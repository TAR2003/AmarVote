# Critical Fixes for Compilation Errors

## ElectionService.java - Required Fixes

### Fix 1: Guardian ID References (Lines 1108, etc.)
```java
// OLD
guardian.getId()

// NEW  
guardian.getGuardianId()
```

### Fix 2: Remove .userId() calls (Lines 272, 324)
```java
// Line 272 - Guardian builder
Guardian guardian = Guardian.builder()
        .electionId(savedElection.getElectionId())
        .userEmail(email)  // Change from .userId(userId)
        .guardianPublicKey(publicKey)
        .sequenceOrder(order)
        .build();

// Line 324 - AllowedVoter builder  
AllowedVoter voter = AllowedVoter.builder()
        .electionId(electionId)
        .userEmail(email)  // Change from .userId(userId)
        .hasVoted(false)
        .build();
```

### Fix 3: Remove Guardian fields that moved to Decryptions table
These methods don't exist anymore:
- `guardian.getPartialDecryptedTally()` - moved to Decryptions table
- `guardian.getProof()` - removed
- `guardian.getTallyShare()` - moved to Decryptions table
- `guardian.getGuardianDecryptionKey()` - moved to Decryptions table
- `guardian.getKeyBackup()` - moved to Decryptions table
- `guardian.getUserId()` - use `guardian.getUserEmail()` instead

**Lines 1114-1117: Remove these lines**
```java
// DELETE these lines:
guardianData.put("partialDecryptedTally", guardian.getPartialDecryptedTally());
guardianData.put("guardianDecryptionKey", guardian.getGuardianDecryptionKey());
guardianData.put("tallyShare", guardian.getTallyShare());
guardianData.put("keyBackup", guardian.getKeyBackup());
```

**Lines 673-683: Update to use Decryptions table**
```java
// OLD - checking Guardian table
boolean hasDecrypted = guardian.getTallyShare() != null...

// NEW - check Decryptions table
List<Decryption> decryptions = decryptionRepository.findByGuardianId(guardian.getGuardianId());
boolean hasDecrypted = !decryptions.isEmpty();

// For partial decryption data, fetch from Decryptions table
if (!decryptions.isEmpty()) {
    Decryption dec = decryptions.get(0);
    map.put("partialDecryptedTally", dec.getPartialDecryptedTally());
}
```

### Fix 4: Update repository methods
```java
// Line 440, 549, 645 - findByElectionIdAndUserEmail returns Optional, not List
// OLD
List<AllowedVoter> allowedVoters = allowedVoterRepository.findByElectionIdAndUserEmail(...)

// NEW
Optional<AllowedVoter> voterOpt = allowedVoterRepository.findByElectionIdAndUserEmail(...)
if (voterOpt.isPresent()) {
    AllowedVoter voter = voterOpt.get();
    // use voter
}
```

### Fix 5: Remove election.getEncryptedTally() (Line 615)
```java
// encryptedTally is now in ElectionCenter table, not Election table
// OLD
.encryptedTally(election.getEncryptedTally())

// NEW - fetch from ElectionCenter
List<ElectionCenter> centers = electionCenterRepository.findByElectionId(electionId);
if (!centers.isEmpty()) {
    .encryptedTally(centers.get(0).getEncryptedTally())
}
```

### Fix 6: CompensatedDecryption fields (Lines 1149-1159)
CompensatedDecryption uses guardianId foreign keys, not sequence numbers:
```java
// OLD methods don't exist:
cd.getElectionId()
cd.getCompensatingGuardianSequence()
cd.getMissingGuardianSequence()

// NEW - use the correct fields:
cd.getElectionCenterId()
cd.getCompensatingGuardianId()
cd.getMissingGuardianId()

// To get sequence, look up the Guardian:
Guardian compensatingGuardian = guardianRepository.findById(cd.getCompensatingGuardianId()).get();
cdData.put("compensatingGuardianSequence", compensatingGuardian.getSequenceOrder());
```

### Fix 7: Repository methods that need updating

**AllowedVoterRepository.java** - Add:
```java
Optional<AllowedVoter> findByElectionIdAndUserEmail(Long electionId, String userEmail);
```

**CompensatedDecryptionRepository.java** - Add:
```java
List<CompensatedDecryption> findByElectionCenterId(Long electionCenterId);
```

### Fix 8: Remove User lookups (Lines 1123, 1162, 1170)
```java
// OLD
Optional<User> userOpt = userRepository.findById(guardian.getUserId());
guardianData.put("email", userOpt.get().getUserEmail());

// NEW
guardianData.put("email", guardian.getUserEmail());
```

## Quick Apply Script

```java
// In ElectionService.java, apply these replacements:

// 1. Fix guardian ID
guardian.getId() → guardian.getGuardianId()

// 2. Fix User imports
Remove: import com.amarvote.amarvote.model.User;
Remove: import com.amarvote.amarvote.repository.UserRepository;
Remove: @Autowired private UserRepository userRepository;

// 3. Fix voter/guardian creation - remove userId lookups
// Search for these patterns and simplify per examples above

// 4. Fix guardian data retrieval - use email directly
guardian.getUserEmail() instead of looking up User

// 5. Remove or update references to fields moved to Decryptions table
```

## Testing After Fixes

```powershell
cd backend
mvn clean compile

# If still errors, run:
mvn compile -e -X | Select-String "error"
```

---

**Note:** The chunking/decryption logic will need significant updates since Guardian table fields moved to Decryptions table. Focus first on getting it to compile, then worry about decryption logic.
