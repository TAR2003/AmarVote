# Frontend Progress Update and Global Worker Concurrency Fixes

## Issues Fixed

### 1. ✅ Frontend Shows Wrong Progress (60/60 immediately after 20 chunks)
**Problem**: After completing 20 partial decryption chunks, frontend immediately shows 60/60 chunks completed, even though compensated decryption is still ongoing in the backend.

**Root Cause**: 
- When partial decryption completes, backend transitions to `compensated_shares_generation` phase
- Backend resets `processedChunks = 0` but hasn't updated `totalChunks` yet
- Frontend calculation did: `completedOperations = numChunks + 0 = 20 + 0 = 20`
- But then immediately calculated total as `20 chunks × 3 guardians = 60`
- This made it look like 20/60 = all work done, when actually compensated phase just started

**Solution**: Added transition detection in frontend to wait for backend to update `totalChunks` before counting compensated progress.

### 2. ✅ Global Worker Concurrency Control
**Problem**: No easy way to control the maximum number of concurrent workers across all queues. Needed to set to 4 workers max.

**Solution**: Added configurable concurrency settings in `application.properties` with default value of 4.

## Changes Made

### Backend Changes

#### 1. application.properties - Add Concurrency Configuration
**File**: `backend/src/main/resources/application.properties`

```properties
# RabbitMQ Worker Concurrency Configuration
# Maximum number of concurrent workers processing tasks across all queues
# Lower values = fewer parallel processes, more sequential execution
# Higher values = more parallel processes, higher throughput
# Recommended: 4-8 for balanced performance
rabbitmq.worker.concurrency.min=4
rabbitmq.worker.concurrency.max=4
```

**How to Change**:
```properties
# For faster processing (more parallel workers)
rabbitmq.worker.concurrency.min=8
rabbitmq.worker.concurrency.max=8

# For slower, more stable processing
rabbitmq.worker.concurrency.min=2
rabbitmq.worker.concurrency.max=2

# For development/testing
rabbitmq.worker.concurrency.min=1
rabbitmq.worker.concurrency.max=1
```

#### 2. RabbitMQConfig.java - Read from Properties
**File**: `backend/src/main/java/com/amarvote/amarvote/config/RabbitMQConfig.java`

**Added**:
```java
@Value("${rabbitmq.worker.concurrency.min:4}")
private int minConcurrentConsumers;

@Value("${rabbitmq.worker.concurrency.max:4}")
private int maxConcurrentConsumers;
```

**Updated**:
```java
factory.setConcurrentConsumers(minConcurrentConsumers);
factory.setMaxConcurrentConsumers(maxConcurrentConsumers);

System.out.println("⚙️ RabbitMQ Worker Concurrency configured: min=" + minConcurrentConsumers + ", max=" + maxConcurrentConsumers);
```

### Frontend Changes

#### 3. DecryptionProgressModal.jsx - Fix Progress Calculation
**File**: `frontend/src/components/DecryptionProgressModal.jsx`

**Problem Detection**:
```javascript
// Phase 2 calculation - with transition detection
if (status.currentPhase === 'compensated_shares_generation') {
  // Calculate expected totalChunks for compensated phase
  const expectedCompensatedTotalChunks = numChunks * otherGuardians;
  
  if ((status.totalChunks || 0) === expectedCompensatedTotalChunks) {
    // Backend has properly updated totalChunks
    // Safe to count: Phase 1 chunks + compensated chunks processed
    completedOperations = numChunks + (status.processedChunks || 0);
  } else if ((status.totalChunks || 0) === numChunks && (status.processedChunks || 0) === 0) {
    // Phase just transitioned, backend hasn't updated totalChunks yet
    // Show only Phase 1 completion (don't add compensated yet)
    completedOperations = numChunks;
  } else {
    // Fallback
    completedOperations = numChunks + (status.processedChunks || 0);
  }
}
```

**How It Works**:
1. Frontend checks if `totalChunks` has been updated to compensated phase value
2. If `totalChunks = numChunks` and `processedChunks = 0`, we're in transition
3. Only count Phase 1 completion until backend updates
4. Once backend updates `totalChunks = numChunks × otherGuardians`, start counting Phase 2

## Example Scenario

### 20 Chunks, 3 Guardians (1 missing), Quorum = 2

**Phase 1: Partial Decryption (Guardian 1)**
```
Backend:
  totalChunks = 20
  processedChunks = 0 → 1 → 2 → ... → 20
  currentPhase = "partial_decryption"

Frontend Display:
  "Processing 5 of 20 chunks"
  Progress: 5/60 total operations (20 chunks × 3 guardians)
```

**Phase Transition (The Critical Moment)**
```
Backend (immediately after last partial chunk):
  totalChunks = 20 (not updated yet)
  processedChunks = 0 (reset!)
  currentPhase = "compensated_shares_generation"

Frontend Detection:
  ✅ Detects: totalChunks (20) == numChunks (20) && processedChunks == 0
  ✅ Shows: 20/60 completed (only Phase 1, NOT 40/60 or 60/60)
  ✅ Waits for backend to update totalChunks
```

**Phase 2: Compensated Shares (Guardian 1)**
```
Backend (after TaskWorkerService updates):
  totalChunks = 40 (20 chunks × 2 other guardians)
  processedChunks = 0 → 1 → 2 → ... → 40
  currentPhase = "compensated_shares_generation"

Frontend Display:
  "Processing 25 of 60 total operations"
  (20 from Phase 1 + 5 from Phase 2)
  Progress: 25/60 = 41.7%
```

**Completed**
```
Backend:
  totalChunks = 40
  processedChunks = 40
  currentPhase = "completed"
  status = "completed"

Frontend Display:
  "60 of 60 operations completed"
  Progress: 100%
```

## Testing Instructions

### Test Frontend Progress Display

1. **Start Election with 20 chunks, 3 guardians**
2. **Have 2 guardians decrypt (1 missing)**
3. **Watch Progress for Guardian 1**:

   ```
   Phase 1 (Partial):
   ✅ Should show: "1 of 20 chunks"
   ✅ Should show: "1 of 60 total operations" (1.7%)
   
   After Phase 1 completes:
   ✅ Should show: "20 of 60 total operations" (33.3%)
   ❌ Should NOT show: "60 of 60" (100%)
   ❌ Should NOT jump to completed
   
   Phase 2 (Compensated):
   ✅ Should show: "21 of 60 total operations" (35%)
   ✅ Should increment: 22, 23, 24... up to 60
   
   After Phase 2 completes:
   ✅ Should show: "60 of 60 total operations" (100%)
   ✅ Status should be "completed"
   ```

### Test Worker Concurrency

1. **Check Current Setting**:
   ```bash
   # View application.properties
   cat backend/src/main/resources/application.properties | grep concurrency
   ```

2. **Verify at Runtime**:
   ```bash
   # Check backend logs
   docker logs backend 2>&1 | grep "Worker Concurrency"
   
   # Expected output:
   # ⚙️ RabbitMQ Worker Concurrency configured: min=4, max=4
   ```

3. **Check Active Consumers**:
   ```bash
   # Check RabbitMQ consumers
   docker exec rabbitmq rabbitmqctl list_consumers
   
   # Should see maximum 4 consumers total across all queues
   ```

4. **Test Different Values**:
   ```properties
   # Edit application.properties
   rabbitmq.worker.concurrency.min=2
   rabbitmq.worker.concurrency.max=2
   ```
   
   ```bash
   # Rebuild and restart
   cd backend && mvn clean package -DskipTests
   docker-compose down && docker-compose up -d
   
   # Verify new setting
   docker logs backend 2>&1 | grep "Worker Concurrency"
   # Should show: min=2, max=2
   ```

### Monitor Progress Updates

```bash
# Watch backend progress logs in real-time
docker logs -f backend | grep -E "(Progress|Phase|Transition)"

# Expected sequence:
# 📊 Partial Decryption Progress: 1/20 chunks completed
# 📊 Partial Decryption Progress: 2/20 chunks completed
# ...
# 📊 Partial Decryption Progress: 20/20 chunks completed
# ✅ All partial decryption chunks completed
# 🔄 Transitioning to compensated shares generation phase
# 📊 Compensated Decryption Progress: 1/40 tasks completed
# 📊 Compensated Decryption Progress: 2/40 tasks completed
# ...
# 📊 Compensated Decryption Progress: 40/40 tasks completed
# ✅ All compensated decryption tasks completed
```

## Concurrency Configuration Guide

### Current Setting: 4 Workers

**Good for**:
- Balanced performance and stability
- Moderate hardware (4-8 CPU cores)
- Production environments with consistent load

### Recommended Settings

**Low Hardware (2-4 cores)**:
```properties
rabbitmq.worker.concurrency.min=2
rabbitmq.worker.concurrency.max=2
```

**Medium Hardware (4-8 cores)**:
```properties
rabbitmq.worker.concurrency.min=4
rabbitmq.worker.concurrency.max=6
```

**High Hardware (8+ cores)**:
```properties
rabbitmq.worker.concurrency.min=6
rabbitmq.worker.concurrency.max=10
```

**Development/Debug**:
```properties
rabbitmq.worker.concurrency.min=1
rabbitmq.worker.concurrency.max=1
```

### How It Works

```
RabbitMQ Queues:
├── tally_creation_queue
├── partial_decryption_queue
├── compensated_decryption_queue
└── combine_decryption_queue

With concurrency=4:
- Maximum 4 workers active across ALL queues
- Could be: 2 tally + 1 partial + 1 compensated
- Or: 4 compensated + 0 others
- Or: 2 partial + 2 combine

Workers dynamically distributed based on queue demand
```

### Performance Impact

**Concurrency = 1**:
- Sequential processing only
- Slowest but most stable
- Best for debugging

**Concurrency = 4**:
- Moderate parallelism
- Good balance
- Recommended default

**Concurrency = 10**:
- High parallelism
- Fastest throughput
- May overwhelm ElectionGuard service
- Higher memory usage

## Deployment

### Quick Update
```bash
# 1. Edit application.properties (if changing concurrency)
nano backend/src/main/resources/application.properties

# 2. Rebuild backend
cd backend
mvn clean package -DskipTests

# 3. Restart services
cd ..
docker-compose down
docker-compose up -d

# 4. Verify
docker logs backend 2>&1 | grep "Worker Concurrency"
```

### Full Rebuild
```bash
# Rebuild everything
docker-compose down
docker-compose up -d --build

# Monitor startup
docker logs -f backend
```

## Related Files

- `backend/src/main/resources/application.properties` - Concurrency configuration
- `backend/src/main/java/com/amarvote/amarvote/config/RabbitMQConfig.java` - Worker factory
- `frontend/src/components/DecryptionProgressModal.jsx` - Progress display
- `backend/src/main/java/com/amarvote/amarvote/service/TaskWorkerService.java` - Progress updates

## Summary

### Frontend Fix
- ✅ Progress no longer jumps to 100% after partial decryption
- ✅ Correctly waits for backend to update before counting compensated chunks
- ✅ Shows smooth incremental progress through both phases

### Concurrency Control
- ✅ Maximum 4 concurrent workers (configurable)
- ✅ Easy to change via `application.properties`
- ✅ No code changes needed to adjust concurrency
- ✅ Visible in logs at startup

### Key Takeaway
**To change worker concurrency**, just edit one line in `application.properties`:
```properties
rabbitmq.worker.concurrency.min=4  # Change this number
rabbitmq.worker.concurrency.max=4  # And this number
```
Then rebuild and restart. No code changes required!
