-- ============================================
-- WORKER LOG TABLES VERIFICATION SCRIPT
-- ============================================
-- This script checks if worker log tables exist and are properly configured
-- Run this to diagnose "N/A" or "No data found" issues in Worker Proceedings tab

\echo '================================================'
\echo 'CHECKING WORKER LOG TABLES'
\echo '================================================'

-- 1. Check if tables exist
\echo ''
\echo '1. Checking if worker log tables exist...'
SELECT 
    CASE 
        WHEN EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tally_worker_log')
        THEN '✅ tally_worker_log exists'
        ELSE '❌ tally_worker_log is MISSING'
    END as tally_table_status,
    CASE 
        WHEN EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'decryption_worker_log')
        THEN '✅ decryption_worker_log exists'
        ELSE '❌ decryption_worker_log is MISSING'
    END as decryption_table_status,
    CASE 
        WHEN EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'combine_worker_log')
        THEN '✅ combine_worker_log exists'
        ELSE '❌ combine_worker_log is MISSING'
    END as combine_table_status;

-- 2. Check table structure and columns
\echo ''
\echo '2. Checking table structures...'
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name IN ('tally_worker_log', 'decryption_worker_log', 'combine_worker_log')
ORDER BY table_name, ordinal_position;

-- 3. Check foreign key constraints
\echo ''
\echo '3. Checking foreign key constraints...'
SELECT 
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name IN ('tally_worker_log', 'decryption_worker_log', 'combine_worker_log')
ORDER BY tc.table_name, kcu.column_name;

-- 4. Check indexes
\echo ''
\echo '4. Checking indexes...'
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public' 
  AND tablename IN ('tally_worker_log', 'decryption_worker_log', 'combine_worker_log')
ORDER BY tablename, indexname;

-- 5. Count records in each table
\echo ''
\echo '5. Checking record counts...'
DO $$
DECLARE
    tally_count INTEGER;
    decryption_count INTEGER;
    combine_count INTEGER;
BEGIN
    -- Check if tables exist before counting
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tally_worker_log') THEN
        SELECT COUNT(*) INTO tally_count FROM tally_worker_log;
        RAISE NOTICE 'tally_worker_log: % records', tally_count;
    ELSE
        RAISE NOTICE 'tally_worker_log: TABLE DOES NOT EXIST';
    END IF;
    
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'decryption_worker_log') THEN
        SELECT COUNT(*) INTO decryption_count FROM decryption_worker_log;
        RAISE NOTICE 'decryption_worker_log: % records', decryption_count;
    ELSE
        RAISE NOTICE 'decryption_worker_log: TABLE DOES NOT EXIST';
    END IF;
    
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'combine_worker_log') THEN
        SELECT COUNT(*) INTO combine_count FROM combine_worker_log;
        RAISE NOTICE 'combine_worker_log: % records', combine_count;
    ELSE
        RAISE NOTICE 'combine_worker_log: TABLE DOES NOT EXIST';
    END IF;
END $$;

-- 6. Show sample data from each table (if exists)
\echo ''
\echo '6. Sample data from worker log tables...'

-- Tally worker logs
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tally_worker_log') THEN
        RAISE NOTICE 'Recent tally worker logs:';
    END IF;
END $$;

SELECT 
    tally_worker_log_id,
    election_id,
    chunk_number,
    status,
    start_time,
    end_time
FROM tally_worker_log
WHERE EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tally_worker_log')
ORDER BY start_time DESC
LIMIT 5;

-- Decryption worker logs
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'decryption_worker_log') THEN
        RAISE NOTICE 'Recent decryption worker logs:';
    END IF;
END $$;

SELECT 
    decryption_worker_log_id,
    election_id,
    decryption_type,
    chunk_number,
    status,
    start_time,
    end_time
FROM decryption_worker_log
WHERE EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'decryption_worker_log')
ORDER BY start_time DESC
LIMIT 5;

-- Combine worker logs
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'combine_worker_log') THEN
        RAISE NOTICE 'Recent combine worker logs:';
    END IF;
END $$;

SELECT 
    combine_worker_log_id,
    election_id,
    chunk_number,
    status,
    start_time,
    end_time
FROM combine_worker_log
WHERE EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'combine_worker_log')
ORDER BY start_time DESC
LIMIT 5;

-- 7. Summary and recommendations
\echo ''
\echo '================================================'
\echo 'DIAGNOSTIC SUMMARY'
\echo '================================================'

DO $$
DECLARE
    tables_missing BOOLEAN := FALSE;
    tables_empty BOOLEAN := FALSE;
    total_records INTEGER := 0;
BEGIN
    -- Check if any tables are missing
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tally_worker_log') OR
       NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'decryption_worker_log') OR
       NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'combine_worker_log') THEN
        tables_missing := TRUE;
    END IF;
    
    -- Check if tables exist and are empty
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tally_worker_log') THEN
        SELECT COUNT(*) INTO total_records FROM tally_worker_log;
        IF total_records = 0 THEN
            SELECT COUNT(*) INTO total_records FROM decryption_worker_log;
            IF total_records = 0 THEN
                SELECT COUNT(*) INTO total_records FROM combine_worker_log;
                IF total_records = 0 THEN
                    tables_empty := TRUE;
                END IF;
            END IF;
        END IF;
    END IF;
    
    IF tables_missing THEN
        RAISE NOTICE '';
        RAISE NOTICE '❌ PROBLEM FOUND: Worker log tables are missing!';
        RAISE NOTICE '';
        RAISE NOTICE '📝 SOLUTION:';
        RAISE NOTICE '   1. Run the table creation script:';
        RAISE NOTICE '      psql -U amarvote_admin -d amarvote -f Database/creation/table_creation_file_AmarVote.sql';
        RAISE NOTICE '   OR';
        RAISE NOTICE '   2. Run the quick fix script:';
        RAISE NOTICE '      psql -U amarvote_admin -d amarvote -f Database/diagnostics/create_worker_log_tables.sql';
        RAISE NOTICE '';
    ELSIF tables_empty THEN
        RAISE NOTICE '';
        RAISE NOTICE '⚠️  INFORMATION: Worker log tables exist but are empty';
        RAISE NOTICE '';
        RAISE NOTICE '📝 EXPLANATION:';
        RAISE NOTICE '   Worker logs are created during election processing.';
        RAISE NOTICE '   This is normal if:';
        RAISE NOTICE '   - No elections have been processed since tables were created';
        RAISE NOTICE '   - You are looking at old elections created before worker logging was added';
        RAISE NOTICE '';
        RAISE NOTICE '   To generate worker logs:';
        RAISE NOTICE '   1. Create a NEW election';
        RAISE NOTICE '   2. Process it through tally creation, decryption, and combining';
        RAISE NOTICE '   3. Worker logs will appear in the Worker Proceedings tab';
        RAISE NOTICE '';
    ELSE
        RAISE NOTICE '';
        RAISE NOTICE '✅ Worker log tables are properly configured and contain data!';
        RAISE NOTICE '';
        RAISE NOTICE 'If you still see "N/A" in Worker Proceedings:';
        RAISE NOTICE '   1. Check if the election ID you are viewing has worker logs';
        RAISE NOTICE '   2. Check browser console for API errors';
        RAISE NOTICE '   3. Verify backend service is running';
        RAISE NOTICE '   4. Check backend logs for errors';
        RAISE NOTICE '';
    END IF;
END $$;

\echo '================================================'
\echo 'VERIFICATION COMPLETE'
\echo '================================================'
