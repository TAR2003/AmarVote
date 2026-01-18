# Guardian Marking and Compensated Decryption I/O Error Fix

## Problems Fixed

### Problem 1: Guardian Not Marked as Decrypted ❌
**Symptom**: After successful decryption (especially for single guardian), the combine button doesn't appear and the guardian count animation doesn't update.

**Root Cause**: When we moved to RabbitMQ worker architecture, the synchronous code that marked `guardian.setDecryptedOrNot(true)` was no longer executed. The worker processes tasks but never updates the guardian's `decryptedOrNot` flag.

**Frontend Impact**:
- Combine button doesn't show (checks if all required guardians have `decryptedOrNot = true`)
- Animation showing "X/Y guardians decrypted" doesn't update
- User sees "Decryption Successful" but can't proceed to combine

### Problem 2: I/O Error in Compensated Decryption ❌
**Symptom**: 
```
❌ Decryption Failed
I/O error on POST request for "http://electionguard:5000/create_compensated_decryption_shares": 
Error writing request body to server
```

**Root Cause**: 
- Large request payload (all ballot cipher texts + tally data)
- Network timeouts
- Connection issues with ElectionGuard microservice
- No retry logic for transient failures

## Solutions Implemented

### Fix 1: Mark Guardian as Decrypted on Completion

**Files Modified**: `TaskWorkerService.java`

#### Change 1: Single Guardian Case
When partial decryption completes for a single guardian election:
```java
if (totalCompensatedGuardians == 0) {
    status.setStatus("completed");
    status.setCurrentPhase("completed");
    status.setCompletedAt(Instant.now());
    
    // Mark guardian as decrypted (needed for frontend combine button)
    markGuardianAsDecrypted(guardianId);  // ✅ NEW
    
    System.out.println("✅ Single guardian election - decryption completed");
}
```

#### Change 2: Multi-Guardian Case
When compensated decryption completes for multi-guardian election:
```java
if (status.getProcessedChunks() >= totalCompensatedTasks) {
    status.setStatus("completed");
    status.setCurrentPhase("completed");
    status.setCompletedAt(Instant.now());
    
    // Mark guardian as decrypted (needed for frontend combine button)
    markGuardianAsDecrypted(guardianId);  // ✅ NEW
    
    System.out.println("✅ All compensated decryption tasks completed");
}
```

#### Change 3: New Helper Method
Added `markGuardianAsDecrypted()` method:
```java
@Transactional
private void markGuardianAsDecrypted(Long guardianId) {
    try {
        Optional<Guardian> guardianOpt = guardianRepository.findById(guardianId);
        if (guardianOpt.isPresent()) {
            Guardian guardian = guardianOpt.get();
            guardian.setDecryptedOrNot(true);  // ✅ Critical for frontend
            guardianRepository.save(guardian);
            System.out.println("✅ Guardian " + guardianId + " marked as decrypted");
        }
    } catch (Exception e) {
        System.err.println("Failed to mark guardian as decrypted: " + e.getMessage());
    }
}
```

### Fix 2: Retry Logic for Compensated Decryption

**Files Modified**: `TaskWorkerService.java`

#### Added Retry Logic with Exponential Backoff
```java
String response = null;
ElectionGuardCompensatedDecryptionResponse guardResponse = null;
int maxRetries = 3;
int attempt = 0;

while (attempt < maxRetries) {
    try {
        attempt++;
        if (attempt > 1) {
            System.out.println("⚠️ Retry attempt " + attempt + "/" + maxRetries);
            Thread.sleep(2000 * attempt); // Exponential backoff: 2s, 4s, 6s
        }
        
        response = electionGuardService.postRequest(
            "/create_compensated_decryption_shares", guardRequest);
        guardResponse = objectMapper.readValue(response, 
            ElectionGuardCompensatedDecryptionResponse.class);
        break; // Success, exit retry loop
        
    } catch (Exception e) {
        if (attempt >= maxRetries) {
            System.err.println("❌ All retry attempts failed");
            throw new RuntimeException("Failed after " + maxRetries + 
                " attempts: " + e.getMessage(), e);
        }
        System.err.println("⚠️ Attempt " + attempt + "/" + maxRetries + 
            " failed: " + e.getMessage());
    }
}
```

#### Added Request Size Logging
```java
System.out.println("📦 Request size - Ballots: " + ballotCipherTexts.size() + 
    ", Tally length: " + ciphertextTallyString.length());
```

This helps diagnose if the request is too large.

## How It Works Now

### Single Guardian Workflow (1 guardian, quorum 1)

1. **Guardian submits credentials**
   ```
   📥 Request received
   👤 Single guardian election detected
   ```

2. **Partial decryption processes**
   ```
   📊 Partial Decryption: 1/8, 2/8, ..., 8/8
   ✅ All partial chunks completed
   ```

3. **Status updated & guardian marked**
   ```
   ✅ Single guardian - decryption completed
   ✅ Guardian X marked as decrypted (decryptedOrNot=true)  ← NEW
   Status: "completed"
   Phase: "completed"
   ```

4. **Frontend updates**
   ```
   ✅ Combine button appears
   ✅ Animation shows "1/1 guardians decrypted"
   ```

### Multi-Guardian Workflow (3 guardians, quorum 2)

1. **Guardian submits credentials**
   ```
   📥 Request received
   👥 Multi-guardian - will generate compensated shares for 2 others
   ```

2. **Partial decryption processes**
   ```
   📊 Partial Decryption: 1/8, 2/8, ..., 8/8
   ✅ All partial chunks completed
   🔄 Transitioning to compensated shares phase
   ```

3. **Compensated decryption processes**
   ```
   📊 Compensated Decryption: 1/16, 2/16, ..., 16/16
   ⚠️ Retry attempt 2/3 (if needed)
   ✅ All compensated tasks completed
   ```

4. **Status updated & guardian marked**
   ```
   ✅ All compensated decryption completed
   ✅ Guardian X marked as decrypted (decryptedOrNot=true)  ← NEW
   Status: "completed"
   Phase: "completed"
   ```

5. **Frontend updates**
   ```
   ✅ Animation shows "2/3 guardians decrypted"
   ✅ Combine button appears when quorum met (2/3)
   ```

## Testing

### Test 1: Single Guardian Election

1. Create election with 1 guardian, quorum 1
2. Create tally
3. Guardian submits credentials
4. **Verify**:
   ```bash
   docker logs -f amarvote_backend | grep "marked as decrypted"
   ```
   Expected: `✅ Guardian X marked as decrypted (decryptedOrNot=true)`

5. **Check database**:
   ```sql
   SELECT guardian_id, decrypted_or_not 
   FROM guardians 
   WHERE election_id = <your_election_id>;
   ```
   Expected: `decrypted_or_not = true`

6. **Check frontend**:
   - Combine button should appear
   - Animation should show "1/1 guardians"

### Test 2: Multi-Guardian with I/O Retry

1. Create election with 3 guardians, quorum 2
2. Create tally with many ballots (to trigger large payload)
3. Guardian submits credentials
4. **Monitor logs**:
   ```bash
   docker logs -f amarvote_backend | grep -E "Retry|marked as decrypted"
   ```
   
5. **Expected logs**:
   ```
   📦 Request size - Ballots: 500, Tally length: 15000
   ⚠️ Retry attempt 2/3
   ✅ Compensated chunk complete
   ...
   ✅ Guardian X marked as decrypted (decryptedOrNot=true)
   ```

### Test 3: Frontend Animation

1. Open election page with multiple guardians
2. As each guardian completes decryption, verify:
   - Counter updates: "0/3" → "1/3" → "2/3"
   - Animation progresses
   - Combine button appears when quorum reached

## Benefits

### Before Fixes ❌
- Guardian flag never updated → No combine button
- I/O errors → Complete decryption failure
- No retry → Transient errors become permanent failures
- Poor error visibility

### After Fixes ✅
- Guardian automatically marked on completion
- Retry logic handles transient failures
- Better error logging
- Combine button appears correctly
- Frontend animations work properly

## Files Modified

1. ✅ `backend/src/main/java/com/amarvote/amarvote/service/TaskWorkerService.java`
   - Added `markGuardianAsDecrypted()` method
   - Updated `updatePartialDecryptionProgress()` - calls mark on single guardian completion
   - Updated `updateCompensatedDecryptionProgress()` - calls mark on multi-guardian completion
   - Added retry logic in `processCompensatedDecryptionTask()`
   - Added request size logging

## Deployment

```bash
# Rebuild backend
docker-compose down
docker-compose up -d --build backend

# Monitor logs
docker logs -f amarvote_backend | grep -E "marked as decrypted|Retry"
```

## Troubleshooting

### Issue: Combine button still not appearing

**Check**:
```sql
-- Verify guardian is marked
SELECT guardian_id, decrypted_or_not, guardian_email
FROM guardians
WHERE election_id = <election_id>;

-- Should show decrypted_or_not = true for completed guardians
```

**Check logs**:
```bash
docker logs amarvote_backend | grep "Guardian .* marked as decrypted"
```

### Issue: Still getting I/O errors

**Check**:
1. ElectionGuard service health:
   ```bash
   docker logs electionguard_service
   ```

2. Request size:
   ```bash
   docker logs amarvote_backend | grep "Request size"
   ```

3. If ballots > 1000, may need to increase ElectionGuard timeout:
   ```properties
   # application.properties
   electionguard.socket.timeout=900000  # 15 minutes
   ```

---

**Status**: ✅ FIXED  
**Date**: January 18, 2026  
**Critical**: Must test before production deployment
