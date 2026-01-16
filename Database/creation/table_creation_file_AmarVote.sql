-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";



-- Election Table
CREATE TABLE IF NOT EXISTS elections (
    election_id SERIAL PRIMARY KEY,
    election_title TEXT NOT NULL,
    election_description TEXT,
    number_of_guardians INTEGER NOT NULL CHECK (number_of_guardians > 0),
    election_quorum INTEGER NOT NULL CHECK (election_quorum > 0),
    no_of_candidates INTEGER NOT NULL CHECK (no_of_candidates > 0),
    joint_public_key TEXT,
    manifest_hash TEXT,
    status TEXT NOT NULL DEFAULT 'draft', -- Changed from election_status enum
    starting_time TIMESTAMP WITH TIME ZONE NOT NULL,
    ending_time TIMESTAMP WITH TIME ZONE NOT NULL,
    -- encrypted_tally TEXT, -- Moved to election_center table
    base_hash TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    profile_pic TEXT,
    admin_email TEXT, -- Added admin_email field
	privacy TEXT,
    eligibility TEXT,
    CONSTRAINT valid_election_times CHECK (ending_time > starting_time),
    CONSTRAINT valid_status CHECK (status IN ('draft', 'active', 'completed', 'decrypted')),
    CONSTRAINT valid_quorum CHECK (election_quorum <= number_of_guardians AND election_quorum > 0)
);

CREATE TABLE IF NOT EXISTS election_center (
    election_center_id SERIAL PRIMARY KEY,
    election_id INTEGER NOT NULL,
    encrypted_tally TEXT,
    election_result TEXT,
    CONSTRAINT fk_election FOREIGN KEY (election_id) 
        REFERENCES elections(election_id) ON DELETE CASCADE
); 

-- Allowed Voters Table
CREATE TABLE IF NOT EXISTS allowed_voters (
    election_id INTEGER NOT NULL,
    user_email TEXT NOT NULL,
    has_voted BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (election_id, user_email),
    CONSTRAINT fk_election FOREIGN KEY (election_id) REFERENCES elections(election_id) ON DELETE CASCADE
);

-- Guardians Table
CREATE TABLE IF NOT EXISTS guardians (
    guardian_id SERIAL PRIMARY KEY,
    election_id INTEGER NOT NULL,
    user_email TEXT NOT NULL,
    key_backup TEXT,
    guardian_public_key TEXT NOT NULL,
    sequence_order INTEGER NOT NULL CHECK (sequence_order > 0),
    decrypted_or_not BOOLEAN NOT NULL DEFAULT FALSE,
    credentials TEXT, -- Added credentials field
    CONSTRAINT unique_sequence_order UNIQUE (election_id, sequence_order),
    CONSTRAINT fk_election FOREIGN KEY (election_id) REFERENCES elections(election_id) ON DELETE CASCADE
);

-- Election Choices Table
CREATE TABLE IF NOT EXISTS election_choices (
    choice_id SERIAL PRIMARY KEY,
    election_id INTEGER NOT NULL,
    option_title TEXT NOT NULL,
    option_description TEXT,
    party_name TEXT,
    candidate_pic TEXT,
    party_pic TEXT,
    total_votes INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT unique_election_option UNIQUE (election_id, option_title),
    CONSTRAINT fk_election FOREIGN KEY (election_id) REFERENCES elections(election_id) ON DELETE CASCADE
);

-- Ballot Table
CREATE TABLE IF NOT EXISTS ballots (
    ballot_id SERIAL PRIMARY KEY,
    election_id INTEGER NOT NULL,
    submission_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL, -- Changed from ballot_status enum
    cipher_text TEXT NOT NULL,
    hash_code TEXT NOT NULL,
    tracking_code TEXT NOT NULL,
    CONSTRAINT unique_tracking_code UNIQUE (election_id,tracking_code),
    CONSTRAINT fk_election FOREIGN KEY (election_id) REFERENCES elections(election_id) ON DELETE CASCADE,
    CONSTRAINT valid_ballot_status CHECK (status IN ('cast', 'spoiled', 'challenged'))
);



-- Submitted Ballots Table (for ElectionGuard tally results)
CREATE TABLE IF NOT EXISTS submitted_ballots (
    submitted_ballot_id SERIAL PRIMARY KEY,
    election_center_id INTEGER NOT NULL,
    cipher_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_election_center FOREIGN KEY (election_center_id) REFERENCES election_center(election_center_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS compensated_decryptions (
    compensated_decryption_id SERIAL PRIMARY KEY,
    election_center_id INTEGER NOT NULL,
    compensating_guardian_id INTEGER NOT NULL,
    missing_guardian_id INTEGER NOT NULL,
    compensated_tally_share TEXT NOT NULL,
    compensated_ballot_share TEXT NOT NULL,
    CONSTRAINT fk_election_center FOREIGN KEY (election_center_id) REFERENCES election_center(election_center_id) ON DELETE CASCADE,
    CONSTRAINT fk_compensating_guardian FOREIGN KEY (compensating_guardian_id) REFERENCES guardians(guardian_id) ON DELETE CASCADE,
    CONSTRAINT fk_missing_guardian FOREIGN KEY (missing_guardian_id) REFERENCES guardians(guardian_id) ON DELETE CASCADE
);

-- Decryption Table
CREATE TABLE IF NOT EXISTS decryptions (
    decryption_id SERIAL PRIMARY KEY,
    election_center_id INTEGER NOT NULL,
    guardian_id INTEGER NOT NULL,
    partial_decrypted_tally TEXT,
    guardian_decryption_key TEXT,
    tally_share TEXT,
    date_performed TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_guardian FOREIGN KEY (guardian_id) 
        REFERENCES guardians(guardian_id) ON DELETE CASCADE,
    CONSTRAINT fk_election_center FOREIGN KEY (election_center_id) REFERENCES election_center(election_center_id) ON DELETE CASCADE
);


-- OTP Verification Table
CREATE TABLE IF NOT EXISTS otp_verifications (
    otp_id SERIAL PRIMARY KEY,
    user_email TEXT NOT NULL,
    otp_code VARCHAR(6) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_used BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS decryption_status (
    decryption_status_id SERIAL PRIMARY KEY,

    election_id BIGINT NOT NULL,
    guardian_id BIGINT NOT NULL,

    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    -- Status values: 'pending', 'in_progress', 'completed', 'failed'

    -- Progress tracking
    total_chunks INT NOT NULL DEFAULT 0,
    processed_chunks INT NOT NULL DEFAULT 0,

    -- Current processing phase
    current_phase VARCHAR(100),
    -- Phase values: 'partial_decryption', 'compensated_shares_generation'

    -- Current chunk being processed
    current_chunk_number INT DEFAULT 0,

    -- Compensated guardian tracking
    compensating_for_guardian_id BIGINT,
    compensating_for_guardian_name VARCHAR(255),
    total_compensated_guardians INT DEFAULT 0,
    processed_compensated_guardians INT DEFAULT 0,

    -- Metadata
    guardian_email VARCHAR(255),
    guardian_name VARCHAR(255),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_election_guardian
        UNIQUE (election_id, guardian_id),

    CONSTRAINT fk_decryption_election
        FOREIGN KEY (election_id)
        REFERENCES elections(election_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_decryption_guardian
        FOREIGN KEY (guardian_id)
        REFERENCES guardians(guardian_id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tally_creation_status (
    tally_status_id SERIAL PRIMARY KEY,

    election_id BIGINT NOT NULL,

    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    -- 'pending', 'in_progress', 'completed', 'failed'

    total_chunks INT NOT NULL DEFAULT 0,
    processed_chunks INT NOT NULL DEFAULT 0,

    created_by VARCHAR(255) NOT NULL,
    -- Email of user who initiated tally creation

    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,

    CONSTRAINT unique_election_tally
        UNIQUE (election_id),

    CONSTRAINT fk_tally_election
        FOREIGN KEY (election_id)
        REFERENCES elections(election_id)
        ON DELETE CASCADE
);

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



CREATE INDEX IF NOT EXISTS idx_combine_election_status
    ON combine_status (election_id, status);



CREATE INDEX idx_decryption_election_status
    ON decryption_status (election_id, status);

CREATE INDEX idx_decryption_guardian_status
    ON decryption_status (guardian_id, status);

CREATE INDEX idx_tally_election_status
    ON tally_creation_status (election_id, status);




-- OTP Verification table indexes
CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_verifications(user_email);
CREATE INDEX IF NOT EXISTS idx_otp_email_code ON otp_verifications(user_email, otp_code);
CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_verifications(expires_at);


-- ============================================
-- AMARVOTE PERFORMANCE INDEXES
-- Run after creating all tables
-- ============================================

-- Elections table indexes
CREATE INDEX IF NOT EXISTS idx_elections_status ON elections(status);
CREATE INDEX IF NOT EXISTS idx_elections_admin ON elections(admin_email);
CREATE INDEX IF NOT EXISTS idx_elections_times ON elections(starting_time, ending_time);
CREATE INDEX IF NOT EXISTS idx_elections_created ON elections(created_at DESC);

-- Election Center table indexes
CREATE INDEX IF NOT EXISTS idx_election_center_election ON election_center(election_id);

-- Allowed Voters table indexes
CREATE INDEX IF NOT EXISTS idx_allowed_voters_email ON allowed_voters(user_email);
CREATE INDEX IF NOT EXISTS idx_allowed_voters_voted ON allowed_voters(election_id, has_voted);

-- Guardians table indexes
CREATE INDEX IF NOT EXISTS idx_guardians_election ON guardians(election_id);
CREATE INDEX IF NOT EXISTS idx_guardians_email ON guardians(user_email);
CREATE INDEX IF NOT EXISTS idx_guardians_sequence ON guardians(election_id, sequence_order);
CREATE INDEX IF NOT EXISTS idx_guardians_decryption_status ON guardians(election_id, decrypted_or_not);

-- Election Choices table indexes
CREATE INDEX IF NOT EXISTS idx_choices_election ON election_choices(election_id);
CREATE INDEX IF NOT EXISTS idx_choices_title ON election_choices(election_id, option_title);

-- Ballots table indexes (CRITICAL for performance)
CREATE INDEX IF NOT EXISTS idx_ballots_election ON ballots(election_id);
CREATE INDEX IF NOT EXISTS idx_ballots_election_status ON ballots(election_id, status);
CREATE INDEX IF NOT EXISTS idx_ballots_tracking ON ballots(tracking_code);
CREATE INDEX IF NOT EXISTS idx_ballots_submission_time ON ballots(election_id, submission_time DESC);
CREATE INDEX IF NOT EXISTS idx_ballots_hash ON ballots(hash_code);
CREATE INDEX IF NOT EXISTS idx_ballots_status ON ballots(status);

-- Submitted Ballots table indexes
CREATE INDEX IF NOT EXISTS idx_submitted_ballots_center ON submitted_ballots(election_center_id);
CREATE INDEX IF NOT EXISTS idx_submitted_ballots_created ON submitted_ballots(election_center_id, created_at DESC);

-- Compensated Decryptions table indexes
CREATE INDEX IF NOT EXISTS idx_compensated_election_center ON compensated_decryptions(election_center_id);
CREATE INDEX IF NOT EXISTS idx_compensated_comp_guardian ON compensated_decryptions(compensating_guardian_id);
CREATE INDEX IF NOT EXISTS idx_compensated_miss_guardian ON compensated_decryptions(missing_guardian_id);
CREATE INDEX IF NOT EXISTS idx_compensated_guardians ON compensated_decryptions(election_center_id, compensating_guardian_id, missing_guardian_id);

-- Decryptions table indexes
CREATE INDEX IF NOT EXISTS idx_decryptions_center ON decryptions(election_center_id);
CREATE INDEX IF NOT EXISTS idx_decryptions_guardian ON decryptions(guardian_id);
CREATE INDEX IF NOT EXISTS idx_decryptions_center_guardian ON decryptions(election_center_id, guardian_id);
CREATE INDEX IF NOT EXISTS idx_decryptions_date ON decryptions(election_center_id, date_performed DESC);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ballots_election_time_status ON ballots(election_id, submission_time DESC, status);
CREATE INDEX IF NOT EXISTS idx_guardians_election_decrypted ON guardians(election_id, decrypted_or_not, sequence_order);

-- API Logs table for tracking all API requests
CREATE TABLE IF NOT EXISTS api_logs (
    log_id BIGSERIAL PRIMARY KEY,
    request_method VARCHAR(10) NOT NULL,
    request_path TEXT NOT NULL,
    request_ip VARCHAR(50),
    user_agent TEXT,
    bearer_token TEXT,
    extracted_email VARCHAR(255),
    request_body TEXT,
    response_status INTEGER,
    request_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    response_time BIGINT,
    error_message TEXT
);

-- API Logs indexes
CREATE INDEX IF NOT EXISTS idx_api_logs_email ON api_logs(extracted_email);
CREATE INDEX IF NOT EXISTS idx_api_logs_time ON api_logs(request_time DESC);
CREATE INDEX IF NOT EXISTS idx_api_logs_path ON api_logs(request_path);
CREATE INDEX IF NOT EXISTS idx_api_logs_ip ON api_logs(request_ip);
CREATE INDEX IF NOT EXISTS idx_api_logs_status ON api_logs(response_status);


