-- Script to reset compensated decryptions for a specific election
-- This is useful when you need to regenerate compensated shares
-- Replace <election_id> with your actual election ID

-- Step 1: Find all election centers (chunks) for the election
-- SELECT election_center_id FROM election_center WHERE election_id = <election_id>;

-- Step 2: Delete compensated decryptions for specific election centers
-- DELETE FROM compensated_decryptions 
-- WHERE election_center_id IN (
--     SELECT election_center_id FROM election_center WHERE election_id = <election_id>
-- );

-- Example: For election_id = 1
DELETE FROM compensated_decryptions 
WHERE election_center_id IN (
    SELECT election_center_id FROM election_center WHERE election_id = 1
);

-- Verify deletion
SELECT COUNT(*) as remaining_compensated_shares
FROM compensated_decryptions cd
JOIN election_center ec ON cd.election_center_id = ec.election_center_id
WHERE ec.election_id = 1;

-- View what was deleted (run before deletion)
-- SELECT 
--     cd.compensated_decryption_id,
--     ec.election_center_id,
--     cd.compensating_guardian_id,
--     cd.missing_guardian_id
-- FROM compensated_decryptions cd
-- JOIN election_center ec ON cd.election_center_id = ec.election_center_id
-- WHERE ec.election_id = 1;
