# Worker Proceedings - Troubleshooting Guide

## Problem: Worker Proceedings shows "N/A" or "No data found"

This guide will help you fix the Worker Proceedings feature showing empty data.

---

## Quick Diagnosis

Run this command to check your database:
```bash
psql -U amarvote_admin -d amarvote -f Database/diagnostics/verify_worker_log_tables.sql
```

This will tell you exactly what's wrong and how to fix it.

---

## Common Issues and Solutions

### Issue 1: Worker Log Tables Don't Exist ❌

**Symptoms:**
- Worker Proceedings shows error message
- Backend logs show SQL errors about missing tables
- 404 or 500 errors in browser console

**Solution:**
```bash
# Run the quick fix script
psql -U amarvote_admin -d amarvote -f Database/diagnostics/create_worker_log_tables.sql

# OR run the full table creation script
psql -U amarvote_admin -d amarvote -f Database/creation/table_creation_file_AmarVote.sql
```

After running the script:
1. Restart your backend service
2. Create a NEW election to test
3. Process it through voting and tallying
4. Check Worker Proceedings tab

---

### Issue 2: Tables Exist But Are Empty ⚠️

**Symptoms:**
- Worker Proceedings shows "No Processing Logs Yet"
- The diagnostic script shows 0 records
- No errors in console

**Explanation:**
This is **NORMAL** behavior if:
- You're viewing an old election (created before worker log tables were added)
- The election hasn't been processed through tally/decryption yet
- No elections have been created since the tables were added

**Solution:**
Worker logs are only created for **NEW** elections during processing. To see logs:

1. **Create a new election** through the admin panel
2. **Add voters** to the election
3. **Process the election:**
   - Start the election
   - Have voters cast votes
   - End the election
   - Create tally (as admin)
   - Submit guardian keys (if applicable)
   - Combine decryption results
4. **Check Worker Proceedings** tab - logs will now appear!

---

### Issue 3: API Errors

**Symptoms:**
- Red error message in Worker Proceedings
- Backend not responding
- Authentication errors

**Solutions:**

1. **Check Backend is Running**
   ```bash
   # Check if backend is running
   curl http://localhost:8080/api/elections
   ```

2. **Check Backend Logs**
   ```bash
   # Look for errors in backend logs
   tail -f backend/logs/spring.log
   ```

3. **Verify Authentication**
   - Make sure you're logged in
   - Try refreshing the page
   - Check if your session has expired

4. **Check CORS Settings**
   - Verify CORS is enabled in backend
   - Check `@CrossOrigin` annotation in WorkerLogController

---

## Database Commands Reference

### Connect to Database
```bash
psql -U amarvote_admin -d amarvote
```

### Check if Tables Exist
```sql
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename LIKE '%worker_log%';
```

### Count Records in Tables
```sql
SELECT 'tally' as table_name, COUNT(*) as records FROM tally_worker_log
UNION ALL
SELECT 'decryption', COUNT(*) FROM decryption_worker_log
UNION ALL
SELECT 'combine', COUNT(*) FROM combine_worker_log;
```

### View Recent Logs
```sql
-- View recent tally logs
SELECT * FROM tally_worker_log 
ORDER BY start_time DESC LIMIT 10;

-- View recent decryption logs
SELECT * FROM decryption_worker_log 
ORDER BY start_time DESC LIMIT 10;

-- View recent combine logs
SELECT * FROM combine_worker_log 
ORDER BY start_time DESC LIMIT 10;
```

### Drop and Recreate Tables (if corrupted)
```sql
-- ⚠️ WARNING: This will delete all worker log data!
DROP TABLE IF EXISTS tally_worker_log CASCADE;
DROP TABLE IF EXISTS decryption_worker_log CASCADE;
DROP TABLE IF EXISTS combine_worker_log CASCADE;

-- Then run the creation script
\i Database/diagnostics/create_worker_log_tables.sql
```

---

## Understanding Worker Logs

Worker logs track the performance of background processing tasks:

1. **Tally Worker Logs** - Created during tally creation
   - Tracks chunked processing of ballots
   - Shows time taken per chunk

2. **Decryption Worker Logs** - Created during guardian decryption
   - Tracks partial decryption (each guardian decrypting their share)
   - Tracks compensated decryption (when guardians are missing)

3. **Combine Worker Logs** - Created during final result combining
   - Tracks the combining of decrypted shares
   - Shows final tally computation time

---

## Frontend Improvements

The Worker Proceedings component now shows:

- ✅ Better error messages with troubleshooting tips
- ✅ Distinction between "API error" and "No logs yet"
- ✅ Detailed error information for debugging
- ✅ Retry button when errors occur
- ✅ Loading states
- ✅ Helpful information boxes

---

## Testing the Feature

Follow these steps to test Worker Proceedings:

1. **Verify Tables Exist**
   ```bash
   psql -U amarvote_admin -d amarvote -f Database/diagnostics/verify_worker_log_tables.sql
   ```

2. **Create Test Election**
   - Log in as admin
   - Create a new election
   - Add 2-3 candidates
   - Add 5-10 voters
   - Add 1-2 guardians

3. **Process Election**
   - Start election
   - Cast votes as different voters
   - End election
   - Create tally (this generates tally worker logs)
   - Submit guardian keys (this generates decryption worker logs)
   - Combine results (this generates combine worker logs)

4. **View Results**
   - Navigate to election page
   - Click "Worker Proceedings" tab
   - You should see:
     - Statistics cards showing processing times
     - Timeline visualization
     - Bar chart of chunk processing
     - Detailed table of all chunks

---

## Still Having Issues?

If you've followed all steps and still have problems:

1. **Check Browser Console**
   ```
   Press F12 → Console tab
   Look for errors in red
   ```

2. **Check Backend Logs**
   ```bash
   cd backend
   cat logs/spring.log | grep ERROR
   ```

3. **Verify Database Connection**
   ```bash
   psql -U amarvote_admin -d amarvote -c "SELECT version();"
   ```

4. **Check Network Requests**
   - F12 → Network tab
   - Look for `/api/worker-logs/*` requests
   - Check response status and body

5. **Contact Support**
   - Provide browser console errors
   - Provide backend log errors
   - Provide database verification output
   - Describe steps you've already tried

---

## Related Files

- **Frontend Component:** `frontend/src/components/WorkerProceedings.jsx`
- **Backend Controller:** `backend/src/main/java/com/amarvote/amarvote/controller/WorkerLogController.java`
- **Database Schema:** `Database/creation/table_creation_file_AmarVote.sql`
- **Verification Script:** `Database/diagnostics/verify_worker_log_tables.sql`
- **Quick Fix Script:** `Database/diagnostics/create_worker_log_tables.sql`

---

## Summary

Most "N/A" or "No data found" issues are caused by:
1. ❌ Missing worker log tables → Run `create_worker_log_tables.sql`
2. ⚠️ Viewing old elections → Create and process a NEW election
3. ❌ Backend not running → Start backend service
4. ❌ Database connection issues → Check database credentials

Follow the diagnosis script first, then apply the appropriate solution!
