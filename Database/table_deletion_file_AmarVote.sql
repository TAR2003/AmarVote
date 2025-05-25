-- Drop tables in reverse order of creation to avoid foreign key constraints errors

-- First drop the audit log and config tables
DROP TABLE IF EXISTS audit_log;

-- Then drop the blocked connections table
DROP TABLE IF EXISTS blocked_connections;

-- Drop challenges table
DROP TABLE IF EXISTS challenges;

-- Drop decryptions table
DROP TABLE IF EXISTS decryptions;

-- Drop ballots table
DROP TABLE IF EXISTS ballots;

-- Drop election choices table
DROP TABLE IF EXISTS election_choices;

-- Drop guardians table
DROP TABLE IF EXISTS guardians;

-- Drop allowed voters table
DROP TABLE IF EXISTS allowed_voters;

-- Drop elections table and its enum type
DROP TABLE IF EXISTS elections;
DROP TYPE IF EXISTS election_status;

-- Finally drop users table
DROP TABLE IF EXISTS users;

-- Drop extensions if needed
DROP EXTENSION IF EXISTS "uuid-ossp";
DROP EXTENSION IF EXISTS "pgcrypto";