# 💾 Redis Service

**Technology:** Redis 7 Alpine  
**Port:** `6379`  
**Dev Network IP:** `172.20.0.70` · **Prod Network IP:** `172.20.0.75`  
**Memory Limit:** `256 MiB`  
**Eviction Policy:** `allkeys-lru` (least recently used eviction when memory cap reached)

---

## Overview

Redis serves three distinct roles in AmarVote:

1. **Guardian Credential Cache** — Temporary storage of decrypted private keys during election decryption (6-hour TTL)
2. **Phase Completion Counters** — Atomic increment counters to track chunk-level progress across worker threads
3. **Distributed Locks & Once-Only Guards** — SET NX to prevent double-processing or double-triggering

---

## Role 1: Guardian Credential Cache

Managed by `CredentialCacheService.java`

### Why Redis for Keys?

Guardian private keys are decrypted from ML-KEM-1024-wrapped storage when a guardian submits their credentials. These keys must be available to multiple RabbitMQ worker threads over the course of a multi-hour decryption process. In-memory JVM storage would not survive restarts and is not shared between worker instances.

Redis provides:
- **TTL expiration** — keys automatically expire after 6 hours
- **Thread safety** — atomic Redis operations
- **External access** — multiple JVM worker instances can access the same key

### Key Schema

| Redis Key | Value | TTL | Description |
|---|---|---|---|
| `guardian:privatekey:{electionId}:{guardianId}` | Decrypted private key (decimal string, ~1240 chars) | 360 min (6h) | Guardian's ElectionGuard private key |
| `guardian:polynomial:{electionId}:{guardianId}` | Polynomial data (JSON string) | 360 min (6h) | Guardian's polynomial for compensated decryption |

### Operations

```java
// Store when guardian submits credentials
credentialCacheService.storePrivateKey(electionId, guardianId, decryptedKey);
credentialCacheService.storePolynomial(electionId, guardianId, polynomialJson);

// Retrieve when worker processes a chunk
String privateKey = credentialCacheService.getPrivateKey(electionId, guardianId);
String polynomial = credentialCacheService.getPolynomial(electionId, guardianId);

// Check existence before queuing chunks
if (credentialCacheService.hasCredentials(electionId, guardianId)) { ... }

// Clear after all chunks are processed (explicit cleanup before TTL)
credentialCacheService.clearCredentials(electionId, guardianId);
```

### Security Notes

- Keys are only stored after PQ-decryption, never the PQ-wrapped form
- 6-hour TTL prevents stale keys from persisting indefinitely
- Keys are explicitly cleared via `clearCredentials()` at the end of successful decryption — TTL serves as safety net
- Redis is on the internal Docker network only, not exposed externally
- In production, Redis password should be set via `SPRING_REDIS_PASSWORD`

---

## Role 2: Phase Completion Counters

These counters enable the workers to **self-coordinate** Phase 1 → Phase 2 transitions without a central coordinator polling the database.

### Counter Schema

| Redis Key | Type | TTL | Description |
|---|---|---|---|
| `partial_progress:{electionId}:{guardianId}` | Counter (INCR) | 4h | Count of completed partial decryption chunks |
| `compensated_progress:{electionId}` | Counter (INCR) | 4h | Count of completed compensated decryption chunks |
| `partial_triggered:{electionId}:{guardianId}` | Flag (SET NX) | 4h | "Phase 2 already triggered" guard |
| `compensated_triggered:{electionId}` | Flag (SET NX) | 4h | "Combine already triggered" guard |

### How It Works

```java
// Worker completes one partial decryption chunk:
long completed = redisTemplate.opsForValue().increment(
    "partial_progress:" + electionId + ":" + guardianId
);

if (completed == totalChunks) {
    // Exactly-once trigger: SET NX returns TRUE only to first caller
    Boolean isFirst = redisTemplate.opsForValue().setIfAbsent(
        "partial_triggered:" + electionId + ":" + guardianId, "1"
    );
    if (Boolean.TRUE.equals(isFirst)) {
        // This worker (and only this worker) queues Phase 2 tasks
        decryptionTaskQueueService.queueCompensatedDecryptionTasks(electionId, guardianId);
    }
}
```

This pattern is **race-condition safe**: even if two workers simultaneously complete the last chunk and both call `INCR`, only one will successfully `SET NX` and trigger Phase 2.

---

## Role 3: Distributed Locks

Managed by `RedisLockService.java`

Used to prevent duplicate chunk processing in edge cases where a worker restart might pick up an already-in-progress message.

```java
// Acquire lock (SET NX EX 300 → 5-minute lock)
Boolean acquired = redisLockService.acquireLock(lockKey, 300);

// Application-level double-check (ConcurrentHashMap) also used in workers
if (processingLocks.putIfAbsent(lockKey, Boolean.TRUE) != null) {
    return; // already being processed
}
```

---

## Configuration

### Docker Compose (Dev)

```yaml
redis:
  image: redis:7-alpine
  command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
  ports:
    - "6379:6379"
  volumes:
    - redis_data:/data
```

### Docker Compose (Prod)

```yaml
redis:
  image: redis:7-alpine
  command: >
    redis-server
    --maxmemory 256mb
    --maxmemory-policy allkeys-lru
    --appendonly yes
  mem_limit: 256m
```

### Spring `application.properties`

```properties
spring.data.redis.host=${SPRING_REDIS_HOST:redis}
spring.data.redis.port=${SPRING_REDIS_PORT:6379}
spring.data.redis.password=${SPRING_REDIS_PASSWORD:}
spring.data.redis.timeout=2000ms
```

### `RedisConfig.java`

Configures `RedisTemplate<String, String>` with `StringRedisSerializer` for both keys and values:

```java
@Bean
public RedisTemplate<String, String> redisTemplate(RedisConnectionFactory factory) {
    RedisTemplate<String, String> template = new RedisTemplate<>();
    template.setConnectionFactory(factory);
    template.setKeySerializer(new StringRedisSerializer());
    template.setValueSerializer(new StringRedisSerializer());
    return template;
}
```

---

## Memory Sizing

**256 MB Redis for AmarVote is sufficient because:**

| Data Type | Estimated Size | Example |
|---|---|---|
| One guardian private key | ~2 KB | 1240-char decimal string |
| One polynomial | ~5 KB | JSON with coefficients |
| 10 guardian keys + polynomials | ~70 KB | |
| Phase completion counters | <1 KB | Small integers |
| Distributed lock keys | <1 KB | Small flags |
| **Total typical usage** | **<100 KB** | Well within 256 MB |

Redis `allkeys-lru` eviction is a safety net — in normal operation, explicit `clearCredentials()` calls and TTL expiration keep memory usage minimal.
