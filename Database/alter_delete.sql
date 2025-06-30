-- Drop indexes first
DROP INDEX IF EXISTS idx_audit_log_user;
DROP INDEX IF EXISTS idx_audit_log_election;
DROP INDEX IF EXISTS idx_blocked_ips;
DROP INDEX IF EXISTS idx_choices_election;
DROP INDEX IF EXISTS idx_guardians_election;
DROP INDEX IF EXISTS idx_voters_user;
DROP INDEX IF EXISTS idx_voters_election;
DROP INDEX IF EXISTS idx_ballots_tracking;
DROP INDEX IF EXISTS idx_ballots_election;

-- Drop tables in reverse order of dependencies
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS blocked_connections;
DROP TABLE IF EXISTS challenges;
DROP TABLE IF EXISTS decryptions;
DROP TABLE IF EXISTS ballots;
DROP TABLE IF EXISTS election_choices;
DROP TABLE IF EXISTS guardians;
DROP TABLE IF EXISTS allowed_voters;
DROP TABLE IF EXISTS elections;

-- Drop custom types
DROP TYPE IF EXISTS challenge_status;
DROP TYPE IF EXISTS ballot_status;
DROP TYPE IF EXISTS election_status;
DROP TYPE IF EXISTS threat_level;
