# AmarVote Refactoring - Summary of Work Completed

## ✅ What Has Been Completed

### 1. Database Models Fixed ✅
- **AllowedVoter.java**: Updated to use composite key (election_id, user_email) instead of separate id
- **Guardian.java**: Cleaned up, removed duplicate fields, uses guardian_id as primary key
- **Other models**: ElectionCenter, OtpVerification, Decryption, CompensatedDecryption, SubmittedBallot are all correct

### 2. Core Services Updated ✅
- **MyUserDetailsService.java**: No longer requires User table, creates UserDetails from email directly
- **OtpAuthService.java**: Already working correctly for OTP-based authentication
- **ChunkingService.java**: Already implemented with correct chunking logic

### 3. Utilities Created/Updated ✅
- **JwtUtil.java**: Created new wrapper utility for JWT operations
- **VoterIdGenerator.java**: Updated all methods to use `String userEmail` instead of `Integer userId`

### 4. Frontend Components Created ✅
- **OtpLogin.jsx**: Complete OTP authentication flow with:
  - Email input step
  - OTP verification step with 6-digit input
  - 5-minute countdown timer
  - Resend OTP functionality
  - Error handling and loading states
  - Clean, user-friendly UI

### 5. Frontend Navigation Updated ✅
- **Home.jsx**: Changed from two buttons (Sign In / Sign Up) to single "Sign In" button pointing to `/auth`

### 6. Documentation Created ✅
- **REFACTORING_GUIDE_OTP_CHUNKING.md**: Complete technical guide covering all changes
- **IMPLEMENTATION_STATUS.md**: Detailed status and remaining work
- **migrate_to_email_auth.py**: Python script to help automate backend changes

## 🔄 What Remains To Be Done

### Critical Backend Changes (Prevents Compilation)

#### 1. BallotService.java - ~50 lines to change
Remove `User` and `UserRepository` dependencies and replace all `userId` references with `userEmail`:

**Key changes:**
```java
// Remove imports and autowiring
- import com.amarvote.amarvote.model.User;
- import com.amarvote.amarvote.repository.UserRepository;
- @Autowired private UserRepository userRepository;

// Simplify user validation (line ~145)
- Optional<User> userOpt = userRepository.findByUserEmail(userEmail);
- if (!userOpt.isPresent()) { ... }
- User user = userOpt.get();
+ if (userEmail == null || userEmail.trim().isEmpty()) { ... }

// Replace user.getUserId() with userEmail (lines 175, 196, 219, 275, etc.)
- user.getUserId()
+ userEmail

// Update method signatures (lines 401, 453, 462)
- private boolean checkVoterEligibility(Integer userId, Election election)
+ private boolean checkVoterEligibility(String userEmail, Election election)

// Update AllowedVoter comparisons
- .anyMatch(av -> av.getUserId().equals(userId))
+ .anyMatch(av -> av.getUserEmail().equals(userEmail))

- .userId(userId)
+ .userEmail(userEmail)
```

**Affected lines:** 34, 60, 145-150, 175, 196, 219, 275, 344, 347, 401, 412, 453, 458, 462, 467, 481, 488, 661, 682, 704, 770, 817, 962, 972, 1009

#### 2. ElectionService.java - ~30 lines to change
Similar pattern - remove User/UserRepository and update voter/guardian handling:

**Key changes:**
```java
// Remove imports and autowiring
- import com.amarvote.amarvote.model.User;
- import com.amarvote.amarvote.repository.UserRepository;
- @Autowired private UserRepository userRepository;

// Simplify allowed voter creation (lines ~260-272)
for (String email : allowedVoterEmails) {
-   Integer userId = userRepository.findByUserEmail(email)
-       .orElseThrow(() -> new RuntimeException("User not found"))
-       .getUserId();
    
    AllowedVoter.builder()
        .electionId(electionId)
-       .userId(userId)
+       .userEmail(email)
        .hasVoted(false)
        .build();
}

// Simplify guardian email retrieval (lines ~1123)
- Optional<User> userOpt = userRepository.findById(guardian.getUserId());
- guardianData.put("email", userOpt.get().getUserEmail());
+ guardianData.put("email", guardian.getUserEmail());
```

**Affected lines:** 29, 260-272, 318-324, 461, 1110, 1123, 1162, 1170

#### 3. PartialDecryptionService.java - Minor changes
Remove User import and any UserRepository usage

#### 4. Other Files Needing Updates
- **ImageUploadController.java**: Remove User dependencies
- **UserProfileDTO.java**: Remove userId field or delete file
- **UserSearchResponse.java**: Remove userId field or delete file

### Files to Delete (No Longer Needed)

**Models:**
- User.java
- UserPrincipal.java
- PasswordResetToken.java
- VerificationCode.java

**Repositories:**
- UserRepository.java
- PasswordResetTokenRepository.java
- VerificationCodeRepository.java

**Services:**
- UserService.java
- UserSearchService.java
- PasswordResetTokenService.java
- VerificationCodeService.java

**Controllers:**
- UserController.java
- UserSearchController.java
- PasswordController.java
- VerificationController.java
- ImageUploadController.java (or update to remove User deps)

### Frontend Changes Needed

1. **Update App routing** to use `/auth` route for OtpLogin
2. **Delete obsolete pages**: Login.jsx, Signup.jsx
3. **Update any navigation components** that link to /login or /signup

### Integration Work (Chunking System)

The chunking service exists but needs integration:

1. **TallyService.java**: After voting ends, divide ballots into chunks and create ElectionCenter rows
2. **PartialDecryptionService.java**: Decrypt each chunk separately, combine results
3. **Results API**: Return per-chunk and combined results
4. **Frontend Results Page**: Animate chunk combination

## 📁 Files Modified By This Session

### Created:
1. `backend/.../util/JwtUtil.java` - JWT wrapper utility
2. `frontend/src/pages/OtpLogin.jsx` - OTP authentication UI
3. `REFACTORING_GUIDE_OTP_CHUNKING.md` - Technical guide
4. `IMPLEMENTATION_STATUS.md` - Status document
5. `migrate_to_email_auth.py` - Migration script
6. `IMPLEMENTATION_SUMMARY.md` - This file

### Modified:
1. `backend/.../model/AllowedVoter.java` - Composite key
2. `backend/.../model/Guardian.java` - Cleaned up fields
3. `backend/.../service/MyUserDetailsService.java` - Email-only auth
4. `backend/.../utils/VoterIdGenerator.java` - Email parameters
5. `frontend/src/pages/Home.jsx` - Single sign-in button

## 🚀 Next Steps To Complete The Refactoring

### Step 1: Backend Service Updates (2-3 hours)
Run the migration script or manually apply changes:
```bash
python migrate_to_email_auth.py
```

Or manually update:
1. BallotService.java - Follow patterns in IMPLEMENTATION_STATUS.md
2. ElectionService.java - Follow patterns in IMPLEMENTATION_STATUS.md
3. PartialDecryptionService.java - Minor updates

### Step 2: Delete Obsolete Files (15 minutes)
```bash
# Navigate to backend/src/main/java/com/amarvote/amarvote/
rm model/{User,UserPrincipal,PasswordResetToken,VerificationCode}.java
rm repository/{User,PasswordResetToken,VerificationCode}Repository.java
rm service/{User,UserSearch,PasswordResetToken,VerificationCode}Service.java
rm controller/{User,UserSearch,Password,Verification,ImageUpload}Controller.java
```

### Step 3: Frontend Routing (30 minutes)
1. Update App.jsx or Routes file to include:
   ```jsx
   <Route path="/auth" element={<OtpLogin setUserEmail={setUserEmail} />} />
   ```
2. Remove old login/signup routes
3. Delete Login.jsx and Signup.jsx

### Step 4: Test Backend (1 hour)
```bash
cd backend
mvn clean compile
# Fix any remaining compilation errors
mvn spring-boot:run
```

Test:
- OTP email sending: `POST /api/auth/request-otp`
- OTP verification: `POST /api/auth/verify-otp`
- Create election with email-based voters
- Cast vote without User table

### Step 5: Test Frontend (1 hour)
```bash
cd frontend
npm install
npm run dev
```

Test:
- OTP login flow
- Dashboard access with JWT
- User email display in header
- Election creation and voting

### Step 6: Integration & Polish (2-3 hours)
1. Integrate chunking in TallyService
2. Update PartialDecryptionService for per-chunk decryption
3. Create results API endpoint
4. Build animated results page
5. Update verification tab for per-chunk data

## 📊 Effort Estimate

| Task | Time | Priority |
|------|------|----------|
| Backend service updates | 2-3 hours | Critical |
| Delete obsolete files | 15 minutes | Critical |
| Frontend routing | 30 minutes | Critical |
| Backend testing | 1 hour | Critical |
| Frontend testing | 1 hour | Critical |
| Chunking integration | 2-3 hours | High |
| Results animation | 1 hour | Medium |
| **Total** | **8-10 hours** | |

## ⚠️ Important Notes

1. **Database Migration**: Run SQL to drop old tables before deploying:
   ```sql
   DROP TABLE IF EXISTS users CASCADE;
   DROP TABLE IF EXISTS password_reset_tokens CASCADE;
   DROP TABLE IF EXISTS signup_verification CASCADE;
   ```

2. **Backup First**: Always backup database and code before applying changes

3. **Incremental Testing**: Test after each major change, don't wait until the end

4. **Migration Script**: The `migrate_to_email_auth.py` script handles common patterns but may need manual review

5. **JWT Configuration**: Ensure `application.properties` has correct JWT and email settings

## 🎯 Success Criteria

- [ ] Backend compiles without errors
- [ ] OTP login flow works end-to-end
- [ ] Elections can be created with email-based voters
- [ ] Voting works without User table
- [ ] Guardian functionality intact
- [ ] Chunking divides ballots correctly
- [ ] Decryption works per chunk
- [ ] Results combine and display correctly
- [ ] All tests pass

## 📞 If You Get Stuck

Refer to:
1. `REFACTORING_GUIDE_OTP_CHUNKING.md` for technical details
2. `IMPLEMENTATION_STATUS.md` for specific code changes
3. The migration script for automation

The core architecture is sound. Most remaining work is systematic replacement of `userId` → `userEmail` throughout the codebase.

---

**Status**: Foundation complete, implementation 60% done, 8-10 hours remaining work

**Last Updated**: Based on current codebase analysis
