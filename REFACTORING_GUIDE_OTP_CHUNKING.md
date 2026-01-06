# AmarVote Refactoring Guide - OTP Authentication & Chunking System

## Overview
This document outlines the complete refactoring needed to:
1. Remove User table and use email-based authentication with OTP
2. Implement ballot chunking for scalable election tallying
3. Update frontend to single sign-in flow

## Database Changes

### ✅ Completed Models
- **AllowedVoter**: Now uses composite key (election_id, user_email)
- **Guardian**: Uses user_email, removed duplicate fields from decryptions table
- **ElectionCenter**: Separate table for chunk-based tallies
- **OtpVerification**: Table for OTP codes (5-minute validity)

### ❌ Models to Delete
1. **User.java** - No longer needed
2. **PasswordResetToken.java** - No longer needed  
3. **VerificationCode.java** - No longer needed
4. **UserPrincipal.java** - No longer needed

### 📝 Repositories to Delete/Update
- Delete: UserRepository, PasswordResetTokenRepository, VerificationCodeRepository
- Update: AllowedVoterRepository to use composite key

## Backend Service Changes

### Critical Files Needing Updates

#### 1. BallotService.java
**Issues:**
- Lines using `user.getUserId()` need to use `userEmail` directly
- Methods: `checkVoterEligibility`, `hasUserAlreadyVoted`, `updateVoterStatus`
- VoterIdGenerator calls need email instead of userId

**Required Changes:**
```java
// OLD
boolean isEligible = checkVoterEligibility(user.getUserId(), election);
private boolean checkVoterEligibility(Integer userId, Election election)

// NEW  
boolean isEligible = checkVoterEligibility(userEmail, election);
private boolean checkVoterEligibility(String userEmail, Election election)
```

#### 2. ElectionService.java
**Issues:**
- Uses UserRepository to find userId from email
- Methods creating AllowedVoter with userId

**Required Changes:**
```java
// OLD
Integer userId = userRepository.findByUserEmail(email).getUserId();
AllowedVoter.builder().userId(userId)

// NEW
AllowedVoter.builder()
    .electionId(electionId)
    .userEmail(email)
    .hasVoted(false)
```

#### 3. MyUserDetailsService.java
**Purpose:** Spring Security UserDetailsService
**Current:** Loads User from database
**New:** Create email-only UserDetails without database lookup

```java
@Service
public class MyUserDetailsService implements UserDetailsService {
    
    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        // Return a UserDetails with just the email
        return org.springframework.security.core.userdetails.User
                .withUsername(email)
                .password("") // No password needed for OTP
                .authorities("ROLE_USER")
                .build();
    }
}
```

#### 4. UserService.java
**Action:** DELETE this entire service - no longer needed

#### 5. VerificationCodeService.java  
**Action:** DELETE this entire service - replaced by OtpAuthService

#### 6. PasswordResetTokenService.java
**Action:** DELETE this entire service - no longer needed

#### 7. VoterIdGenerator.java
**Update all methods to use email instead of userId:**
```java
// OLD
public static String generateBallotHashId(Integer userId, Long electionId)
String combined = APP_SALT + ":" + userId + ":" + electionId;

// NEW
public static String generateBallotHashId(String userEmail, Long electionId)
String combined = APP_SALT + ":" + userEmail + ":" + electionId;
```

### Controllers to Delete/Update

#### Delete:
- **UserController.java** - User management no longer needed
- **PasswordController.java** - Password reset no longer needed  
- **VerificationController.java** - Email verification no longer needed

#### Keep & Update:
- **OtpAuthController.java** - Already correct! ✅
- **ElectionController.java** - Update to use email instead of userId
- **ImageUploadController.java** - Update to use email from JWT

## Frontend Changes

### 1. Home.jsx
**Current:** Two buttons (Sign In, Sign Up)
**New:** Single "Sign In" button

```jsx
// OLD
<Link to="/login">
  <button>Sign In</button>
</Link>
<Link to="/signup">
  <button>Sign Up</button>
</Link>

// NEW  
<Link to="/otp-login">
  <button>Sign In</button>
</Link>
```

### 2. Create New OTP Login Flow
**File:** `frontend/src/pages/OtpLogin.jsx`

```jsx
// Step 1: Enter Email
<input type="email" placeholder="Enter your email" />
<button onClick={handleSendOTP}>Continue</button>

// Step 2: Enter OTP Code
<input type="text" placeholder="Enter 6-digit code" />
<button onClick={handleVerifyOTP}>Sign In</button>

// Timer: "Code expires in 4:32"
```

### 3. Delete Pages
- **Login.jsx** - Replace with OtpLogin.jsx
- **Signup.jsx** - No longer needed

### 4. Update Routes
```jsx
// OLD
<Route path="/login" element={<Login />} />
<Route path="/signup" element={<Signup />} />

// NEW
<Route path="/otp-login" element={<OtpLogin />} />
```

## Chunking System

### ✅ Already Implemented
- **ChunkingService.java** - Calculates chunks correctly
- **ElectionCenter** table structure

### 🔧 Integration Needed

#### TallyService.java
```java
// After voting ends:
1. Calculate chunk configuration
2. Randomly distribute ballots to chunks  
3. For each chunk:
   - Create ElectionCenter row
   - Send ballots to microservice for tally
   - Store encrypted_tally in ElectionCenter
   - Store ballot cipher_text in SubmittedBallot (with election_center_id)
```

#### PartialDecryptionService.java
```java
// When guardians submit private keys:
1. Decrypt guardian credentials
2. For each chunk (ElectionCenter):
   - Call microservice with chunk's encrypted tally
   - Generate partial decryption for that chunk
   - Store in Decryptions table (with election_center_id)
   - Generate compensated decryptions if needed
3. Combine results from all chunks
4. Store combined result in each ElectionCenter.election_result
```

### Results Display

#### Backend Endpoint
```java
@GetMapping("/elections/{id}/results")
public ResultsDto getResults(Long electionId) {
    // Return:
    // - Individual chunk results: [{chunkId: 1, results: {A:1, B:2}}, ...]
    // - Combined results: {A:4, B:3}
    // - All ballot tracking codes with their chunk assignments
}
```

#### Frontend Animation
**File:** `frontend/src/pages/ElectionResults.jsx`

```jsx
// Animate chunks adding up:
Chunk 1: A ▓▓ (2)  B ▓▓▓ (3)
Chunk 2: A ▓    (1)  B ▓ (1)
---------------------------------
Final:   A ▓▓▓ (3)  B ▓▓▓▓ (4)

// Use React Spring or Framer Motion for animations
```

## Verification Tab Updates

### Show Per-Chunk Data
```jsx
<Tabs>
  <Tab label="Overview">
    {/* Existing election info */}
  </Tab>
  
  <Tab label="Chunks">
    {chunks.map(chunk => (
      <ChunkVerification 
        chunkId={chunk.id}
        encryptedTally={chunk.encryptedTally}
        partialDecryptions={chunk.decryptions}
        compensatedDecryptions={chunk.compensatedDecryptions}
      />
    ))}
  </Tab>
  
  <Tab label="Ballots">
    {/* Show all ballot tracking codes grouped by chunk */}
  </Tab>
</Tabs>
```

## Security Configuration

### Update JwtAuthenticationFilter
Ensure it extracts email from JWT correctly:

```java
String email = jwtService.extractUserEmailFromToken(token);
UserDetails userDetails = userDetailsService.loadUserByUsername(email);
```

## Testing Checklist

- [ ] OTP email sending works
- [ ] OTP verification and JWT generation works  
- [ ] Frontend redirects after successful OTP login
- [ ] Email is correctly extracted from JWT in all endpoints
- [ ] Elections can be created with email-based allowed voters
- [ ] Voting works without User table
- [ ] Chunking divides ballots correctly
- [ ] Tally creation works for each chunk
- [ ] Decryption works per chunk
- [ ] Results combine correctly
- [ ] Results page animates properly
- [ ] Verification tab shows per-chunk data

## Migration Notes

### Database Migration
```sql
-- Remove User table dependencies
ALTER TABLE allowed_voters DROP CONSTRAINT IF EXISTS allowed_voters_user_id_fkey;
ALTER TABLE guardians DROP COLUMN IF EXISTS user_id;

-- Drop obsolete tables
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS password_reset_tokens CASCADE;
DROP TABLE IF EXISTS signup_verification CASCADE;

-- Ensure indexes are correct
CREATE INDEX IF NOT EXISTS idx_allowed_voters_email ON allowed_voters(user_email);
CREATE INDEX IF NOT EXISTS idx_guardians_email ON guardians(user_email);
```

### Backend Config
Ensure `application.properties` has:
```properties
# JWT Settings
jwt.secret=your-secret-key
jwt.expiration=604800000

# Email Settings  
spring.mail.host=smtp.gmail.com
spring.mail.port=587
spring.mail.username=your-email
spring.mail.password=your-app-password

# Chunking
amarvote.chunking.chunk-size=64
```

## Priority Order

### Phase 1: Authentication (Critical)
1. ✅ Create JwtUtil
2. Delete User/Password/Verification models & repos
3. Update MyUserDetailsService to email-only
4. Update all services removing userId references
5. Update VoterIdGenerator to use email
6. Frontend: Create OtpLogin component
7. Frontend: Update Home.jsx navigation

### Phase 2: Chunking (High Priority)
1. Verify ChunkingService logic
2. Update TallyService to create chunks
3. Update PartialDecryptionService for per-chunk decryption  
4. Create results aggregation endpoint
5. Frontend: Results animation component
6. Frontend: Verification per-chunk display

### Phase 3: Cleanup & Polish
1. Delete obsolete controllers/services
2. Remove unused imports
3. Update error messages
4. Add logging
5. Write integration tests

---

**Status:** This document covers all required changes. Implementation should follow the priority order above.
