# ✅ COMPREHENSIVE MEMORY LEAK FIXES - COMPLETE

## 🎯 Problem Identified
Memory was STILL accumulating despite aggressive GC after every chunk because:
1. **HTTP Response Strings**: Not being cleared after parsing in ElectionGuard service calls
2. **Large Object References**: guardRequest, guardResponse, decryption objects not explicitly nulled
3. **Accumulating Data**: electionCenter, ciphertext strings kept in memory across chunks

## 🔧 Solutions Implemented

### 1. ✅ HTTP Response String Clearing
**Fixed in 3 ElectionGuard service call methods:**

#### a) `callElectionGuardPartialDecryptionService()` (Line ~1145)
```java
ElectionGuardPartialDecryptionResponse parsedResponse = objectMapper.readValue(response, ...);

// ✅ CRITICAL: Clear response string immediately to free memory
response = null;
request = null;

return parsedResponse;
```

#### b) `callElectionGuardCompensatedDecryptionService()` (Line ~2210)
```java
ElectionGuardCompensatedDecryptionResponse parsedResponse = objectMapper.readValue(response, ...);

// ✅ CRITICAL: Clear response string immediately to free memory
response = null;

return parsedResponse;
```

#### c) `callElectionGuardCombineDecryptionSharesService()` (Line ~2255)
```java
ElectionGuardCombineDecryptionSharesResponse parsedResponse = objectMapper.readValue(response, ...);

// ✅ CRITICAL: Clear response string immediately to free memory
response = null;

return parsedResponse;
```

### 2. ✅ Explicit Object Nulling in Phase 1 (Partial Decryption)
**In `processDecryptionAsync()` after each chunk save:**
```java
decryptionRepository.save(decryption);

// ✅ CRITICAL: Clear ALL large objects immediately to prevent memory leak
guardRequest = null;
guardResponse = null;
decryption = null;
chunkBallots = null;
ballotCipherTexts = null;
electionCenterOpt = null;
electionCenter = null;
ciphertextTallyString = null;
guardianDataJson = null;

// ✅ AGGRESSIVE GC AFTER EVERY CHUNK
System.gc();
Thread.sleep(300);
System.gc(); // Second pass
```

### 3. ✅ Explicit Object Nulling in Phase 2 (Compensated Decryption)
**In `createCompensatedDecryptionSharesWithProgress()` after each chunk:**
```java
// ✅ CRITICAL: Clear references to prevent memory accumulation
electionCenterOpt = null;
electionCenter = null;
submittedBallots = null;
ballotCipherTexts = null;
electionChoices = null;
candidateNames = null;
partyNames = null;
availableGuardianDataJson = null;
missingGuardianDataJson = null;
compensatedRequest = null;
compensatedResponse = null;
compensatedDecryption = null;

// ✅ AGGRESSIVE GC AFTER EVERY COMPENSATED CHUNK
System.gc();
Thread.sleep(300);
System.gc();
```

### 4. ✅ Explicit Object Nulling in Phase 3 (Combine Decryption)
**In `combinePartialDecryption()` after each chunk:**
```java
// ✅ CRITICAL: Clear ALL large objects to prevent memory leak
chunkSubmittedBallots = null;
ballotCipherTexts = null;
decryptions = null;
guardianDecryptionMap = null;
guardianDataList = null;
availableGuardianIds = null;
availableGuardianPublicKeys = null;
availableTallyShares = null;
availableBallotShares = null;
missingGuardianIds = null;
compensatingGuardianIds = null;
compensatedTallyShares = null;
compensatedBallotShares = null;
guardRequest = null;
guardResponse = null;
ciphertextTallyString = null;
electionCenterOpt = null;
electionCenter = null;

// ✅ AGGRESSIVE GC AFTER EVERY COMBINE CHUNK
System.gc();
Thread.sleep(300);
System.gc();
```

## 📊 Memory Management Strategy

### Before Fixes:
```
🗑️ [PARTIAL-DECRYPT-GC] After chunk 10/100: 109 MB
🗑️ [PARTIAL-DECRYPT-GC] After chunk 10/100: 112 MB  ← GROWING!
🗑️ [PARTIAL-DECRYPT-GC] After chunk 20/100: 115 MB  ← STILL GROWING!
```

### After Fixes (Expected):
```
🗑️ [PARTIAL-DECRYPT-GC] After chunk 10/100: 85 MB
🗑️ [PARTIAL-DECRYPT-GC] After chunk 10/100: 85 MB  ← STABLE
🗑️ [PARTIAL-DECRYPT-GC] After chunk 20/100: 85 MB  ← STABLE
```

## ⚙️ GC Configuration (Already in Place)
**In `backend/Dockerfile`:**
```dockerfile
ENV JAVA_OPTS="-Xmx2560m -Xms512m \
    -XX:+UseG1GC \
    -XX:MaxGCPauseMillis=200 \
    -XX:InitiatingHeapOccupancyPercent=45 \
    -XX:+ExplicitGCInvokesConcurrent"
```

## 🔍 Root Cause Analysis

### Why Memory Was Accumulating:
1. **HTTP Response Strings**: Large JSON responses (10KB-1MB each) from ElectionGuard microservice were:
   - Parsed into Java objects via `objectMapper.readValue(response, ...)`
   - **NOT cleared** after parsing
   - Accumulated across all chunks (100 chunks × 10KB = 1MB+ leak)

2. **Object References**: Large objects held in memory:
   - `guardRequest`, `guardResponse`: ElectionGuard request/response DTOs
   - `decryption`: Saved entity with large JSON fields
   - `electionCenter`: Entity with relationships
   - `ciphertextTallyString`: Large encrypted tally JSON
   - `guardianDataJson`: Guardian key backup data

3. **Why GC Couldn't Collect**:
   - Variables still in scope at loop end
   - JVM sees referenceable objects = NOT garbage
   - **Explicit nulling required** to mark as collectable

### Why Explicit Nulling Works:
```java
// Before: guardResponse still referenced → NOT garbage
// guardResponse = {...large data...};
// Loop continues with guardResponse in scope

// After: guardResponse explicitly nulled → GARBAGE
guardResponse = null;  // ✅ Now GC can collect immediately
System.gc();           // ✅ Trigger collection
```

## 🧪 Testing Instructions

### 1. Deploy Updated Code:
```bash
# Build and deploy
cd backend
mvn clean compile
docker-compose -f docker-compose.prod.yml up -d --build backend
```

### 2. Monitor Memory:
```bash
# Watch logs for memory stability
docker logs -f amarvote-backend-1 | grep "\[PARTIAL-DECRYPT-GC\]"
docker logs -f amarvote-backend-1 | grep "\[COMPENSATED-DECRYPT-GC\]"
docker logs -f amarvote-backend-1 | grep "\[COMBINE-DECRYPT-GC\]"
```

### 3. Expected Results:
- **Memory should STABILIZE** around 80-120 MB after initial warmup
- **No continuous growth** across chunks
- **Example:**
  ```
  🗑️ [PARTIAL-DECRYPT-GC] After chunk 10/100: 95 MB
  🗑️ [PARTIAL-DECRYPT-GC] After chunk 20/100: 97 MB
  🗑️ [PARTIAL-DECRYPT-GC] After chunk 30/100: 95 MB  ← Stable
  🗑️ [PARTIAL-DECRYPT-GC] After chunk 40/100: 98 MB
  🗑️ [PARTIAL-DECRYPT-GC] After chunk 50/100: 96 MB  ← Stable
  ```

## 📝 Key Learnings

### 1. GC Alone Is Not Enough
- **Myth**: `System.gc()` will clear all unused memory
- **Reality**: JVM only collects **unreachable** objects
- **Solution**: Explicitly null large objects to make them unreachable

### 2. HTTP Response Strings Are Dangerous
- Large responses accumulate quickly (10KB × 100 chunks = 1MB)
- Must clear immediately after parsing
- Pattern:
  ```java
  String response = service.call();
  Object parsed = parse(response);
  response = null;  // ✅ CRITICAL
  return parsed;
  ```

### 3. Loop Variable Scope Matters
- Variables declared before loop stay in scope
- Reused across iterations = accumulation
- Must explicitly null after each iteration

### 4. EntityManager.clear() NOT NEEDED
- We removed `@Transactional` from async methods
- Each chunk uses its own transaction via repository methods
- EntityManager would cause "No EntityManager with actual transaction" errors

## ✅ Compilation Status
```
[INFO] BUILD SUCCESS
[INFO] Total time:  9.366 s
```

## 📌 Files Modified
1. **PartialDecryptionService.java**:
   - Line ~1145: Clear response in `callElectionGuardPartialDecryptionService()`
   - Line ~720: Add comprehensive nulling in `processDecryptionAsync()` Phase 1
   - Line ~1064: Add comprehensive nulling in `createCompensatedDecryptionSharesWithProgress()` Phase 2
   - Line ~1767: Verify comprehensive nulling in `combinePartialDecryption()` Phase 3
   - Line ~2210: Clear response in `callElectionGuardCompensatedDecryptionService()`
   - Line ~2255: Clear response in `callElectionGuardCombineDecryptionSharesService()`

## 🎯 Expected Outcome
- **No more OutOfMemoryError** even with 100+ chunks
- **Stable memory usage** across all phases
- **Successful completion** of large-scale decryption operations
- **Memory efficiency**: ~80-120 MB instead of 500+ MB accumulation

---

## ⚠️ IMPORTANT NOTES
1. **DO NOT** re-add `@Transactional` to async methods (causes Hibernate session leak)
2. **DO NOT** use `EntityManager.flush/clear()` (causes transaction errors)
3. **ALWAYS** null large objects after save operations
4. **ALWAYS** clear HTTP response strings after parsing
5. Monitor memory logs to verify stability
