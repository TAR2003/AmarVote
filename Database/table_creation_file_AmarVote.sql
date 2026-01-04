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

CREATE INDEX IF NOT EXISTS election_center
(
    election_center_id SERIAL PRIMARY KEY,
    election_id INTEGER NOT NULL,
    encrypted_tally TEXT
)

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
    guardian_public_key TEXT NOT NULL,
    guardian_polynomial TEXT NOT NULL,
    sequence_order INTEGER NOT NULL CHECK (sequence_order > 0),
    decrypted_or_not BOOLEAN NOT NULL DEFAULT FALSE,
    -- partial_decrypted_tally TEXT,
    -- proof TEXT, -- Added proof field
    -- guardian_decryption_key TEXT, -- Added guardian_decryption_key field
    -- tally_share TEXT, -- Added tally_share field
    -- ballot_share TEXT, -- Added ballot_share field
    key_backup TEXT, -- Added key_backup field
    credentails TEXT, -- Added credentials field
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
    tracking_code TEXT NOT NULL
    CONSTRAINT unique_tracking_code UNIQUE (tracking_code),
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
    compensating_guardian_sequence INTEGER NOT NULL,
    missing_guardian_sequence INTEGER NOT NULL,
    compensated_tally_share TEXT NOT NULL,
    compensated_ballot_share TEXT NOT NULL,
    CONSTRAINT fk_election_center FOREIGN KEY (election_center_id) REFERENCES election_center(election_center_id) ON DELETE CASCADE,
    CONSTRAINT fk_compensating_guardian FOREIGN KEY (election_center_id, compensating_guardian_sequence) REFERENCES guardians(election_center_id, sequence_order) ON DELETE CASCADE,
    CONSTRAINT fk_missing_guardian FOREIGN KEY (election_center_id, missing_guardian_sequence) REFERENCES guardians(election_center_id, sequence_order) ON DELETE CASCADE,
    CONSTRAINT check_different_guardians CHECK (compensating_guardian_sequence != missing_guardian_sequence)
);

-- Decryption Table
CREATE TABLE IF NOT EXISTS decryptions (
    decryption_id SERIAL PRIMARY KEY,
    election_center_id INTEGER NOT NULL,
    guardian_id INTEGER NOT NULL,
    partial_decrypted_tally TEXT,
    guardian_decryption_key TEXT,
    tally_share TEXT,
    key_backup TEXT,
    date_performed TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_guardian FOREIGN KEY (guardian_id) 
        REFERENCES guardians(guardian_id) ON DELETE CASCADE,
    CONSTRAINT fk_election_center FOREIGN KEY (election_center_id) REFERENCES election_center(election_center_id) ON DELETE CASCADE
);


