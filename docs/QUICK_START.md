# Quick Start: Completing the AmarVote Refactoring

## What Was Done For You ✅

1. **Fixed database models** (AllowedVoter, Guardian)
2. **Created OTP login UI** (OtpLogin.jsx)
3. **Updated utilities** (JwtUtil, VoterIdGenerator)
4. **Updated Home page** (single Sign In button)
5. **Created MyUserDetailsService** (email-only auth)
6. **Created documentation** (3 comprehensive guides)

## What You Need To Do (Prioritized)

### STEP 1: Update BallotService.java (CRITICAL - 30 min)

Open: `backend/src/main/java/com/amarvote/amarvote/service/BallotService.java`

**Remove these lines:**
```java
import com.amarvote.amarvote.model.User;              // Line 34
import com.amarvote.amarvote.repository.UserRepository; // Line 40

@Autowired
private UserRepository userRepository;                  // Lines 60-61
```

**Find and replace throughout the file:**
```java
// Pattern 1: User lookup (appears ~10 times)
OLD: Optional<User> userOpt = userRepository.findByUserEmail(userEmail);
     if (!userOpt.isPresent()) { return error; }
     User user = userOpt.get();

NEW: if (userEmail == null || userEmail.trim().isEmpty()) {
         return error; // Same error response
     }

// Pattern 2: Method calls (appears ~15 times)
OLD: user.getUserId()
NEW: userEmail

// Pattern 3: Method signatures (3 methods)
OLD: private boolean checkVoterEligibility(Integer userId, Election election)
NEW: private boolean checkVoterEligibility(String userEmail, Election election)

OLD: private boolean hasUserAlreadyVoted(Integer userId, Long electionId)
NEW: private boolean hasUserAlreadyVoted(String userEmail, Long electionId)

OLD: private void updateVoterStatus(Integer userId, Election election)
NEW: private void updateVoterStatus(String userEmail, Election election)

// Pattern 4: AllowedVoter comparisons (appears ~5 times)
OLD: .anyMatch(av -> av.getUserId().equals(userId))
NEW: .anyMatch(av -> av.getUserEmail().equals(userEmail))

OLD: .filter(av -> av.getUserId().equals(userId))
NEW: .filter(av -> av.getUserEmail().equals(userEmail))

OLD: .userId(userId)
NEW: .userEmail(userEmail)
```

### STEP 2: Update ElectionService.java (CRITICAL - 20 min)

Open: `backend/src/main/java/com/amarvote/amarvote/service/ElectionService.java`

**Remove these lines:**
```java
import com.amarvote.amarvote.model.User;              // Line 29
import com.amarvote.amarvote.repository.UserRepository;

@Autowired
private UserRepository userRepository;
```

**Find this block (~line 260):**
```java
for (String email : allowedVoterEmails) {
    Integer userId = userRepository.findByUserEmail(email)
            .orElseThrow(() -> new RuntimeException("User not found"))
            .getUserId();
    
    AllowedVoter allowedVoter = AllowedVoter.builder()
            .electionId(savedElection.getElectionId())
            .userId(userId)
            .hasVoted(false)
            .build();
    allowedVoterRepository.save(allowedVoter);
}
```

**Replace with:**
```java
for (String email : allowedVoterEmails) {
    AllowedVoter allowedVoter = AllowedVoter.builder()
            .electionId(savedElection.getElectionId())
            .userEmail(email)
            .hasVoted(false)
            .build();
    allowedVoterRepository.save(allowedVoter);
}
```

**Similar change for guardian emails (~line 318):**
```java
for (String email : guardianEmails) {
    AllowedVoter guardian = AllowedVoter.builder()
            .electionId(savedElection.getElectionId())
            .userEmail(email)
            .hasVoted(false)
            .build();
    allowedVoterRepository.save(guardian);
}
```

### STEP 3: Delete Obsolete Files (5 min)

```powershell
# Run in PowerShell from backend/src/main/java/com/amarvote/amarvote/

# Delete models
Remove-Item model/User.java
Remove-Item model/UserPrincipal.java
Remove-Item model/PasswordResetToken.java
Remove-Item model/VerificationCode.java

# Delete repositories
Remove-Item repository/UserRepository.java
Remove-Item repository/PasswordResetTokenRepository.java
Remove-Item repository/VerificationCodeRepository.java

# Delete services
Remove-Item service/UserService.java
Remove-Item service/UserSearchService.java
Remove-Item service/PasswordResetTokenService.java
Remove-Item service/VerificationCodeService.java

# Delete controllers
Remove-Item controller/UserController.java
Remove-Item controller/UserSearchController.java
Remove-Item controller/PasswordController.java
Remove-Item controller/VerificationController.java
```

### STEP 4: Update Frontend Routing (10 min)

**File:** `frontend/src/App.jsx` (or wherever routes are defined)

Add import:
```javascript
import OtpLogin from './pages/OtpLogin';
```

Add route:
```javascript
<Route path="/auth" element={<OtpLogin setUserEmail={setUserEmail} />} />
```

Remove old routes:
```javascript
// Delete these if they exist:
<Route path="/login" element={<Login />} />
<Route path="/signup" element={<Signup />} />
```

Delete files:
```powershell
# Run from frontend/src/pages/
Remove-Item Login.jsx
Remove-Item Signup.jsx
```

### STEP 5: Test Backend (15 min)

```powershell
cd backend
mvn clean compile
```

**If compilation errors:**
- Check the error message
- Find the file mentioned
- Replace any remaining `userId` with `userEmail`
- Remove any remaining User/UserRepository imports

**Once it compiles:**
```powershell
mvn spring-boot:run
```

**Test OTP flow:**
```powershell
# Request OTP
curl -X POST http://localhost:8080/api/auth/request-otp `
  -H "Content-Type: application/json" `
  -d '{"email":"test@example.com"}'

# Check email, then verify
curl -X POST http://localhost:8080/api/auth/verify-otp `
  -H "Content-Type: application/json" `
  -d '{"email":"test@example.com","otpCode":"123456"}'
```

### STEP 6: Test Frontend (10 min)

```powershell
cd frontend
npm install
npm run dev
```

**Manual testing:**
1. Go to http://localhost:5173
2. Click "Sign In" button
3. Enter your email
4. Check email for OTP code
5. Enter OTP code
6. Verify redirect to dashboard
7. Check that email shows in header

## Common Issues & Fixes

### Issue: "getUserId cannot be resolved"
**Fix:** Replace that occurrence with `userEmail` (you missed one)

### Issue: "User cannot be resolved to a type"
**Fix:** Remove the import line for User

### Issue: "UserRepository cannot be resolved"
**Fix:** Remove the UserRepository import and @Autowired field

### Issue: Frontend shows 404 for /auth
**Fix:** Make sure you added the route in App.jsx

### Issue: OTP email not sending
**Fix:** Check `application.properties` for email configuration:
```properties
spring.mail.host=smtp.gmail.com
spring.mail.port=587
spring.mail.username=your-email@gmail.com
spring.mail.password=your-app-password
spring.mail.properties.mail.smtp.auth=true
spring.mail.properties.mail.smtp.starttls.enable=true
```

## Time Estimate

- BallotService: 30 min
- ElectionService: 20 min
- Delete files: 5 min
- Frontend routing: 10 min
- Backend testing: 15 min
- Frontend testing: 10 min
- **Total: ~90 minutes**

## Success Checklist

- [ ] Backend compiles: `mvn clean compile`
- [ ] Backend runs: `mvn spring-boot:run`
- [ ] OTP request API works
- [ ] OTP verify API works
- [ ] Frontend builds: `npm run dev`
- [ ] Can navigate to /auth page
- [ ] OTP login flow works end-to-end
- [ ] Email displays in dashboard header
- [ ] Can create election
- [ ] Can vote in election

## Need Help?

1. **For detailed code changes:** See `IMPLEMENTATION_STATUS.md`
2. **For architecture decisions:** See `REFACTORING_GUIDE_OTP_CHUNKING.md`
3. **For automation:** Run `migrate_to_email_auth.py`

## What's Not Urgent (Can Do Later)

- Chunking integration (system works without it for now)
- Results animation (existing results page works)
- Verification tab per-chunk display (existing display works)
- UserProfileDTO cleanup (if not used, just ignore)

Focus on getting OTP authentication working first. Everything else can wait!

---

**Pro Tip:** Do one file at a time, compile after each change. Don't try to fix everything at once.
