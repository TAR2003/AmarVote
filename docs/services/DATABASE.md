# 🗄️ PostgreSQL Database

**Technology:** PostgreSQL 15 Alpine  
**Dev:** Neon Cloud (remote, via `${NEON_HOST}`)  
**Prod Port:** `5432` · **Network IP:** `172.20.0.20`  
**Memory Limit (prod):** `512 MiB`  
**Prod Credentials:** `amarvote_db` / `amarvote_user` / `amarvote_password`

---

## Overview

AmarVote uses PostgreSQL as its primary relational database. Two deployment modes:

- **Development:** Neon Cloud PostgreSQL (remote, serverless, no local container needed)
- **Production:** Local `postgres:15-alpine` container for data sovereignty

The schema is managed by **Hibernate DDL auto-update** (`spring.jpa.hibernate.ddl-auto=update`). The `Database/creation/` folder contains manual SQL creation scripts as backups and for initial setup.

---

## Schema Reference

### `elections`

The central entity. Every other table references this.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `election_id` | BIGSERIAL | PK | Auto-increment primary key |
| `election_title` | TEXT | NOT NULL | Display name of election |
| `election_description` | TEXT | | Markdown description |
| `number_of_guardians` | INTEGER | NOT NULL | Total guardian count (e.g. 5) |
| `election_quorum` | INTEGER | NOT NULL | Required for decryption (e.g. 3) |
| `no_of_candidates` | INTEGER | NOT NULL | Candidate count |
| `joint_public_key` | TEXT | | ElGamal joint public key (4096-bit decimal) |
| `manifest_hash` | TEXT | | ElectionGuard commitment hash |
| `status` | TEXT | | `draft` / `active` / `completed` / `decrypted` |
| `starting_time` | TIMESTAMPTZ | NOT NULL | Election open time |
| `ending_time` | TIMESTAMPTZ | NOT NULL | Election close time |
| `base_hash` | TEXT | | ElectionGuard base hash |
| `created_at` | TIMESTAMPTZ | Auto-set | Creation timestamp |
| `profile_pic` | TEXT | | Cloudinary URL for election cover image |
| `admin_email` | TEXT | | Election creator's email |
| `privacy` | TEXT | | `public` / `private` |
| `eligibility` | TEXT | | `open` / `restricted` / `listed` / `unlisted` |

### `election_center`

Stores the cryptographic material for an election's tally and results.

| Column | Type | Description |
|---|---|---|
| `election_center_id` | BIGSERIAL PK | |
| `election_id` | BIGINT FK → `elections` | |
| `encrypted_tally` | TEXT | Homomorphic tally ciphertext (JSON/msgpack) |
| `election_result` | TEXT | Final decrypted result JSON with vote counts and proofs |

### `allowed_voters`

Controls voter eligibility for restricted elections.

| Column | Type | Constraints |
|---|---|---|
| `election_id` | BIGINT FK | Composite PK |
| `user_email` | TEXT | Composite PK |
| `has_voted` | BOOLEAN | Default false |

### `guardians`

Guardian key storage — one row per guardian per election.

| Column | Type | Description |
|---|---|---|
| `guardian_id` | BIGSERIAL PK | |
| `election_id` | BIGINT FK → `elections` | |
| `user_email` | TEXT | Guardian's email address |
| `key_backup` | TEXT | ML-KEM-1024-wrapped private key blob |
| `guardian_public_key` | TEXT | Guardian's ElGamal public key (decimal) |
| `sequence_order` | INTEGER | Position in key ceremony (1-based) |
| `decrypted_or_not` | BOOLEAN | True after guardian completes decryption |
| `credentials` | TEXT | Additional encrypted credential data |

### `election_choices`

Candidates/options in an election.

| Column | Type | Description |
|---|---|---|
| `choice_id` | BIGSERIAL PK | |
| `election_id` | BIGINT FK → `elections` | |
| `option_title` | TEXT | Candidate name |
| `party_name` | TEXT | Party affiliation |
| `candidate_pic` | TEXT | Cloudinary URL |
| `party_pic` | TEXT | Cloudinary URL |
| `total_votes` | INTEGER | Updated after decryption |

### `ballots`

One row per cast ballot. Contains the encrypted ciphertext.

| Column | Type | Description |
|---|---|---|
| `ballot_id` | BIGSERIAL PK | |
| `election_id` | BIGINT FK → `elections` | |
| `submission_time` | TIMESTAMPTZ | When voter submitted |
| `status` | TEXT | `cast` / `spoiled` / `challenged` |
| `cipher_text` | TEXT | ElGamal encrypted ballot (JSON/msgpack) |
| `hash_code` | TEXT | Ballot hash for blockchain verification |
| `tracking_code` | TEXT | Unique voter-facing tracking code |

### `submitted_ballots`

Ballots included in a specific tally chunk (many-to-one with `election_center`).

| Column | Type | Description |
|---|---|---|
| `submitted_ballot_id` | BIGSERIAL PK | |
| `election_center_id` | BIGINT FK → `election_center` | |
| `cipher_text` | TEXT | Copy of ballot ciphertext included in this chunk |

### `decryptions`

Guardian partial decryption results — one row per (guardian, tally chunk).

| Column | Type | Description |
|---|---|---|
| `decryption_id` | BIGSERIAL PK | |
| `election_center_id` | BIGINT FK → `election_center` | |
| `guardian_id` | BIGINT FK → `guardians` | |
| `partial_decrypted_tally` | TEXT | Guardian's tally decryption share (msgpack) |
| `guardian_decryption_key` | TEXT | Guardian's public decryption key for verification |
| `tally_share` | TEXT | Tally share for proof verification |
| `date_performed` | TIMESTAMPTZ | When decryption was performed |

### `compensated_decryptions`

Compensation entries when a guardian is absent.

| Column | Type | Description |
|---|---|---|
| `compensated_decryption_id` | BIGSERIAL PK | |
| `election_center_id` | BIGINT FK → `election_center` | |
| `compensating_guardian_id` | BIGINT FK → `guardians` | Present guardian performing compensation |
| `missing_guardian_id` | BIGINT FK → `guardians` | Absent guardian being compensated for |
| `compensated_tally_share` | TEXT | Reconstructed tally decryption share |
| `compensated_ballot_share` | TEXT | Reconstructed ballot decryption share |

### `election_jobs`

Tracks background job lifecycle (used by admin/monitoring).

| Column | Type | Description |
|---|---|---|
| `job_id` | UUID PK | Auto-generated UUID |
| `election_id` | BIGINT FK → `elections` | |
| `operation_type` | TEXT | `TALLY` / `DECRYPTION` / `COMBINE_DECRYPTION` |
| `status` | TEXT | `PENDING` / `IN_PROGRESS` / `COMPLETED` / `FAILED` |
| `total_chunks` | INTEGER | Total chunks in this job |
| `processed_chunks` | INTEGER | Completed chunks |
| `failed_chunks` | INTEGER | Failed chunks |
| `created_by` | TEXT | Email of user who triggered the job |
| `started_at` | TIMESTAMPTZ | |
| `completed_at` | TIMESTAMPTZ | |
| `error_message` | TEXT | On failure |
| `metadata` | JSONB | Additional job-specific data |

### Worker Log Tables

Three tables with identical structure, one per processing phase:

**`tally_worker_log`**

| Column | Description |
|---|---|
| `tally_worker_log_id` | PK |
| `election_id` | FK → elections |
| `election_center_id` | FK → election_center |
| `chunk_number` | Which chunk (0-indexed) |
| `start_time` | Chunk processing start |
| `end_time` | Chunk processing end |
| `status` | `IN_PROGRESS` / `COMPLETED` / `FAILED` |
| `error_message` | On failure |

**`decryption_worker_log`** — Same columns plus:
- `guardian_id` — The guardian whose key is being used
- `decrypting_guardian_id` — Performing guardian (may differ for compensation)
- `decryption_type` — `PARTIAL` or `COMPENSATED`

**`combine_worker_log`** — Same as `tally_worker_log`

### `api_logs`

Comprehensive HTTP request/response audit trail for all API calls.

| Column | Description |
|---|---|
| `log_id` | BIGSERIAL PK |
| `request_method` | GET / POST / PUT / DELETE |
| `request_path` | URL path |
| `request_ip` | Client IP (X-Forwarded-For or remote addr) |
| `user_agent` | Browser/client user agent |
| `bearer_token` | JWT token (partial, for auditing) |
| `extracted_email` | Email from JWT, if present |
| `request_body` | Request body (sanitized) |
| `response_status` | HTTP status code |
| `request_time` | Request received timestamp |
| `response_time` | Response sent timestamp |
| `error_message` | On error responses |

### `otp_verifications`

Short-lived OTP records for passwordless login.

| Column | Description |
|---|---|
| `otp_id` | BIGSERIAL PK |
| `user_email` | Target email |
| `otp_code` | 6-digit code |
| `created_at` | Creation time |
| `expires_at` | Expiry time (`created_at + 5 min`) |
| `is_used` | BOOLEAN — prevents replay |

---

## Indexes

The schema includes comprehensive indexes for performance:

- All foreign key columns indexed
- `ballots(election_id, tracking_code)` — composite for verification lookups
- `ballots(election_id, status)` — filter by status for tally
- `api_logs(request_path, extracted_email, request_ip)` — admin log filtering
- `otp_verifications(user_email, is_used, expires_at)` — OTP lookup
- `election_jobs(election_id, operation_type)` — job status queries
- All log tables indexed on `election_id`, `status`, `start_time`

---

## Database Extensions

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";    -- Cryptographic functions
```

---

## Setup Scripts

Located in `Database/`:

| Directory | Purpose |
|---|---|
| `creation/` | Full schema creation SQL (`table_creation_file_AmarVote.sql`) |
| `deletion/` | Full schema teardown SQL |
| `init/` | Docker init scripts (mounted at `/docker-entrypoint-initdb.d/`) |
| `cleanup/` | Data cleanup scripts |
| `maintenance/` | Vacuum, analyze, index rebuild scripts |
| `diagnostics/` | Performance diagnostic queries |
| `emergency/` | Emergency data recovery procedures |

**Production init:** `docker-compose.prod.yml` mounts `./Database/creation/` as init scripts executed by PostgreSQL on first startup.

---

## Connection Pool (HikariCP)

| Property | Value | Description |
|---|---|---|
| `maximum-pool-size` | 30 | Max simultaneous DB connections |
| `minimum-idle` | 10 | Idle connections kept warm |
| `connection-timeout` | 30,000 ms | Max wait to acquire connection |
| `max-lifetime` | 1,800,000 ms (30 min) | Max connection age |
| `idle-timeout` | Default | Idle connection eviction |

30 max connections is sized for 4 concurrent RabbitMQ workers × 4 queues × ~2 connections each, plus API thread pool.

---

## Time Zone Policy

All timestamps stored as `TIMESTAMPTZ` (with timezone) and the Hibernate JDBC timezone is explicitly set to `UTC`:

```properties
spring.jpa.properties.hibernate.jdbc.time_zone=UTC
```

Frontend receives UTC timestamps and `timezoneUtils.js` converts to local display time.
