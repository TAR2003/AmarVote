# Tally Creation Feature - Quick Start Guide

## Setup Instructions

### 1. Run Database Migration

**On Windows:**
```bash
.\migrate-tally-table.bat
```

**On Linux/Mac:**
```bash
chmod +x migrate-tally-table.sh
./migrate-tally-table.sh
```

**Or manually:**
```bash
mysql -u root -p amarvote < Database/tally_creation_status_table.sql
```

### 2. Restart Backend Application
The backend will automatically pick up the new table and endpoints.

### 3. Test the Feature
1. Navigate to an election that has ended
2. Go to the "Guardian Keys" tab
3. Click "Create/Check Tally Status" button
4. Follow the on-screen instructions

## API Endpoints

### Initiate Tally Creation
```http
POST /api/initiate-tally
Content-Type: application/json
Authorization: Bearer <jwt_token>

{
  "election_id": 123
}

Response:
{
  "success": true,
  "message": "Tally creation initiated successfully. Processing in background...",
  "encryptedTally": "INITIATED"
}
```

### Get Tally Status
```http
GET /api/election/{electionId}/tally-status
Authorization: Bearer <jwt_token>

Response:
{
  "success": true,
  "status": "in_progress",
  "message": "Tally creation status retrieved successfully",
  "totalChunks": 5,
  "processedChunks": 3,
  "progressPercentage": 60.0,
  "createdBy": "admin@example.com",
  "startedAt": "2026-01-08T10:30:00Z",
  "completedAt": null,
  "errorMessage": null
}
```

## Status Values

| Status | Description |
|--------|-------------|
| `not_started` | Tally creation not initiated |
| `pending` | Request received, processing about to start |
| `in_progress` | Chunks being processed |
| `completed` | All chunks processed successfully |
| `failed` | Error occurred during processing |

## Frontend Usage

### Import the Modal
```javascript
import TallyCreationModal from '../components/TallyCreationModal';
```

### Add to Component
```jsx
const [isTallyModalOpen, setIsTallyModalOpen] = useState(false);

<TallyCreationModal
  isOpen={isTallyModalOpen}
  onClose={() => setIsTallyModalOpen(false)}
  electionId={electionId}
  electionApi={electionApi}
/>
```

### Open Modal
```jsx
<button onClick={() => setIsTallyModalOpen(true)}>
  Create/Check Tally Status
</button>
```

## Common Issues & Solutions

### Issue 1: Table Already Exists
**Error**: `Table 'tally_creation_status' already exists`
**Solution**: The table is already created. No action needed.

### Issue 2: Async Not Working
**Error**: Methods marked with `@Async` execute synchronously
**Solution**: Ensure `@EnableAsync` is present in `AmarvoteApplication.java`

### Issue 3: Progress Not Updating
**Error**: Frontend shows 0% progress indefinitely
**Solution**: 
- Check backend logs for errors
- Verify database connection
- Ensure election has cast ballots

### Issue 4: Guardian Can't Submit Key
**Error**: "Tally has not been created yet..."
**Solution**: Create tally first using the "Create Tally" button

## Testing Scenarios

### Scenario 1: Normal Flow
1. ✅ Election ends
2. ✅ User clicks "Create/Check Tally Status"
3. ✅ Modal shows "Ready to Create Tally"
4. ✅ User clicks "Create Tally"
5. ✅ Progress bar shows chunks being processed
6. ✅ Completion message appears
7. ✅ Guardian can now submit keys

### Scenario 2: Concurrent Users
1. ✅ User A starts tally creation
2. ✅ User B opens modal during User A's creation
3. ✅ User B sees same progress as User A
4. ✅ Both see completion simultaneously

### Scenario 3: Retry After Failure
1. ✅ Tally creation fails (simulated error)
2. ✅ Error message displayed
3. ✅ User clicks "Retry"
4. ✅ Tally creation succeeds

## Architecture Overview

```
Frontend (React)
    ↓
TallyCreationModal
    ↓
electionApi.initiateTallyCreation()
    ↓
ElectionController.initiateTallyCreation()
    ↓
TallyService.initiateTallyCreation() → Returns immediately
    ↓
TallyService.createTallyAsync() → Runs in background
    ↓
    ├─ Creates status record
    ├─ Processes chunks (with progress updates)
    └─ Marks as completed
    
Frontend Polling
    ↓
electionApi.getTallyStatus() (every 2 seconds)
    ↓
TallyService.getTallyStatus()
    ↓
Updates UI with progress
```

## Performance Considerations

### Database
- Indexed on `(election_id, status)` for fast lookups
- Unique constraint prevents duplicates

### Backend
- Async processing prevents request timeout
- Concurrent hashmap prevents race conditions
- Transaction boundaries ensure data consistency

### Frontend
- Polling interval: 2 seconds (adjustable)
- Automatic cleanup on modal close
- Real-time progress updates

## Troubleshooting Commands

### Check Table Structure
```sql
DESCRIBE tally_creation_status;
```

### View Tally Status
```sql
SELECT * FROM tally_creation_status WHERE election_id = 123;
```

### Reset Tally Status (for testing)
```sql
DELETE FROM tally_creation_status WHERE election_id = 123;
DELETE FROM election_center WHERE election_id = 123;
```

### Check Backend Logs
```bash
# Look for these patterns
grep "=== Async Tally Creation Started ===" backend.log
grep "✅ Chunk .* completed" backend.log
grep "=== Tally Creation Completed ===" backend.log
```

## Support

For issues or questions:
1. Check backend logs for detailed error messages
2. Verify database schema matches expected structure
3. Ensure all dependencies are up to date
4. Review [TALLY_CREATION_IMPLEMENTATION.md](TALLY_CREATION_IMPLEMENTATION.md) for details
