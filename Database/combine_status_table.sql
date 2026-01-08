-- Table for tracking combine partial decryption progress
CREATE TABLE IF NOT EXISTS combine_status (
    combine_status_id SERIAL PRIMARY KEY,

    election_id BIGINT NOT NULL,

    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    -- 'pending', 'in_progress', 'completed', 'failed'

    total_chunks INT NOT NULL DEFAULT 0,
    processed_chunks INT NOT NULL DEFAULT 0,

    created_by VARCHAR(255) NOT NULL,
    -- Email of user who initiated combine

    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,

    CONSTRAINT unique_election_combine
        UNIQUE (election_id),

    CONSTRAINT fk_combine_election
        FOREIGN KEY (election_id)
        REFERENCES elections(election_id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_combine_election_status
    ON combine_status (election_id, status);
