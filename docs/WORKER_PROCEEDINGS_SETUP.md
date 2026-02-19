# Worker Proceedings Feature - Setup Guide

## Problem
The Worker Proceedings tab shows "N/A" because the database tables don't exist yet.

## Solution - Run These Steps

### Step 1: Check Current Status
Connect to your PostgreSQL database and run:
```bash
psql -U your_username -d your_database -f Database/diagnostics/check_worker_logs.sql
```

### Step 2: Create Missing Tables
If tables are missing, run:
```bash
psql -U your_username -d your_database -f Database/creation/create_worker_logs_tables.sql
```

### Step 3: Restart Backend
After creating tables, restart your Spring Boot backend:
```bash
cd backend
./mvnw spring-boot:stop
./mvnw spring-boot:run
```

### Step 4: Test with New Election
**IMPORTANT:** The worker logs only track NEW operations after the tables are created.

Your completed election (ID=2) won't have worker logs because:
- The election was processed BEFORE the tables existed
- Worker logging only starts AFTER tables are created

To see worker logs:
1. Create a new test election
2. Complete the tally/decryption process
3. Navigate to Worker Proceedings tab
4. You should see all metrics and charts

---

## Alternative: SQL Commands (Manual)

If you prefer to run SQL directly:

### 1. Connect to database:
```bash
psql -U postgres -d amarvote
```

### 2. Run this SQL:
```sql
-- Create tables
CREATE TABLE IF NOT EXISTS tally_worker_log (
    tally_worker_log_id BIGSERIAL PRIMARY KEY,
    election_id BIGINT NOT NULL,
    election_center_id BIGINT NOT NULL,
    chunk_number INTEGER NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'IN_PROGRESS',
    error_message TEXT,
    CONSTRAINT fk_tally_worker_election FOREIGN KEY (election_id) REFERENCES elections(election_id) ON DELETE CASCADE,
    CONSTRAINT fk_tally_worker_center FOREIGN KEY (election_center_id) REFERENCES election_center(election_center_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS decryption_worker_log (
    decryption_worker_log_id BIGSERIAL PRIMARY KEY,
    election_id BIGINT NOT NULL,
    election_center_id BIGINT NOT NULL,
    guardian_id BIGINT NOT NULL,
    decrypting_guardian_id BIGINT NOT NULL,
    decryption_type VARCHAR(50) NOT NULL,
    chunk_number INTEGER NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'IN_PROGRESS',
    error_message TEXT,
    CONSTRAINT fk_decryption_worker_election FOREIGN KEY (election_id) REFERENCES elections(election_id) ON DELETE CASCADE,
    CONSTRAINT fk_decryption_worker_center FOREIGN KEY (election_center_id) REFERENCES election_center(election_center_id) ON DELETE CASCADE,
    CONSTRAINT fk_decryption_worker_guardian FOREIGN KEY (guardian_id) REFERENCES guardians(guardian_id) ON DELETE CASCADE,
    CONSTRAINT fk_decryption_worker_decrypting FOREIGN KEY (decrypting_guardian_id) REFERENCES guardians(guardian_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS combine_worker_log (
    combine_worker_log_id BIGSERIAL PRIMARY KEY,
    election_id BIGINT NOT NULL,
    election_center_id BIGINT NOT NULL,
    chunk_number INTEGER NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'IN_PROGRESS',
    error_message TEXT,
    CONSTRAINT fk_combine_worker_election FOREIGN KEY (election_id) REFERENCES elections(election_id) ON DELETE CASCADE,
    CONSTRAINT fk_combine_worker_center FOREIGN KEY (election_center_id) REFERENCES election_center(election_center_id) ON DELETE CASCADE
);

-- Verify
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('tally_worker_log', 'decryption_worker_log', 'combine_worker_log');
```

---

## Troubleshooting

### Tables exist but still showing N/A?
- Check if election ID=2 has any worker log data:
  ```sql
  SELECT COUNT(*) FROM tally_worker_log WHERE election_id = 2;
  SELECT COUNT(*) FROM decryption_worker_log WHERE election_id = 2;
  SELECT COUNT(*) FROM combine_worker_log WHERE election_id = 2;
  ```
- If all return 0, the election was completed before tables were created
- Create a new test election to see worker logs

### Backend errors after creating tables?
- Restart backend: `./mvnw spring-boot:restart`
- Check logs for any JPA/Hibernate errors
- Verify entities are loaded: Check for `TallyWorkerLog`, `DecryptionWorkerLog`, `CombineWorkerLog` in logs

### Frontend showing 404 for worker-logs endpoint?
- Backend may not have restarted
- Check backend logs for controller registration
- Verify endpoint: `curl http://localhost:8080/api/worker-logs/tally/2`

---

## Expected Result

After setup and running a NEW election, Worker Proceedings tab will show:
- ✅ Total Processing Time
- ✅ Average per Chunk
- ✅ Total Elapsed Time
- ✅ Completion Status (X / Y chunks)
- ✅ Bar chart of chunk durations
- ✅ Detailed table with times and status for each chunk

All data should be visible across all 4 tabs:
1. Tally Processing
2. Partial Decryption
3. Compensated Decryption
4. Combine Decryption
