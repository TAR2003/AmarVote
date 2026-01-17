# Guardian Decryption Progress - Quick Start Guide

## What Was Implemented?

A comprehensive real-time progress tracking system for guardian credential submission and decryption, similar to the tally creation feature.

## Quick Overview

### For Guardians
1. **Submit credentials** → Backend receives and responds immediately
2. **Modal opens automatically** → Shows real-time progress
3. **Watch live updates** → See chunks being processed
4. **Phase 1**: Partial decryption for your guardian role
5. **Phase 2**: Compensated shares for other guardians
6. **Completion** → Success message with timestamp

### For Other Users
- Can see that a guardian has submitted
- Can view overall election progress
- No access to individual guardian details (privacy)

## Setup Instructions

### 1. Database Migration

**Windows:**
```bash
cd C:\Users\TAWKIR\Documents\GitHub\AmarVote
.\migrate-decryption-table.bat
```

**Linux/Mac:**
```bash
cd /path/to/AmarVote
chmod +x migrate-decryption-table.sh
./migrate-decryption-table.sh
```

**Manual Migration:**
```bash
mysql -u root -p amarvote < Database/decryption_status_table.sql
```

### 2. Restart Backend
```bash
cd backend
mvn spring-boot:run
```

### 3. Restart Frontend
```bash
cd frontend
npm start
```

## How It Works

### Backend Flow
```
Guardian Submit → Validate → Create Status → Async Process → Update Progress
                                                ↓
                                     Phase 1: Partial Decryption
                                     (Process each chunk)
                                                ↓
                                     Phase 2: Compensated Shares
                                     (For each other guardian)
                                                ↓
                                          Mark Complete
```

### Frontend Flow
```
Submit Credentials → Modal Opens → Poll Status (every 2s) → Show Progress
                                         ↓
                                   Live Updates:
                                   - Chunk X/Y
                                   - Current Phase
                                   - Compensating for Guardian Z
                                         ↓
                                   Completion or Error
```

## API Endpoints

### Initiate Decryption
```
POST /api/guardian/initiate-decryption
Content-Type: application/json

{
  "election_id": 123,
  "encrypted_data": "base64_credential_file"
}
```

### Get Status
```
GET /api/guardian/decryption-status/{electionId}/{guardianId}
```

## Key Features

### Real-Time Progress
- **Chunk Processing**: "Processing chunk 3/5"
- **Current Phase**: Partial decryption or compensated shares
- **Compensating For**: "Creating shares for Guardian Bob"
- **Dual Progress**: Overall % and per-guardian %

### Visual Elements
- 🔐 **Partial Decryption Phase**
- 💫 **Compensated Shares Phase**
- ✅ **Completion Status**
- ❌ **Error Handling**
- 📊 **Progress Bars**
- ⏱️ **Timeline View**

### Concurrent Handling
- Same guardian clicks twice → Shows existing progress
- Multiple guardians → Independent progress tracking
- No duplicate processing
- Safe concurrent operations

## Testing Checklist

### Basic Flow
- [ ] Create election with multiple guardians
- [ ] End election
- [ ] Create tally (via "Create Tally" button)
- [ ] Submit guardian credentials
- [ ] Modal opens automatically
- [ ] Progress updates in real-time
- [ ] Phase transitions visible
- [ ] Compensated guardian names shown
- [ ] Completion message appears
- [ ] Can close and reopen modal

### Concurrent Scenarios
- [ ] Same guardian clicks "Submit" twice
- [ ] Existing progress shown
- [ ] No duplicate processing
- [ ] Multiple guardians submit simultaneously
- [ ] Each has independent progress

### Error Scenarios
- [ ] Submit invalid credentials
- [ ] Error message displayed
- [ ] Can retry with correct credentials
- [ ] Status persists after close/reopen

## Troubleshooting

### Modal Doesn't Open
- Check browser console for errors
- Verify API endpoint is accessible
- Check JWT token is valid
- Ensure guardian is authenticated

### No Progress Updates
- Check polling is running (Network tab)
- Verify backend is processing (check logs)
- Check decryption_status table for updates
- Ensure async processing is enabled (@EnableAsync)

### Backend Errors
- Check Spring Boot logs
- Verify database migration ran successfully
- Check DecryptionStatus table exists
- Verify guardian credentials are valid

### Frontend Errors
- Check React component imports
- Verify DecryptionProgressModal exists
- Check electionApi methods exist
- Verify polling interval is active

## Database Schema

```sql
decryption_status
├── decryption_status_id (PK)
├── election_id (FK)
├── guardian_id (FK)
├── status (pending|in_progress|completed|failed)
├── total_chunks
├── processed_chunks
├── current_phase (partial_decryption|compensated_shares_generation)
├── current_chunk_number
├── compensating_for_guardian_id
├── compensating_for_guardian_name
├── total_compensated_guardians
├── processed_compensated_guardians
├── guardian_email
├── guardian_name
├── started_at
├── completed_at
├── error_message
├── created_at
└── updated_at
```

## Code Locations

### Backend
- **Model**: `backend/src/main/java/com/amarvote/amarvote/model/DecryptionStatus.java`
- **Repository**: `backend/src/main/java/com/amarvote/amarvote/repository/DecryptionStatusRepository.java`
- **DTO**: `backend/src/main/java/com/amarvote/amarvote/dto/DecryptionStatusResponse.java`
- **Service**: `backend/src/main/java/com/amarvote/amarvote/service/PartialDecryptionService.java`
  - `initiateDecryption()`
  - `processDecryptionAsync()`
  - `getDecryptionStatus()`
- **Controller**: `backend/src/main/java/com/amarvote/amarvote/controller/ElectionController.java`
  - POST `/guardian/initiate-decryption`
  - GET `/guardian/decryption-status/{electionId}/{guardianId}`

### Frontend
- **Component**: `frontend/src/components/DecryptionProgressModal.jsx`
- **Integration**: `frontend/src/pages/ElectionPage.jsx`
  - `handleGuardianKeySubmit()`
  - `handleDecryptionModalClose()`
- **API Client**: `frontend/src/utils/electionApi.js`
  - `initiateDecryption()`
  - `getDecryptionStatus()`

### Database
- **Schema**: `Database/decryption_status_table.sql`
- **Migration Scripts**:
  - `migrate-decryption-table.bat` (Windows)
  - `migrate-decryption-table.sh` (Linux/Mac)

## Example Status Response

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

## Benefits

### For Guardians
- **Transparency**: See exactly what's happening
- **Reassurance**: Process is working correctly
- **Progress Tracking**: Know how long it will take
- **Error Feedback**: Clear messages if something fails

### For System
- **Concurrent Safety**: No duplicate processing
- **Error Recovery**: Can retry failed operations
- **Monitoring**: Track all decryption activities
- **Audit Trail**: Complete history of operations

### For Users
- **Professional UX**: Modern, intuitive interface
- **Real-Time Updates**: No need to refresh
- **Visual Feedback**: Progress bars and animations
- **Clear Communication**: What's happening at each phase

## Next Steps

After successful deployment:

1. **Test with real election data**
2. **Monitor backend logs for any issues**
3. **Check database for status records**
4. **Verify polling mechanism works**
5. **Test concurrent submissions**
6. **Validate error handling**
7. **Confirm completion notifications**

## Support

If you encounter issues:

1. Check this guide's troubleshooting section
2. Review backend logs for errors
3. Inspect database decryption_status table
4. Verify migration ran successfully
5. Check browser console for frontend errors
6. Refer to DECRYPTION_PROGRESS_IMPLEMENTATION.md for detailed architecture

---

**Implementation Complete!** 🎉

Your guardian decryption process now has professional, industry-level progress tracking with modern visualizations and intuitive user experience.
