# AmarVote Refactoring - Quick Start Guide

## What's Been Done ✅

The foundation for the new authentication and chunking system has been implemented:

1. **Database Models** - All created and updated
2. **Repositories** - Core repositories created
3. **OTP Authentication** - Complete backend implementation
4. **Chunking Service** - Complete implementation
5. **DTOs** - All data transfer objects created
6. **Documentation** - Comprehensive guides written
7. **Configuration** - application.properties updated

## What You Need to Do Next

### Step 1: Update Database

Run these SQL scripts in your PostgreSQL database:

```bash
# 1. Create OTP table
psql -U your_user -d your_database -f Database/otp_table_creation.sql

# 2. Ensure election_center table exists (should already be there)
# Check if table exists, if not run table_creation_file_AmarVote.sql
```

### Step 2: Update Repository Methods

Add user_email based queries to existing repositories:

**File**: `backend/src/main/java/com/amarvote/amarvote/repository/GuardianRepository.java`
```java
public interface GuardianRepository extends JpaRepository<Guardian, Long> {
    // Add these methods:
    List<Guardian> findByUserEmail(String userEmail);
    Optional<Guardian> findByElectionIdAndUserEmail(Long electionId, String userEmail);
    List<Guardian> findByElectionId(Long electionId);
}
```

**File**: `backend/src/main/java/com/amarvote/amarvote/repository/AllowedVoterRepository.java`
```java
public interface AllowedVoterRepository extends JpaRepository<AllowedVoter, Long> {
    // Add these methods:
    Optional<AllowedVoter> findByElectionIdAndUserEmail(Long electionId, String userEmail);
    List<AllowedVoter> findByElectionId(Long electionId);
    List<AllowedVoter> findByUserEmail(String userEmail);
}
```

### Step 3: Update ElectionService

Find the method that creates tallies and update it to use chunking:

**File**: `backend/src/main/java/com/amarvote/amarvote/service/ElectionService.java`

Add dependencies:
```java
@Autowired
private ChunkingService chunkingService;

@Autowired
private ElectionCenterRepository electionCenterRepository;

@Autowired
private SubmittedBallotRepository submittedBallotRepository;
```

Update tally creation method (look for where you call the microservice):
```java
public void createElectionTally(Long electionId) {
    // 1. Get all cast ballots
    List<Ballot> castBallots = ballotRepository.findByElectionIdAndStatus(electionId, "cast");
    
    // 2. Calculate chunks
    ChunkConfiguration chunkConfig = chunkingService.calculateChunks(castBallots.size());
    
    // 3. Assign ballots to chunks randomly
    Map<Integer, List<Ballot>> chunks = chunkingService.assignBallotsToChunks(castBallots, chunkConfig);
    
    // 4. Process each chunk
    for (Map.Entry<Integer, List<Ballot>> entry : chunks.entrySet()) {
        int chunkNumber = entry.getKey();
        List<Ballot> chunkBallots = entry.getValue();
        
        // Create election center entry for this chunk
        ElectionCenter electionCenter = ElectionCenter.builder()
            .electionId(electionId)
            .build();
        electionCenter = electionCenterRepository.save(electionCenter);
        
        // Call microservice to create tally for this chunk
        String encryptedTally = callMicroserviceForTally(chunkBallots, electionId);
        
        // Store tally
        electionCenter.setEncryptedTally(encryptedTally);
        electionCenterRepository.save(electionCenter);
        
        // Create submitted_ballot entries with election_center_id
        for (Ballot ballot : chunkBallots) {
            SubmittedBallot submittedBallot = SubmittedBallot.builder()
                .electionCenterId(electionCenter.getElectionCenterId())
                .cipherText(ballot.getCipherText())
                .build();
            submittedBallotRepository.save(submittedBallot);
        }
    }
    
    // 5. Update election status
    Election election = electionRepository.findById(electionId).orElseThrow();
    election.setStatus("completed");
    electionRepository.save(election);
}
```

### Step 4: Update Decryption Service

Find where guardians submit decryptions:

**File**: `backend/src/main/java/com/amarvote/amarvote/service/GuardianService.java` or similar

Add dependencies:
```java
@Autowired
private ElectionCenterRepository electionCenterRepository;

@Autowired
private DecryptionRepository decryptionRepository;

@Autowired
private CompensatedDecryptionRepository compensatedDecryptionRepository;
```

Update decryption method:
```java
public void processGuardianDecryption(Long guardianId, String privateKey) {
    Guardian guardian = guardianRepository.findById(guardianId).orElseThrow();
    Long electionId = guardian.getElectionId();
    
    // 1. Decrypt guardian credentials (once for all chunks)
    // ... existing credential decryption logic ...
    
    // 2. Get all election centers (chunks) for this election
    List<ElectionCenter> chunks = electionCenterRepository.findByElectionId(electionId);
    
    // 3. Process each chunk
    for (ElectionCenter chunk : chunks) {
        // Call microservice for partial decryption of this chunk
        String partialDecryption = callMicroserviceForDecryption(
            chunk.getEncryptedTally(), 
            guardian, 
            privateKey
        );
        
        // Store decryption
        Decryption decryption = Decryption.builder()
            .electionCenterId(chunk.getElectionCenterId())
            .guardianId(guardianId)
            .partialDecryptedTally(partialDecryption)
            .tallyShare(/* from microservice response */)
            .build();
        decryptionRepository.save(decryption);
        
        // Check if decryption complete and aggregate results
        if (allGuardiansDecrypted(chunk.getElectionCenterId())) {
            aggregateChunkResults(chunk);
        }
    }
    
    // Mark guardian as decrypted
    guardian.setDecryptedOrNot(true);
    guardianRepository.save(guardian);
}

private void aggregateChunkResults(ElectionCenter chunk) {
    // Call microservice to combine partial decryptions
    // Parse results and store in chunk.electionResult as JSON
    // ... implementation based on your microservice response format ...
}
```

### Step 5: Frontend Authentication

**File**: `frontend/src/pages/Login.jsx` or similar

Replace current login UI with two-step OTP flow:

```jsx
import { useState } from 'react';
import axios from 'axios';

export default function LoginPage() {
  const [step, setStep] = useState(1); // 1 = email, 2 = OTP
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [countdown, setCountdown] = useState(300); // 5 minutes
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const response = await axios.post('/api/auth/request-otp', { email });
      if (response.data.success) {
        setStep(2);
        // Start countdown timer
        const timer = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const response = await axios.post('/api/auth/verify-otp', { 
        email, 
        otpCode: otp 
      });
      
      if (response.data.success) {
        // Token is set in HTTP-only cookie automatically
        window.location.href = '/dashboard'; // or wherever
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  // Render UI based on step
  return (
    <div>
      {step === 1 ? (
        <form onSubmit={handleRequestOtp}>
          <h2>Sign In</h2>
          <input 
            type="email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Sending...' : 'Continue'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp}>
          <h2>Enter Verification Code</h2>
          <p>Code sent to {email}</p>
          <input 
            type="text" 
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="000000"
            maxLength={6}
            required
          />
          <p>Expires in: {Math.floor(countdown / 60)}:{countdown % 60}</p>
          <button type="submit" disabled={loading || countdown === 0}>
            {loading ? 'Verifying...' : 'Sign In'}
          </button>
          <button type="button" onClick={() => setStep(1)}>
            Change Email
          </button>
        </form>
      )}
      {error && <p style={{color: 'red'}}>{error}</p>}
    </div>
  );
}
```

Remove the sign-up button from your home page.

### Step 6: Frontend Results Page

Create `frontend/src/pages/ElectionResults.jsx`:

```jsx
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';

export default function ElectionResults({ electionId }) {
  const [results, setResults] = useState(null);
  const [currentChunk, setCurrentChunk] = useState(0);
  const [animatedVotes, setAnimatedVotes] = useState({});

  useEffect(() => {
    // Fetch results
    axios.get(`/api/elections/${electionId}/results`)
      .then(response => setResults(response.data));
  }, [electionId]);

  // Animate chunks one by one
  useEffect(() => {
    if (!results) return;
    
    const animateChunks = async () => {
      for (let i = 0; i < results.chunkResults.length; i++) {
        setCurrentChunk(i);
        
        // Update vote counts
        const chunk = results.chunkResults[i];
        setAnimatedVotes(prev => {
          const updated = { ...prev };
          Object.entries(chunk.candidateVotes).forEach(([candidate, votes]) => {
            updated[candidate] = (updated[candidate] || 0) + votes;
          });
          return updated;
        });
        
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    };
    
    animateChunks();
  }, [results]);

  if (!results) return <div>Loading results...</div>;

  return (
    <div>
      <h1>Election Results</h1>
      
      {/* Animated vote bars */}
      <div className="vote-bars">
        {Object.entries(animatedVotes).map(([candidate, votes]) => (
          <motion.div
            key={candidate}
            initial={{ height: 0 }}
            animate={{ height: `${(votes / Math.max(...Object.values(animatedVotes))) * 300}px` }}
            transition={{ duration: 0.5 }}
          >
            <h3>{candidate}</h3>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {votes} votes
            </motion.p>
          </motion.div>
        ))}
      </div>

      {/* Final results */}
      <h2>Final Results</h2>
      {JSON.stringify(results.finalResults)}

      {/* All ballots */}
      <h2>All Ballots</h2>
      {results.chunkResults.map(chunk => (
        <div key={chunk.chunkNumber}>
          <h3>Chunk {chunk.chunkNumber + 1}</h3>
          <ul>
            {chunk.ballotTrackingCodes.map((code, idx) => (
              <li key={idx}>
                {code} - {chunk.ballotHashes[idx]}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
```

Install animation library:
```bash
cd frontend
npm install framer-motion
```

### Step 7: Test Everything

1. **Start backend**: `mvn spring-boot:run`
2. **Start frontend**: `npm run dev`
3. **Test OTP login**:
   - Go to login page
   - Enter email
   - Check email for OTP code
   - Enter OTP and verify login works
4. **Test election with < 64 ballots**: Should create 1 chunk
5. **Test election with > 64 ballots**: Should create multiple chunks
6. **Verify results display correctly**

## Important Notes

- The microservice API calls you're already using remain the same
- You just call them multiple times (once per chunk)
- Guardian credentials are decrypted once and used for all chunks
- Each chunk is processed independently
- Results are combined at the end

## Getting Help

- See `docs/REFACTORING_SUMMARY.md` for complete overview
- See `docs/CHUNKING_IMPLEMENTATION_GUIDE.md` for detailed guide
- Check existing service files to understand microservice call patterns

## Common Issues

**Issue**: Can't find User table
**Fix**: You removed it! Use email directly from JWT token

**Issue**: Ballot in multiple chunks
**Fix**: Check ChunkingService.verifyChunkAssignment()

**Issue**: Results not aggregating
**Fix**: Ensure all guardians have decrypted all chunks before aggregating

**Issue**: OTP not received
**Fix**: Check email service configuration in application.properties
