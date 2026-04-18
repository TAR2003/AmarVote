# Batch Job Scheduling in AmarVote (Tally + Decryption/Combine)

## Why your system does not behave like plain FIFO queueing

In a plain RabbitMQ setup, if Job A pushes 100 messages first and Job B pushes 100 later, Job B usually waits until many/all A messages are consumed.

Your implementation is different because RabbitMQ is not the only scheduler.

AmarVote uses an application-level scheduler called RoundRobinTaskScheduler that controls how chunks are published into RabbitMQ. Instead of publishing all chunks from one job at once, it publishes chunks in strict round-robin across active task instances.

So behavior is:
- Not FIFO by whole job
- FIFO only for already-published messages inside each RabbitMQ queue
- Fair interleaving at publish time (A1, B1, A2, B2, ... style)

## Core design

The flow is:
1. API/service receives a job request.
2. Job is split into chunks.
3. All chunks are registered as one task instance in RoundRobinTaskScheduler.
4. Scheduler runs every 100ms and publishes chunks fairly across active task instances.
5. Rabbit listeners consume published chunks.
6. Workers update chunk state (PROCESSING, COMPLETED, FAILED) back into scheduler.
7. Scheduler publishes next fair set of chunks.

## Important implementation details

### 1) Task registration (producer side)

Tally creation:
- TallyService does not push all chunks directly to RabbitMQ.
- It builds taskDataList and calls roundRobinTaskScheduler.registerTask(...).

Decryption/combine:
- DecryptionTaskQueueService does the same for:
  - queuePartialDecryptionTasks(...)
  - queueCompensatedDecryptionTasks(...)
  - queueCombineDecryptionTasks(...)
- Each of those methods ends by calling roundRobinTaskScheduler.registerTask(...).

Meaning: all heavy jobs first enter the scheduler, not RabbitMQ directly.

### 2) Fair scheduler loop (the key reason)

RoundRobinTaskScheduler:
- Runs on @Scheduled(fixedDelay = 100)
- Finds all active task instances
- Publishes at most one queued chunk per task instance at a time
- Uses MAX_QUEUED_CHUNKS_PER_TASK = 1
- Rotates starting index each cycle (taskRoundRobinIndex)
- Makes multiple passes per cycle (TARGET_CHUNKS_PER_CYCLE = 8) to keep workers busy

Result:
- One task instance cannot flood the queue.
- New task instances join rotation quickly.
- Long jobs and newer jobs make progress together.

### 3) RabbitMQ worker behavior

From RabbitMQConfig + listeners:
- prefetchCount = 1
- listener concurrency is configurable via rabbitmq.worker.concurrency.min/max
- current application.properties sets min=2, max=2

Why this matters:
- prefetch=1 means each worker takes one message at a time (no hoarding).
- multiple workers allow true parallel progress on interleaved chunks.

## Your exact scenario: Job A starts first, Job B starts 1 minute later

Assume same task type queue (example: combine or tally), and both have 100 chunks.

What happens in AmarVote:
1. Job A registers and starts producing chunks through scheduler.
2. Scheduler keeps at most 1 queued chunk per task instance and rotates.
3. After 1 minute, Job B registers as a new active task instance.
4. In the next scheduler cycles (every 100ms), Job B is included in rotation.
5. Scheduler publishes B chunks without waiting for all A chunks to finish.
6. Workers consume whichever interleaved chunks are in queue.

So Job B starts before A reaches chunk 100. This is expected and designed behavior.

## Tally vs Decryption-Combine phase behavior

### Tally creation
- Chunked and registered into scheduler as TALLY_CREATION.
- Workers process chunk-by-chunk from tally.creation.queue.

### Partial decryption (Phase 1)
- Only partial tasks are queued first.
- After each partial chunk, progress uses Redis atomic counter + one-shot trigger.
- When all partial chunks are done for guardian, phase 2 is triggered once.

### Compensated decryption (Phase 2)
- Queued only after phase 1 completion for that guardian.
- One task instance per target guardian; each has chunk list.
- Also handled by scheduler fairness.

### Combine decryption
- processCombineAsync queues combine tasks via queueCombineDecryptionTasks(...).
- Scheduler registers as COMBINE_DECRYPTION and publishes fairly.
- Worker combines shares chunk-by-chunk.

## Why this architecture was chosen

It solves two production problems:
- Fairness/starvation: long-running job A should not block later job B completely.
- Memory control: one chunk per worker fetch (prefetch=1) and chunk-level processing/cleanup.

## Practical implications for operators

- Seeing interleaving between two jobs is correct in this codebase.
- Queue order alone does not explain execution order, because scheduler controls publish order.
- If you reduce concurrency to 1, parallelism drops, but scheduler fairness logic still exists.
- With concurrency >= 2 (current setting), interleaving is usually visible quickly.

## Source locations

Main logic:
- backend/src/main/java/com/amarvote/amarvote/service/RoundRobinTaskScheduler.java
- backend/src/main/java/com/amarvote/amarvote/config/RabbitMQConfig.java
- backend/src/main/resources/application.properties

Task registration:
- backend/src/main/java/com/amarvote/amarvote/service/TallyService.java
- backend/src/main/java/com/amarvote/amarvote/service/DecryptionTaskQueueService.java

Workers and phase transitions:
- backend/src/main/java/com/amarvote/amarvote/service/TaskWorkerService.java
- backend/src/main/java/com/amarvote/amarvote/service/PartialDecryptionService.java
