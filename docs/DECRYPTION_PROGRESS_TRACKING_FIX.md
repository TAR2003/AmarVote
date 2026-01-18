# Partial Decryption Progress Tracking Fix

## Problems Identified

### 1. Partial Decryption Showing 8/8 but Not Completing
**Symptom**: Frontend shows "8/8 chunks" but status remains "in_progress"

**Root Cause**: After completing all partial decryption chunks, the system wasn't transitioning to the next phase or marking as completed.

### 2. Compensated Decryption Progress Tracking Wrong
**Symptom**: Progress tracking was counting guardians instead of tasks

**Root Cause**: The code was incrementing `processedCompensatedGuardians` by 1 for each task, but there are **multiple chunks per guardian**. If there are 8 chunks and 2 other guardians, there should be 16 tasks total (8 × 2), not 2.

### 3. Single Guardian Case Not Handled
**Symptom**: System tried to create compensated shares even with only 1 guardian

**Root Cause**: Compensated decryption is only needed when there are multiple guardians (for fault tolerance). With a single guardian, it should skip directly to completion.

## Solutions Implemented

### Fix 1: Partial Decryption Phase Transition

**File**: `TaskWorkerService.java` - `updatePartialDecryptionProgress()`

**Changes**:
- When all partial decryption chunks complete, check `totalCompensatedGuardians`
- If `totalCompensatedGuardians == 0` (single guardian):
  - Set status to `"completed"`
  - Set phase to `"completed"`
  - Mark completion timestamp
- If `totalCompensatedGuardians > 0` (multiple guardians):
  - Transition phase to `"compensated_shares_generation"`
  - Reset `processedChunks` to 0 for compensated phase tracking
  - Continue processing

**Code**:
```java
// Check if all partial decryption chunks are completed
if (status.getProcessedChunks() >= status.getTotalChunks() && 
    "partial_decryption".equals(status.getCurrentPhase())) {
    
    int totalCompensatedGuardians = status.getTotalCompensatedGuardians() != null ? 
        status.getTotalCompensatedGuardians() : 0;
    
    if (totalCompensatedGuardians == 0) {
        // Single guardian - mark as completed immediately
        status.setStatus("completed");
        status.setCurrentPhase("completed");
        status.setCompletedAt(Instant.now());
    } else {
        // Multiple guardians - transition to compensated phase
        status.setCurrentPhase("compensated_shares_generation");
        status.setProcessedChunks(0); // Reset for compensated tracking
    }
}
```

### Fix 2: Compensated Decryption Progress Tracking

**File**: `TaskWorkerService.java` - `updateCompensatedDecryptionProgress()`

**Changes**:
- Track progress by **total compensated tasks** = `totalChunks × totalCompensatedGuardians`
- Increment `processedChunks` for each task completed
- When all tasks complete, mark status as `"completed"`

**Before (Wrong)**:
```java
// Incremented processedCompensatedGuardians per task
// For 8 chunks × 2 guardians = 16 tasks, but only counted to 2
int processed = status.getProcessedCompensatedGuardians() + 1;
if (processed >= status.getTotalCompensatedGuardians()) { // 2 >= 2
    status.setStatus("completed");
}
```

**After (Correct)**:
```java
// Increment processedChunks per task
int currentProcessed = status.getProcessedChunks() + 1;
status.setProcessedChunks(currentProcessed);

// Calculate total: 8 chunks × 2 guardians = 16 tasks
int totalCompensatedTasks = totalChunks * totalCompensatedGuardians;

// Complete when all tasks done
if (status.getProcessedChunks() >= totalCompensatedTasks) { // 16 >= 16
    status.setStatus("completed");
}
```

### Fix 3: Single Guardian Detection

**File**: `DecryptionTaskQueueService.java` - `queueCompensatedDecryptionTasks()`

**Changes**:
- Check if `otherGuardians.isEmpty()`
- If empty (single guardian), skip queueing compensated tasks entirely
- Return early with log message

**Code**:
```java
// Handle single guardian case - no compensated shares needed
if (otherGuardians.isEmpty()) {
    System.out.println("✅ Single guardian election - no compensated shares needed");
    return;
}
```

**File**: `PartialDecryptionService.java` - `processDecryptionAsync()`

**Changes**:
- Calculate `totalCompensatedGuardians = Math.max(0, allGuardians.size() - 1)`
- Use `Math.max(0, ...)` to ensure it's never negative
- Log whether single or multi-guardian election

**Code**:
```java
int totalCompensatedGuardians = Math.max(0, allGuardians.size() - 1);

if (totalCompensatedGuardians == 0) {
    System.out.println("👤 Single guardian election - no compensated shares needed");
}
```

## Workflow After Fixes

### Multi-Guardian Election (e.g., 3 guardians, 8 chunks)

1. **Phase 1: Partial Decryption**
   - Status: `"in_progress"`, Phase: `"partial_decryption"`
   - Process 8 chunks
   - Progress: 1/8, 2/8, ..., 8/8
   - ✅ When 8/8 complete:
     - Phase transitions to `"compensated_shares_generation"`
     - Reset processedChunks to 0

2. **Phase 2: Compensated Shares**
   - Status: `"in_progress"`, Phase: `"compensated_shares_generation"`
   - Need to create shares for 2 other guardians
   - Total tasks: 8 chunks × 2 guardians = 16 tasks
   - Progress: 1/16, 2/16, ..., 16/16
   - ✅ When 16/16 complete:
     - Status set to `"completed"`
     - Phase set to `"completed"`
     - Completion timestamp set

### Single Guardian Election (1 guardian, 8 chunks)

1. **Phase 1: Partial Decryption**
   - Status: `"in_progress"`, Phase: `"partial_decryption"`
   - Process 8 chunks
   - Progress: 1/8, 2/8, ..., 8/8
   - ✅ When 8/8 complete:
     - **Directly** set status to `"completed"`
     - **Directly** set phase to `"completed"`
     - No compensated phase needed

2. **Phase 2: Compensated Shares**
   - ⏭️ **SKIPPED** - Not needed for single guardian

## Database Schema

The `decryption_status` table tracks:

- `status`: "pending" | "in_progress" | "completed" | "failed"
- `current_phase`: "partial_decryption" | "compensated_shares_generation" | "completed"
- `total_chunks`: Number of chunks in election
- `processed_chunks`: 
  - During partial phase: Count of partial chunks completed
  - During compensated phase: Count of compensated tasks completed (chunks × guardians)
- `total_compensated_guardians`: Number of other guardians (0 for single guardian)
- `processed_compensated_guardians`: ⚠️ **Deprecated** (not used in fixed version)

## Testing

### Test Case 1: Single Guardian Election

1. Create election with 1 guardian
2. Create tally with 8 chunks
3. Guardian submits decryption credentials
4. **Expected**:
   - Partial decryption: 1/8, 2/8, ..., 8/8
   - After 8/8: Status → "completed" immediately
   - No compensated decryption tasks queued
   - RabbitMQ compensated queue: 0 tasks

### Test Case 2: Multi-Guardian Election (3 guardians)

1. Create election with 3 guardians
2. Create tally with 8 chunks
3. Guardian 1 submits credentials
4. **Expected**:
   - Partial decryption: 1/8, 2/8, ..., 8/8
   - After 8/8: Phase → "compensated_shares_generation"
   - Compensated tasks queued: 8 chunks × 2 others = 16 tasks
   - Compensated progress: 1/16, 2/16, ..., 16/16
   - After 16/16: Status → "completed"

### Test Case 3: Combine Decryption (Already Fixed)

1. All guardians complete decryption
2. Initiate combine decryption
3. **Expected**:
   - Combine progress: 1/8, 2/8, ..., 8/8
   - After 8/8: Status → "completed"

## Logs to Monitor

### Partial Decryption Phase Transition

```
📊 Partial Decryption Progress (Guardian 1): 8/8 chunks completed
✅ All partial decryption chunks completed for guardian 1
👤 Single guardian election - decryption completed for guardian 1
```

OR

```
📊 Partial Decryption Progress (Guardian 1): 8/8 chunks completed
✅ All partial decryption chunks completed for guardian 1
🔄 Transitioning to compensated shares generation phase
📊 Need to generate shares for 2 other guardians
```

### Compensated Decryption Progress

```
📊 Compensated Decryption Progress (Guardian 1): 1/16 tasks completed
📊 Compensated Decryption Progress (Guardian 1): 2/16 tasks completed
...
📊 Compensated Decryption Progress (Guardian 1): 16/16 tasks completed
✅ All compensated decryption tasks completed for guardian 1
```

### Combine Decryption Progress

```
📊 Combine Decryption Progress: 1/8 chunks completed
📊 Combine Decryption Progress: 2/8 chunks completed
...
📊 Combine Decryption Progress: 8/8 chunks completed
✅ All combine decryption chunks completed for election 123
```

## Files Modified

1. ✅ `TaskWorkerService.java`
   - `updatePartialDecryptionProgress()` - Phase transition logic
   - `updateCompensatedDecryptionProgress()` - Fixed progress calculation

2. ✅ `DecryptionTaskQueueService.java`
   - `queueCompensatedDecryptionTasks()` - Single guardian skip logic

3. ✅ `PartialDecryptionService.java`
   - `processDecryptionAsync()` - Single guardian detection

## Summary

These fixes ensure that:
- ✅ Partial decryption correctly transitions between phases
- ✅ Compensated decryption tracks all tasks (chunks × guardians)
- ✅ Single guardian elections skip compensated phase entirely
- ✅ Status properly reaches "completed" in all scenarios
- ✅ Progress tracking matches actual work being done

---

**Issue**: Partial/Compensated/Combine decryption progress tracking  
**Status**: ✅ FIXED  
**Date**: January 18, 2026  
**Testing**: Required before production deployment
