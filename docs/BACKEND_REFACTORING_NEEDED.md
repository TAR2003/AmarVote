# Backend Refactoring Tasks - Chunked Tally Implementation

## ✅ COMPLETED

### 1. TallyService ✅
- **Modified**: `createTally()` method now implements chunking logic
- **Changes Made**:
  - Imports ElectionCenter, ChunkingService
  - Calculates chunks using ChunkingService
  - Randomly assigns ballots to chunks  
  - Creates ElectionCenter entry per chunk
  - Calls ElectionGuard microservice per chunk
  - Stores encrypted tally in election_center.encrypted_tally (not election.encrypted_tally)
  - Stores submitted_ballots with election_center_id (not election_id)
  - Returns message indicating number of chunks created

### 2. PartialDecryptionService - Partial ✅
- **Modified**: `createPartialDecryption()` method
- **Changes Made**:
  - Checks election_center table for chunks instead of election.encrypted_tally
  - Iterates through all election_center records (chunks)
  - Calls ElectionGuard partial decryption microservice per chunk
  - Stores decryption data in Decryption table (per chunk) instead of Guardian table
  - Creates compensated decryption shares per chunk

- **Modified**: `createCompensatedDecryptionShares()` and `createCompensatedShare()`
- **Changes Made**:
  - Now accepts electionCenters list parameter
  - Iterates through chunks
  - Saves compensated decryption with election_center_id (not election_id)
  - Uses chunk-specific encrypted_tally and submitted_ballots

## ⚠️ TODO - CRITICAL

### 3. PartialDecryptionService.combinePartialDecryption() ⚠️
**Status**: Needs complete refactoring for chunk-based combining

**Current Issues**:
- Still references `election.getEncryptedTally()` (should use election_center)
- Still uses `submittedBallotRepository.findByElectionId()` (should use findByElectionCenterId per chunk)
- Combines decryption once (should combine per chunk, then aggregate)
- Stores results in election.status = "decrypted" (should store in election_center.election_result per chunk)

**Required Changes**:
```java
@Transactional
public CombinePartialDecryptionResponse combinePartialDecryption(CombinePartialDecryptionRequest request) {
    // 1. Fetch all election_center records (chunks) for this election
    List<ElectionCenter> electionCenters = electionCenterRepository.findByElectionId(request.election_id());
    
    // 2. For EACH chunk:
    for (ElectionCenter electionCenter : electionCenters) {
        Long electionCenterId = electionCenter.getElectionCenterId();
        
        // 2a. Get decryptions for this chunk from Decryption table
        List<Decryption> decryptions = decryptionRepository.findByElectionCenterId(electionCenterId);
        
        // 2b. Get compensated decryptions for this chunk
        List<CompensatedDecryption> compensatedDecryptions = 
            compensatedDecryptionRepository.findByElectionCenterId(electionCenterId);
        
        // 2c. Get submitted ballots for this chunk
        List<SubmittedBallot> chunkBallots = 
            submittedBallotRepository.findByElectionCenterId(electionCenterId);
        
        // 2d. Call ElectionGuard combine_decryption_shares for THIS CHUNK
        ElectionGuardCombineDecryptionSharesRequest guardRequest = /* build with chunk data */;
        ElectionGuardCombineDecryptionSharesResponse guardResponse = 
            callElectionGuardCombineDecryptionSharesService(guardRequest);
        
        // 2e. Store results in election_center.election_result (JSON format)
        electionCenter.setElectionResult(guardResponse.results());
        electionCenterRepository.save(electionCenter);
    }
    
    // 3. Update election status to "decrypted"
    election.setStatus("decrypted");
    electionRepository.save(election);
    
    // 4. Return success with message about chunks processed
    return CombinePartialDecryptionResponse.builder()
        .success(true)
        .message("Successfully combined decryption for " + electionCenters.size() + " chunks")
        .results("Results stored in election_center table per chunk")
        .build();
}
```

### 4. Create ResultAggregationService ⚠️
**Status**: Needs to be created

**Purpose**: Aggregate results from all chunks into final election results

**Required Methods**:
```java
@Service
public class ResultAggregationService {
    
    /**
     * Aggregates results from all chunks for an election
     * Returns AggregatedElectionResult DTO with:
     * - Per-chunk results (chunk_id, vote counts, ballot tracking codes)
     * - Final aggregated vote counts
     * - All ballot tracking codes with their chunk assignments
     */
    public AggregatedElectionResult aggregateResults(Long electionId);
    
    /**
     * Retrieves per-chunk result details
     */
    public List<ChunkResult> getChunkResults(Long electionId);
    
    /**
     * Gets all ballots with their chunk assignments
     */
    public List<BallotChunkAssignment> getBallotChunkAssignments(Long electionId);
}
```

**DTOs Needed**:
```java
@Data
@Builder
public class AggregatedElectionResult {
    private Long electionId;
    private List<ChunkResult> chunkResults;
    private Map<String, Integer> finalVoteCounts; // candidate -> total votes
    private List<BallotChunkAssignment> ballotAssignments;
}

@Data  
@Builder
public class ChunkResult {
    private Long electionCenterId;
    private int chunkNumber;
    private Map<String, Integer> voteCounts; // candidate -> votes in this chunk
    private String encryptedTally;
    private String decryptedResult; // from election_center.election_result
}

@Data
@Builder
public class BallotChunkAssignment {
    private Long ballotId;
    private String trackingCode;
    private String ballotHash;
    private Long electionCenterId;
    private int chunkNumber;
}
```

### 5. Update ElectionController ⚠️
**Status**: Needs new endpoint

**Required Endpoint**:
```java
@GetMapping("/api/elections/{electionId}/aggregated-results")
public ResponseEntity<AggregatedElectionResult> getAggregatedResults(
    @PathVariable Long electionId) {
    
    AggregatedElectionResult result = resultAggregationService.aggregateResults(electionId);
    return ResponseEntity.ok(result);
}
```

## 📋 FRONTEND TASKS

### 6. OTP Login Flow ⚠️
**Status**: Needs implementation

**Components to Create/Modify**:
- `Login.jsx` - Two-step OTP flow
  - Step 1: Email input → call `/api/auth/request-otp`
  - Step 2: OTP input (6 digits) → call `/api/auth/verify-otp`
  - Store JWT token from response in httpOnly cookie (automatically set by backend)

### 7. Results Animation Page ⚠️
**Status**: Needs implementation

**Component**: `ElectionResults.jsx`

**Features**:
- Fetch data from `/api/elections/{id}/aggregated-results`
- Sequential chunk reveal animation (chunk 1, then chunk 2, etc.)
- Climbing vote bars using framer-motion
- Display format:
  ```
  Chunk 1 Results:
  [====== Alice: 50 ======]
  [==== Bob: 30 ====]
  
  Chunk 2 Results:
  [======== Alice: 80 ========] (cumulative: Alice now has 130)
  [===== Bob: 45 =====] (cumulative: Bob now has 75)
  
  Final Results:
  [================ Alice: 130 ================]
  [========= Bob: 75 =========]
  ```
- Show all ballot tracking codes with chunk assignments

### 8. Verification Page Updates ⚠️
**Status**: Needs modification

**Component**: `VerificationPage.jsx`

**Changes Required**:
- Add chunk-based tabs/accordion
- For each chunk, show:
  - Encrypted tally for that chunk
  - Partial decryptions per guardian for that chunk
  - Compensated decryptions for that chunk
  - Decrypted result for that chunk
- Final aggregated results section

**API Endpoints Needed**:
```java
// Get chunk details
GET /api/elections/{electionId}/chunks

// Get decryption data for a specific chunk
GET /api/elections/{electionId}/chunks/{electionCenterId}/decryptions

// Get compensated decryptions for a specific chunk
GET /api/elections/{electionId}/chunks/{electionCenterId}/compensated-decryptions
```

## 🚀 IMPLEMENTATION PRIORITY

1. **HIGH PRIORITY** (Backend - Blocking)
   - PartialDecryptionService.combinePartialDecryption() refactoring
   - ResultAggregationService creation
   - ElectionController endpoint for aggregated results

2. **MEDIUM PRIORITY** (Frontend - Can be done in parallel)
   - OTP Login Flow
   - Basic Results Page (without animation initially)
   - Verification Page updates

3. **LOW PRIORITY** (Polish)
   - Results page animation with framer-motion
   - Advanced verification UI

## 📝 NOTES

### Database Schema Changes ✅ (Already Completed)
- `election_center` table stores encrypted_tally and election_result per chunk
- `decryption` table stores per-guardian, per-chunk decryption data
- `submitted_ballot` table has election_center_id FK (chunk assignment)
- `compensated_decryption` table has election_center_id FK

### Key Design Decisions
- **Chunk Size**: 64 ballots per chunk (configurable in application.properties)
- **Random Assignment**: Ballots assigned to chunks using SecureRandom with Fisher-Yates shuffle
- **Chunk Processing**: Sequential processing (chunk 1, then chunk 2, etc.) for ElectionGuard calls
- **Result Storage**: Per-chunk results in election_center.election_result as JSON
- **Aggregation**: Done on-demand via ResultAggregationService, not pre-computed

### Testing Checklist
- [ ] Test tally creation with various ballot counts (e.g., 162, 11, 64, 100)
- [ ] Verify chunk sizes are calculated correctly
- [ ] Verify ballots are randomly distributed
- [ ] Verify no ballot appears in multiple chunks
- [ ] Test partial decryption for each chunk
- [ ] Test compensated decryption per chunk
- [ ] Test combining decryption per chunk
- [ ] Test result aggregation across chunks
- [ ] Test OTP login flow (email delivery, expiration, verification)
- [ ] Test results page animation
- [ ] Test verification page with chunk data

## 🔧 Configuration

**application.properties**:
```properties
# Chunking Configuration
amarvote.chunking.chunk-size=64

# OTP Configuration
amarvote.otp.validity-minutes=5

# JWT Configuration
amarvote.jwt.expiration-days=7
```
