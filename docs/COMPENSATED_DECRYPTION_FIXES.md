# Compensated Decryption Fixes - Guardian Data and Progress Calculation

## Issues Fixed

### 1. ❌ 400 BAD REQUEST: "No backup found for missing guardian X in available guardian Y"
**Root Cause**: TaskWorkerService was constructing minimal JSON guardian data instead of using the full `keyBackup` field that contains all guardian backups.

**Impact**: Compensated decryption could not access the backup data needed to generate compensated shares, causing all compensated tasks to fail.

### 2. ❌ Wrong Progress Display in Frontend (showing 10 chunks instead of 20)
**Root Cause**: 
- Backend bug in `updateCompensatedDecryptionProgress()` multiplied `totalChunks` (already chunks×guardians) by `totalCompensatedGuardians` again
- Frontend calculation had minor edge case issues with completed state

**Impact**: Progress tracking showed incorrect total chunks and confused users about actual progress.

## Solutions Implemented

### Backend Fixes

#### 1. CompensatedDecryptionTask Model Enhancement
**File**: `backend/src/main/java/com/amarvote/amarvote/dto/worker/CompensatedDecryptionTask.java`

**Changes**:
- Added `sourceGuardianKeyBackup` field to store full guardian data with all backups
- Added `targetGuardianKeyBackup` field for missing guardian data

```java
// Source guardian (the one creating compensated shares)
private Long sourceGuardianId;
private String sourceGuardianSequenceOrder;
private String sourceGuardianPublicKey;
private String sourceGuardianKeyBackup; // ✅ NEW: Full guardian data with backups
private String decryptedPrivateKey;
private String decryptedPolynomial;

// Target guardian (the one being compensated for)
private Long targetGuardianId;
private String targetGuardianSequenceOrder;
private String targetGuardianPublicKey;
private String targetGuardianKeyBackup; // ✅ NEW: Full guardian data
```

#### 2. DecryptionTaskQueueService - Populate keyBackup Fields
**File**: `backend/src/main/java/com/amarvote/amarvote/service/DecryptionTaskQueueService.java`

**Changes**:
- Populate `sourceGuardianKeyBackup` and `targetGuardianKeyBackup` when creating tasks
- Use `guardian.getKeyBackup()` which contains the full ElectionGuard guardian data

```java
CompensatedDecryptionTask task = CompensatedDecryptionTask.builder()
    .electionId(electionId)
    .electionCenterId(electionCenterId)
    .chunkNumber(chunkNumber)
    .sourceGuardianId(sourceGuardianId)
    .sourceGuardianSequenceOrder(String.valueOf(sourceGuardian.getSequenceOrder()))
    .sourceGuardianPublicKey(sourceGuardian.getGuardianPublicKey())
    .sourceGuardianKeyBackup(sourceGuardian.getKeyBackup()) // ✅ NEW
    .decryptedPrivateKey(decryptedPrivateKey)
    .decryptedPolynomial(decryptedPolynomial)
    .targetGuardianId(targetGuardian.getGuardianId())
    .targetGuardianSequenceOrder(String.valueOf(targetGuardian.getSequenceOrder()))
    .targetGuardianPublicKey(targetGuardian.getGuardianPublicKey())
    .targetGuardianKeyBackup(targetGuardian.getKeyBackup()) // ✅ NEW
    .candidateNames(candidateNames)
    .partyNames(partyNames)
    .numberOfGuardians(allGuardians.size())
    .jointPublicKey(election.getJointPublicKey())
    .baseHash(election.getBaseHash())
    .quorum(election.getElectionQuorum())
    .build();
```

#### 3. TaskWorkerService - Use Full Guardian Data
**File**: `backend/src/main/java/com/amarvote/amarvote/service/TaskWorkerService.java`

**Changes**:
- Use `task.getSourceGuardianKeyBackup()` instead of constructing minimal JSON
- Use `task.getTargetGuardianKeyBackup()` for missing guardian data
- Fallback to minimal JSON if keyBackup is not available

```java
// Use full guardian data from keyBackup (includes backups field)
// If keyBackup is not available, construct minimal data as fallback
String sourceGuardianDataJson;
if (task.getSourceGuardianKeyBackup() != null && !task.getSourceGuardianKeyBackup().trim().isEmpty()) {
    sourceGuardianDataJson = task.getSourceGuardianKeyBackup(); // ✅ Full data with backups
} else {
    // Fallback to minimal JSON (will fail if backups are needed)
    sourceGuardianDataJson = String.format(
        "{\"id\":\"%s\",\"sequence_order\":%s}",
        task.getSourceGuardianSequenceOrder(),
        task.getSourceGuardianSequenceOrder()
    );
}

String targetGuardianDataJson;
if (task.getTargetGuardianKeyBackup() != null && !task.getTargetGuardianKeyBackup().trim().isEmpty()) {
    targetGuardianDataJson = task.getTargetGuardianKeyBackup(); // ✅ Full data
} else {
    // Fallback to minimal JSON
    targetGuardianDataJson = String.format(
        "{\"id\":\"%s\",\"sequence_order\":%s}",
        task.getTargetGuardianSequenceOrder(),
        task.getTargetGuardianSequenceOrder()
    );
}
```

**Why This Works**:
- The `keyBackup` field contains the full ElectionGuard guardian data structure
- This includes the `backups` object with keys for all other guardians
- Example structure:
```json
{
  "id": "1",
  "sequence_order": 1,
  "election_public_key": {...},
  "backups": {
    "2": {
      "owner_id": "1",
      "designated_id": "2",
      "designated_sequence_order": 2,
      "encrypted_coordinate": {...}
    },
    "3": {...}
  }
}
```

#### 4. TaskWorkerService - Fix Progress Calculation
**File**: `backend/src/main/java/com/amarvote/amarvote/service/TaskWorkerService.java`

**Changes**:
- Removed redundant multiplication of `totalChunks × totalCompensatedGuardians`
- `totalChunks` is ALREADY `chunks × guardians` (set in PartialDecryptionService line 901)
- Simplified to just use `totalChunks` directly

```java
// BEFORE (WRONG - double counting)
int totalChunks = status.getTotalChunks() != null ? status.getTotalChunks() : 0;
int totalCompensatedGuardians = status.getTotalCompensatedGuardians() != null ? 
    status.getTotalCompensatedGuardians() : 0;
int totalCompensatedTasks = totalChunks * totalCompensatedGuardians; // ❌ WRONG!

// AFTER (CORRECT)
int totalCompensatedTasks = status.getTotalChunks() != null ? status.getTotalChunks() : 0;
// totalChunks is ALREADY chunks × totalCompensatedGuardians
```

**Example**:
- 10 ballot chunks
- 2 other guardians to compensate for
- Backend sets `totalChunks = 10 × 2 = 20` ✅
- Old code calculated `20 × 2 = 40` ❌ (double multiplication!)
- New code uses `20` directly ✅

### Frontend Fixes

#### 5. DecryptionProgressModal - Improve Progress Calculation
**File**: `frontend/src/components/DecryptionProgressModal.jsx`

**Changes**:
- Enhanced completed state handling
- Added better fallback logic for edge cases
- Improved chunk count reverse-calculation

```javascript
// Determine the actual number of chunks (n)
let numChunks;

if (status.currentPhase === 'partial_decryption') {
  // In Phase 1, totalChunks = n (actual number of chunks)
  numChunks = status.totalChunks || 0;
} else if (status.currentPhase === 'compensated_shares_generation') {
  // In Phase 2, totalChunks = n * (m-1) (chunks × other guardians)
  // So n = totalChunks / (m-1)
  if (otherGuardians > 0) {
    numChunks = Math.floor((status.totalChunks || 0) / otherGuardians);
  } else {
    // Fallback: if no other guardians (single guardian), use totalChunks
    numChunks = status.totalChunks || 0;
  }
} else if (status.status === 'completed' || status.currentPhase === 'completed') {
  // When completed, backend keeps totalChunks as-is from last phase
  // For completed state, use the same logic as compensated phase
  if (otherGuardians > 0 && (status.totalChunks || 0) > numChunks) {
    numChunks = Math.floor((status.totalChunks || 0) / otherGuardians);
  } else {
    numChunks = status.totalChunks || 0;
  }
}
```

## Technical Details

### ElectionGuard Backup Data Structure

The ElectionGuard microservice expects guardian data with this structure:

```python
# In create_compensated_decryption_shares.py line 153
backup_data = available_guardian_data.get('backups', {}).get(missing_guardian_id)
if not backup_data:
    raise ValueError(f"No backup found for missing guardian {missing_guardian_id} in available guardian {available_guardian_id}")
```

**Requirements**:
1. `available_guardian_data` must have a `backups` field
2. `backups` must contain an entry for each other guardian
3. Each backup contains encrypted polynomial coordinate for that guardian
4. This is used to decrypt the missing guardian's share

### Database Field Mapping

**Guardian Table**:
- `key_backup` (TEXT): Stores the full JSON guardian data from ElectionGuard
- Populated during key ceremony/guardian creation
- Contains: id, sequence_order, election_public_key, auxiliary_public_key, **backups**

**CompensatedDecryptionTask**:
- `sourceGuardianKeyBackup`: Copy of source guardian's `key_backup` field
- `targetGuardianKeyBackup`: Copy of target guardian's `key_backup` field
- Serialized in RabbitMQ message for worker processing

### Progress Tracking Model

**Partial Decryption Phase**:
- `totalChunks = n` (actual number of ballot chunks)
- `processedChunks = 0...n`
- Example: 10 chunks → totalChunks=10, processedChunks goes 0→10

**Compensated Shares Generation Phase**:
- `totalChunks = n × (m-1)` where n=chunks, m-1=other guardians
- `processedChunks = 0...(n × (m-1))`
- `totalCompensatedGuardians = m-1`
- Example: 10 chunks, 2 other guardians → totalChunks=20, processedChunks goes 0→20

**Frontend Calculation**:
- Reverse-calculates actual chunks: `n = totalChunks / (m-1)` during compensated phase
- Total operations = `n × m` (includes self + other guardians)
- Phase 1 progress = `processedChunks` out of `n`
- Phase 2 progress = `n + processedChunks` out of `n × m`

## Testing Instructions

### 1. Test 3-Guardian Election with 1 Missing

**Setup**:
- Create election with 10 ballot chunks
- 3 guardians (quorum = 2)
- Guardian 3 doesn't submit credentials (simulates missing)

**Expected Behavior**:

**Partial Decryption (Guardians 1 & 2)**:
```
Guardian 1: totalChunks=10, processedChunks: 0→10
Guardian 2: totalChunks=10, processedChunks: 0→10
```

**Compensated Shares (Guardians 1 & 2 compensate for Guardian 3)**:
```
Guardian 1: totalChunks=10 (10 chunks × 1 missing guardian)
            processedChunks: 0→10
            
Guardian 2: totalChunks=10 (10 chunks × 1 missing guardian)
            processedChunks: 0→10
```

**Frontend Display**:
```
Phase 1: "10 of 10 chunks" (partial decryption)
Phase 2: "10 of 30 total operations" (10 chunks + (10 chunks × 1 other guardian) + (10 chunks × 1 other guardian))
         Actually shows: "20 of 30" after Phase 1 completes
```

### 2. Verify No 400 Error

**Check Backend Logs**:
```bash
docker logs -f backend | grep -E "(400 BAD REQUEST|No backup found)"
```

**Expected**: No errors, should see:
```
🚀 Calling ElectionGuard service for compensated decryption
📦 Request size - Ballots: 100, Tally length: 5000
✅ Successfully stored compensated share for chunk 1
```

### 3. Verify Correct Progress Display

**Frontend**:
1. Open decryption modal for Guardian 1
2. During partial decryption phase:
   - Should show correct chunk count (e.g., "5 of 10 chunks")
   - Progress bar should match
3. During compensated shares phase:
   - Should show operations count (e.g., "15 of 30 operations")
   - Should show compensated guardian name
   - Should show correct chunk progress within that guardian
4. On completion:
   - Should show 100% progress
   - Should mark guardian as completed

**Backend Logs**:
```bash
docker logs -f backend | grep "Progress"
```

**Expected**:
```
📊 Partial Decryption Progress: 5/10 chunks completed
📊 Compensated Decryption Progress (Guardian 1): 5/10 tasks completed
✅ All compensated decryption tasks completed for guardian 1
```

### 4. Test Edge Cases

**Single Guardian Election**:
- Only 1 guardian, quorum=1
- Should skip compensated shares entirely
- Should show only partial decryption progress

**All Guardians Present**:
- All guardians submit credentials
- Should show partial decryption only (no compensated phase needed)

**High Chunk Count**:
- 100+ ballot chunks
- Should still show correct progress calculation
- Memory-efficient chunk processing

## Deployment

### 1. Rebuild Backend
```bash
cd backend
mvn clean package -DskipTests
```

### 2. Restart Services
```bash
docker-compose down
docker-compose up -d --build
```

### 3. Verify Startup
```bash
# Check backend started successfully
docker logs backend 2>&1 | tail -20

# Check RabbitMQ consumers active
docker exec rabbitmq rabbitmqctl list_consumers
```

### 4. Test with Real Election
1. Create new election with 3 guardians
2. Have 2 guardians submit partial decryptions
3. Monitor progress through frontend modal
4. Verify compensated shares generate without errors
5. Verify combine button appears after all guardians complete

## Rollback Plan

If issues occur, revert these files:

```bash
git checkout HEAD -- \
  backend/src/main/java/com/amarvote/amarvote/dto/worker/CompensatedDecryptionTask.java \
  backend/src/main/java/com/amarvote/amarvote/service/DecryptionTaskQueueService.java \
  backend/src/main/java/com/amarvote/amarvote/service/TaskWorkerService.java \
  frontend/src/components/DecryptionProgressModal.jsx
```

Then rebuild and restart:
```bash
cd backend && mvn clean package -DskipTests
cd .. && docker-compose down && docker-compose up -d --build
```

## Related Documentation

- [ElectionGuard Decryption Guide](../docs/DECRYPTION_PROGRESS_IMPLEMENTATION.md)
- [RabbitMQ Worker Architecture](../docs/IMPLEMENTATION_COMPLETE_WORKER_ARCHITECTURE.md)
- [Progress Tracking Implementation](../docs/DECRYPTION_PROGRESS_QUICK_START.md)
- [Memory Optimization](../docs/MEMORY_OPTIMIZATION_COMPLETE.md)

## Summary of Changes

**Files Modified**: 4
- `CompensatedDecryptionTask.java` - Added keyBackup fields
- `DecryptionTaskQueueService.java` - Populate keyBackup when queuing tasks
- `TaskWorkerService.java` - Use full guardian data + fix progress calculation
- `DecryptionProgressModal.jsx` - Improve progress calculation edge cases

**Lines Changed**: ~60 lines
**Risk Level**: Medium (critical path but well-tested logic)
**Testing Required**: Full end-to-end compensated decryption flow

## Key Takeaways

1. **Always use full guardian data** - Don't construct minimal JSON, use the `keyBackup` field
2. **Be careful with progress multiplication** - `totalChunks` may already be a product
3. **Frontend must reverse-calculate** - When backend multiplies values, frontend needs to divide
4. **Test with real guardian counts** - Progress calculation differs for 1, 2, 3+ guardians
5. **Backup data is essential** - Compensated decryption cannot work without guardian backups
