# 🐰 RabbitMQ Worker Architecture

**Technology:** RabbitMQ 3.13 · Spring AMQP  
**AMQP Port:** `5672` · **Management UI Port:** `15672`  
**Dev Network IP:** `172.20.0.60` · **Prod Network IP:** `172.20.0.25`  
**Memory Limit (prod):** `512 MiB`  
**Management UI:** `http://localhost:15672` (credentials: `guest` / `guest`)

---

## Table of Contents

1. [Why RabbitMQ?](#why-rabbitmq)
2. [Architecture Overview](#architecture-overview)
3. [Queue Topology](#queue-topology)
4. [RoundRobinTaskScheduler](#roundrobintaskscheduler)
5. [Worker Implementation](#worker-implementation)
6. [Message Formats](#message-formats)
7. [Phase Pipeline](#phase-pipeline)
8. [Memory Management](#memory-management)
9. [Failure Handling & Retry](#failure-handling--retry)
10. [Configuration](#configuration)
11. [Monitoring](#monitoring)

---

## Why RabbitMQ?

Large-scale elections with 10,000+ ballots require processing hundreds of cryptographic chunks. Without task queuing:

- A single HTTP request would attempt to process all chunks in one Spring thread → **OutOfMemoryError**
- Concurrent guardian decryptions would compete for the same JVM heap
- No retry capability on cryptographic failures

**RabbitMQ provides:**
- Durable message queuing — tasks survive service restarts
- `prefetch=1` per consumer — natural backpressure (consumer only takes next task when previous is done)
- Fair round-robin across elections — no single election can monopolize all workers
- Automatic message requeue on consumer crash (if `defaultRequeueRejected=true`)
- Management UI for real-time queue depth monitoring

---

## Architecture Overview

```
Election Admin triggers tally/decryption
        │
        ▼
RoundRobinTaskScheduler  (in-memory, @Scheduled 100ms)
        │
        │  publishes 1 chunk/election/pass
        ▼
  ┌─────────────────────────────────────┐
  │         task.exchange (Direct)       │
  └─────────────────────────────────────┘
        │ routing keys
        ├──► task.tally.creation        ──► tally.creation.queue
        ├──► task.partial.decryption    ──► partial.decryption.queue
        ├──► task.compensated.decryption──► compensated.decryption.queue
        └──► task.combine.decryption    ──► combine.decryption.queue
                                                    │
                                                    │ prefetch=1
                                                    ▼
                                         TaskWorkerService
                                         (4 @RabbitListener methods,
                                          4 concurrent consumers each)
                                                    │
                                                    ▼
                                         ElectionGuard Worker
                                         http://electionguard-worker:5001
```

---

## Queue Topology

**Exchange:** `task.exchange`
- Type: `Direct`
- Durable: `true`
- Auto-delete: `false`

| Queue | Routing Key | Consumer Method | Concurrency | Purpose |
|---|---|---|---|---|
| `tally.creation.queue` | `task.tally.creation` | `processTallyCreationTask` | 4 min/max | Converts ballot ciphertexts → encrypted tally chunk |
| `partial.decryption.queue` | `task.partial.decryption` | `processPartialDecryptionTask` | 4 min/max | Guardian partial decryption of one tally chunk |
| `compensated.decryption.queue` | `task.compensated.decryption` | `processCompensatedDecryptionTask` | 4 min/max | Compensation for absent guardian on one chunk |
| `combine.decryption.queue` | `task.combine.decryption` | `processCombineDecryptionTask` | 4 min/max | Assembles final results from all shares |

**Critical settings:**
- `prefetchCount = 1` — Each consumer only holds one unacknowledged message at a time → ensures `prefetch=1` round-robin fairness
- `defaultRequeueRejected = false` — Failed messages go to dead-letter (not requeued infinitely)
- All queues are **durable** — survive RabbitMQ restarts

---

## RoundRobinTaskScheduler

`RoundRobinTaskScheduler` is the in-memory task orchestration engine. It sits between the business layer (which registers tasks) and RabbitMQ (which executes them).

### Why Not Just Publish All Chunks Immediately?

If election A has 500 chunks and election B has 10 chunks, publishing all 500 chunks first would delay election B entirely. The scheduler ensures **interleaved fairness**: `1 chunk from election A, 1 from election B, 1 from A, 1 from B, ...`

### Key Constants

| Constant | Value | Meaning |
|---|---|---|
| `MAX_QUEUED_CHUNKS_PER_TASK` | `1` | Max in-flight messages per task instance |
| `TARGET_CHUNKS_PER_CYCLE` | `8` | Processing passes per 100ms scheduler tick |
| `MAX_RETRY_ATTEMPTS` | `3` | Retries before permanent failure |
| `INITIAL_RETRY_DELAY_MS` | `5000` | First retry: 5 seconds |

### Scheduling Loop (100ms interval)

```
Every 100ms:
  1. Get all active task instances
  2. For up to TARGET_CHUNKS_PER_CYCLE passes:
     3. For each active task (in round-robin order from taskRoundRobinIndex):
        4. If task.currentlyQueued < MAX_QUEUED_CHUNKS_PER_TASK:
           5. Pop next PENDING chunk
           6. Mark chunk as QUEUED
           7. Publish via TaskPublisherService
  8. Increment taskRoundRobinIndex for next cycle
```

### Task State Machine

```
PENDING
  │ scheduler picks up chunk
  ▼
QUEUED
  │ worker picks up from RabbitMQ
  ▼
PROCESSING
  ├─ success ──► COMPLETED
  └─ failure ──► FAILED
                   │ retry (if attempts < MAX_RETRY_ATTEMPTS)
                   │ exponential backoff: 5s, 10s, 20s
                   ▼
                PENDING (reset for retry)
                   │ after MAX_RETRY_ATTEMPTS
                   ▼
              PERMANENTLY_FAILED
```

### Task Instance ID Format

```
{taskType}_e{electionId}[_g{guardianId}][_sg{sourceId}][_tg{targetId}]_{timestamp}
```

Examples:
- `TALLY_e42_1704067200000`
- `PARTIAL_DECRYPT_e42_g3_1704067200000`
- `COMPENSATED_DECRYPT_e42_sg2_tg3_1704067200000`
- `COMBINE_e42_1704067200000`

### Public API

| Method | Description |
|---|---|
| `registerTask(type, electionId, guardianId, srcGuardianId, tgtGuardianId, chunks)` | Registers task, returns `taskInstanceId` |
| `updateChunkState(chunkId, newState, errorMessage)` | Called by workers to report progress |
| `getTaskProgress(taskInstanceId)` | Returns `TaskProgress { total, completed, failed, pending }` |
| `getElectionProgress(electionId)` | Returns list of all task progresses for an election |
| `getSystemStatistics()` | Returns active instances, queued/completed/failed counts per task type |

**10-second diagnostic log** produced via separate `@Scheduled(fixedDelay=10000)` method.

---

## Worker Implementation

`TaskWorkerService` contains four `@RabbitListener` consumer methods. All follow the same pattern:

### Common Worker Pattern

```java
@RabbitListener(queues = "tally.creation.queue", 
                concurrency = "${rabbitmq.worker.concurrency.min}-${rabbitmq.worker.concurrency.max}")
public void processTallyCreationTask(TallyCreationTask task) {
    String lockKey = "tally_" + electionId + "_chunk_" + chunkNum;
    
    // 1. Distributed lock via ConcurrentHashMap (prevents duplicate processing)
    if (processingLocks.putIfAbsent(lockKey, Boolean.TRUE) != null) {
        log.warn("Chunk already being processed: {}", lockKey);
        return;
    }
    
    try {
        // 2. Create DB worker log entry (IN_PROGRESS)
        TallyWorkerLog log = createWorkerLog(task, IN_PROGRESS);
        
        // 3. Perform work (HTTP call to ElectionGuard worker)
        ElectionGuardTallyResponse response = electionGuardService.createEncryptedTally(request);
        
        // 4. Save results to DB
        saveResults(response);
        
        // 5. Update worker log (COMPLETED)
        updateWorkerLog(log, COMPLETED);
        
        // 6. Report to scheduler
        scheduler.updateChunkState(task.getChunkId(), COMPLETED, null);
        
    } catch (Exception e) {
        updateWorkerLog(log, FAILED, e.getMessage());
        scheduler.updateChunkState(task.getChunkId(), FAILED, e.getMessage());
    } finally {
        processingLocks.remove(lockKey); // Always release lock
        
        // Memory cleanup
        entityManager.flush();
        entityManager.clear();
        System.gc();
    }
}
```

### Phase Completion Triggers

**After all partial decryption chunks complete (Phase 1 → Phase 2):**

```java
private void updatePartialDecryptionProgress(electionId, guardianId, totalChunks) {
    // Atomic increment in Redis
    long completed = redis.increment("partial_progress:" + electionId + ":" + guardianId);
    
    if (completed == totalChunks) {
        // SET NX trigger guard (prevents double initiation even if two workers
        // complete the last chunk simultaneously)
        Boolean triggered = redis.setIfAbsent("partial_triggered:" + electionId + ":" + guardianId, "1");
        if (Boolean.TRUE.equals(triggered)) {
            // Queue Phase 2: compensated decryption tasks
            decryptionTaskQueueService.queueCompensatedDecryptionTasks(electionId, guardianId);
        }
    }
}
```

**After all compensated decryption chunks complete:**

```java
private void updateCompensatedDecryptionProgress(...) {
    // Similar atomic pattern
    if (allDone) {
        credentialCacheService.clearCredentials(electionId, guardianId);  // Purge Redis key
        markGuardianAsDecrypted(guardianId);  // Set decrypted_or_not = true in DB
    }
}
```

---

## Message Formats

### `TallyCreationTask`

```json
{
  "electionId": 42,
  "chunkNumber": 1,
  "chunkId": "TALLY_e42_1704..._chunk_1",
  "taskInstanceId": "TALLY_e42_1704...",
  "ballotIds": [101, 102, 103, ...],
  "jointPublicKey": "decimal string",
  "commitmentHash": "decimal string",
  "manifest": "base64-msgpack encoded"
}
```

### `PartialDecryptionTask`

```json
{
  "electionId": 42,
  "guardianId": 3,
  "chunkNumber": 1,
  "chunkId": "...",
  "taskInstanceId": "...",
  "guardianPrivateKey": "(retrieved from Redis at processing time)",
  "electionCenterId": 5,
  "totalChunks": 25
}
```

### `CompensatedDecryptionTask`

```json
{
  "electionId": 42,
  "compensatingGuardianId": 2,
  "missingGuardianId": 3,
  "chunkNumber": 1,
  "polynomialBackup": "base64-msgpack of backup polynomial"
}
```

### `CombineDecryptionTask`

```json
{
  "electionId": 42,
  "chunkNumber": 1,
  "decryptionShares": [...],
  "compensatedShares": [...],
  "tallyChunkData": "..."
}
```

---

## Phase Pipeline

The complete decryption pipeline from tally initiation to results:

```
[Admin: Initiate Tally]
  │
  ├─ ChunkingService: shuffles ballots, divides into 200-ballot chunks
  ├─ RoundRobinTaskScheduler: registers TALLY task with N chunks
  └─ Scheduler publishes chunks → tally.creation.queue
         │
         ▼ (4 concurrent consumers)
  [Workers: POST /create_encrypted_tally for each chunk]
  [Saves encrypted_tally to election_center table]
         │
[Guardian 1: Initiate Decryption]  [Guardian 2: same]  [Guardian N: same]
  │                                  │                    │
  ├─ Decrypt PQ-wrapped private key  │                    │
  ├─ Store key in Redis (6h TTL)      │                    │
  └─ Register PARTIAL task chunks     │                    │
         │                             │                    │
         ▼ (all guardians in parallel) │                    │
  [Workers: POST /create_partial_decryption for each chunk]
  [Redis INCR completion counter per (election, guardian)]
         │
  [Redis INCR reaches totalChunks]
  [SET NX guard triggers Phase 2]
         │
         ▼
  [Workers: POST /create_compensated_decryption]
  (only if some guardians absent; present guardians compensate)
         │
  [After compensation complete:]
  [Redis credentials cleared]
  [guardian.decrypted_or_not = true]
         │
[Admin: Initiate Combine]
  │
  ├─ Gather all Decryption + CompensatedDecryption records
  └─ Register COMBINE task chunks
         │
         ▼
  [Workers: POST /combine_decryption_shares for each chunk]
  [Saves final election_result JSON to election_center]
         │
         ▼
  [Results available at GET /api/election/{id}/results]
```

---

## Memory Management

**The #1 design goal of the worker architecture is stable memory on 4 GB servers.**

After each chunk is processed:

```java
// 1. Flush pending Hibernate writes
entityManager.flush();

// 2. Clear Hibernate L1 cache (evicts all loaded entities)
entityManager.clear();

// 3. Hint JVM to GC (not guaranteed but helps timing)
System.gc();

// 4. Null out local references (aids GC)
request = null;
response = null;
ballotList = null;
```

Without this cleanup, processing 1000 chunks would load 200,000 ballot rows into Hibernate's first-level cache, exhausting JVM heap.

---

## Failure Handling & Retry

### Worker-Level Failures

If an HTTP call to ElectionGuard fails:
1. Worker logs error to `tally_worker_log` / `decryption_worker_log` / `combine_worker_log`
2. Reports `FAILED` state to `RoundRobinTaskScheduler`
3. Scheduler schedules retry after exponential backoff:
   - Attempt 1: 5s delay
   - Attempt 2: 10s delay
   - Attempt 3: 20s delay
   - After 3 failures: marks permanently FAILED

### Compensated Decryption — Extra Retry

`processCompensatedDecryptionTask` has its own application-level retry:
```java
int maxAttempts = 3;
long baseDelay = 2000; // 2s
for (int attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
        response = electionGuardService.createCompensatedDecryption(request);
        break; // success
    } catch (Exception e) {
        if (attempt < maxAttempts) {
            Thread.sleep(baseDelay * attempt);  // 2s, 4s, 6s
        }
    }
}
```

### RabbitMQ Message Acknowledgment

- `defaultRequeueRejected = false` — messages that throw exceptions are NOT requeued automatically
- Retry is handled at the application level by the scheduler, not by RabbitMQ
- This prevents poison message loops

---

## Configuration

### `rabbitmq.conf`

```properties
vm_memory_high_watermark.relative = 0.4  # Trigger flow control at 40% RAM
disk_free_limit.absolute = 1GB           # Minimum free disk required
default_vhost = /
management.tcp.port = 15672
listeners.tcp.default = 5672
log.file.level = info
log.console = true
log.console.level = info
num_acceptors.tcp = 10
```

### Spring Configuration (`application.properties`)

```properties
spring.rabbitmq.host=${RABBITMQ_HOST:rabbitmq}
spring.rabbitmq.port=${RABBITMQ_PORT:5672}
spring.rabbitmq.username=${RABBITMQ_USERNAME:guest}
spring.rabbitmq.password=${RABBITMQ_PASSWORD:guest}
rabbitmq.worker.concurrency.min=4
rabbitmq.worker.concurrency.max=4
```

---

## Monitoring

**Management UI** available at `http://localhost:15672`:
- Queue depth per queue (should stay near 0 during active processing)
- Message rates (publish rate, deliver rate, ack rate)
- Consumer count per queue
- Memory and disk alarms

**Prometheus metrics** (via Spring Boot Actuator + Micrometer):
- `rabbitmq.published{queue}` — messages published per queue
- `rabbitmq.consumed{queue}` — messages consumed per queue
- `rabbitmq.failed{queue}` — failed messages
- Visible in Grafana dashboard under "RabbitMQ" panel
