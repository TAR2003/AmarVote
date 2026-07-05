-- Add winner_no column: how many top candidates win this election.
-- For existing rows, default to max_choices (typically 1).

ALTER TABLE elections ADD COLUMN IF NOT EXISTS winner_no INTEGER;

UPDATE elections
SET winner_no = COALESCE(max_choices, 1)
WHERE winner_no IS NULL;
