-- ============================================
-- AMARVOTE DATABASE DELETION SCRIPT
-- WARNING: This will permanently delete ALL data!
-- ============================================
-- Use this script to completely remove all AmarVote
-- database objects created by the creation script.
--
-- CAUTION: This action is irreversible!
-- ============================================

-- Step 1: Drop all indexes (optional - CASCADE handles this)
DROP INDEX IF EXISTS idx_elections_status CASCADE;
DROP INDEX IF EXISTS idx_elections_admin CASCADE;
DROP INDEX IF EXISTS idx_elections_times CASCADE;
DROP INDEX IF EXISTS idx_elections_created CASCADE;
DROP INDEX IF EXISTS idx_election_center_election CASCADE;
DROP INDEX IF EXISTS idx_allowed_voters_email CASCADE;
DROP INDEX IF EXISTS idx_allowed_voters_voted CASCADE;
DROP INDEX IF EXISTS idx_guardians_election CASCADE;
DROP INDEX IF EXISTS idx_guardians_email CASCADE;
DROP INDEX IF EXISTS idx_guardians_sequence CASCADE;
DROP INDEX IF EXISTS idx_guardians_decryption_status CASCADE;
DROP INDEX IF EXISTS idx_choices_election CASCADE;
DROP INDEX IF EXISTS idx_choices_title CASCADE;
DROP INDEX IF EXISTS idx_ballots_election CASCADE;
DROP INDEX IF EXISTS idx_ballots_election_status CASCADE;
DROP INDEX IF EXISTS idx_ballots_tracking CASCADE;
DROP INDEX IF EXISTS idx_ballots_submission_time CASCADE;
DROP INDEX IF EXISTS idx_ballots_hash CASCADE;
DROP INDEX IF EXISTS idx_ballots_status CASCADE;
DROP INDEX IF EXISTS idx_submitted_ballots_center CASCADE;
DROP INDEX IF EXISTS idx_submitted_ballots_created CASCADE;
DROP INDEX IF EXISTS idx_compensated_election_center CASCADE;
DROP INDEX IF EXISTS idx_compensated_comp_guardian CASCADE;
DROP INDEX IF EXISTS idx_compensated_miss_guardian CASCADE;
DROP INDEX IF EXISTS idx_compensated_guardians CASCADE;
DROP INDEX IF EXISTS idx_decryptions_center CASCADE;
DROP INDEX IF EXISTS idx_decryptions_guardian CASCADE;
DROP INDEX IF EXISTS idx_decryptions_center_guardian CASCADE;
DROP INDEX IF EXISTS idx_decryptions_date CASCADE;
DROP INDEX IF EXISTS idx_ballots_election_time_status CASCADE;
DROP INDEX IF EXISTS idx_guardians_election_decrypted CASCADE;

DROP INDEX IF EXISTS idx_otp_email CASCADE;
DROP INDEX IF EXISTS idx_otp_email_code CASCADE;
DROP INDEX IF EXISTS idx_otp_expires CASCADE;

DROP INDEX IF EXISTS idx_api_logs_email CASCADE;
DROP INDEX IF EXISTS idx_api_logs_time CASCADE;
DROP INDEX IF EXISTS idx_api_logs_path CASCADE;
DROP INDEX IF EXISTS idx_api_logs_ip CASCADE;
DROP INDEX IF EXISTS idx_api_logs_status CASCADE;


-- Step 2: Drop all tables in reverse dependency order
-- (Child tables first, parent tables last)

DROP TABLE IF EXISTS decryptions CASCADE;
DROP TABLE IF EXISTS compensated_decryptions CASCADE;
DROP TABLE IF EXISTS submitted_ballots CASCADE;
DROP TABLE IF EXISTS ballots CASCADE;
DROP TABLE IF EXISTS election_choices CASCADE;
DROP TABLE IF EXISTS guardians CASCADE;
DROP TABLE IF EXISTS allowed_voters CASCADE;
DROP TABLE IF EXISTS election_center CASCADE;
DROP TABLE IF EXISTS elections CASCADE;
DROP TABLE IF EXISTS otp_verifications CASCADE;
DROP TABLE IF EXISTS decryption_status CASCADE;
DROP TABLE IF EXISTS tally_creation_status CASCADE;
DROP TABLE IF EXISTS combine_status CASCADE;
DROP TABLE IF EXISTS api_logs CASCADE;

-- Step 3: Drop extensions (optional - comment out if shared with other apps)
DROP EXTENSION IF EXISTS "pgcrypto" CASCADE;
DROP EXTENSION IF EXISTS "uuid-ossp" CASCADE;

-- Step 4: Verify cleanup (optional - for confirmation)
-- Run this to check if any tables remain:
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE '%election%' OR tablename LIKE '%ballot%' OR tablename LIKE '%guardian%';

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✓ All AmarVote database objects have been deleted successfully.';
END $$;
