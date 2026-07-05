-- Vote receipts: minimal storage, no voter email or identity.
CREATE TABLE IF NOT EXISTS vote_receipts (
    receipt_id UUID PRIMARY KEY,
    election_id BIGINT NOT NULL,
    election_title TEXT NOT NULL,
    vote_hash TEXT NOT NULL,
    tracking_code TEXT NOT NULL,
    candidate_name TEXT,
    party_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_vote_receipt_election FOREIGN KEY (election_id)
        REFERENCES elections(election_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_vote_receipts_election_id ON vote_receipts (election_id);
CREATE INDEX IF NOT EXISTS idx_vote_receipts_tracking_code ON vote_receipts (tracking_code);
