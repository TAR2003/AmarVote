-- Fix duplicate submitted ballots issue
-- Step 1: Remove any existing duplicates (keeping the earliest created)
DELETE FROM submitted_ballots s1 
USING submitted_ballots s2 
WHERE s1.submitted_ballot_id > s2.submitted_ballot_id 
AND s1.election_id = s2.election_id 
AND s1.cipher_text = s2.cipher_text;

-- Step 2: Add unique constraint to prevent future duplicates
ALTER TABLE submitted_ballots 
ADD CONSTRAINT unique_ballot_per_election 
UNIQUE (election_id, cipher_text);

-- Step 3: Add index for better performance on duplicate checks
CREATE INDEX IF NOT EXISTS idx_submitted_ballots_unique 
ON submitted_ballots(election_id, cipher_text);
