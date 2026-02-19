-- ============================================
-- CREATE WORKER LOG TABLES - QUICK FIX
-- ============================================
-- This script creates the worker log tables if they don't exist
-- Safe to run multiple times (uses CREATE TABLE IF NOT EXISTS)

\echo '================================================'
\echo 'CREATING WORKER LOG TABLES'
\echo '================================================'

-- Check current state
DO $$ 
BEGIN
    \echo 'Checking existing tables...'
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tally_worker_log') THEN
        RAISE NOTICE '✓ Table tally_worker_log already exists';
    ELSE
        RAISE NOTICE '→ Will create tally_worker_log';
    END IF;
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'decryption_worker_log') THEN
        RAISE NOTICE '✓ Table decryption_worker_log already exists';
    ELSE
        RAISE NOTICE '→ Will create decryption_worker_log';
    END IF;
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'combine_worker_log') THEN
        RAISE NOTICE '✓ Table combine_worker_log already exists';
    ELSE
        RAISE NOTICE '→ Will create combine_worker_log';
    END IF;
END $$;

-- ============================================
-- WORKER AUDIT LOGS - Track processing times
-- ============================================

-- Tally Worker Logs - Track tally creation chunk processing
CREATE TABLE IF NOT EXISTS tally_worker_log (
    tally_worker_log_id BIGSERIAL PRIMARY KEY,
    election_id BIGINT NOT NULL,
    election_center_id BIGINT NOT NULL,
    chunk_number INTEGER NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'IN_PROGRESS', -- 'IN_PROGRESS', 'COMPLETED', 'FAILED'
    error_message TEXT,
    CONSTRAINT fk_tally_worker_election FOREIGN KEY (election_id) REFERENCES elections(election_id) ON DELETE CASCADE,
    CONSTRAINT fk_tally_worker_center FOREIGN KEY (election_center_id) REFERENCES election_center(election_center_id) ON DELETE CASCADE
);

-- Decryption Worker Logs - Track partial and compensated decryption processing
CREATE TABLE IF NOT EXISTS decryption_worker_log (
    decryption_worker_log_id BIGSERIAL PRIMARY KEY,
    election_id BIGINT NOT NULL,
    election_center_id BIGINT NOT NULL,
    guardian_id BIGINT NOT NULL,
    decrypting_guardian_id BIGINT NOT NULL, -- Same as guardian_id for partial, different for compensated
    decryption_type VARCHAR(50) NOT NULL, -- 'PARTIAL', 'COMPENSATED'
    chunk_number INTEGER NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'IN_PROGRESS', -- 'IN_PROGRESS', 'COMPLETED', 'FAILED'
    error_message TEXT,
    CONSTRAINT fk_decryption_worker_election FOREIGN KEY (election_id) REFERENCES elections(election_id) ON DELETE CASCADE,
    CONSTRAINT fk_decryption_worker_center FOREIGN KEY (election_center_id) REFERENCES election_center(election_center_id) ON DELETE CASCADE,
    CONSTRAINT fk_decryption_worker_guardian FOREIGN KEY (guardian_id) REFERENCES guardians(guardian_id) ON DELETE CASCADE,
    CONSTRAINT fk_decryption_worker_decrypting FOREIGN KEY (decrypting_guardian_id) REFERENCES guardians(guardian_id) ON DELETE CASCADE
);

-- Combine Worker Logs - Track combine decryption processing
CREATE TABLE IF NOT EXISTS combine_worker_log (
    combine_worker_log_id BIGSERIAL PRIMARY KEY,
    election_id BIGINT NOT NULL,
    election_center_id BIGINT NOT NULL,
    chunk_number INTEGER NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'IN_PROGRESS', -- 'IN_PROGRESS', 'COMPLETED', 'FAILED'
    error_message TEXT,
    CONSTRAINT fk_combine_worker_election FOREIGN KEY (election_id) REFERENCES elections(election_id) ON DELETE CASCADE,
    CONSTRAINT fk_combine_worker_center FOREIGN KEY (election_center_id) REFERENCES election_center(election_center_id) ON DELETE CASCADE
);

-- Worker Logs Indexes
CREATE INDEX IF NOT EXISTS idx_tally_worker_election ON tally_worker_log(election_id);
CREATE INDEX IF NOT EXISTS idx_tally_worker_center ON tally_worker_log(election_center_id);
CREATE INDEX IF NOT EXISTS idx_tally_worker_status ON tally_worker_log(election_id, status);
CREATE INDEX IF NOT EXISTS idx_tally_worker_time ON tally_worker_log(election_id, start_time);

CREATE INDEX IF NOT EXISTS idx_decryption_worker_election ON decryption_worker_log(election_id);
CREATE INDEX IF NOT EXISTS idx_decryption_worker_center ON decryption_worker_log(election_center_id);
CREATE INDEX IF NOT EXISTS idx_decryption_worker_guardian ON decryption_worker_log(guardian_id);
CREATE INDEX IF NOT EXISTS idx_decryption_worker_type ON decryption_worker_log(election_id, decryption_type, status);
CREATE INDEX IF NOT EXISTS idx_decryption_worker_time ON decryption_worker_log(election_id, start_time);

CREATE INDEX IF NOT EXISTS idx_combine_worker_election ON combine_worker_log(election_id);
CREATE INDEX IF NOT EXISTS idx_combine_worker_center ON combine_worker_log(election_center_id);
CREATE INDEX IF NOT EXISTS idx_combine_worker_status ON combine_worker_log(election_id, status);
CREATE INDEX IF NOT EXISTS idx_combine_worker_time ON combine_worker_log(election_id, start_time);

-- Verification
\echo ''
\echo '================================================'
\echo 'VERIFICATION'
\echo '================================================'

-- Verify tables were created
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count,
    (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_name = t.table_name AND constraint_type = 'FOREIGN KEY') as fk_count,
    (SELECT COUNT(*) FROM pg_indexes WHERE tablename = t.table_name) as index_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_name IN ('tally_worker_log', 'decryption_worker_log', 'combine_worker_log')
ORDER BY table_name;

-- Success message
DO $$ 
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ Worker log tables created successfully!';
    RAISE NOTICE '📊 You can now use the Worker Proceedings feature';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  IMPORTANT NOTES:';
    RAISE NOTICE '   • Only NEW elections will have worker logs';
    RAISE NOTICE '   • Past elections will show "No Processing Logs Yet"';
    RAISE NOTICE '   • Logs are created during tally, decryption, and combine operations';
    RAISE NOTICE '';
    RAISE NOTICE '🔄 Next Steps:';
    RAISE NOTICE '   1. Restart your backend service if it''s running';
    RAISE NOTICE '   2. Create a new election to test the feature';
    RAISE NOTICE '   3. Process the election through voting and tallying';
    RAISE NOTICE '   4. Check Worker Proceedings tab for logs';
    RAISE NOTICE '';
END $$;

\echo '================================================'
\echo 'COMPLETE'
\echo '================================================'
