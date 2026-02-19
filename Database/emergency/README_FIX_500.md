# 🚨 FIX 500 ERROR ON /api/all-elections

## Problem
Backend is returning 500 error because worker log tables don't exist in database.

## Solution (Choose ONE method)

---

### Method 1: Automated Fix (PowerShell)

```powershell
cd Database/emergency
./fix_500_error.ps1
```

Follow the prompts. It will:
1. Create missing tables
2. Restart backend automatically

---

### Method 2: Manual Fix (3 Steps)

#### STEP 1: Create Tables
```bash
cd Database/emergency
psql -U postgres -d amarvote -f create_worker_tables_NOW.sql
```

#### STEP 2: Restart Backend
```bash
cd ../../backend
# Stop current backend (Ctrl+C if running in terminal)
# Or kill the Java process
./mvnw spring-boot:run
```

#### STEP 3: Wait & Test
- Wait 30-60 seconds for backend to fully start
- Refresh your frontend
- Dashboard should now load

---

### Method 3: Quick SQL (If you're already in psql)

```sql
-- Connect first
\c amarvote

-- Run this entire block
BEGIN;
DROP TABLE IF EXISTS combine_worker_log CASCADE;
DROP TABLE IF EXISTS decryption_worker_log CASCADE;
DROP TABLE IF EXISTS tally_worker_log CASCADE;

CREATE TABLE tally_worker_log (
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

CREATE TABLE decryption_worker_log (
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

CREATE TABLE combine_worker_log (
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
COMMIT;
```

Then restart backend and refresh frontend.

---

## Why This Happened

The backend code was updated to include worker logging entities (`TallyWorkerLog`, `DecryptionWorkerLog`, `CombineWorkerLog`), but the database tables weren't created yet. When Spring Boot starts, Hibernate validates all entities have matching tables - it failed this check and couldn't start properly.

## After Fix

✅ Backend will start successfully  
✅ `/api/all-elections` will work  
✅ Dashboard will load  
✅ Worker Proceedings feature will be ready (shows data for NEW elections only)  
✅ Cascade delete will work (deleting election_center deletes worker logs)
