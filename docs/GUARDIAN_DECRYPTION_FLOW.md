# Guardian Decryption Progress - Complete Flow Documentation

## Overview

This document describes the complete guardian credential submission and decryption progress tracking system implemented in AmarVote.

## User Flow

### 1. **Initial Submission**

When a guardian submits credentials:

```
User Action: Upload credentials.txt file → Click "Submit Guardian Credentials"
   ↓
Backend: Receives credentials → Validates → Responds immediately
   ↓
Frontend: Shows "✅ Credentials received! Processing decryption..." toast
   ↓
Frontend: Automatically opens DecryptionProgressModal
   ↓
Backend: Starts async processing in background
```

**Visual Feedback:**
- Immediate toast notification: "✅ Credentials received! Processing decryption..."
- Modal opens automatically showing:
  - Circular progress indicator
  - Current phase (Partial Decryption / Compensated Shares)
  - Chunk processing status (e.g., "Processing chunk 2/5")
  - Guardian being compensated (Phase 2)
  - Timeline visualization

### 2. **Checking Progress**

After submission, guardians can monitor progress:

```
User sees: Blue banner with "Check Progress" button
   ↓
User clicks: "Check Progress" button
   ↓
Frontend: Fetches current status from backend
   ↓
Frontend: Opens DecryptionProgressModal with live updates
   ↓
Modal: Polls status every 2 seconds until completion
```

**Status Display:**
- **In Progress**: "Your credentials are being processed..."
- **Completed**: "Your decryption has been completed successfully!"
- **Failed**: "Decryption failed. You can submit new credentials."

### 3. **Preventing Duplicate Submissions**

**Rules:**
1. ✅ **Can Submit**: Status is 'pending', 'failed', or no status exists
2. ❌ **Cannot Submit**: Status is 'in_progress' or 'completed'

**Visual Indicators:**

| Status | Submit Button State | Button Text | Color |
|--------|-------------------|-------------|-------|
| None | Enabled | "Submit Guardian Credentials" | Green |
| In Progress | Disabled | "Processing... Check Progress Above" | Blue (disabled) |
| Completed | Disabled | "Decryption Completed" ✓ | Green (disabled) |
| Failed | Enabled | "Retry Submission" ↻ | Green |

### 4. **Retry After Failure**

If credentials were incorrect:

```
Status: 'failed' → Error message displayed
   ↓
Submit button: Re-enabled with "Retry Submission" text
   ↓
Guardian: Can upload new credentials.txt and resubmit
   ↓
Process: Starts again from step 1
```

## Backend Processing Flow

### Phase 1: Partial Decryption (Per Chunk)

```
For each chunk (ElectionCenter):
  1. Update status: current_phase = "partial_decryption"
  2. Update status: current_chunk_number = X
  3. Decrypt guardian's share using ElectionGuard
  4. Save Decryption record
  5. Update status: processed_chunks++
  6. Repeat for next chunk
```

**Status Updates:**
- `status`: "in_progress"
- `current_phase`: "partial_decryption"
- `current_chunk_number`: 1, 2, 3...
- `processed_chunks`: Increments with each chunk
- `progress_percentage`: (processed_chunks / total_chunks) * 100

### Phase 2: Compensated Shares Generation (Per Guardian)

```
For each other guardian:
  1. Update status: current_phase = "compensated_shares_generation"
  2. Update status: compensating_for_guardian_id = otherGuardianId
  3. Update status: compensating_for_guardian_name = email
  4. For each chunk:
     - Generate compensated share using ElectionGuard
     - Save CompensatedDecryption record
  5. Update status: processed_compensated_guardians++
  6. Repeat for next guardian
```

**Status Updates:**
- `status`: "in_progress"
- `current_phase`: "compensated_shares_generation"
- `compensating_for_guardian_id`: ID of guardian being compensated
- `compensating_for_guardian_name`: Email of guardian
- `processed_compensated_guardians`: Increments with each guardian
- `total_compensated_guardians`: Total other guardians
- `compensated_progress_percentage`: (processed / total) * 100

### Final Completion

```
Mark Status as Completed:
  - status = "completed"
  - completed_at = current timestamp
  - Mark guardian.decrypted_or_not = true
  - Release processing lock
```

## Frontend Components

### State Management

```javascript
// Key state variables
const [isDecryptionModalOpen, setIsDecryptionModalOpen] = useState(false);
const [currentGuardianId, setCurrentGuardianId] = useState(null);
const [currentGuardianName, setCurrentGuardianName] = useState(null);
const [guardianDecryptionStatus, setGuardianDecryptionStatus] = useState(null);
const [isCheckingStatus, setIsCheckingStatus] = useState(false);
```

### Key Functions

#### `handleGuardianKeySubmit()`
1. Check if decryption already in progress/completed
2. If in_progress: Show modal with current status
3. If completed: Show success message
4. If failed/none: Submit credentials
5. On success: Show toast and auto-open modal

#### `handleCheckDecryptionStatus()`
1. Fetch current guardian's decryption status
2. Open modal with status data
3. Modal starts polling for updates

#### `handleDecryptionModalClose()`
1. Close modal
2. Refresh election data to update UI

### DecryptionProgressModal Component

**Features:**
- Circular progress bar showing overall percentage
- Phase-specific displays:
  - **Partial Decryption**: Shows chunk X/Y progress
  - **Compensated Shares**: Shows guardian being compensated
- Timeline visualization with checkmarks
- Color-coded status badges
- Auto-refresh every 2 seconds
- Clean, modern UI with animations

**Props:**
```javascript
<DecryptionProgressModal
  isOpen={isDecryptionModalOpen}
  onClose={handleDecryptionModalClose}
  electionId={id}
  guardianId={currentGuardianId}
  guardianName={currentGuardianName}
/>
```

## API Endpoints

### 1. Initiate Decryption

**Endpoint:** `POST /api/guardian/initiate-decryption`

**Request:**
```json
{
  "election_id": 123,
  "encrypted_data": "base64_encoded_credentials"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Decryption process initiated. Processing in progress..."
}
```

**Behavior:**
- Returns immediately (non-blocking)
- Starts async background processing
- Creates decryption_status record with status='pending'
- Updates to status='in_progress' when processing starts

### 2. Get Decryption Status

**Endpoint:** `GET /api/guardian/decryption-status/{electionId}/{guardianId}`

**Response:**
```json
{
  "success": true,
  "status": "in_progress",
  "message": "Decryption status retrieved successfully",
  "totalChunks": 5,
  "processedChunks": 3,
  "progressPercentage": 60.0,
  "currentPhase": "compensated_shares_generation",
  "currentChunkNumber": 3,
  "compensatingForGuardianId": 456,
  "compensatingForGuardianName": "guardian2@example.com",
  "totalCompensatedGuardians": 4,
  "processedCompensatedGuardians": 2,
  "compensatedProgressPercentage": 50.0,
  "guardianEmail": "guardian1@example.com",
  "guardianName": "guardian1@example.com",
  "startedAt": "2026-01-08T10:30:00Z",
  "completedAt": null,
  "errorMessage": null
}
```

## Database Schema

### decryption_status Table

```sql
CREATE TABLE decryption_status (
    decryption_status_id SERIAL PRIMARY KEY,
    election_id BIGINT NOT NULL,
    guardian_id BIGINT NOT NULL,
    
    -- Status tracking
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    -- 'pending', 'in_progress', 'completed', 'failed'
    
    -- Progress tracking
    total_chunks INT NOT NULL DEFAULT 0,
    processed_chunks INT NOT NULL DEFAULT 0,
    
    -- Phase tracking
    current_phase VARCHAR(100),
    -- 'partial_decryption', 'compensated_shares_generation'
    current_chunk_number INT DEFAULT 0,
    
    -- Compensated guardian tracking
    compensating_for_guardian_id BIGINT,
    compensating_for_guardian_name VARCHAR(255),
    total_compensated_guardians INT DEFAULT 0,
    processed_compensated_guardians INT DEFAULT 0,
    
    -- Metadata
    guardian_email VARCHAR(255),
    guardian_name VARCHAR(255),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(election_id, guardian_id),
    FOREIGN KEY (election_id) REFERENCES elections(election_id),
    FOREIGN KEY (guardian_id) REFERENCES guardians(guardian_id)
);
```

## Concurrent Safety

### Lock Mechanism

```java
// ConcurrentHashMap to prevent duplicate processing
private final ConcurrentHashMap<String, Boolean> decryptionLocks = new ConcurrentHashMap<>();

// Lock key format: "{electionId}_{guardianId}"
String lockKey = electionId + "_" + guardianId;

// Try to acquire lock (returns null if successful, non-null if already locked)
Boolean lockAcquired = decryptionLocks.putIfAbsent(lockKey, true);

// Release lock when done
decryptionLocks.remove(lockKey);
```

### Duplicate Prevention

**Three-layer protection:**

1. **Database Constraint**: `UNIQUE(election_id, guardian_id)` on decryption_status
2. **Status Check**: Backend checks if status is 'in_progress' or 'completed'
3. **Memory Lock**: ConcurrentHashMap prevents simultaneous processing

## Error Handling

### Credential Validation Errors

**Scenario:** Invalid credentials provided

```
Backend: Detects null tally_share from ElectionGuard
   ↓
Backend: Throws "Invalid credentials provided" exception
   ↓
Backend: Sets status = 'failed', error_message = exception details
   ↓
Frontend: Modal shows error message
   ↓
Frontend: Submit button re-enabled for retry
```

### Network/Service Errors

**Scenario:** ElectionGuard service unavailable

```
Backend: HTTP error or timeout from microservice
   ↓
Backend: Catches exception in async method
   ↓
Backend: Sets status = 'failed', error_message = exception details
   ↓
Frontend: Modal shows error, allows retry
```

### Concurrent Submission Attempts

**Scenario:** Guardian clicks submit twice quickly

```
First Request: Acquires lock, starts processing
   ↓
Second Request: Lock already taken
   ↓
Backend: Returns "Decryption is already in progress"
   ↓
Frontend: Opens modal showing current progress
```

## Testing Checklist

### Basic Flow
- [x] Submit credentials → Modal opens automatically
- [x] Modal shows chunk progress in real-time
- [x] Phase transitions visible (partial → compensated)
- [x] Compensated guardian names displayed
- [x] Completion message appears
- [x] Can close and reopen modal

### Status Checking
- [x] "Check Progress" button visible after submission
- [x] Clicking button opens modal with current status
- [x] Status persists across page refreshes
- [x] Status loads automatically when visiting guardian tab

### Duplicate Prevention
- [x] Same guardian cannot submit twice while in_progress
- [x] Submit button disabled during processing
- [x] Submit button disabled after completion
- [x] Clicking submit during processing opens status modal

### Retry After Failure
- [x] Failed status allows new submission
- [x] Submit button shows "Retry Submission"
- [x] New credentials can be uploaded
- [x] Process starts fresh on retry

### Visual Feedback
- [x] Toast notification on submission
- [x] Circular progress indicator animates
- [x] Phase icons and labels update correctly
- [x] Timeline shows completion checkmarks
- [x] Color-coded status badges

## Key Improvements Over Old System

| Aspect | Old System | New System |
|--------|-----------|------------|
| **Feedback** | Synchronous blocking | Immediate acknowledgment |
| **Progress** | No visibility | Real-time chunk/phase tracking |
| **Status Check** | Not available | "Check Progress" button |
| **Duplicates** | Could submit multiple times | Properly prevented |
| **Retry** | Manual intervention | Automatic retry enabled on failure |
| **UI/UX** | Basic form | Modern modal with animations |
| **Monitoring** | No progress info | Detailed phase/guardian tracking |

## Benefits

### For Guardians
✅ Immediate confirmation of credential receipt  
✅ Real-time progress visibility  
✅ Clear phase-by-phase breakdown  
✅ Can check status anytime via button  
✅ Visual feedback with modern UI  
✅ No confusion about submission state  

### For System
✅ Prevents duplicate processing  
✅ Concurrent safety guaranteed  
✅ Complete audit trail in database  
✅ Graceful error handling  
✅ Automatic retry on failure  
✅ Professional, production-ready code  

## Files Modified/Created

### Backend
- `model/DecryptionStatus.java` - Entity for status tracking
- `repository/DecryptionStatusRepository.java` - Data access
- `dto/DecryptionStatusResponse.java` - Response DTO
- `service/PartialDecryptionService.java` - Enhanced with async processing
- `controller/ElectionController.java` - New endpoints
- `Database/decryption_status_table.sql` - Schema

### Frontend
- `components/DecryptionProgressModal.jsx` - Progress modal component
- `pages/ElectionPage.jsx` - Enhanced guardian tab
- `utils/electionApi.js` - New API methods

### Documentation
- `DECRYPTION_PROGRESS_IMPLEMENTATION.md` - Technical details
- `DECRYPTION_PROGRESS_QUICK_START.md` - Setup guide
- `GUARDIAN_DECRYPTION_FLOW.md` - This document

---

**Implementation Complete!** 🎉

Your guardian decryption system now provides:
- ✅ Immediate acknowledgment
- ✅ Real-time progress tracking
- ✅ Visual feedback with animations
- ✅ Status checking capability
- ✅ Duplicate prevention
- ✅ Retry on failure
- ✅ Professional, modern UI
