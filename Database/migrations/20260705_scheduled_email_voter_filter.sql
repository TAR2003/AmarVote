-- Add voter_filter for scheduled emails to voters (both / voted / not_voted).
ALTER TABLE scheduled_election_emails ADD COLUMN IF NOT EXISTS voter_filter TEXT;

UPDATE scheduled_election_emails
SET voter_filter = 'both'
WHERE voter_filter IS NULL;
