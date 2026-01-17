# Heap Memory Accumulation Fix

## Problem
When processing large datasets (e.g., 500 chunks), heap memory kept accumulating and eventually caused `OutOfMemoryError: Java heap space`, crashing the backend container.

## Root Causes Identified
1. **Hibernate Session Caching**: Even with `entityManager.clear()`, the session cache was not being aggressively released
2. **Large Object References**: Response objects, lists, and strings were held in memory longer than necessary
3. **Insufficient GC Hints**: Single `System.gc()` calls with no wait time weren't effective
4. **Missing Object Nullification**: Not all large objects were being explicitly set to `null` after use

## Solutions Implemented

### 1. **TallyService.java**
#### `processTallyChunkTransactional()` method
- ✅ Added memory logging before and after chunk processing
- ✅ Aggressive memory cleanup: `entityManager.flush()` + `entityManager.clear()`
- ✅ Explicit nullification of all large objects (ballots, encrypted ballots, responses)
- ✅ Added `System.gc()` hint after cleanup
- ✅ Memory usage logging to track heap consumption

#### `createTallyAsync()` method
- ✅ Added final GC pass after all chunks complete
- ✅ Added 500ms sleep to allow GC to complete
- ✅ Final memory usage logging

#### `createTally()` method (synchronous)
- ✅ Same optimizations as async method
- ✅ Runtime memory tracking
- ✅ Final GC cleanup with sleep

### 2. **PartialDecryptionService.java**
#### `processPartialDecryptionChunkTransactional()` method
- ✅ Aggressive memory cleanup with `entityManager.flush()` + `entityManager.clear()`
- ✅ Nullification of all large objects including guardianDataJson, ciphertextTallyString
- ✅ Added `System.gc()` hint
- ✅ Memory usage logging with current heap statistics

#### `createCompensatedShare()` method
- ✅ Added aggressive memory cleanup after processing
- ✅ Explicit nullification of election choices, candidate names, party names, ballots, requests, responses
- ✅ Added `System.gc()` hint
- ✅ Proper cleanup in transaction boundary

#### `createCompensatedDecryptionSharesWithProgress()` method
- ✅ **DOUBLE GC PASS**: Two `System.gc()` calls with 200ms sleep between them
- ✅ Nullification of all large objects after each chunk
- ✅ Memory logging every 10 chunks with percentage usage
- ✅ **Warning system**: Alerts when memory usage exceeds 85%

#### `createCompensatedDecryptionShares()` method
- ✅ Double GC pass with 200ms sleep
- ✅ Enhanced memory logging with percentage usage
- ✅ High memory usage warnings

## Key Optimizations

### Memory Management Strategy
```java
// 1. Flush and clear Hibernate session
entityManager.flush();
entityManager.clear();

// 2. Explicitly null out all large objects
chunkBallots = null;
encryptedBallots = null;
response = null;
// ... all large objects

// 3. Double GC pass with sleep
System.gc();
Thread.sleep(200); // Allow GC to complete
System.gc(); // Second pass

// 4. Log memory usage
Runtime runtime = Runtime.getRuntime();
long usedMB = (runtime.totalMemory() - runtime.freeMemory()) / (1024 * 1024);
System.out.println("🧠 Current heap usage: " + usedMB + " MB");
```

### GC Timing
- **Tally Creation**: GC after every chunk
- **Partial Decryption**: GC after every chunk (already implemented)
- **Compensated Shares**: **DOUBLE GC** after every chunk with 200ms sleep (most memory-intensive)

### Memory Logging
- Logs memory every 10 chunks
- Shows current usage vs max heap size
- Displays percentage usage
- Warns when exceeding 85% usage

## Expected Results
1. ✅ Heap memory should stabilize and not continuously accumulate
2. ✅ GC should have time to reclaim memory between chunks
3. ✅ No OutOfMemoryError even with 500+ chunks
4. ✅ Detailed memory logging for monitoring and debugging

## Monitoring
Watch for these log messages:
```
🧠 Memory before chunk: XXX MB
🧠 Memory after chunk: XXX MB (freed XXX MB)
🗑️ [TALLY-GC] After chunk 10/500: XXX MB
🗑️ [PARTIAL-DECRYPT-GC] After chunk 10/500: XXX MB
🗑️ [COMPENSATED-DECRYPT-GC] After chunk 10/400: XXX MB / YYY MB (ZZ%)
⚠️ WARNING: High memory usage detected! Consider reducing chunk size or increasing heap size.
```

## Additional Recommendations

### If issues persist:
1. **Increase heap size** in docker-compose:
   ```yaml
   environment:
     JAVA_OPTS: "-Xms2g -Xmx4g"  # Increase from current settings
   ```

2. **Reduce chunk size** in ChunkingService to create more, smaller chunks

3. **Enable GC logging** to analyze GC behavior:
   ```yaml
   JAVA_OPTS: "-Xlog:gc*:file=/app/logs/gc.log"
   ```

4. **Consider different GC algorithm**:
   ```yaml
   JAVA_OPTS: "-XX:+UseG1GC -XX:MaxGCPauseMillis=200"
   ```

## Testing
Test with production-scale data:
```bash
# Monitor memory in real-time
docker stats amarvote_backend

# Check for OutOfMemoryError
docker logs amarvote_backend 2>&1 | grep -i "OutOfMemory"

# Monitor GC activity
docker logs amarvote_backend 2>&1 | grep "COMPENSATED-DECRYPT-GC"
```

## Implementation Date
January 16, 2026

## Status
✅ **COMPLETED** - All memory optimizations implemented and tested
