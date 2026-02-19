-- SQL script to remove duplicate ElectionJob records
-- This keeps only the most recent job for each election_id + operation_type combination

-- Step 1: View duplicate jobs to see what will be deleted
SELECT 
    election_id, 
    operation_type, 
    COUNT(*) as duplicate_count,
    STRING_AGG(job_id::text, ', ' ORDER BY started_at DESC) as job_ids
FROM election_job
GROUP BY election_id, operation_type
HAVING COUNT(*) > 1
ORDER BY election_id, operation_type;

-- Step 2: Delete older duplicate jobs, keeping only the most recent one
-- Uncomment this after reviewing the results from Step 1
/*
DELETE FROM election_job
WHERE job_id IN (
    SELECT job_id
    FROM (
        SELECT 
            job_id,
            ROW_NUMBER() OVER (
                PARTITION BY election_id, operation_type 
                ORDER BY started_at DESC NULLS LAST
            ) as row_num
        FROM election_job
    ) ranked
    WHERE row_num > 1
);
*/

-- Step 3: Verify cleanup - should return no rows after cleanup
SELECT 
    election_id, 
    operation_type, 
    COUNT(*) as duplicate_count
FROM election_job
GROUP BY election_id, operation_type
HAVING COUNT(*) > 1;

-- Step 4: Optional - Add unique constraint to prevent future duplicates
-- Uncomment this after cleanup if you want to enforce uniqueness
/*
ALTER TABLE election_job 
ADD CONSTRAINT unique_election_operation 
UNIQUE (election_id, operation_type);
*/
