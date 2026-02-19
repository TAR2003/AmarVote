-- ============================================
-- EMERGENCY FIX: Create Worker Log Tables
-- ============================================
-- Run this NOW to fix the 500 error on /api/all-elections

-- This script creates the worker log tables that the backend expects
-- The backend is failing because these JPA entities exist but tables don't

BEGIN;

-- Drop existing tables if they have wrong constraints (will recreate properly)
DROP TABLE IF EXISTS combine_worker_log CASCADE;
DROP TABLE IF EXISTS decryption_worker_log CASCADE;
DROP TABLE IF EXISTS tally_worker_log CASCADE;

-- Tally Worker Logs
CREATE TABLE tally_worker_log (
    tally_worker_log_id BIGSERIAL PRIMARY KEY,
    election_id BIGINT NOT NULL,
    election_center_id BIGINT NOT NULL,
    chunk_number INTEGER NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'IN_PROGRESS',
    error_message TEXT,
    CONSTRAINT fk_tally_worker_election 
        FOREIGN KEY (election_id) 
        REFERENCES elections(election_id) 
        ON DELETE CASCADE,
    CONSTRAINT fk_tally_worker_center 
        FOREIGN KEY (election_center_id) 
        REFERENCES election_center(election_center_id) 
        ON DELETE CASCADE
);

-- Decryption Worker Logs
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
    CONSTRAINT fk_decryption_worker_election 
        FOREIGN KEY (election_id) 
        REFERENCES elections(election_id) 
        ON DELETE CASCADE,
    CONSTRAINT fk_decryption_worker_center 
        FOREIGN KEY (election_center_id) 
        REFERENCES election_center(election_center_id) 
        ON DELETE CASCADE,
    CONSTRAINT fk_decryption_worker_guardian 
        FOREIGN KEY (guardian_id) 
        REFERENCES guardians(guardian_id) 
        ON DELETE CASCADE,
    CONSTRAINT fk_decryption_worker_decrypting 
        FOREIGN KEY (decrypting_guardian_id) 
        REFERENCES guardians(guardian_id) 
        ON DELETE CASCADE
);

-- Combine Worker Logs
CREATE TABLE combine_worker_log (
    combine_worker_log_id BIGSERIAL PRIMARY KEY,
    election_id BIGINT NOT NULL,
    election_center_id BIGINT NOT NULL,
    chunk_number INTEGER NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'IN_PROGRESS',
    error_message TEXT,
    CONSTRAINT fk_combine_worker_election 
        FOREIGN KEY (election_id) 
        REFERENCES elections(election_id) 
        ON DELETE CASCADE,
    CONSTRAINT fk_combine_worker_center 
        FOREIGN KEY (election_center_id) 
        REFERENCES election_center(election_center_id) 
        ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX idx_tally_worker_election ON tally_worker_log(election_id);
CREATE INDEX idx_tally_worker_center ON tally_worker_log(election_center_id);
CREATE INDEX idx_tally_worker_status ON tally_worker_log(election_id, status);
CREATE INDEX idx_tally_worker_time ON tally_worker_log(election_id, start_time);

CREATE INDEX idx_decryption_worker_election ON decryption_worker_log(election_id);
CREATE INDEX idx_decryption_worker_center ON decryption_worker_log(election_center_id);
CREATE INDEX idx_decryption_worker_guardian ON decryption_worker_log(guardian_id);
CREATE INDEX idx_decryption_worker_type ON decryption_worker_log(election_id, decryption_type, status);
CREATE INDEX idx_decryption_worker_time ON decryption_worker_log(election_id, start_time);

CREATE INDEX idx_combine_worker_election ON combine_worker_log(election_id);
CREATE INDEX idx_combine_worker_center ON combine_worker_log(election_center_id);
CREATE INDEX idx_combine_worker_status ON combine_worker_log(election_id, status);
CREATE INDEX idx_combine_worker_time ON combine_worker_log(election_id, start_time);

COMMIT;

-- Verify tables were created
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as columns,
    (SELECT COUNT(*) FROM pg_indexes WHERE tablename = t.table_name) as indexes,
    '✅ CREATED' as status
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_name IN ('tally_worker_log', 'decryption_worker_log', 'combine_worker_log')
ORDER BY table_name;

-- Success message
DO $$ 
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ Worker log tables created!';
    RAISE NOTICE '🔄 NOW RESTART YOUR BACKEND';
    RAISE NOTICE '========================================';
END $$;
