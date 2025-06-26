-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- User Table stores all user information
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY, -- unique id to identify every user
    user_email VARCHAR(255) NOT NULL UNIQUE, -- unique email account for every user
    is_verified BOOLEAN NOT NULL DEFAULT FALSE, -- is the email verified
    user_name VARCHAR(100) NOT NULL, -- name of the user
    password_hash TEXT NOT NULL, -- hashed version of the password
    salt TEXT NOT NULL, -- necessary element for hashing, so that hash of two same password remain different
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- account creation time
    last_login TIMESTAMP WITH TIME ZONE, -- login for the latest session
    NID TEXT NOT NULL,
    profile_pic TEXT
);

-- Contains all the possible election status
CREATE TYPE election_status AS ENUM ('draft', 'active', 'completed', 'decrypted');
-- Election Table to contain all the information about an election
CREATE TABLE elections (
    election_id SERIAL PRIMARY KEY, -- primary key
    election_title VARCHAR(255) NOT NULL, -- The name of the election
    election_description TEXT, -- description for that particular election
    number_of_guardians INTEGER NOT NULL CHECK (number_of_guardians > 0), -- guardian no for the election
    election_quorum INTEGER NOT NULL CHECK (election_quorum > 0), -- quorum number
    no_of_candidates INTEGER NOT NULL CHECK (no_of_candidates > 0), -- candidate number
    joint_public_key TEXT, -- the public key which will be used to encrypt every ballot paper
    manifest_hash VARCHAR(64), -- manifest hash id for that election based on election details
    status election_status NOT NULL DEFAULT 'draft', -- current status for the election
    starting_time TIMESTAMP WITH TIME ZONE NOT NULL, -- starting time for the election
    ending_time TIMESTAMP WITH TIME ZONE NOT NULL, -- ending time for the election
    encrypted_tally TEXT, -- the completed tally for all the encrypted ballot papers(encrypted result)
    base_hash TEXT, --hash value derived from election context for verifying encryptino chain
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- creation of that particualr election
    profile_pic TEXT,
    CONSTRAINT valid_election_times CHECK (ending_time > starting_time) -- election starting time cannot be later than its ending time
);

-- Allowed Voters Table for all the voters of the election
CREATE TABLE allowed_voters (
    election_id INTEGER NOT NULL REFERENCES elections(election_id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    has_voted BOOLEAN NOT NULL DEFAULT FALSE, -- has that particaulr voter has voted or not
    PRIMARY KEY (election_id, user_id)
);

-- Guardians Table 
CREATE TABLE guardians (
    election_id INTEGER NOT NULL REFERENCES elections(election_id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE, -- user i for that particular guardian
    guardian_public_key TEXT NOT NULL, -- public key for that guardian for that election
    sequence_order INTEGER NOT NULL CHECK (sequence_order > 0), -- ordering of the guardians
    decrypted_or_not BOOLEAN NOT NULL DEFAULT FALSE, -- has the guardian already decrypted his partial tally
    partial_decrypted_tally TEXT, -- the partial decrypted tally for the guardian using his private key
    proof TEXT, -- proof that guardian's decryption share is valid
    PRIMARY KEY (election_id, user_id),
    UNIQUE (election_id, sequence_order)
);

-- Election Choices Table (All voting Options)
CREATE TABLE election_choices (
    choice_id SERIAL PRIMARY KEY, -- id for choice
    election_id INTEGER NOT NULL REFERENCES elections(election_id) ON DELETE CASCADE,
    option_title VARCHAR(255) NOT NULL, -- titel of the choice
    option_description TEXT, -- description for the option
    party_name VARCHAR(100), -- name of the party for that option
    candidate_pic TEXT,
    party_pic TEXT,
    total_votes INTEGER NOT NULL DEFAULT 0, -- total received votes for that spcific option (if tally is completely decrypted)
    UNIQUE (election_id, option_title) 
);

-- Ballot status
CREATE TYPE ballot_status AS ENUM ('cast', 'spoiled', 'challenged');
-- Ballot Table containing all the information for a stored ballot
CREATE TABLE ballots (
    ballot_id SERIAL PRIMARY KEY, -- primary key
    election_id INTEGER NOT NULL REFERENCES elections(election_id) ON DELETE CASCADE,
    submission_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- submission time for the ballot
    status ballot_status NOT NULL, -- current status of the ballot
    cipher_text TEXT NOT NULL, -- balloted ciphertext, the encrpyted vertion of the ballot
    hash_code TEXT NOT NULL, -- proof that ballot has not been altered
    tracking_code TEXT NOT NULL UNIQUE, -- user can track the encrypted ballot using that tracking code
    master_nonce TEXT, -- nonce value used to encrypt ballots
    proof TEXT, -- mathematical proof to examine validity
    ballot_style VARCHAR(100), -- what style is the ballot
    ballot_nonces JSONB, -- ballot nonce is saved JSON files in binary format
    contest_hashes JSONB -- contest hashes is saved JSON files in binary format
);

-- Decryption Table
CREATE TABLE decryptions (
    decryption_id SERIAL PRIMARY KEY,
    election_id INTEGER NOT NULL REFERENCES elections(election_id) ON DELETE CASCADE,
    guardian_id INTEGER NOT NULL, -- the guardian responsible for the decryption
    decryption_proof TEXT NOT NULL, -- used to validate partial decriptions
    decrypted_tally TEXT, -- the partial decrypted tally
    lagrange_coefficient TEXT, -- coefficient of lagrange for security purposes
    date_performed TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- date for the decryption process
    FOREIGN KEY (election_id, guardian_id) REFERENCES guardians(election_id, user_id)
);

-- status for any challenge by 3rd party authenticators
CREATE TYPE challenge_status AS ENUM ('pending', 'resolved', 'failed');
-- Challenges Table
CREATE TABLE challenges (
    challenge_id SERIAL PRIMARY KEY,
    election_id INTEGER NOT NULL REFERENCES elections(election_id) ON DELETE CASCADE,
    guardian_id INTEGER NOT NULL, -- the guardian whihc is challenged
    challenge_data TEXT NOT NULL, -- encrypted information about he challenge
    response_data TEXT, -- response for that particular challenge
    status challenge_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- creation time for the challenge
    FOREIGN KEY (election_id, guardian_id) REFERENCES guardians(election_id, user_id)
);

-- 
CREATE TYPE threat_level AS ENUM ('low', 'medium', 'high', 'critical');
-- Blocked Connections Table
CREATE TABLE blocked_connections (
    blocked_connection_id SERIAL PRIMARY KEY,
    ip_address INET NOT NULL, -- ip address of the suspicious connection
    device_id TEXT, -- the device id for that connection
    reason TEXT NOT NULL, -- the reason
    threat_level threat_level NOT NULL, -- current threat level 
    is_banned BOOLEAN NOT NULL DEFAULT TRUE, -- if it is permenantly banned
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- creation
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- last update time
    expires_at TIMESTAMP WITH TIME ZONE, -- if it expires
    note TEXT, -- note about the connection
    reported_by TEXT, -- whi reported it
    UNIQUE (ip_address, device_id)
);

-- Audit Log Table
CREATE TABLE audit_log (
    log_id SERIAL PRIMARY KEY,
    election_id INTEGER REFERENCES elections(election_id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    action_type VARCHAR(100) NOT NULL, -- the human readable form of that action (login, logout)
    action_details JSONB NOT NULL, -- the details of the particular event
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- time for that event
    ip_address INET -- the ip address for the event 
);

CREATE TABLE password_reset_tokens (
    token_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- unique identifier for each token
    email VARCHAR(255) NOT NULL REFERENCES users(user_email) ON DELETE CASCADE,
    token TEXT NOT NULL, -- the JWT or random token string
    used BOOLEAN NOT NULL DEFAULT FALSE, -- mark token as used after one-time usage
    expiry_time TIMESTAMP WITH TIME ZONE NOT NULL, -- when this token expires
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- when it was created
    used_at TIMESTAMP WITH TIME ZONE -- when it was actually used
);


-- Create indexes for better performance
CREATE INDEX idx_ballots_election ON ballots(election_id);
CREATE INDEX idx_ballots_tracking ON ballots(tracking_code);
CREATE INDEX idx_voters_election ON allowed_voters(election_id);
CREATE INDEX idx_voters_user ON allowed_voters(user_id);
CREATE INDEX idx_guardians_election ON guardians(election_id);
CREATE INDEX idx_choices_election ON election_choices(election_id);
CREATE INDEX idx_blocked_ips ON blocked_connections(ip_address);
CREATE INDEX idx_audit_log_election ON audit_log(election_id);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_password_reset_email ON password_reset_tokens(email);
CREATE INDEX idx_password_reset_token ON password_reset_tokens(token);