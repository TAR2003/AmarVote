-- ============================================
-- DIAGNOSTIC SCRIPT FOR WORKER LOGS
-- ============================================
-- Run this script to check the status of worker log tables and data

-- ============================================
-- 1. Check if tables exist
-- ============================================
SELECT 
    CASE 
        WHEN EXISTS (SELECT FROM pg_tables WHERE tablename = 'tally_worker_log') 
        THEN '✅ EXISTS' 
        ELSE '❌ MISSING' 
    END as tally_worker_log_status,
    CASE 
        WHEN EXISTS (SELECT FROM pg_tables WHERE tablename = 'decryption_worker_log') 
        THEN '✅ EXISTS' 
        ELSE '❌ MISSING' 
    END as decryption_worker_log_status,
    CASE 
        WHEN EXISTS (SELECT FROM pg_tables WHERE tablename = 'combine_worker_log') 
        THEN '✅ EXISTS' 
        ELSE '❌ MISSING' 
    END as combine_worker_log_status;

-- ============================================
-- 2. Check record counts (if tables exist)
-- ============================================
DO $$ 
DECLARE
    tally_count INTEGER;
    decryption_count INTEGER;
    combine_count INTEGER;
BEGIN
    -- Check tally_worker_log
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'tally_worker_log') THEN
        SELECT COUNT(*) INTO tally_count FROM tally_worker_log;
        RAISE NOTICE 'Tally worker logs: % records', tally_count;
    ELSE
        RAISE NOTICE 'Tally worker log table does not exist';
    END IF;
    
    -- Check decryption_worker_log
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'decryption_worker_log') THEN
        SELECT COUNT(*) INTO decryption_count FROM decryption_worker_log;
        RAISE NOTICE 'Decryption worker logs: % records', decryption_count;
    ELSE
        RAISE NOTICE 'Decryption worker log table does not exist';
    END IF;
    
    -- Check combine_worker_log
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'combine_worker_log') THEN
        SELECT COUNT(*) INTO combine_count FROM combine_worker_log;
        RAISE NOTICE 'Combine worker logs: % records', combine_count;
    ELSE
        RAISE NOTICE 'Combine worker log table does not exist';
    END IF;
END $$;

-- ============================================
-- 3. Show sample data for election 2 (if exists)
-- ============================================
DO $$ 
BEGIN
    RAISE NOTICE '==========================================';
    RAISE NOTICE 'SAMPLE DATA FOR ELECTION ID = 2';
    RAISE NOTICE '==========================================';
END $$;

-- Tally logs for election 2
SELECT 
    'TALLY' as log_type,
    chunk_number,
    start_time,
    end_time,
    status,
    EXTRACT(EPOCH FROM (end_time - start_time)) * 1000 as duration_ms
FROM tally_worker_log
WHERE election_id = 2
ORDER BY chunk_number
LIMIT 10;

-- Decryption logs for election 2
SELECT 
    'DECRYPTION' as log_type,
    decryption_type,
    chunk_number,
    start_time,
    end_time,
    status,
    EXTRACT(EPOCH FROM (end_time - start_time)) * 1000 as duration_ms
FROM decryption_worker_log
WHERE election_id = 2
ORDER BY decryption_type, chunk_number
LIMIT 10;

-- Combine logs for election 2
SELECT 
    'COMBINE' as log_type,
    chunk_number,
    start_time,
    end_time,
    status,
    EXTRACT(EPOCH FROM (end_time - start_time)) * 1000 as duration_ms
FROM combine_worker_log
WHERE election_id = 2
ORDER BY chunk_number
LIMIT 10;

-- ============================================
-- 4. Summary statistics
-- ============================================
DO $$ 
DECLARE
    tally_exists BOOLEAN;
    decryption_exists BOOLEAN;
    combine_exists BOOLEAN;
BEGIN
    tally_exists := EXISTS (SELECT FROM pg_tables WHERE tablename = 'tally_worker_log');
    decryption_exists := EXISTS (SELECT FROM pg_tables WHERE tablename = 'decryption_worker_log');
    combine_exists := EXISTS (SELECT FROM pg_tables WHERE tablename = 'combine_worker_log');
    
    RAISE NOTICE '==========================================';
    RAISE NOTICE 'DIAGNOSTIC SUMMARY';
    RAISE NOTICE '==========================================';
    
    IF tally_exists AND decryption_exists AND combine_exists THEN
        RAISE NOTICE '✅ All worker log tables exist';
    ELSE
        RAISE NOTICE '❌ Some worker log tables are missing';
        RAISE NOTICE '   Run create_worker_logs_tables.sql to create them';
    END IF;
    
    RAISE NOTICE '==========================================';
END $$;
