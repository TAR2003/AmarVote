# AmarVote Refactoring - Implementation Status

## ✅ Completed Changes

### Models
1. **AllowedVoter.java** - Updated to use composite key (election_id, user_email)
2. **Guardian.java** - Cleaned up, uses user_email, removed duplicate fields
3. **ElectionCenter.java** - Already correct ✅
4. **OtpVerification.java** - Already correct ✅
5. **Decryption.java** - Already correct ✅
6. **CompensatedDecryption.java** - Already correct ✅
7. **SubmittedBallot.java** - Already correct ✅

### Services
1. **MyUserDetailsService.java** - Updated to work without User table ✅
2. **OtpAuthService.java** - Already correct ✅
3. **ChunkingService.java** - Already implemented ✅

### Utilities
1. **JwtUtil.java** - Created new wrapper ✅
2. **VoterIdGenerator.java** - Updated to use email instead of userId ✅

### Documentation
1. **REFACTORING_GUIDE_OTP_CHUNKING.md** - Complete refactoring guide ✅
2. **migrate_to_email_auth.py** - Migration script ✅

## 🔄 Remaining Backend Changes

### Critical - Must Fix for Compilation

#### BallotService.java (Lines to update: ~50 instances)
```java
// Remove User and UserRepository imports
// Remove UserRepository autowiring

// Line ~145: Change user lookup
- Optional<User> userOpt = userRepository.findByUserEmail(userEmail);
- if (!userOpt.isPresent()) { return error; }
- User user = userOpt.get();
+ if (userEmail == null || userEmail.trim().isEmpty()) { return error; }

// Lines ~175, 196, 219, 275, 344, 347, 661, 682, 704, 770, 817, 962, 972, 1009:
- user.getUserId()
+ userEmail

// Lines ~401, 453, 462: Update method signatures
- private boolean checkVoterEligibility(Integer userId, Election election)
+ private boolean checkVoterEligibility(String userEmail, Election election)

- private boolean hasUserAlreadyVoted(Integer userId, Long electionId)
+ private boolean hasUserAlreadyVoted(String userEmail, Long electionId)

- private void updateVoterStatus(Integer userId, Election election)
+ private void updateVoterStatus(String userEmail, Election election)

// Lines ~412, 458, 467: Update AllowedVoter comparisons
- .anyMatch(av -> av.getUserId().equals(userId))
+ .anyMatch(av -> av.getUserEmail().equals(userEmail))

// Lines ~481: Update AllowedVoter builder
- .userId(userId)
+ .userEmail(userEmail)
```

#### ElectionService.java (Lines to update: ~30 instances)
```java
// Remove User and UserRepository imports
// Remove UserRepository autowiring

// Lines ~260-272: Simplify voter addition
for (String email : allowedVoterEmails) {
-   Integer userId = userRepository.findByUserEmail(email)
-       .orElseThrow(() -> new RuntimeException("User not found"))
-       .getUserId();
    
    AllowedVoter allowedVoter = AllowedVoter.builder()
            .electionId(savedElection.getElectionId())
-           .userId(userId)
+           .userEmail(email)
            .hasVoted(false)
            .build();
}

// Lines ~318-324: Same pattern for guardian addition

// Lines ~461: Fix voted check
- .anyMatch(av -> av.getUserId().equals(userOpt.get().getUserId()) && av.getHasVoted())
+ .anyMatch(av -> av.getUserEmail().equals(userEmail) && av.getHasVoted())

// Lines ~1110: Remove userId from guardian data
- guardianData.put("userId", guardian.getUserId());
+ // userId not needed

// Lines ~1123: Simplify user lookup
- Optional<User> userOpt = userRepository.findById(guardian.getUserId());
- guardianData.put("email", userOpt.get().getUserEmail());
+ guardianData.put("email", guardian.getUserEmail());

// Lines ~1162, 1170: Same for compensated decryptions
```

#### PartialDecryptionService.java
```java
// Remove User import
// Remove any UserRepository usage
// Replace guardian.getUserId() lookups with guardian.getUserEmail()
```

### Files to Delete (No longer needed)
```bash
rm backend/src/main/java/com/amarvote/amarvote/model/User.java
rm backend/src/main/java/com/amarvote/amarvote/model/UserPrincipal.java
rm backend/src/main/java/com/amarvote/amarvote/model/PasswordResetToken.java
rm backend/src/main/java/com/amarvote/amarvote/model/VerificationCode.java

rm backend/src/main/java/com/amarvote/amarvote/repository/UserRepository.java
rm backend/src/main/java/com/amarvote/amarvote/repository/PasswordResetTokenRepository.java
rm backend/src/main/java/com/amarvote/amarvote/repository/VerificationCodeRepository.java

rm backend/src/main/java/com/amarvote/amarvote/service/UserService.java
rm backend/src/main/java/com/amarvote/amarvote/service/PasswordResetTokenService.java
rm backend/src/main/java/com/amarvote/amarvote/service/VerificationCodeService.java
rm backend/src/main/java/com/amarvote/amarvote/service/UserSearchService.java

rm backend/src/main/java/com/amarvote/amarvote/controller/UserController.java
rm backend/src/main/java/com/amarvote/amarvote/controller/PasswordController.java
rm backend/src/main/java/com/amarvote/amarvote/controller/VerificationController.java
rm backend/src/main/java/com/amarvote/amarvote/controller/UserSearchController.java
rm backend/src/main/java/com/amarvote/amarvote/controller/ImageUploadController.java
```

### DTOs to Update
```java
// UserProfileDTO.java - Remove userId field
// UserSearchResponse.java - Remove userId field
// Or delete these files if not needed
```

## 🔄 Frontend Changes Needed

### 1. Create OtpLogin Component
**File:** `frontend/src/pages/OtpLogin.jsx`

**Features:**
- Email input with validation
- OTP code input (6 digits)
- Countdown timer (5 minutes)
- Error handling
- Success redirect to dashboard

**API Calls:**
```javascript
// Step 1: Request OTP
POST /api/auth/request-otp
Body: { email: "user@example.com" }

// Step 2: Verify OTP  
POST /api/auth/verify-otp
Body: { email: "user@example.com", otpCode: "123456" }
Response: { success: true, message: "Login successful", token: "..." }
```

### 2. Update Home.jsx
```jsx
// Replace Sign In / Sign Up buttons with single Sign In button
<Link to="/auth">
  <button className="px-4 py-2 bg-blue-600 text-white rounded-md">
    Sign In
  </button>
</Link>
```

### 3. Update App Routes
```jsx
// Remove old routes
- <Route path="/login" element={<Login />} />
- <Route path="/signup" element={<Signup />} />

// Add new route
+ <Route path="/auth" element={<OtpLogin />} />
```

### 4. Delete Obsolete Pages
```bash
rm frontend/src/pages/Login.jsx
rm frontend/src/pages/Signup.jsx
```

### 5. Update Navbar/Header
Remove any signup links, keep only sign-in

## 🔧 Chunking Integration (Already Mostly Done)

### TallyService.java - Add Chunking
```java
public void createTally(Long electionId) {
    List<Ballot> ballots = ballotRepository.findByElectionIdAndStatus(electionId, "cast");
    
    // Calculate chunks
    ChunkConfiguration config = chunkingService.calculateChunks(ballots.size());
    Map<Integer, List<Ballot>> chunks = chunkingService.assignBallotsToChunks(ballots, config);
    
    // Process each chunk
    for (Map.Entry<Integer, List<Ballot>> entry : chunks.entrySet()) {
        int chunkNumber = entry.getKey();
        List<Ballot> chunkBallots = entry.getValue();
        
        // Call microservice for this chunk's tally
        String encryptedTally = callMicroserviceForTally(chunkBallots);
        
        // Save to ElectionCenter
        ElectionCenter center = ElectionCenter.builder()
            .electionId(electionId)
            .encryptedTally(encryptedTally)
            .build();
        electionCenterRepository.save(center);
        
        // Save submitted ballots with election_center_id
        for (Ballot ballot : chunkBallots) {
            SubmittedBallot sb = SubmittedBallot.builder()
                .electionCenterId(center.getElectionCenterId())
                .cipherText(ballot.getCipherText())
                .build();
            submittedBallotRepository.save(sb);
        }
    }
}
```

### PartialDecryptionService.java - Per-Chunk Decryption
```java
public void decryptElection(Long electionId, GuardianDecryptionRequest request) {
    // Get all chunks for this election
    List<ElectionCenter> chunks = electionCenterRepository.findByElectionId(electionId);
    
    // Decrypt each chunk
    for (ElectionCenter chunk : chunks) {
        // Call microservice for partial decryption of this chunk
        String partialDecryption = callMicroserviceForDecryption(
            chunk.getEncryptedTally(), 
            request.getGuardianPrivateKey()
        );
        
        // Save decryption
        Decryption dec = Decryption.builder()
            .electionCenterId(chunk.getElectionCenterId())
            .guardianId(guardianId)
            .partialDecryptedTally(partialDecryption)
            .build();
        decryptionRepository.save(dec);
    }
    
    // After all guardians decrypt, combine results
    if (allGuardiansDecrypted(electionId)) {
        combineChunkResults(electionId);
    }
}

private void combineChunkResults(Long electionId) {
    List<ElectionCenter> chunks = electionCenterRepository.findByElectionId(electionId);
    
    Map<String, Integer> combinedResults = new HashMap<>();
    List<String> allBallotTracking = new ArrayList<>();
    
    for (ElectionCenter chunk : chunks) {
        // Get decrypted result for this chunk from microservice
        Map<String, Integer> chunkResult = getChunkFinalResult(chunk);
        
        // Add to combined results
        chunkResult.forEach((candidate, votes) -> 
            combinedResults.merge(candidate, votes, Integer::sum)
        );
        
        // Store chunk result in election_result
        chunk.setElectionResult(serializeChunkResult(chunkResult, ballotList));
        electionCenterRepository.save(chunk);
    }
}
```

### Results API Endpoint
```java
@GetMapping("/elections/{id}/results")
public ResponseEntity<ElectionResultsDto> getResults(@PathVariable Long id) {
    List<ElectionCenter> chunks = electionCenterRepository.findByElectionId(id);
    
    ElectionResultsDto results = new ElectionResultsDto();
    results.setChunks(chunks.stream().map(this::parseChunkResult).collect(Collectors.toList()));
    results.setCombinedResults(calculateCombinedResults(chunks));
    results.setAllBallots(getAllBallotsWithChunkInfo(id));
    
    return ResponseEntity.ok(results);
}
```

### Frontend Results Page with Animation
```jsx
import { motion } from 'framer-motion';

function ElectionResults({ electionId }) {
  const [results, setResults] = useState(null);
  const [animationStep, setAnimationStep] = useState(0);
  
  // Animate chunk combination
  useEffect(() => {
    if (!results) return;
    
    const timer = setInterval(() => {
      if (animationStep < results.chunks.length) {
        setAnimationStep(prev => prev + 1);
      }
    }, 1500);
    
    return () => clearInterval(timer);
  }, [results, animationStep]);
  
  return (
    <div>
      <h2>Election Results</h2>
      
      {/* Animated bars */}
      {candidates.map(candidate => (
        <motion.div
          key={candidate.name}
          initial={{ width: 0 }}
          animate={{ 
            width: `${getVotesUpToChunk(candidate, animationStep)}%` 
          }}
          transition={{ duration: 0.8 }}
        >
          {candidate.name}: {getVotesUpToChunk(candidate, animationStep)} votes
        </motion.div>
      ))}
      
      {/* Chunk breakdown */}
      <div>
        <h3>Results by Chunk</h3>
        {results.chunks.map((chunk, idx) => (
          <ChunkResult key={idx} chunk={chunk} visible={idx <= animationStep} />
        ))}
      </div>
    </div>
  );
}
```

## 🧪 Testing Checklist

### Backend
- [ ] mvn clean compile (no errors)
- [ ] OTP email sending works
- [ ] OTP verification generates JWT
- [ ] JWT contains email (not userId)
- [ ] Election creation with email-based voters
- [ ] Voting without User table
- [ ] Chunking calculates correctly
- [ ] Tally per chunk works
- [ ] Decryption per chunk works
- [ ] Results combination correct

### Frontend  
- [ ] OTP login flow works
- [ ] Email validation
- [ ] OTP code validation
- [ ] Timer countdown works
- [ ] JWT stored in cookie
- [ ] Dashboard accessible after OTP login
- [ ] User email displayed in header
- [ ] Results animation smooth
- [ ] Chunk breakdown visible

## 🚀 Deployment Steps

1. **Backup database**
2. **Run migration SQL** (drop old tables)
3. **Deploy updated backend**
4. **Deploy updated frontend**
5. **Test OTP login flow**
6. **Test complete voting cycle**
7. **Monitor logs for errors**

## 📝 Notes

- The chunking logic is already implemented in ChunkingService ✅
- OTP authentication is implemented in OtpAuthController ✅  
- Main work is removing User table dependencies from services
- Frontend needs complete OTP login UI
- Results page needs animation implementation

**Estimated remaining work: 4-6 hours**
- Backend service updates: 2-3 hours
- Frontend OTP UI: 1-2 hours  
- Results animation: 1 hour
- Testing: 1-2 hours
