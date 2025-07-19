-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- User Table
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    user_email TEXT NOT NULL,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    user_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE,
    NID TEXT NOT NULL,
    profile_pic TEXT,
    CONSTRAINT unique_user_email UNIQUE (user_email)
);

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
    encrypted_tally TEXT,
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

-- Allowed Voters Table
CREATE TABLE IF NOT EXISTS allowed_voters (
    election_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    has_voted BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (election_id, user_id),
    CONSTRAINT fk_election FOREIGN KEY (election_id) REFERENCES elections(election_id) ON DELETE CASCADE,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Guardians Table
CREATE TABLE IF NOT EXISTS guardians (
    election_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    guardian_public_key TEXT NOT NULL,
    guardian_polynomial TEXT NOT NULL,
    sequence_order INTEGER NOT NULL CHECK (sequence_order > 0),
    decrypted_or_not BOOLEAN NOT NULL DEFAULT FALSE,
    partial_decrypted_tally TEXT,
    proof TEXT,
    guardian_decryption_key TEXT, -- Added guardian_decryption_key field
    tally_share TEXT, -- Added tally_share field
    ballot_share TEXT, -- Added ballot_share field
    key_backup TEXT, -- Added key_backup field
    credentails TEXT, -- Added credentials field
    PRIMARY KEY (election_id, user_id),
    CONSTRAINT unique_sequence_order UNIQUE (election_id, sequence_order),
    CONSTRAINT fk_election FOREIGN KEY (election_id) REFERENCES elections(election_id) ON DELETE CASCADE,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
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
    master_nonce TEXT,
    proof TEXT,
    ballot_style TEXT,
    ballot_nonces JSONB,
    contest_hashes JSONB,
    CONSTRAINT unique_tracking_code UNIQUE (tracking_code),
    CONSTRAINT fk_election FOREIGN KEY (election_id) REFERENCES elections(election_id) ON DELETE CASCADE,
    CONSTRAINT valid_ballot_status CHECK (status IN ('cast', 'spoiled', 'challenged'))
);



-- Submitted Ballots Table (for ElectionGuard tally results)
CREATE TABLE IF NOT EXISTS submitted_ballots (
    submitted_ballot_id SERIAL PRIMARY KEY,
    election_id INTEGER NOT NULL,
    cipher_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_election FOREIGN KEY (election_id) REFERENCES elections(election_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS compensated_decryptions (
    election_id INTEGER NOT NULL,
    compensating_guardian_sequence INTEGER NOT NULL,
    missing_guardian_sequence INTEGER NOT NULL,
    compensated_tally_share TEXT NOT NULL,
    compensated_ballot_share TEXT NOT NULL,
    PRIMARY KEY (election_id, compensating_guardian_sequence, missing_guardian_sequence),
    CONSTRAINT fk_election FOREIGN KEY (election_id) REFERENCES elections(election_id) ON DELETE CASCADE,
    CONSTRAINT fk_compensating_guardian FOREIGN KEY (election_id, compensating_guardian_sequence) REFERENCES guardians(election_id, sequence_order) ON DELETE CASCADE,
    CONSTRAINT fk_missing_guardian FOREIGN KEY (election_id, missing_guardian_sequence) REFERENCES guardians(election_id, sequence_order) ON DELETE CASCADE,
    CONSTRAINT check_different_guardians CHECK (compensating_guardian_sequence != missing_guardian_sequence)
);

-- Decryption Table
CREATE TABLE IF NOT EXISTS decryptions (
    decryption_id SERIAL PRIMARY KEY,
    election_id INTEGER NOT NULL,
    guardian_id INTEGER NOT NULL,
    decryption_proof TEXT NOT NULL,
    decrypted_tally TEXT,
    lagrange_coefficient TEXT,
    date_performed TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_guardian FOREIGN KEY (election_id, guardian_id) 
        REFERENCES guardians(election_id, user_id)
);

-- Challenges Table
CREATE TABLE IF NOT EXISTS challenges (
    challenge_id SERIAL PRIMARY KEY,
    election_id INTEGER NOT NULL,
    guardian_id INTEGER NOT NULL,
    challenge_data TEXT NOT NULL,
    response_data TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- Changed from challenge_status enum
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_guardian FOREIGN KEY (election_id, guardian_id) 
        REFERENCES guardians(election_id, user_id),
    CONSTRAINT valid_challenge_status CHECK (status IN ('pending', 'resolved', 'failed'))
);

-- Blocked Connections Table
CREATE TABLE IF NOT EXISTS blocked_connections (
    blocked_connection_id SERIAL PRIMARY KEY,
    ip_address INET NOT NULL,
    device_id TEXT,
    reason TEXT NOT NULL,
    threat_level TEXT NOT NULL, -- Changed from threat_level enum
    is_banned BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    note TEXT,
    reported_by TEXT,
    CONSTRAINT unique_ip_device UNIQUE (ip_address, device_id),
    CONSTRAINT valid_threat_level CHECK (threat_level IN ('low', 'medium', 'high', 'critical'))
);

-- Audit Log Table
CREATE TABLE IF NOT EXISTS audit_log (
    log_id SERIAL PRIMARY KEY,
    election_id INTEGER,
    user_id INTEGER,
    action_type TEXT NOT NULL,
    action_details JSONB NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    CONSTRAINT fk_election FOREIGN KEY (election_id) REFERENCES elections(election_id) ON DELETE SET NULL,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Password Reset Tokens Table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    token_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL,
    token TEXT NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    expiry_time TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    used_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_user_email FOREIGN KEY (email) REFERENCES users(user_email) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS signup_verification (
    id SERIAL PRIMARY KEY,
    verification_code VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    expiry_date TIMESTAMP WITH TIME ZONE NOT NULL
);


-- Create indexes
CREATE INDEX IF NOT EXISTS idx_compensated_decryptions_pk 
ON compensated_decryptions(election_id, compensating_guardian_sequence, missing_guardian_sequence);
CREATE INDEX IF NOT EXISTS idx_ballots_election ON ballots(election_id);
CREATE INDEX IF NOT EXISTS idx_ballots_tracking ON ballots(tracking_code);
CREATE INDEX IF NOT EXISTS idx_voters_election ON allowed_voters(election_id);
CREATE INDEX IF NOT EXISTS idx_voters_user ON allowed_voters(user_id);
CREATE INDEX IF NOT EXISTS idx_guardians_election ON guardians(election_id);
CREATE INDEX IF NOT EXISTS idx_choices_election ON election_choices(election_id);
CREATE INDEX IF NOT EXISTS idx_blocked_ips ON blocked_connections(ip_address);
CREATE INDEX IF NOT EXISTS idx_audit_log_election ON audit_log(election_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_email ON password_reset_tokens(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_verification_code ON signup_verification(verification_code);
CREATE INDEX IF NOT EXISTS idx_submitted_ballots_election ON submitted_ballots(election_id);