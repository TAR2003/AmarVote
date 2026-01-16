-- Migration Script: Add ElectionJob Table for Tier 3 Message Queue
-- Run this script to add the job tracking table

-- Create election_jobs table
CREATE TABLE IF NOT EXISTS election_jobs (
    job_id UUID PRIMARY KEY,
    election_id BIGINT NOT NULL,
    operation_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    total_chunks INTEGER NOT NULL DEFAULT 0,
    processed_chunks INTEGER NOT NULL DEFAULT 0,
    failed_chunks INTEGER NOT NULL DEFAULT 0,
    created_by VARCHAR(255),
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    error_message TEXT,
    metadata TEXT,
    
    -- Indexes for performance
    CONSTRAINT fk_election FOREIGN KEY (election_id) 
        REFERENCES election(election_id) ON DELETE CASCADE
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_election_jobs_election_id 
    ON election_jobs(election_id);

CREATE INDEX IF NOT EXISTS idx_election_jobs_status 
    ON election_jobs(status);

CREATE INDEX IF NOT EXISTS idx_election_jobs_operation_type 
    ON election_jobs(operation_type);

CREATE INDEX IF NOT EXISTS idx_election_jobs_started_at 
    ON election_jobs(started_at DESC);

-- Composite index for common query pattern
CREATE INDEX IF NOT EXISTS idx_election_jobs_election_operation 
    ON election_jobs(election_id, operation_type);

-- Comments for documentation
COMMENT ON TABLE election_jobs IS 
    'Tracks progress of background jobs processed via RabbitMQ message queue';

COMMENT ON COLUMN election_jobs.job_id IS 
    'Unique job identifier (UUID)';

COMMENT ON COLUMN election_jobs.operation_type IS 
    'Type of operation: TALLY, DECRYPTION, COMBINE, COMPENSATED_DECRYPTION';

COMMENT ON COLUMN election_jobs.status IS 
    'Job status: QUEUED, IN_PROGRESS, COMPLETED, FAILED';

COMMENT ON COLUMN election_jobs.total_chunks IS 
    'Total number of chunks to process';

COMMENT ON COLUMN election_jobs.processed_chunks IS 
    'Number of chunks successfully processed';

COMMENT ON COLUMN election_jobs.failed_chunks IS 
    'Number of chunks that failed processing';

COMMENT ON COLUMN election_jobs.metadata IS 
    'JSON metadata containing job parameters (election settings, guardian credentials, etc.)';

-- Verify table was created
SELECT 
    table_name, 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_name = 'election_jobs'
ORDER BY ordinal_position;
