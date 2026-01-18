# RabbitMQ Last Chunk Stuck Issue - FIXED

## Problem Description

After implementing the RabbitMQ worker architecture, the system was working but the **last chunk was getting stuck**. The RabbitMQ dashboard showed no tasks remaining, but the progress tracker indicated that one chunk was not completed.

### Symptoms
- RabbitMQ dashboard: 0 tasks in queue ✅
- Backend logs: Last chunk processed successfully ✅
- Database: `processed_chunks = 9`, `total_chunks = 10` ❌
- Status: Stuck at "in_progress" instead of "completed" ❌

## Root Cause

**Chunks are numbered starting from 0, not 1.**

For an election with 10 chunks:
- Chunk numbers: 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 (10 chunks total)
- Total chunks: 10

**The bug was in the progress tracking logic:**

### Old Code (Incorrect)
```java
private void updateTallyProgress(Long electionId, int completedChunk) {
    status.setProcessedChunks(completedChunk);  // ❌ WRONG: Sets to chunk number
    
    if (completedChunk >= status.getTotalChunks()) {  // ❌ WRONG: 9 >= 10 is false
        status.setStatus("completed");
    }
}
```

**What happened:**
- Chunk 0 completes → `processedChunks = 0` (should be 1)
- Chunk 1 completes → `processedChunks = 1` (should be 2)
- ...
- Chunk 9 completes → `processedChunks = 9` (should be 10)
- Check: `9 >= 10` → **FALSE** → Status stays "in_progress"

### New Code (Correct)
```java
private void updateTallyProgress(Long electionId, int completedChunk) {
    int currentProcessed = status.getProcessedChunks() != null ? status.getProcessedChunks() : 0;
    status.setProcessedChunks(currentProcessed + 1);  // ✅ Increment count
    
    if (status.getProcessedChunks() >= status.getTotalChunks()) {  // ✅ 10 >= 10 is true
        status.setStatus("completed");
    }
}
```

**What happens now:**
- Chunk 0 completes → `processedChunks = 0 + 1 = 1` ✅
- Chunk 1 completes → `processedChunks = 1 + 1 = 2` ✅
- ...
- Chunk 9 completes → `processedChunks = 9 + 1 = 10` ✅
- Check: `10 >= 10` → **TRUE** → Status set to "completed" ✅

## Changes Made

### File: `TaskWorkerService.java`

Fixed progress tracking for **all 4 task types**:

1. ✅ **Tally Creation** - `updateTallyProgress()`
2. ✅ **Partial Decryption** - `updatePartialDecryptionProgress()`
3. ✅ **Compensated Decryption** - Already correct (uses different logic)
4. ✅ **Combine Decryption** - `updateCombineDecryptionProgress()`

### Key Changes

Each update method now:
1. **Increments** the processed count instead of setting it to chunk number
2. **Logs progress** to help with debugging
3. **Properly detects completion** when all chunks are done

### Added Logging

The fix includes better logging to track progress:
```
📊 Tally Progress: 1/10 chunks completed
📊 Tally Progress: 2/10 chunks completed
...
📊 Tally Progress: 10/10 chunks completed
✅ All tally chunks completed for election 123
```

## Testing

### How to Verify the Fix

1. **Create a test election** with enough ballots to generate multiple chunks (e.g., 300 ballots → 3 chunks)

2. **Create tally and monitor progress:**
   ```bash
   docker logs -f amarvote_backend | grep "Progress"
   ```

3. **Check database:**
   ```sql
   SELECT election_id, status, processed_chunks, total_chunks
   FROM tally_creation_status
   WHERE election_id = <your_election_id>;
   ```

4. **Expected result:**
   - After all chunks process: `processed_chunks = total_chunks`
   - Status changes to: `"completed"`
   - `completed_at` timestamp is set

5. **RabbitMQ Management UI:**
   - http://localhost:15672
   - All queues should be empty
   - No messages stuck

### Test All 4 Task Types

Repeat testing for:
1. ✅ **Tally Creation** - Create election and create tally
2. ✅ **Partial Decryption** - Guardian submits credentials
3. ✅ **Compensated Decryption** - Guardian creates compensated shares
4. ✅ **Combine Decryption** - Combine all decryption shares

## Impact

### Before Fix
- ❌ Last chunk stuck forever
- ❌ Status never reaches "completed"
- ❌ Frontend shows "in_progress" indefinitely
- ❌ Users confused about election state

### After Fix
- ✅ All chunks tracked correctly
- ✅ Status properly set to "completed"
- ✅ Frontend shows correct completion state
- ✅ Clear progress logging for debugging

## Deployment

### Steps to Deploy

1. **Pull latest code** (includes the fix)

2. **Rebuild backend:**
   ```bash
   docker-compose down
   docker-compose up -d --build backend
   ```

3. **Verify backend is healthy:**
   ```bash
   docker ps | grep backend
   docker logs amarvote_backend | tail -50
   ```

4. **Test with a small election:**
   - Create test election with 20-30 ballots
   - Create tally
   - Monitor logs and database
   - Verify completion

### Production Deployment

```bash
docker-compose -f docker-compose.prod.yml down backend
docker-compose -f docker-compose.prod.yml up -d --build backend
```

## Related Files Modified

- ✅ `backend/src/main/java/com/amarvote/amarvote/service/TaskWorkerService.java`
  - `updateTallyProgress()` - Fixed
  - `updatePartialDecryptionProgress()` - Fixed
  - `updateCombineDecryptionProgress()` - Fixed
  - `updateCompensatedDecryptionProgress()` - Already correct

## Additional Improvements

The fix also adds:
- Better progress logging with emojis for visibility
- Null safety checks for `processedChunks`
- Clear completion messages
- Helpful debug information

## Conclusion

The "last chunk stuck" issue was caused by confusing **chunk numbers** (0-based) with **chunk counts** (1-based). The fix properly increments the count of completed chunks, ensuring that when all chunks are processed, the status is correctly set to "completed".

This fix applies to all 4 major task types in the RabbitMQ worker architecture, ensuring consistent and correct progress tracking across the entire system.

---

**Issue**: Last chunk stuck in "in_progress"  
**Status**: ✅ FIXED  
**Date**: January 18, 2026  
**Impact**: Critical - Affects all chunked processing operations  
**Testing**: Required for all 4 task types before production deployment
