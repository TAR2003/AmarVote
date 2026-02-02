# 🔄 Concurrent Round-Robin Processing - Fix Applied

## Problem Description

### The Issue
When multiple guardians submitted their credentials at different times, the system exhibited sequential behavior instead of true concurrent processing:

1. **Guardian A** submits first → Task A starts with 100 chunks
2. Task A processes chunks 1-20 (partial decryption)
3. **Guardian B** submits credentials → Task B created with 100 chunks
4. ❌ **Task B waits** until Task A completes partial decryption
5. Only when Task A moves to compensated decryption does Task B start
6. When Task B finishes partial decryption, it waits again for Task A's compensated decryption to complete

### Root Cause
The system was configured with **only 1 worker** (`rabbitmq.worker.concurrency=1`):
- Even though the `RoundRobinTaskScheduler` published chunks in round-robin order
- Only ONE worker could process chunks at a time
- Worker had to finish Task A's chunk before picking up Task B's chunk
- No true concurrency between tasks

---

## Solution Applied

### Configuration Change
Updated `application.properties`:

```properties
# BEFORE (Sequential Processing)
rabbitmq.worker.concurrency.min=1
rabbitmq.worker.concurrency.max=1

# AFTER (Concurrent Processing)
rabbitmq.worker.concurrency.min=6
rabbitmq.worker.concurrency.max=6
```

### How It Works Now

#### Architecture Overview
```
┌─────────────────────────────────────────────────────────────┐
│           RoundRobinTaskScheduler (Every 100ms)             │
│  Publishes chunks in round-robin order:                     │
│  A-chunk-21, B-chunk-1, A-chunk-22, B-chunk-2, ...          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   RabbitMQ Queue                             │
│  prefetch=1 (Each worker fetches ONE chunk at a time)       │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┬────────────┐
        ▼              ▼              ▼            ▼
    Worker 1       Worker 2       Worker 3    ... Worker 6
    A-chunk-21     B-chunk-1      A-chunk-22      B-chunk-2
```

#### Example Scenario

**Timeline:**
1. Guardian A submits → Task A with 100 chunks
2. Task A processes 20 chunks
3. Guardian B submits → Task B with 100 chunks

**With 6 Workers + prefetch=1:**

| Worker | Chunk Being Processed | Status |
|--------|----------------------|---------|
| Worker 1 | Task A - Chunk 21 | Processing |
| Worker 2 | Task B - Chunk 1 | Processing ✅ |
| Worker 3 | Task A - Chunk 22 | Processing |
| Worker 4 | Task B - Chunk 2 | Processing ✅ |
| Worker 5 | Task A - Chunk 23 | Processing |
| Worker 6 | Task B - Chunk 3 | Processing ✅ |

**Result:** Both tasks progress simultaneously!

---

## Technical Details

### Critical Components

#### 1. Worker Concurrency (FIXED)
- **Setting:** `rabbitmq.worker.concurrency.min=6` and `max=6`
- **Effect:** 6 independent worker threads can process chunks concurrently
- **Benefit:** Multiple tasks can progress at the same time

#### 2. Prefetch Count (UNCHANGED - Must Stay 1)
- **Setting:** `factory.setPrefetchCount(1)` in RabbitMQConfig
- **Effect:** Each worker fetches only ONE chunk at a time
- **Benefit:** Fair distribution, no worker hoards multiple chunks

#### 3. Round-Robin Scheduler (UNCHANGED)
- **Frequency:** Runs every 100ms
- **Algorithm:** Publishes 1 chunk from each active task in rotation
- **Benefit:** Fair chunk distribution across all tasks

### The Magic Formula

```
Multiple Workers + prefetch=1 + Round-Robin Publishing = 
True Concurrent Fair Processing
```

**Why This Works:**
1. **Scheduler** publishes chunks in round-robin: A, B, A, B, A, B...
2. **Queue** holds these chunks in order
3. **Workers** (6 of them) fetch chunks with prefetch=1
   - Worker 1 grabs first available (A-chunk-21)
   - Worker 2 grabs next (B-chunk-1) ← B doesn't wait!
   - Worker 3 grabs next (A-chunk-22)
   - Worker 4 grabs next (B-chunk-2)
   - ... and so on

4. **Result:** Both tasks process concurrently in fair proportion

---

## Performance Impact

### Before Fix (1 Worker)
```
Time →
Task A: ████████████████████░░░░░░░░░░
Task B:                     ████████████████████
        ↑ B waits here
```

### After Fix (6 Workers)
```
Time →
Task A: ████████████░░░░░░
Task B:     ████████████░░░░░░
        ↑ B starts immediately
```

**Benefits:**
- ⚡ **Faster completion:** Tasks finish sooner due to parallel processing
- 🎯 **Fair processing:** No task starves, all make progress
- 📊 **Better UX:** Users see immediate progress, no long waits
- 💪 **Scalability:** Can handle more simultaneous guardians

### Throughput Comparison

| Scenario | 1 Worker | 6 Workers |
|----------|----------|-----------|
| Single Task (100 chunks) | ~100 time units | ~100 time units* |
| Two Tasks (100 chunks each) | ~200 time units | ~100-120 time units* |
| Three Tasks (100 chunks each) | ~300 time units | ~100-150 time units* |

*Assuming chunks take similar processing time. Actual speedup depends on chunk processing duration.

---

## Code Changes

### 1. application.properties
```properties
# Updated worker concurrency from 1 to 6
rabbitmq.worker.concurrency.min=6
rabbitmq.worker.concurrency.max=6
```

### 2. RabbitMQConfig.java
- ✅ Enhanced documentation explaining concurrent processing
- ✅ Added detailed examples of how workers interact
- ✅ Clarified the role of prefetch=1 in fair scheduling

### 3. RoundRobinTaskScheduler.java
- ✅ Improved logging to show concurrent task processing
- ✅ Added documentation explaining fairness with concurrency
- ✅ Enhanced progress tracking in logs

---

## Verification Steps

### How to Verify the Fix Works

1. **Start the application** with updated configuration

2. **Check startup logs** for:
   ```
   ⚙️ RabbitMQ Worker Concurrency configured: min=6, max=6
   ⚠️ PREFETCH COUNT: 1 (ENFORCED - critical for fair scheduling)
   ✅ Multiple workers + prefetch=1 = Concurrent round-robin processing!
   ```

3. **Test scenario:**
   - Guardian A submits credentials
   - Wait for 20-30 chunks to process
   - Guardian B submits credentials
   - **Expected:** B's progress starts immediately, not after A completes

4. **Check logs** for concurrent processing:
   ```
   🔄 ROUND-ROBIN: 2 active tasks being processed concurrently
     - Task: partial_decryption_e1_g1_... | Progress: 25/100 | Processing: 3 | Queued: 3
     - Task: partial_decryption_e1_g2_... | Progress: 5/100 | Processing: 2 | Queued: 2
   📤 Published chunk from Task partial_decryption_e1_g1... - Workers can process concurrently
   📤 Published chunk from Task partial_decryption_e1_g2... - Workers can process concurrently
   ```

5. **Monitor progress:** Both guardians should show simultaneous progress increments

---

## Configuration Tuning

### Adjusting Worker Count

The worker count can be adjusted based on:

1. **System Resources**
   - More workers = More memory usage
   - Each worker maintains JVM state
   - Recommended: Monitor memory during peak load

2. **Number of Simultaneous Users**
   - 2-3 guardians: 4-6 workers sufficient
   - 4-6 guardians: 6-8 workers recommended
   - 7+ guardians: 8-12 workers

3. **Chunk Processing Time**
   - Fast chunks (<1s): Fewer workers needed
   - Slow chunks (>5s): More workers beneficial

### Recommended Settings by Scenario

| Scenario | Min Workers | Max Workers | Rationale |
|----------|-------------|-------------|-----------|
| Development | 4 | 4 | Lower memory usage |
| Small Elections (2-3 guardians) | 4 | 6 | Balanced |
| Medium Elections (4-6 guardians) | 6 | 8 | Optimal concurrency |
| Large Elections (7+ guardians) | 8 | 12 | Maximum throughput |

### Warning: Don't Change prefetch!

⚠️ **NEVER modify `factory.setPrefetchCount(1)`**

Setting prefetch > 1 will:
- ❌ Break fair scheduling
- ❌ Allow workers to hoard chunks
- ❌ Cause task starvation
- ❌ Defeat the round-robin algorithm

The entire fairness guarantee depends on prefetch=1.

---

## Comparison: Old vs New Behavior

### Scenario: Two Guardians Submit Credentials

#### OLD BEHAVIOR (1 Worker)
```
Timeline:
t=0:  Guardian A submits → Task A created (100 chunks)
t=1:  Worker processes A-chunk-1
t=2:  Worker processes A-chunk-2
...
t=20: Worker processes A-chunk-20
t=21: Guardian B submits → Task B created (100 chunks)
t=22: Scheduler publishes A-chunk-21, B-chunk-1
t=23: Worker processes A-chunk-21 (B-chunk-1 waits in queue)
t=24: Worker processes B-chunk-1 (finally!)
t=25: Worker processes A-chunk-22
...

Problem: B waits, sequential processing despite round-robin publishing
```

#### NEW BEHAVIOR (6 Workers)
```
Timeline:
t=0:  Guardian A submits → Task A created (100 chunks)
t=1:  Workers 1-6 process A-chunks 1-6 simultaneously
t=2:  Workers 1-6 process A-chunks 7-12 simultaneously
...
t=4:  Workers 1-6 process A-chunks 19-24 simultaneously
t=5:  Guardian B submits → Task B created (100 chunks)
t=6:  Scheduler publishes A-chunk-25, B-chunk-1, A-chunk-26, B-chunk-2...
      Worker 1: A-chunk-25
      Worker 2: B-chunk-1 ← B starts immediately!
      Worker 3: A-chunk-26
      Worker 4: B-chunk-2
      Worker 5: A-chunk-27
      Worker 6: B-chunk-3

Result: Both tasks progress concurrently, no waiting!
```

---

## Benefits Summary

### For Guardians
- ✅ Immediate processing when credentials submitted
- ✅ No waiting for other guardians to complete
- ✅ Fair progress across all guardians
- ✅ Faster overall decryption process

### For System
- ✅ Better resource utilization
- ✅ Predictable performance
- ✅ Scalable to multiple simultaneous users
- ✅ Maintains fairness guarantees

### For Administrators
- ✅ Configurable worker count
- ✅ Clear monitoring through logs
- ✅ Tunable based on load
- ✅ Well-documented behavior

---

## Related Files

- [application.properties](../backend/src/main/resources/application.properties) - Worker concurrency settings
- [RabbitMQConfig.java](../backend/src/main/java/com/amarvote/amarvote/config/RabbitMQConfig.java) - Queue and worker configuration
- [RoundRobinTaskScheduler.java](../backend/src/main/java/com/amarvote/amarvote/service/RoundRobinTaskScheduler.java) - Round-robin scheduling logic
- [FAIR_ROUND_ROBIN_IMPLEMENTATION_COMPLETE.md](FAIR_ROUND_ROBIN_IMPLEMENTATION_COMPLETE.md) - Original round-robin implementation

---

## Troubleshooting

### Issue: Tasks Still Process Sequentially

**Check:**
1. Verify worker concurrency in logs:
   ```
   ⚙️ RabbitMQ Worker Concurrency configured: min=6, max=6
   ```
2. If shows `min=1, max=1`, application.properties not loaded correctly
3. Restart application to apply changes

### Issue: High Memory Usage

**Solutions:**
1. Reduce worker count: `rabbitmq.worker.concurrency.min=4`
2. Monitor heap size with `-Xmx` JVM parameter
3. Enable garbage collection logging

### Issue: One Task Still Starves

**Check:**
1. Verify prefetch=1 in logs:
   ```
   ⚠️ PREFETCH COUNT: 1 (ENFORCED - critical for fair scheduling)
   ```
2. Check RoundRobinTaskScheduler logs for round-robin publishing
3. Ensure both tasks are "active" (not failed/completed)

---

## Implementation Status

- ✅ Worker concurrency increased to 6
- ✅ Documentation updated with examples
- ✅ Logging enhanced for monitoring
- ✅ prefetch=1 maintained (critical)
- ✅ Round-robin scheduler unchanged (working correctly)
- ✅ Backward compatible (can tune worker count as needed)

---

**Fix Applied:** February 2, 2026  
**Status:** ✅ Complete and Tested  
**Impact:** High - Significantly improves concurrent processing fairness
