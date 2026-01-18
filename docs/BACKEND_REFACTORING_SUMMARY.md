# Backend Refactoring - Queue-Based Processing

## Problem Identified

The backend was doing ALL the processing work for:
- Tally creation
- Partial decryption
- Compensated decryption  
- Combine decryption shares

Instead of just fetching IDs and sending them to workers, the backend was:
1. Fetching IDs
2. Loading all related data from database
3. Calling ElectionGuard microservice
4. Storing results in database

This defeats the purpose of the worker architecture!

## Solution Implemented

### What the Backend Should Do (Fixed ✅)

**Backend's ONLY job:**
1. Receive request from client
2. Fetch IDs (ballot IDs or election_center_ids)
3. Create job record in database
4. Publish ID chunks to RabbitMQ queue
5. Return job ID immediately to client

**Worker's job (Already implemented, now being used properly):**
1. Pick up one chunk ID from queue
2. Fetch related data from database using that ID
3. Call ElectionGuard microservice with the data
4. Store results in database
5. Mark chunk as complete

## Files Created

### 1. DecryptionQueueService.java
- Validates guardian and tally existence
- Decrypts guardian credentials
- Publishes election_center_ids to decryption queue
- Returns job ID immediately

### 2. CompensatedDecryptionQueueService.java
- Finds missing guardians
- Publishes (chunk, source_guardian, missing_guardian) combinations to queue
- Returns job IDs immediately

### 3. CombineDecryptionQueueService.java
- Validates election exists
- Publishes election_center_ids to combine queue
- Returns job ID immediately

## Files Modified

### 1. QueuePublisherService.java
Added:
- `publishCompensatedDecryptionJob()` method

### 2. ElectionController.java
Updated endpoints to use queue services:
- `/api/create-partial-decryption` → uses `DecryptionQueueService`
- `/api/guardian/initiate-decryption` → uses `DecryptionQueueService`
- `/api/initiate-combine` → uses `CombineDecryptionQueueService`
- `/api/combine-partial-decryption` → uses `CombineDecryptionQueueService`

All endpoints now return `JobResponse` with:
- `jobId`: UUID for tracking
- `totalChunks`: Number of chunks to process
- `status`: "IN_PROGRESS"
- `pollUrl`: "/api/jobs/{jobId}/status" for checking progress

## Architecture Flow (Fixed)

### Before (❌ Wrong)
```
Client → Backend (fetch IDs, load data, call microservice, store results) → Response
         ↓ (ALL processing done here - SLOW!)
         Returns after everything is done
```

### After (✅ Correct)
```
Client → Backend (fetch IDs only) → RabbitMQ → Worker (load data, call microservice, store)
         ↓                                        ↓
         Returns job ID immediately               Processes in background
         
Client can poll: /api/jobs/{jobId}/status for progress
```

## Operation Flows

### 1. Tally Creation (Already fixed)
Backend: Fetch ballot IDs → Publish to queue → Return job ID
Worker: Load ballots → Call ElectionGuard → Store tally

### 2. Partial Decryption (Fixed ✅)
Backend: Fetch election_center_ids + Decrypt credentials → Publish to queue → Return job ID
Worker: Load submitted ballots → Call ElectionGuard → Store partial decryption

### 3. Compensated Decryption (Fixed ✅)
Backend: Fetch election_center_ids + Find missing guardians → Publish to queue → Return job IDs
Worker: Load ballots + guardian data → Call ElectionGuard → Store compensated shares

### 4. Combine Decryption (Fixed ✅)
Backend: Fetch election_center_ids → Publish to queue → Return job ID
Worker: Load partial + compensated decryptions → Call ElectionGuard → Store final results

## What Workers Do (No changes needed - already correct)

### TallyWorker
- ✅ Receives chunk ID
- ✅ Loads ballots for that chunk
- ✅ Calls ElectionGuard microservice
- ✅ Stores encrypted tally

### DecryptionWorker  
- ✅ Receives chunk ID + guardian ID
- ✅ Loads submitted ballots for that chunk
- ✅ Calls ElectionGuard microservice
- ✅ Stores partial decryption

### CompensatedDecryptionWorker
- ✅ Receives chunk ID + source guardian + missing guardian
- ✅ Loads ballots and guardian data
- ✅ Calls ElectionGuard microservice
- ✅ Stores compensated share

### CombineDecryptionWorker
- ✅ Receives chunk ID
- ✅ Loads partial and compensated decryptions
- ✅ Calls ElectionGuard microservice
- ✅ Stores final decrypted result

## Benefits

1. **Memory Efficient**: Backend uses minimal memory (just fetching IDs)
2. **Scalable**: Can add more workers by scaling backend containers
3. **Fast Response**: Client gets immediate response with job ID
4. **Fault Tolerant**: Failed chunks automatically retry
5. **Horizontal Scaling**: `docker-compose up -d --scale backend=10`

## Testing Checklist

- [ ] Tally creation returns job ID immediately
- [ ] Partial decryption returns job ID immediately
- [ ] Compensated decryption returns job IDs immediately
- [ ] Combine decryption returns job ID immediately
- [ ] Workers process chunks in background
- [ ] Check logs: Backend should only show "Fetching IDs" and "Publishing to queue"
- [ ] Workers should show "Loading data", "Calling microservice", "Storing results"
- [ ] Poll /api/jobs/{jobId}/status shows progress
- [ ] All operations complete successfully end-to-end

## Backend Log Pattern (Should Look Like This)

```
✅ Backend:
- "=== Creating Partial Decryption (Queue Mode) ==="
- "Found 2000 chunks"
- "✅ Successfully decrypted guardian credentials"
- "📤 Publishing job to queue"
- "✅ Published job: uuid-123"
- Returns in < 1 second

✅ Worker (background):
- "=== Decryption Worker Processing Chunk ==="
- "✅ Loaded 50 submitted ballots"
- "⏳ Calling ElectionGuard microservice..."
- "✅ Stored partial decryption"
- "✅ Chunk completed successfully"
- Processes over minutes/hours
```

## What NOT to See in Backend Logs

❌ "Processing chunk 1 of 2000..."
❌ "Calling ElectionGuard microservice..."
❌ "Storing partial decryption..."
❌ Backend taking minutes to respond

If you see these in backend logs, it means backend is still doing the work!

## Summary

✅ Backend now only fetches IDs and publishes to queue
✅ Workers do all the heavy processing
✅ All operations (tally, partial decryption, compensated, combine) use queue system
✅ Client gets immediate response with job ID
✅ Can scale horizontally by adding more workers
