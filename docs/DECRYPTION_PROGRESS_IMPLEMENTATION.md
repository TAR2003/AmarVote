# Guardian Decryption Progress Tracking Implementation

## Overview
This document describes the comprehensive progress tracking system for guardian credential submission and decryption processes in the AmarVote election system.

## Architecture

### Backend Components

#### 1. Database Schema (`decryption_status` table)
Tracks detailed progress information for each guardian's decryption process:

**Key Fields:**
- `election_id`, `guardian_id`: Unique identification
- `status`: pending, in_progress, completed, failed
- `total_chunks`, `processed_chunks`: Overall progress tracking
- `current_phase`: partial_decryption, compensated_shares_generation
- `current_chunk_number`: Real-time chunk being processed
- `compensating_for_guardian_id/name`: Tracks which guardian is being compensated
- `total_compensated_guardians`, `processed_compensated_guardians`: Compensated share progress
- `started_at`, `completed_at`: Timestamps for monitoring
- `error_message`: Detailed error information

#### 2. Backend Models & Repositories
**DecryptionStatus.java**: JPA entity mapping to database table  
**DecryptionStatusRepository.java**: Data access layer with queries:
- `findByElectionIdAndGuardianId()`: Get specific guardian status
- `findByElectionId()`: Get all guardians' status for an election
- `findByElectionIdAndStatus()`: Filter by status

#### 3. DTO (Data Transfer Object)
**DecryptionStatusResponse.java**: Complete status information including:
- Progress percentages (overall & compensated)
- Current phase and chunk information
- Compensated guardian details
- Timestamps and error messages

#### 4. Service Layer (`PartialDecryptionService.java`)

**Key Methods:**

##### `initiateDecryption(request, userEmail)`
- Validates guardian and tally existence
- Creates/updates decryption status record
- Acquires concurrent lock (ConcurrentHashMap)
- Starts async processing
- Returns immediately with confirmation

##### `processDecryptionAsync(request, userEmail, guardian, electionCenters)` [@Async]
**Phase 1: Partial Decryption**
- Processes each chunk sequentially
- Updates status after each chunk
- Validates credentials
- Stores partial decryption shares
- Real-time progress tracking

**Phase 2: Compensated Shares Generation**
- Creates backup shares for each other guardian
- Updates compensating guardian info
- Tracks progress per guardian
- Enables election decryption even with missing guardians

##### `getDecryptionStatus(electionId, guardianId)`
- Returns current status with progress percentages
- Handles legacy decryptions (before feature)
- Calculates both chunk and compensated progress

##### `createCompensatedDecryptionSharesWithProgress(...)`
- Iterates through other guardians
- Updates status with current compensating guardian
- Processes all chunks for each guardian
- Real-time progress updates

#### 5. REST API Endpoints (`ElectionController.java`)

##### POST `/api/guardian/initiate-decryption`
**Request:**
```json
{
  "election_id": 123,
  "encrypted_data": "base64_encoded_credential_file"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Decryption process initiated. Processing in progress..."
}
```

##### GET `/api/guardian/decryption-status/{electionId}/{guardianId}`
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
  "compensatingForGuardianName": "Guardian Bob",
  "totalCompensatedGuardians": 4,
  "processedCompensatedGuardians": 2,
  "compensatedProgressPercentage": 50.0,
  "guardianEmail": "alice@example.com",
  "guardianName": "Guardian Alice",
  "startedAt": "2026-01-08T10:30:00Z",
  "completedAt": null,
  "errorMessage": null
}
```

### Frontend Components

#### 1. DecryptionProgressModal.jsx
Modern, professional React component with:

**Visual Features:**
- Circular progress indicator (react-circular-progressbar)
- Real-time status updates (2-second polling)
- Phase-specific UI sections
- Timeline visualization
- Color-coded status badges
- Animated progress bars

**Phase Displays:**

**Phase 1: Partial Decryption**
- Shows chunk processing progress
- Visual progress bar
- Current chunk number
- Total chunks indicator

**Phase 2: Compensated Shares Generation**
- Displays current guardian being compensated
- Guardian-specific progress
- Total guardians progress
- Dual progress tracking

**Status States:**
- `not_started`: Initial state
- `pending`: Queued for processing
- `in_progress`: Active processing with live updates
- `completed`: Success with completion timestamp
- `failed`: Error state with detailed message

**UI Sections:**
1. **Header**: Guardian name, close button
2. **Status Badge**: Color-coded current status
3. **Circular Progress**: Overall completion percentage
4. **Metrics Panel**: Chunks processed, current chunk
5. **Phase Details**: Context-specific information
6. **Compensating Guardian**: Who is being compensated (Phase 2)
7. **Timeline**: Visual process flow
8. **Footer**: Action buttons

#### 2. ElectionPage.jsx Integration

**State Management:**
```javascript
const [isDecryptionModalOpen, setIsDecryptionModalOpen] = useState(false);
const [currentGuardianId, setCurrentGuardianId] = useState(null);
const [currentGuardianName, setCurrentGuardianName] = useState(null);
```

**Modified `handleGuardianKeySubmit`:**
1. Calls `electionApi.initiateDecryption()`
2. Opens modal automatically on success
3. Passes guardian info to modal
4. Handles errors gracefully

**Modal Close Handler:**
- Refreshes election data
- Updates guardian status
- Closes modal

#### 3. API Client (electionApi.js)

**New Methods:**

```javascript
async initiateDecryption(electionId, encryptedData) {
  return await apiRequest('/guardian/initiate-decryption', {
    method: 'POST',
    body: JSON.stringify({
      election_id: electionId,
      encrypted_data: encryptedData
    }),
  }, EXTENDED_TIMEOUT);
}

async getDecryptionStatus(electionId, guardianId) {
  return await apiRequest(
    `/guardian/decryption-status/${electionId}/${guardianId}`,
    { method: 'GET' }
  );
}
```

## User Experience Flow

### Guardian Submits Credentials

1. **Guardian uploads credential file** in "Guardian Keys" tab
2. **Clicks "Submit Guardian Credentials"**
3. **Backend receives request:**
   - Validates guardian & tally
   - Creates decryption status record
   - Acquires lock
   - Returns immediately
4. **Frontend opens DecryptionProgressModal automatically**
5. **Modal starts polling** (every 2 seconds)

### Decryption Processing (Background)

**Phase 1: Partial Decryption**
- Guardian sees: "🔐 Processing Partial Decryption"
- Updates: "Chunk 1/5 processed"
- Progress bar animates: 20% → 40% → 60% → 80% → 100%

**Phase 2: Compensated Shares**
- Guardian sees: "💫 Generating Compensated Shares"
- Updates: "Currently compensating for: Guardian Bob"
- Progress: "2/4 guardians processed"
- Dual progress bars for chunks × guardians

**Completion:**
- Status changes to: "✅ Decryption Complete!"
- Shows completion timestamp
- Guardian can close modal
- Results are ready when quorum met

### Concurrent Access Handling

**Same Guardian Clicks Again:**
- Backend detects existing in-progress status
- Returns current status
- Modal opens showing live progress
- No duplicate processing

**Other Users:**
- Can see that guardian submitted key
- Cannot see detailed progress (privacy)
- Election status updates when completed

### Error Handling

**Invalid Credentials:**
- Process stops immediately
- Error message: "Invalid credentials provided"
- Guardian can retry with correct file

**System Error:**
- Detailed error message captured
- Status set to "failed"
- Lock released
- Guardian can retry

## Concurrent Safety

### Locking Mechanism
```java
private final ConcurrentHashMap<String, Boolean> decryptionLocks = new ConcurrentHashMap<>();
```

**Lock Key:** `{electionId}_{guardianId}`

**Prevents:**
- Duplicate decryption processes
- Race conditions
- Resource conflicts

**Lock Lifecycle:**
1. Acquired before starting async process
2. Held during entire decryption
3. Released in `finally` block
4. Released on error

### Database-Level Safety
- `UNIQUE KEY unique_election_guardian (election_id, guardian_id)`
- Prevents duplicate status records
- Ensures data consistency

## Polling Strategy

### Frontend Polling
- **Interval:** 2 seconds
- **Trigger:** Modal open
- **Endpoint:** GET `/guardian/decryption-status/{electionId}/{guardianId}`
- **Cleanup:** Interval cleared on modal close

### Benefits:
- Real-time updates without WebSocket complexity
- Lightweight HTTP requests
- Automatic reconnection
- No persistent connections

## Visual Design

### Color Scheme
- **Pending:** Gray (`#94a3b8`)
- **In Progress:** Blue (`#6366f1`)
- **Completed:** Green (`#10b981`)
- **Failed:** Red (`#ef4444`)

### Animations
- Circular progress: Smooth percentage updates
- Progress bars: Transition animations (500ms)
- Status badges: Pulse effect for active states
- Timeline: Checkmark transitions

### Icons
- 🔐 Partial Decryption
- 💫 Compensated Shares
- ✅ Completion
- ❌ Error
- ⏳ Pending
- 🛡️ Guardian Protection

## Performance Considerations

### Backend Optimization
- Async processing with `@Async`
- Non-blocking initial response
- Efficient database updates
- Minimal locking duration

### Frontend Optimization
- Conditional polling (only when modal open)
- Lightweight status checks
- Memoized components
- Cleanup on unmount

### Database Optimization
- Indexed queries (election_id, guardian_id, status)
- Minimal column updates
- Efficient foreign key relationships

## Migration & Deployment

### Database Migration

**Windows:**
```bash
.\migrate-decryption-table.bat
```

**Linux/Mac:**
```bash
chmod +x migrate-decryption-table.sh
./migrate-decryption-table.sh
```

### Backend Deployment
1. Run database migration
2. Restart Spring Boot application
3. Verify `@EnableAsync` configuration
4. Test endpoints

### Frontend Deployment
1. Restart React development server
2. Verify modal import
3. Test polling mechanism
4. Check visual animations

## Testing Scenarios

### 1. Normal Flow
1. Create election with guardians
2. End election and create tally
3. Submit guardian credentials
4. Watch progress modal
5. Verify completion
6. Check results

### 2. Concurrent Submissions
1. Same guardian clicks twice
2. Verify no duplicate processing
3. Modal shows existing progress
4. Verify lock mechanism

### 3. Multiple Guardians
1. Multiple guardians submit simultaneously
2. Each has independent progress
3. Verify concurrent safety
4. Check compensated shares

### 4. Error Handling
1. Submit invalid credentials
2. Verify error message
3. Check status: "failed"
4. Retry with correct credentials

### 5. Modal Interaction
1. Close modal during processing
2. Reopen to see continued progress
3. Verify polling resumes
4. Check background processing

## Monitoring & Debugging

### Backend Logs
```
=== ASYNC DECRYPTION STARTED ===
Election ID: 123, Guardian: Guardian Alice
✅ Guardian credentials decrypted successfully
=== PHASE 1: PARTIAL DECRYPTION (5 chunks) ===
📦 Processing chunk 1/5 (ID: 789)
✅ Chunk 1 processed and saved
...
✅ PHASE 1 COMPLETED: All 5 chunks processed
=== PHASE 2: COMPENSATED SHARES GENERATION ===
💫 Creating compensated shares for guardian: Guardian Bob (1/4)
✅ Compensated shares created for Guardian Bob
...
✅ PHASE 2 COMPLETED: Compensated shares for all 4 guardians
🎉 DECRYPTION PROCESS COMPLETED SUCCESSFULLY
🔓 Lock released for guardian 456
```

### Status Monitoring
- Check `decryption_status` table
- Query by election_id for overview
- Monitor `updated_at` for activity
- Review `error_message` for issues

## Security Considerations

### Credential Protection
- Credentials never stored in decryption_status
- Encrypted data transmitted securely
- Validated before processing

### Access Control
- JWT authentication required
- Guardian validation
- User must be guardian for election

### Concurrent Protection
- Application-level locks
- Database constraints
- Transaction management

## Future Enhancements

### Potential Improvements
1. WebSocket for real-time updates (eliminate polling)
2. Notification system (email/SMS on completion)
3. Progress persistence across sessions
4. Detailed analytics dashboard
5. Retry mechanism with backoff
6. Admin override capabilities
7. Audit trail for decryption events
8. Performance metrics tracking

## Summary

This implementation provides:
- ✅ Professional, industry-standard architecture
- ✅ Real-time progress tracking
- ✅ Modern, intuitive UI/UX
- ✅ Concurrent request handling
- ✅ Comprehensive error handling
- ✅ Detailed progress visualization
- ✅ Phase-specific updates
- ✅ Compensated guardian tracking
- ✅ Safe concurrent operations
- ✅ Maintainable codebase
- ✅ Comprehensive documentation

The system ensures guardians have complete visibility into their decryption process while maintaining security, performance, and reliability standards expected in production election systems.
