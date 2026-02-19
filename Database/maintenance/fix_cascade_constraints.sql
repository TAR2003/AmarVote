-- ============================================
-- CHECK AND FIX FOREIGN KEY CONSTRAINTS
-- ============================================
-- This script checks if CASCADE constraints exist and adds them if missing

-- ============================================
-- 1. Check existing foreign keys
-- ============================================
SELECT
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
LEFT JOIN information_schema.referential_constraints AS rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.table_name IN ('tally_worker_log', 'decryption_worker_log', 'combine_worker_log')
    AND tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name, tc.constraint_name;

-- ============================================
-- 2. Drop existing constraints (if they exist without CASCADE)
-- ============================================

-- Drop tally_worker_log constraints
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'fk_tally_worker_center' 
               AND table_name = 'tally_worker_log') THEN
        ALTER TABLE tally_worker_log DROP CONSTRAINT fk_tally_worker_center;
        RAISE NOTICE 'Dropped fk_tally_worker_center';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'fk_tally_worker_election' 
               AND table_name = 'tally_worker_log') THEN
        ALTER TABLE tally_worker_log DROP CONSTRAINT fk_tally_worker_election;
        RAISE NOTICE 'Dropped fk_tally_worker_election';
    END IF;
END $$;

-- Drop decryption_worker_log constraints
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'fk_decryption_worker_center' 
               AND table_name = 'decryption_worker_log') THEN
        ALTER TABLE decryption_worker_log DROP CONSTRAINT fk_decryption_worker_center;
        RAISE NOTICE 'Dropped fk_decryption_worker_center';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'fk_decryption_worker_election' 
               AND table_name = 'decryption_worker_log') THEN
        ALTER TABLE decryption_worker_log DROP CONSTRAINT fk_decryption_worker_election;
        RAISE NOTICE 'Dropped fk_decryption_worker_election';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'fk_decryption_worker_guardian' 
               AND table_name = 'decryption_worker_log') THEN
        ALTER TABLE decryption_worker_log DROP CONSTRAINT fk_decryption_worker_guardian;
        RAISE NOTICE 'Dropped fk_decryption_worker_guardian';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'fk_decryption_worker_decrypting' 
               AND table_name = 'decryption_worker_log') THEN
        ALTER TABLE decryption_worker_log DROP CONSTRAINT fk_decryption_worker_decrypting;
        RAISE NOTICE 'Dropped fk_decryption_worker_decrypting';
    END IF;
END $$;

-- Drop combine_worker_log constraints
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'fk_combine_worker_center' 
               AND table_name = 'combine_worker_log') THEN
        ALTER TABLE combine_worker_log DROP CONSTRAINT fk_combine_worker_center;
        RAISE NOTICE 'Dropped fk_combine_worker_center';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'fk_combine_worker_election' 
               AND table_name = 'combine_worker_log') THEN
        ALTER TABLE combine_worker_log DROP CONSTRAINT fk_combine_worker_election;
        RAISE NOTICE 'Dropped fk_combine_worker_election';
    END IF;
END $$;

-- ============================================
-- 3. Add constraints with CASCADE
-- ============================================

-- Tally Worker Log constraints
ALTER TABLE tally_worker_log
    ADD CONSTRAINT fk_tally_worker_election 
    FOREIGN KEY (election_id) 
    REFERENCES elections(election_id) 
    ON DELETE CASCADE;

ALTER TABLE tally_worker_log
    ADD CONSTRAINT fk_tally_worker_center 
    FOREIGN KEY (election_center_id) 
    REFERENCES election_center(election_center_id) 
    ON DELETE CASCADE;

-- Decryption Worker Log constraints
ALTER TABLE decryption_worker_log
    ADD CONSTRAINT fk_decryption_worker_election 
    FOREIGN KEY (election_id) 
    REFERENCES elections(election_id) 
    ON DELETE CASCADE;

ALTER TABLE decryption_worker_log
    ADD CONSTRAINT fk_decryption_worker_center 
    FOREIGN KEY (election_center_id) 
    REFERENCES election_center(election_center_id) 
    ON DELETE CASCADE;

ALTER TABLE decryption_worker_log
    ADD CONSTRAINT fk_decryption_worker_guardian 
    FOREIGN KEY (guardian_id) 
    REFERENCES guardians(guardian_id) 
    ON DELETE CASCADE;

ALTER TABLE decryption_worker_log
    ADD CONSTRAINT fk_decryption_worker_decrypting 
    FOREIGN KEY (decrypting_guardian_id) 
    REFERENCES guardians(guardian_id) 
    ON DELETE CASCADE;

-- Combine Worker Log constraints
ALTER TABLE combine_worker_log
    ADD CONSTRAINT fk_combine_worker_election 
    FOREIGN KEY (election_id) 
    REFERENCES elections(election_id) 
    ON DELETE CASCADE;

ALTER TABLE combine_worker_log
    ADD CONSTRAINT fk_combine_worker_center 
    FOREIGN KEY (election_center_id) 
    REFERENCES election_center(election_center_id) 
    ON DELETE CASCADE;

-- ============================================
-- 4. Verify CASCADE is now enabled
-- ============================================
SELECT
    tc.table_name,
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS references_table,
    rc.delete_rule,
    CASE 
        WHEN rc.delete_rule = 'CASCADE' THEN '✅ CASCADE'
        ELSE '❌ NOT CASCADE'
    END as cascade_status
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
LEFT JOIN information_schema.referential_constraints AS rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.table_name IN ('tally_worker_log', 'decryption_worker_log', 'combine_worker_log')
    AND tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name, tc.constraint_name;

-- ============================================
-- 5. Test CASCADE behavior (optional - uncomment to test)
-- ============================================
/*
-- Create test data
INSERT INTO elections (election_title, election_description, number_of_guardians, election_quorum, 
                       no_of_candidates, status, starting_time, ending_time)
VALUES ('Test Election', 'Testing CASCADE', 2, 1, 2, 'draft', 
        NOW() + INTERVAL '1 day', NOW() + INTERVAL '2 days')
RETURNING election_id;

-- Note the election_id from above, then insert election_center
INSERT INTO election_center (election_id) 
VALUES (999) -- Replace 999 with the actual election_id
RETURNING election_center_id;

-- Note the election_center_id, then insert worker logs
INSERT INTO tally_worker_log (election_id, election_center_id, chunk_number, start_time)
VALUES (999, 999, 1, NOW()); -- Replace with actual IDs

-- Now delete election_center and check if worker log was deleted
DELETE FROM election_center WHERE election_center_id = 999; -- Replace with actual ID

-- Check if worker log was cascade deleted (should return 0 rows)
SELECT COUNT(*) FROM tally_worker_log WHERE election_center_id = 999;
*/

-- Success message
DO $$ 
BEGIN
    RAISE NOTICE '✅ Foreign key constraints updated successfully!';
    RAISE NOTICE '📋 All worker logs will now CASCADE delete when election_center is deleted';
    RAISE NOTICE '⚠️  This applies to: tally_worker_log, decryption_worker_log, combine_worker_log';
END $$;
