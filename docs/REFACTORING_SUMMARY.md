# AmarVote Major Refactoring - Implementation Summary

## Date: January 4, 2026

## What Has Been Completed

### 1. Database Schema Updates ✅

#### New Tables/Models Created:
- **ElectionCenter**: Stores encrypted tally and election result for each chunk
  - `election_center_id` (PK)
  - `election_id` (FK to elections)
  - `encrypted_tally` (TEXT)
  - `election_result` (TEXT - stores JSON)

- **Decryption**: Stores partial decryptions per guardian per chunk
  - `decryption_id` (PK)
  - `election_center_id` (FK)
  - `guardian_id` (FK)
  - `partial_decrypted_tally` (TEXT)
  - `guardian_decryption_key` (TEXT)
  - `tally_share` (TEXT)
  - `key_backup` (TEXT)
  - `date_performed` (TIMESTAMP)

- **OtpVerification**: Stores OTP codes for authentication
  - `otp_id` (PK)
  - `user_email` (TEXT)
  - `otp_code` (VARCHAR(6))
  - `created_at` (TIMESTAMP)
  - `expires_at` (TIMESTAMP)
  - `is_used` (BOOLEAN)

#### Models Updated to Use user_email:
- **Guardian**: Changed from `user_id` to `user_email`
- **AllowedVoter**: Changed from `user_id` to `user_email`
- **Election**: Removed `encrypted_tally` (moved to ElectionCenter)
- **SubmittedBallot**: Changed from `election_id` to `election_center_id`
- **CompensatedDecryption**: Changed to use `election_center_id` and guardian IDs instead of sequences

### 2. Repository Layer ✅

Created new repositories:
- `ElectionCenterRepository`
- `DecryptionRepository`
- `OtpVerificationRepository`

**Note**: Existing repositories need updates to query by `user_email`:
- `GuardianRepository` - Add methods: `findByUserEmail()`, `findByElectionIdAndUserEmail()`
- `AllowedVoterRepository` - Add method: `findByElectionIdAndUserEmail()`

### 3. OTP-Based Authentication System ✅

#### Backend Components:
- **OtpAuthService**:
  - `sendOtp(String userEmail)` - Generates 6-digit OTP, stores in DB, sends email
  - `verifyOtpAndGenerateToken(String userEmail, String otpCode)` - Verifies OTP and returns JWT token
  - OTP valid for 5 minutes
  - Single-use OTPs

- **OtpAuthController**:
  - `POST /api/auth/request-otp` - Request OTP code
  - `POST /api/auth/verify-otp` - Verify OTP and receive JWT token
  - `GET /api/auth/session` - Check current session (existing)
  - `POST /api/auth/logout` - Logout (existing)

- **EmailService** updated:
  - Added `sendOtpEmail(String toEmail, String otpCode)` method
  - Inline HTML template for OTP emails

#### DTOs Created:
- `OtpRequestDto` - For requesting OTP
- `OtpVerifyDto` - For verifying OTP
- `OtpResponseDto` - Generic response
- `OtpLoginResponseDto` - Response with JWT token

### 4. Chunking System ✅

#### ChunkingService Created:
- `calculateChunks(int totalBallots)` - Calculates optimal chunk configuration
  - Rules implemented:
    - ≤ CHUNK_SIZE ballots: 1 chunk
    - > CHUNK_SIZE: Divides into n chunks where n = floor(totalBallots/CHUNK_SIZE)
    - Remainder distributed evenly across chunks
  - Examples:
    - 162 ballots, CHUNK_SIZE=64 → 2 chunks (81, 81)
    - 11 ballots, CHUNK_SIZE=3 → 3 chunks (4, 4, 3)
    - 50 ballots, CHUNK_SIZE=64 → 1 chunk (50)

- `assignBallotsToChunks(List<Ballot> ballots, ChunkConfiguration config)` 
  - Randomly assigns ballots to chunks using cryptographically secure randomization
  - Ensures each ballot assigned to exactly one chunk

- `verifyChunkAssignment()` - Validates chunk assignment

#### DTOs for Chunking:
- `ChunkConfiguration` - Number of chunks and their sizes
- `ChunkResult` - Individual chunk results with votes, tracking codes, hashes
- `AggregatedElectionResult` - Combined results from all chunks

### 5. Database Scripts ✅
- Created `otp_table_creation.sql` with indexes
- `table_creation_file_AmarVote.sql` already has election_center table

## What Needs To Be Done

### CRITICAL - Backend Service Layer Updates

1. **Update ElectionService** (HIGH PRIORITY):
   - Modify election completion/tally creation to:
     - Get all cast ballots
     - Calculate chunks using ChunkingService
     - Assign ballots randomly to chunks
     - Create ElectionCenter entries for each chunk
     - Call microservice for tally per chunk
     - Store tallies in ElectionCenter
     - Create SubmittedBallot entries with correct election_center_id

2. **Update Guardian/Decryption Service** (HIGH PRIORITY):
   - Modify decryption flow to:
     - Process each chunk separately
     - Decrypt guardian credentials once (shared)
     - Call microservice for each chunk's partial decryption
     - Create Decryption and CompensatedDecryption entries per chunk
     - Aggregate results from all chunks
     - Store in ElectionCenter.election_result as JSON

3. **Create ResultAggregationService**:
   - Parse chunk results from microservice responses
   - Combine into AggregatedElectionResult
   - Serialize to JSON for storage
   - Deserialize for frontend retrieval

4. **Update Repository Methods**:
   - GuardianRepository: Add user_email based queries
   - AllowedVoterRepository: Add user_email based queries
   - Update all service methods using these repositories

5. **Update ElectionController**:
   - `GET /api/elections/{id}/results` - Return aggregated results
   - `GET /api/elections/{id}/chunks` - Return chunk information
   - `GET /api/elections/{id}/verification` - Include per-chunk data

### Frontend Updates Required

1. **Authentication Flow** (HIGH PRIORITY):
   - Update Login page:
     - Remove "Sign Up" button
     - Single "Sign In" button
     - Two-step flow:
       1. Enter email → Call `/api/auth/request-otp`
       2. Enter 6-digit code → Call `/api/auth/verify-otp`
     - Add 5-minute countdown timer
     - Handle OTP expiration

2. **Results Page with Animation** (HIGH PRIORITY):
   - Create new ResultsPage component
   - Fetch from `/api/elections/{id}/results`
   - Animate chunks appearing sequentially
   - Show vote bars climbing for each candidate
   - Display final combined totals
   - Show all ballot tracking codes with chunk assignments
   - Suggested libraries: `framer-motion` or `react-spring`

3. **Verification Page Updates**:
   - Add "Chunks" tab
   - Display per-chunk verification data:
     - Encrypted tally
     - Partial decryptions by guardian
     - Compensated decryptions
     - Decrypted result
   - Keep existing verification features

4. **Loading States**:
   - Show "Tally is being created..." when chunks being processed
   - Allow viewing other election info during tally creation
   - Poll backend for tally completion status

### Configuration

Add to `application.properties`:
```properties
amarvote.chunking.chunk-size=64
amarvote.otp.validity-minutes=5
```

### Testing Requirements

Create tests for:
- [ ] OTP generation, validation, expiration
- [ ] OTP single-use enforcement
- [ ] Chunk calculation with various ballot counts
- [ ] Ballot assignment randomization
- [ ] No ballot duplication across chunks
- [ ] Result aggregation accuracy
- [ ] Multi-chunk decryption flow
- [ ] Frontend OTP flow
- [ ] Frontend result animation

### Database Migration

1. Run `otp_table_creation.sql`
2. If existing data: Migrate user_id to user_email in guardians and allowed_voters
3. Test all queries

### Deployment Checklist

- [ ] Update database schema
- [ ] Deploy backend with new endpoints
- [ ] Deploy frontend with new auth flow
- [ ] Test small election end-to-end
- [ ] Test large election (>64 ballots) for chunking
- [ ] Verify all existing features still work

## Key Design Decisions

1. **No Users Table**: Authentication based solely on email + OTP
2. **Chunk Size Configurable**: Default 64, adjustable via properties
3. **Random Assignment**: Cryptographically secure randomization for chunk assignment
4. **One-Time Tallying**: Results computed once and stored, not recomputed
5. **Per-Chunk Verification**: All verification data available at chunk level
6. **JSON Result Storage**: Structured results stored as JSON in database
7. **Backward Compatibility**: JWT tokens still used, email extracted from token

## Security Considerations

- OTP codes must be single-use
- Rate limit OTP requests (3 per email per hour recommended)
- OTP expiration strictly enforced
- Secure random for chunk assignment
- Verify no ballot in multiple chunks
- Guardian credentials decrypted once per election

## Performance Considerations

- Chunk processing can be parallelized (future enhancement)
- Consider async/background jobs for tally creation
- Cache aggregated results after first computation
- Proper indexing on election_center_id foreign keys

## Files Created/Modified

### Created:
- `backend/src/main/java/com/amarvote/amarvote/model/ElectionCenter.java`
- `backend/src/main/java/com/amarvote/amarvote/model/Decryption.java`
- `backend/src/main/java/com/amarvote/amarvote/model/OtpVerification.java`
- `backend/src/main/java/com/amarvote/amarvote/repository/ElectionCenterRepository.java`
- `backend/src/main/java/com/amarvote/amarvote/repository/DecryptionRepository.java`
- `backend/src/main/java/com/amarvote/amarvote/repository/OtpVerificationRepository.java`
- `backend/src/main/java/com/amarvote/amarvote/service/OtpAuthService.java`
- `backend/src/main/java/com/amarvote/amarvote/service/ChunkingService.java`
- `backend/src/main/java/com/amarvote/amarvote/controller/OtpAuthController.java`
- `backend/src/main/java/com/amarvote/amarvote/dto/OtpRequestDto.java`
- `backend/src/main/java/com/amarvote/amarvote/dto/OtpVerifyDto.java`
- `backend/src/main/java/com/amarvote/amarvote/dto/OtpResponseDto.java`
- `backend/src/main/java/com/amarvote/amarvote/dto/OtpLoginResponseDto.java`
- `backend/src/main/java/com/amarvote/amarvote/dto/ChunkConfiguration.java`
- `backend/src/main/java/com/amarvote/amarvote/dto/ChunkResult.java`
- `backend/src/main/java/com/amarvote/amarvote/dto/AggregatedElectionResult.java`
- `Database/otp_table_creation.sql`
- `docs/CHUNKING_IMPLEMENTATION_GUIDE.md`

### Modified:
- `backend/src/main/java/com/amarvote/amarvote/model/Guardian.java` - user_email
- `backend/src/main/java/com/amarvote/amarvote/model/AllowedVoter.java` - user_email
- `backend/src/main/java/com/amarvote/amarvote/model/Election.java` - removed encryptedTally
- `backend/src/main/java/com/amarvote/amarvote/model/SubmittedBallot.java` - election_center_id
- `backend/src/main/java/com/amarvote/amarvote/model/CompensatedDecryption.java` - updated structure
- `backend/src/main/java/com/amarvote/amarvote/model/CompensatedDecryptionId.java` - updated fields
- `backend/src/main/java/com/amarvote/amarvote/service/EmailService.java` - added sendOtpEmail

## Next Steps (Priority Order)

1. **Add configuration to application.properties**
2. **Update GuardianRepository and AllowedVoterRepository** with user_email queries
3. **Modify ElectionService** for chunked tally creation
4. **Modify Decryption/Guardian Service** for chunk processing
5. **Create ResultAggregationService**
6. **Update ElectionController** with new endpoints
7. **Update Frontend Login flow**
8. **Create Frontend Results animation page**
9. **Update Frontend Verification page**
10. **Comprehensive testing**

## Notes

- The microservice API calls remain unchanged - they're just called multiple times (once per chunk)
- Each chunk is treated as an independent mini-election for tallying/decryption
- Guardian credentials are decrypted once and reused for all chunks
- The final election result is the sum of all chunk results
- All verification data is available both per-chunk and aggregated

## Contact

For questions or clarifications on this refactoring, refer to:
- `docs/CHUNKING_IMPLEMENTATION_GUIDE.md` - Detailed implementation guide
- Database schema: `Database/table_creation_file_AmarVote.sql`
- OTP table: `Database/otp_table_creation.sql`
