# AmarVote Chunked Tallying Implementation Guide

## Overview
This document describes the implementation of chunked tallying for AmarVote elections to handle large-scale voting efficiently.

## Changes Completed

### 1. Database Models Updated ✅
- Created `ElectionCenter` model
- Created `Decryption` model  
- Created `OtpVerification` model
- Updated `Guardian` to use `userEmail` instead of `userId`
- Updated `AllowedVoter` to use `userEmail` instead of `userId`
- Updated `Election` to remove `encryptedTally` (moved to ElectionCenter)
- Updated `SubmittedBallot` to use `electionCenterId` instead of `electionId`
- Updated `CompensatedDecryption` to use guardian IDs and `electionCenterId`

### 2. Repositories Created ✅
- `ElectionCenterRepository`
- `DecryptionRepository`
- `OtpVerificationRepository`

### 3. Authentication System ✅
- Created `OtpAuthService` for OTP generation and verification
- Created `OtpAuthController` with endpoints:
  - `POST /api/auth/request-otp` - Request OTP
  - `POST /api/auth/verify-otp` - Verify OTP and login
  - `GET /api/auth/session` - Check session
  - `POST /api/auth/logout` - Logout
- Added OTP email template to `EmailService`
- Created DTOs: `OtpRequestDto`, `OtpVerifyDto`, `OtpResponseDto`, `OtpLoginResponseDto`

### 4. Database Scripts ✅
- Created `otp_table_creation.sql`
- Updated `table_creation_file_AmarVote.sql` (already has election_center)

## Remaining Implementation Tasks

### 5. Chunking Service (HIGH PRIORITY)

Create `c:\Users\TAWKIR\Documents\GitHub\AmarVote\backend\src\main\java\com\amarvote\amarvote\service\ChunkingService.java`:

```java
@Service
public class ChunkingService {
    
    private static final int CHUNK_SIZE = 64; // Configurable
    
    /**
     * Calculate optimal number of chunks and their sizes
     * Rules:
     * - If ballots/CHUNK_SIZE <= 1: 1 chunk
     * - If ballots/CHUNK_SIZE > n but < n+1: n chunks (evenly distributed)
     */
    public ChunkConfiguration calculateChunks(int totalBallots) {
        if (totalBallots <= CHUNK_SIZE) {
            return new ChunkConfiguration(1, List.of(totalBallots));
        }
        
        int numChunks = totalBallots / CHUNK_SIZE;
        if (totalBallots % CHUNK_SIZE > 0 && numChunks > 0) {
            // Don't create an extra chunk, distribute evenly
            List<Integer> chunkSizes = distributeEvenly(totalBallots, numChunks);
            return new ChunkConfiguration(numChunks, chunkSizes);
        }
        
        // Perfect division
        List<Integer> chunkSizes = new ArrayList<>();
        for (int i = 0; i < numChunks; i++) {
            chunkSizes.add(CHUNK_SIZE);
        }
        return new ChunkConfiguration(numChunks, chunkSizes);
    }
    
    /**
     * Distribute ballots evenly across chunks
     */
    private List<Integer> distributeEvenly(int totalBallots, int numChunks) {
        List<Integer> chunkSizes = new ArrayList<>();
        int baseSize = totalBallots / numChunks;
        int remainder = totalBallots % numChunks;
        
        for (int i = 0; i < numChunks; i++) {
            chunkSizes.add(baseSize + (i < remainder ? 1 : 0));
        }
        return chunkSizes;
    }
    
    /**
     * Randomly assign ballots to chunks
     */
    public Map<Integer, List<Ballot>> assignBallotsToChunks(
            List<Ballot> ballots, ChunkConfiguration config) {
        
        List<Ballot> shuffled = new ArrayList<>(ballots);
        Collections.shuffle(shuffled);
        
        Map<Integer, List<Ballot>> chunks = new HashMap<>();
        int ballotIndex = 0;
        
        for (int chunkNum = 0; chunkNum < config.getNumChunks(); chunkNum++) {
            int chunkSize = config.getChunkSizes().get(chunkNum);
            List<Ballot> chunkBallots = shuffled.subList(
                ballotIndex, ballotIndex + chunkSize);
            chunks.put(chunkNum, new ArrayList<>(chunkBallots));
            ballotIndex += chunkSize;
        }
        
        return chunks;
    }
}

@Data
@AllArgsConstructor
class ChunkConfiguration {
    private int numChunks;
    private List<Integer> chunkSizes;
}
```

### 6. Update Election Service for Chunking

Modify election completion logic to:
1. Get all cast ballots for election
2. Calculate chunks using `ChunkingService`
3. Assign ballots randomly to chunks
4. Create `ElectionCenter` entry for each chunk
5. Call microservice for tally generation per chunk
6. Store encrypted tally in `ElectionCenter.encryptedTally`
7. Create `SubmittedBallot` entries linked to appropriate `electionCenterId`

### 7. Update Decryption Service

Modify guardian decryption logic to:
1. Load all `ElectionCenter` entries for the election
2. For each chunk:
   - Decrypt guardian's credentials once (shared across chunks)
   - Call microservice for partial decryption of that chunk
   - Create `Decryption` entry for that chunk
   - Create `CompensatedDecryption` entries if needed
3. After all chunks decrypted:
   - Parse results from each chunk
   - Aggregate into final election result
   - Store individual chunk results in `ElectionCenter.electionResult`

### 8. Result Aggregation DTO

Create DTOs for structured result storage:

```java
@Data
@AllArgsConstructor
@NoArgsConstructor
public class ChunkResult {
    private Long electionCenterId;
    private int chunkNumber;
    private Map<String, Integer> candidateVotes; // candidateName -> votes
    private List<String> ballotTrackingCodes;
    private List<String> ballotHashes;
}

@Data
@AllArgsConstructor
@NoArgsConstructor  
public class AggregatedElectionResult {
    private Long electionId;
    private Map<String, Integer> finalResults; // candidateName -> total votes
    private List<ChunkResult> chunkResults;
    private Instant tallyCompletedAt;
}
```

Store as JSON in `ElectionCenter.electionResult`.

### 9. Update ElectionController

Add/modify endpoints:
- `GET /api/elections/{id}/results` - Return aggregated results
- `GET /api/elections/{id}/chunks` - Return chunk information
- `GET /api/elections/{id}/verification` - Include per-chunk verification data

### 10. Update Repository Queries

Update repositories to query by `userEmail` instead of `userId`:
- `GuardianRepository`: Add `findByUserEmail()`, `findByElectionIdAndUserEmail()`
- `AllowedVoterRepository`: Add `findByElectionIdAndUserEmail()`
- Update all service methods using these repositories

### 11. Frontend Authentication Changes

#### Update [frontend/src/pages/Login.jsx](frontend/src/pages/Login.jsx):
- Remove signup button from home screen
- Change to single "Sign In" button
- Create two-step login flow:
  1. Email input screen → calls `/api/auth/request-otp`
  2. OTP verification screen → calls `/api/auth/verify-otp`
- Add 5-minute countdown timer for OTP
- Store JWT token from response

#### Update [frontend/src/utils/auth.js](frontend/src/utils/auth.js):
- Remove old registration/login logic
- Add OTP request and verification functions
- Update token management

### 12. Frontend Results Page with Animation

Create [frontend/src/pages/ResultsPage.jsx](frontend/src/pages/ResultsPage.jsx):
- Fetch results from `/api/elections/{id}/results`
- Display chunks sequentially with animations
- Show vote bars climbing for each candidate as chunks are revealed
- Final combined totals after all chunks shown
- Display all ballot tracking codes and hashes with chunk assignments

Animation library suggestion: `framer-motion` or `react-spring`

Example structure:
```jsx
{chunkResults.map((chunk, index) => (
  <motion.div
    key={chunk.chunkNumber}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.5 }}
  >
    <h3>Chunk {chunk.chunkNumber}</h3>
    {/* Animated vote bars */}
  </motion.div>
))}
```

### 13. Frontend Verification Page Updates

Update [frontend/src/pages/VerificationPage.jsx](frontend/src/pages/VerificationPage.jsx):
- Add "Chunks" tab
- For each chunk, display:
  - Encrypted tally
  - Partial decryptions by each guardian
  - Compensated decryptions
  - Final decrypted result
- Keep existing verification features

### 14. Loading States

Update election page to show:
- "Tally is being created..." message when status is "completed" but chunks not yet created
- Allow viewing other election info while tally is processing
- Poll backend for tally status

### 15. Testing Requirements

Create tests for:
- OTP generation and expiration
- Chunk calculation with various ballot counts
- Random ballot assignment (verify no duplicates)
- Result aggregation accuracy
- Guardian decryption across multiple chunks

## Configuration

Add to `application.properties`:
```properties
amarvote.chunking.chunk-size=64
amarvote.otp.validity-minutes=5
```

## Migration Steps

1. Run SQL scripts to create new tables
2. Deploy backend with new endpoints
3. Run data migration to populate `userEmail` fields if existing data
4. Deploy frontend with new authentication flow
5. Test end-to-end with small election
6. Test with large election (> 64 ballots) to verify chunking

## Security Considerations

- OTP codes must be single-use
- Expired OTPs must not be accepted
- Rate limit OTP requests per email (e.g., 3 per hour)
- Ensure chunk assignment randomization is cryptographically secure
- Verify no ballot appears in multiple chunks

## Performance Notes

- Chunk processing can be parallelized
- Consider async/background job for tally creation
- Index `election_center_id` foreign keys properly
- Cache aggregated results after computation

## API Endpoints Summary

### Authentication
- `POST /api/auth/request-otp` - Request OTP code
- `POST /api/auth/verify-otp` - Verify OTP and login
- `GET /api/auth/session` - Check current session
- `POST /api/auth/logout` - Logout

### Elections (to be updated)
- `GET /api/elections/{id}/results` - Get aggregated results
- `GET /api/elections/{id}/chunks` - Get chunk information  
- `GET /api/elections/{id}/verification` - Get verification data with chunks
- `POST /api/elections/{id}/tally` - Trigger tally creation (with chunking)

### Guardians (to be updated)
- `POST /api/guardians/{id}/decrypt` - Submit decryption for all chunks

## Notes

- Microservice calls remain unchanged - just called multiple times (once per chunk)
- Guardian credentials decrypted once, used for all chunks
- Each chunk is treated as independent "mini-election" for tallying/decryption
- Final result is sum of all chunk results
- Verification data available per-chunk and aggregated
