# 🚀 AmarVote Backend — Spring Boot Service

**Technology:** Java 21 · Spring Boot 3.5.0 · Maven  
**Container Port:** `8080`  
**Network IP:** `172.20.0.30` (both dev and prod)  
**Memory Limit (prod):** `1280 MiB` (JVM: `-Xms512m -Xmx1024m`)

---

## Table of Contents

1. [Overview](#overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Configuration & Environment Variables](#configuration--environment-variables)
5. [Security Architecture](#security-architecture)
6. [REST API Reference](#rest-api-reference)
   - [Authentication APIs](#authentication-apis)
   - [Election APIs](#election-apis)
   - [Ballot & Voting APIs](#ballot--voting-apis)
   - [Tally & Decryption APIs](#tally--decryption-apis)
   - [Blockchain Verification APIs](#blockchain-verification-apis)
   - [Admin APIs](#admin-apis)
   - [Chatbot API](#chatbot-api)
   - [Worker Log APIs](#worker-log-apis)
   - [Image Upload APIs](#image-upload-apis)
7. [Data Models (JPA Entities)](#data-models-jpa-entities)
8. [Service Layer](#service-layer)
9. [RabbitMQ Worker Architecture](#rabbitmq-worker-architecture)
10. [Redis Integration](#redis-integration)
11. [Resilience Patterns](#resilience-patterns)
12. [Async Processing](#async-processing)
13. [Monitoring & Metrics](#monitoring--metrics)
14. [Testing](#testing)

---

## Overview

The AmarVote backend is the central orchestration hub of the platform. It:

- Exposes the full REST API consumed by the React frontend
- Orchestrates cryptographic operations by delegating to the ElectionGuard Python microservice
- Queues all heavy cryptographic tasks (tally, partial/compensated decryption, combine) onto RabbitMQ for memory-safe async processing
- Stores election data, ballots, decryptions, and audit logs in PostgreSQL
- Caches guardian credentials securely in Redis with 6-hour TTL
- Sends transactional emails (OTP, guardian credentials) via Gmail SMTP
- Integrates with Cloudinary for candidate/party/election image uploads
- Exposes Prometheus metrics on `/actuator/prometheus`

---

## Technology Stack

| Component | Library / Version | Purpose |
|---|---|---|
| Runtime | Java 21 (OpenJDK) | Platform |
| Framework | Spring Boot 3.5.0 | Core web + DI |
| Web | Spring MVC + WebFlux | REST API + reactive WebClient |
| Security | Spring Security 6.x | Auth + CSRF |
| ORM | Spring Data JPA + Hibernate | PostgreSQL access |
| Message Queue | Spring AMQP (RabbitMQ) | Async task queuing |
| Cache | Spring Data Redis (Lettuce) | Guardian credential cache |
| JWT | JJWT 0.12.6 | Token-based auth |
| Email | Spring Mail | Gmail SMTP notifications |
| Images | Cloudinary SDK 1.38.0 | Media upload |
| Circuit Breaker | Resilience4j 2.1.0 | Fault tolerance |
| Binary Transport | Jackson-msgpack 0.9.8 | Fast Python↔Java serialization |
| Monitoring | Micrometer + Prometheus | Metrics export |
| Email Templates | Thymeleaf | HTML email rendering |
| Build | Maven (mvnw wrapper) | Build tool |

---

## Project Structure

```
backend/src/main/java/com/amarvote/amarvote/
├── AmarvoteApplication.java          ← Spring Boot entry point
├── controller/
│   ├── AdminController.java          ← /api/admin/* endpoints
│   ├── ChatbotController.java        ← /api/chatbot/chat endpoint
│   ├── ChatController.java           ← session chat helpers
│   ├── ElectionController.java       ← all core /api/* election + ballot endpoints
│   ├── helloController.java          ← /api/health endpoint
│   ├── ImageUploadController.java    ← /api/images/* upload endpoints
│   ├── JobController.java            ← background job status queries
│   ├── OtpAuthController.java        ← /api/auth/* OTP-based login
│   └── WorkerLogController.java      ← /api/worker-logs/* audit logs
│
├── service/
│   ├── ApiLogService.java            ← records all requests to api_logs table
│   ├── BallotService.java            ← ballot casting, bot detection, eligibility
│   ├── BlockchainService.java        ← calls blockchain-microservice
│   ├── ChunkingService.java          ← divides ballot lists into ~200-ballot chunks
│   ├── CloudinaryService.java        ← image upload/delete
│   ├── ConversationContextService.java ← in-memory chat session management
│   ├── CredentialCacheService.java   ← Redis guardian key storage (6h TTL)
│   ├── DecryptionTaskQueueService.java ← Phase 2 trigger logic
│   ├── ElectionGuardCryptoService.java ← PQ key wrap/unwrap (ML-KEM-1024)
│   ├── ElectionGuardService.java     ← HTTP calls to EG microservice
│   ├── ElectionService.java          ← election CRUD, guardian setup
│   ├── EmailService.java             ← Gmail SMTP (OTP, credentials)
│   ├── JWTService.java               ← JWT generate + validate
│   ├── MyUserDetailsService.java     ← UserDetailsService for Spring Security
│   ├── OtpAuthService.java           ← 6-digit OTP logic (5-min TTL)
│   ├── PartialDecryptionService.java ← partial + compensated + combine orchestration
│   ├── RAGService.java               ← HTTP calls to RAG microservice
│   ├── RedisLockService.java         ← distributed locking via Redis SET NX
│   ├── RoundRobinTaskScheduler.java  ← in-memory fair round-robin task scheduler
│   ├── SecureCredentialFileService.java ← legacy file-based credential backup
│   ├── TallyService.java             ← tally initiation and status
│   ├── TaskPublisherService.java     ← RabbitMQ publish wrappers
│   └── TaskWorkerService.java        ← @RabbitListener workers (4 consumers)
│
├── model/                            ← JPA entities (see Data Models section)
├── dto/                              ← ~60 request/response DTOs
├── repository/                       ← Spring Data JPA repositories
├── config/
│   ├── CloudinaryConfig.java
│   ├── CorsConfig.java
│   ├── CSRFConfig.java
│   ├── CustomRetryStrategy.java
│   ├── ExternalApiWebClientConfig.java
│   ├── RabbitMQConfig.java
│   ├── RedisConfig.java
│   ├── SecurityConfig.java
│   └── TimeZoneConfig.java
├── filter/
│   └── JWTFilter.java                ← JWT cookie extraction → SecurityContext
├── exception/                        ← global exception handlers
├── fabric/                           ← Hyperledger Fabric stubs (planned)
└── schedular/                        ← @Scheduled cleanup jobs
```

---

## Configuration & Environment Variables

All configuration is in `backend/src/main/resources/application.properties`.

### Required Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SPRING_DATASOURCE_URL` | — | JDBC URL, e.g. `jdbc:postgresql://host:5432/db` |
| `SPRING_DATASOURCE_USERNAME` | — | DB username |
| `SPRING_DATASOURCE_PASSWORD` | — | DB password |
| `JWT_SECRET` | — | HMAC-SHA256 signing key |
| `MAIL_PASSWORD` | — | Gmail App Password for `amarvote2025@gmail.com` |
| `MASTER_KEY_PQ` | — | Base64-encoded 32-byte master key for ML-KEM-1024 key wrapping |
| `CLOUDINARY_NAME` | — | Cloudinary cloud name |
| `CLOUDINARY_KEY` | — | Cloudinary API key |
| `CLOUDINARY_SECRET` | — | Cloudinary API secret |
| `DEEPSEEK_API_KEY` | — | OpenRouter API key (for chatbot) |

### Optional / Defaulted Variables

| Variable | Default | Description |
|---|---|---|
| `RABBITMQ_HOST` | `rabbitmq` | RabbitMQ hostname |
| `RABBITMQ_PORT` | `5672` | AMQP port |
| `RABBITMQ_USERNAME` | `guest` | Username |
| `RABBITMQ_PASSWORD` | `guest` | Password |
| `SPRING_REDIS_HOST` | `redis` | Redis hostname |
| `SPRING_REDIS_PORT` | `6379` | Redis port |
| `SPRING_REDIS_PASSWORD` | _(empty)_ | Redis password |
| `ELECTIONGUARD_API_URL` | `http://electionguard-api:5000` | Fast EG operations |
| `ELECTIONGUARD_WORKER_URL` | `http://electionguard-worker:5001` | Heavy EG operations |
| `RAG_SERVICE_URL` | — | RAG service base URL |
| `BLOCKCHAIN_SERVICE_URL` | — | Blockchain microservice URL |
| `LOG_PASSWORD` | `amarvote123` | Admin panel login password |
| `cookie.secure` | `false` | Set `true` in HTTPS production |
| `CREDENTIALS_DIRECTORY` | `credentials` | Temp credential file directory |

### Key Application Settings

| Property | Value | Notes |
|---|---|---|
| `server.port` | `8080` | |
| `spring.jpa.hibernate.ddl-auto` | `update` | Auto-updates schema |
| `spring.jpa.properties.hibernate.jdbc.time_zone` | `UTC` | |
| `amarvote.chunking.chunk-size` | `200` | Ballots per processing chunk |
| `amarvote.otp.validity-minutes` | `5` | OTP expiry |
| `spring.mvc.async.request-timeout` | `300000` | 5-minute async timeout |
| `electionguard.connection.timeout` | `10000` | 10s connect timeout to EG |
| `electionguard.socket.timeout` | `600000` | 10-minute socket timeout |
| `rabbitmq.worker.concurrency.min` | `4` | Minimum consumer threads |
| `rabbitmq.worker.concurrency.max` | `4` | Maximum consumer threads |
| HikariCP `maximum-pool-size` | `30` | DB connection pool size |
| HikariCP `minimum-idle` | `10` | Idle connections maintained |
| HikariCP `connection-timeout` | `30000` | 30s acquire timeout |
| HikariCP `max-lifetime` | `1800000` | 30-min connection max life |

---

## Security Architecture

### Request Flow

```
Browser
  → Nginx reverse proxy
  → Spring MVC DispatcherServlet
  → JWTFilter (extracts JWT from "jwtToken" HttpOnly cookie)
  → SecurityContextHolder.setAuthentication(UsernamePasswordAuthToken)
  → @RabbitListener or @RestController method
```

### JWT Cookies

- Cookie name: `jwtToken`
- `HttpOnly=true`, `Path=/`, `SameSite=Strict`
- `MaxAge`: 7 days for regular users, 7 days for admin
- `Secure` flag controlled by `${cookie.secure:false}` (set `true` in HTTPS production)

### Public Endpoints (No Auth Required)

```
/api/auth/register        /api/auth/login
/api/auth/session         /api/auth/request-otp
/api/auth/verify-otp      /api/auth/logout
/api/password/**          /api/verify/**
/api/health               /api/test-deepseek
/api/chatbot/**
/api/admin/login
/actuator/prometheus      /actuator/health    /actuator/metrics
```

### Password Encoding

`BCryptPasswordEncoder` with `strength=12`.

### CSRF

Configured via `CSRFConfig`. Frontend reads `XSRF-TOKEN` cookie and sends `X-XSRF-TOKEN` header on all non-GET requests.

### Bot Detection

`BallotService.castBallot()` validates:
1. `isBot == false` — if `true`, request is rejected immediately
2. Timestamp freshness: bot detection data must be ≤ 5 minutes old

---

## REST API Reference

All endpoints are prefixed `/api` unless noted. Authentication via `jwtToken` cookie.

### Authentication APIs

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/request-otp` | Public | Sends 6-digit OTP to the provided email address. OTP valid for 5 minutes. |
| POST | `/api/auth/verify-otp` | Public | Verifies OTP code; on success issues `jwtToken` cookie (7-day MaxAge). Body: `{userEmail, otpCode}` |
| GET | `/api/auth/session` | Authenticated | Returns `{ username }` — confirms session validity |
| POST | `/api/auth/logout` | Authenticated | Clears `jwtToken` cookie (sets MaxAge=0) |
| POST | `/api/password/forgot-password` | Public | Initiates password reset flow |
| POST | `/api/password/create-password` | Public | Sets new password via reset token |
| POST | `/api/verify/send-code` | Public | Sends email verification code |
| POST | `/api/verify/verify-code` | Public | Verifies email verification code |

### Election APIs

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/create-election` | Authenticated | Create election. Body: `ElectionCreationRequest` (title, description, candidateNames, partyNames, guardianEmails, numberOfGuardians, quorum, startingTime, endingTime, privacy, eligibility). Triggers ElectionGuard guardian setup and encrypted credential emails to all guardians. |
| GET | `/api/all-elections` | Authenticated | Returns all elections accessible to the calling user with role metadata (`userRoles`, `hasVoted`). |
| GET | `/api/election/{id}` | Authenticated | Full election detail including candidates, guardians, timeline. |
| GET | `/api/election/{id}/guardians` | Authenticated | Guardian list (no private credential data). |
| GET | `/api/election/{id}/compensated-decryptions` | Authenticated | List of compensated decryption records. |
| GET | `/api/election/{id}/results` | Authenticated | Final decrypted results from `election_center.election_result`. |
| GET | `/api/election/{electionId}/cached-results` | Authenticated | Returns cached results JSON. |
| POST | `/api/upload-candidate-image` | Authenticated | Uploads candidate image to Cloudinary. Returns `imageUrl`. |
| POST | `/api/upload-party-image` | Authenticated | Uploads party image to Cloudinary. Returns `imageUrl`. |

### Ballot & Voting APIs

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/eligibility` | Authenticated | Check if calling user can vote in `{electionId}`. Returns `{eligible, reason}`. |
| POST | `/api/cast-ballot` | Authenticated | Cast a vote. Body: `CastBallotRequest { electionId, selectedCandidate, botDetectionData { isBot, requestId, timestamp } }`. Validates bot detection freshness (≤5 min). |
| POST | `/api/create-encrypted-ballot` | Authenticated | Creates encrypted ballot. Payload is fixed-size `application/octet-stream` (PKCS#7 padded to `TARGET_SIZE` bytes — anti-traffic-analysis). Returns `CreateEncryptedBallotResponse { encryptedBallot, trackingCode, proof }`. |
| POST | `/api/benaloh-challenge` | Authenticated | Performs Benaloh challenge on an encrypted ballot (spoil for verification). Body: `BenalohChallengeRequest`. |
| POST | `/api/cast-encrypted-ballot` | Authenticated | Casts a pre-encrypted (and optionally challenged) ballot. Body: `CastEncryptedBallotRequest`. |
| GET | `/api/ballot-details/{electionId}/{trackingCode}` | Authenticated | Returns ciphertext details for a specific ballot. |

### Tally & Decryption APIs

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/initiate-tally` | Authenticated | Queues tally creation task via RoundRobinTaskScheduler → RabbitMQ. Divides ballots into ~200-ballot chunks and publishes `TallyCreationTask` messages. Returns immediately. |
| GET | `/api/election/{electionId}/tally-status` | Authenticated | Returns `TallyCreationStatusResponse { status, chunksTotal, chunksCompleted, chunksFailed }`. |
| POST | `/api/create-tally` | Authenticated | Legacy alias for `initiate-tally`. |
| POST | `/api/guardian/initiate-decryption` | Authenticated | Guardian submits credentials; service decrypts PQ-wrapped private key; stores in Redis (6h TTL); queues partial decryption chunks. |
| GET | `/api/guardian/decryption-status/{electionId}` | Authenticated | Status for the calling guardian's decryption. |
| GET | `/api/guardian/decryption-status/{electionId}/{guardianId}` | Authenticated | Status for a specific guardian. |
| POST | `/api/initiate-combine` | Authenticated | Queues combine operation: gathers all partial/compensated shares, publishes `CombineDecryptionTask` per chunk. |
| GET | `/api/combine-status/{electionId}` | Authenticated | Returns `CombineStatusResponse { status, chunksTotal, chunksCompleted }`. |
| POST | `/api/create-partial-decryption` | Authenticated | Synchronous partial decryption (legacy / testing). |
| POST | `/api/combine-partial-decryption` | Authenticated | Synchronous combine (legacy / testing). |

### Blockchain Verification APIs

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/blockchain/ballot/{electionId}/{trackingCode}` | **Public** | Verifies a ballot hash on the Ganache blockchain. Returns `{ ballotFound, blockNumber, transactionHash, timestamp, verified }`. |
| GET | `/api/blockchain/logs/{electionId}` | **Public** | Returns all blockchain event logs for an election. |

### Admin APIs

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/admin/login` | Public | Admin login. Body: `{ username: "admin", password: LOG_PASSWORD }`. Issues `jwtToken` cookie with subject `"admin"`, valid 7 days. |
| GET | `/api/admin/logs` | Admin JWT | Paginated API request logs. Params: `page`, `size`, `email`, `ip`, `path`. |
| GET | `/api/admin/logs/stats` | Admin JWT | Returns `{ totalLogs, errorLogs }` counts. |

### Chatbot API

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/chatbot/chat` | Public | AI chatbot endpoint. Body: `{ userMessage: string, sessionId: string }`. Returns streaming/reactive `Mono<String>`. |

**Query Classification (QueryIntent):**

| Intent | Trigger keywords | Routing |
|---|---|---|
| `AMARVOTE_USER_GUIDE` | "how to create election", "how to vote", "how to verify", "see results" | RAG service → `AmarVote_User_Guide` document |
| `ELECTIONGUARD_TECHNICAL` | "guardians", "key ceremony", "encryption", "zero-knowledge", "ZK proofs" | RAG service → `EG_spec_2_1` document |
| `ELECTION_RESULTS` | "recent election", "latest election", "results of election" | Live DB query via `ElectionService` |
| `GENERAL_ELECTION` | General election topics | DeepSeek AI directly |
| `OFF_TOPIC` | Everything else | Canned refusal message |

**AI config:** Model `deepseek/deepseek-chat-v3-0324:free` via OpenRouter (`https://openrouter.ai/api/v1/chat/completions`). In-memory session store with up to 10-message history per `sessionId`. Timeout: 5 minutes (300,000 ms).

### Worker Log APIs

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/worker-logs/tally/{electionId}` | Authenticated | All tally worker logs with timing stats and initiator email. |
| GET | `/api/worker-logs/decryption/partial/{electionId}` | Authenticated | Partial decryption logs per guardian per chunk. |
| GET | `/api/worker-logs/decryption/compensated/{electionId}` | Authenticated | Compensated decryption logs. |
| GET | `/api/worker-logs/combine/{electionId}` | Authenticated | Combine worker logs with stats. |
| GET | `/api/worker-logs/summary/{electionId}` | Authenticated | Aggregate summary: counts, completion status, timing stats for all phases. |

Each log response includes: `id`, `electionId`, `electionCenterId`, `chunkNumber`, `startTime`, `endTime`, `status` (`IN_PROGRESS`/`COMPLETED`/`FAILED`), `errorMessage`, `duration` (ms). Decryption logs also include `guardianId`, `decryptingGuardianId`, `decryptionType`.

### Image Upload APIs

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/upload-candidate-image` | Authenticated | Multipart upload; returns Cloudinary URL. |
| POST | `/api/upload-party-image` | Authenticated | Multipart upload; returns Cloudinary URL. |
| POST | `/api/images/election` | Authenticated | Election cover image. |

---

## Data Models (JPA Entities)

### `Election` → table `elections`

| Column | Type | Constraints |
|---|---|---|
| `election_id` | BIGSERIAL | PK |
| `election_title` | TEXT | NOT NULL |
| `election_description` | TEXT | |
| `number_of_guardians` | INTEGER | NOT NULL |
| `election_quorum` | INTEGER | NOT NULL |
| `no_of_candidates` | INTEGER | NOT NULL |
| `joint_public_key` | TEXT | ElGamal joint public key (decimal string) |
| `manifest_hash` | TEXT | ElectionGuard manifest commitment hash |
| `status` | TEXT | `draft` / `active` / `completed` / `decrypted` |
| `starting_time` | TIMESTAMPTZ | NOT NULL |
| `ending_time` | TIMESTAMPTZ | NOT NULL |
| `base_hash` | TEXT | Commitment/base hash |
| `created_at` | TIMESTAMPTZ | Auto-set, immutable |
| `profile_pic` | TEXT | Cloudinary URL |
| `admin_email` | TEXT | Election creator email |
| `privacy` | TEXT | `public` / `private` |
| `eligibility` | TEXT | `open` / `restricted` / `listed` / `unlisted` |

### Other Entities

| Entity | Table | Key Columns |
|---|---|---|
| `Guardian` | `guardians` | `guardian_id`, `election_id FK`, `user_email`, `key_backup` (PQ-encrypted), `guardian_public_key`, `sequence_order`, `decrypted_or_not BOOL`, `credentials` |
| `Ballot` | `ballots` | `ballot_id`, `election_id FK`, `cipher_text`, `hash_code`, `tracking_code`, `status` (`cast`/`spoiled`/`challenged`), `submission_time` |
| `ElectionCenter` | `election_center` | `election_center_id`, `election_id FK`, `encrypted_tally`, `election_result` (JSON) |
| `ElectionChoice` | `election_choices` | `choice_id`, `election_id FK`, `option_title`, `party_name`, `candidate_pic`, `party_pic`, `total_votes` |
| `AllowedVoter` | `allowed_voters` | `election_id + user_email` (composite PK), `has_voted BOOL` |
| `Decryption` | `decryptions` | `decryption_id`, `election_center_id FK`, `guardian_id FK`, `partial_decrypted_tally`, `guardian_decryption_key`, `tally_share`, `date_performed` |
| `CompensatedDecryption` | `compensated_decryptions` | `compensated_decryption_id`, `election_center_id FK`, `compensating_guardian_id FK`, `missing_guardian_id FK`, `compensated_tally_share`, `compensated_ballot_share` |
| `ElectionJob` | `election_jobs` | `job_id UUID`, `election_id FK`, `operation_type` (`TALLY`/`DECRYPTION`/`COMBINE_DECRYPTION`), `status`, `total_chunks`, `processed_chunks`, `failed_chunks`, `created_by`, `started_at`, `completed_at`, `error_message` |
| `TallyWorkerLog` | `tally_worker_log` | Per-chunk tally processing log |
| `DecryptionWorkerLog` | `decryption_worker_log` | Per-chunk partial/compensated decryption log |
| `CombineWorkerLog` | `combine_worker_log` | Per-chunk combine log |
| `ApiLog` | `api_logs` | Full HTTP request/response log (method, path, IP, user-agent, JWT, email, body, response status, timing) |
| `OtpVerification` | `otp_verifications` | `otp_id`, `user_email`, `otp_code`, `created_at`, `expires_at`, `is_used BOOL` |

---

## Service Layer

### `ChunkingService`

Divides ballot collections into approximately equal chunks of `CHUNK_SIZE=200` (configurable).

- `calculateChunks(totalBallots)` → `ChunkConfiguration { numChunks, chunkSizes[] }` — distributes ballots evenly across chunks; if remainder, first N chunks each get +1 ballot
- `assignBallotsToChunks(ballots, config)` → `Map<Integer, List<Ballot>>` — **randomly shuffles** ballot list (using `SecureRandom`) before distributing (prevents sequential patterns)
- `assignIdsToChunks(ids, config)` → `Map<Integer, List<Long>>` — memory-efficient ID-only variant
- `verifyChunkAssignment(originalBallots, chunks)` → boolean — integrity check: total count matches, no duplicate ballot IDs

### `CredentialCacheService`

Manages temporary guardian private key storage in Redis.

- **Redis key format:** `guardian:privatekey:{electionId}:{guardianId}`, `guardian:polynomial:{electionId}:{guardianId}`
- **TTL:** 360 minutes (6 hours)
- `storePrivateKey` / `storePolynomial` — stores with TTL
- `getPrivateKey` / `getPolynomial` — returns `null` if expired or missing
- `clearCredentials` — deletes both keys immediately; falls back to TTL reduction on error
- `hasCredentials` — returns `true` only if both keys exist

### `OtpAuthService`

- OTP: 6-digit code using `100000 + SecureRandom.nextInt(900000)`
- Validity: 5 minutes (`OTP_VALIDITY_MINUTES = 5`)  
- On `sendOtp`: deletes all existing OTPs for that email first, then creates new one
- On `verifyOtpAndGenerateToken`: finds non-expired, non-used OTP; marks `isUsed=true`; returns JWT

### `ElectionGuardCryptoService`

Post-quantum key wrapping using **ML-KEM-1024** (CRYSTALS-Kyber):

- `encryptPrivateKey(privateKey, email)` → encrypted blob stored in `guardian.key_backup`
- `decryptPrivateKey(encryptedBlob, email)` → decrypted private key string (called when guardian submits credentials)
- Uses `MASTER_KEY_PQ` as entropy source for key derivation

---

## RabbitMQ Worker Architecture

See [RABBITMQ.md](RABBITMQ.md) for the complete architecture.

### Queue Configuration (`RabbitMQConfig`)

- **Exchange:** `task.exchange` (Direct, durable)
- **Prefetch:** `1` per consumer (round-robin fairness)
- **Concurrency:** min=4, max=4 consumers per queue

| Queue | Routing Key | Worker Method | Purpose |
|---|---|---|---|
| `tally.creation.queue` | `task.tally.creation` | `processTallyCreationTask` | Chunk → encrypted tally |
| `partial.decryption.queue` | `task.partial.decryption` | `processPartialDecryptionTask` | Guardian partial decrypt |
| `compensated.decryption.queue` | `task.compensated.decryption` | `processCompensatedDecryptionTask` | Absent guardian compensation |
| `combine.decryption.queue` | `task.combine.decryption` | `processCombineDecryptionTask` | Final result assembly |

### `RoundRobinTaskScheduler`

In-memory fair scheduler that publishes messages to RabbitMQ:

- **Scheduling interval:** 100ms
- **Max queued chunks per task:** `1` (strict interleaving — prevents a single election from hogging all consumers)
- **Target chunks per cycle:** `8` (round-robin passes per tick)
- **Retry:** max 3 attempts, exponential backoff: 5s, 10s, 20s
- **State machine:** `PENDING → QUEUED → PROCESSING → COMPLETED / FAILED`

### Memory Management in Workers

After each chunk:
1. `entityManager.flush()` + `entityManager.clear()` — evicts L1 Hibernate cache
2. `System.gc()` — explicit GC hint to JVM
3. Local variable references set to `null`

This ensures stable memory on 4 GB RAM servers even for elections with 1000+ chunks.

---

## Redis Integration

See [REDIS.md](REDIS.md) for full documentation.

Redis serves three distinct purposes in the backend:

1. **Credential Cache** — Temporary storage of decrypted guardian private keys and polynomials (6h TTL via `CredentialCacheService`)
2. **Phase Completion Counters** — Atomic `INCR` counters per `(electionId, guardianId)` track how many partial/compensated chunks have completed; trigger Phase 2 initiation via `SET NX` guard
3. **Distributed Locks** — `RedisLockService` uses `SET NX EX` to prevent double-processing of the same chunk across multiple worker instances

---

## Resilience Patterns

Configured via Resilience4j on the `electionguard` circuit breaker group:

| Pattern | Config | Behavior |
|---|---|---|
| Circuit Breaker | Window=10 calls, failure rate=50% | Opens circuit for 30s after 50% failures |
| Slow Call Threshold | 300s | Calls > 5 min counted as failures |
| Retry | 3 attempts, 2s wait, exponential × 2 | Applied to `compensated.decryption` worker specifically |
| Timeout | 600s socket timeout | Via Apache HC5 HTTP client |

---

## Async Processing

- Spring async executor: `core-size=20`, `max-size=50`, `queue-capacity=500`
- MVC async timeout: 300,000 ms (5 min)
- All tally/decryption/combine flows return immediately; status polled via dedicated status endpoints

---

## Monitoring & Metrics

- **Path:** `/actuator/prometheus` (public, no auth required)
- **Application tag:** `AmarVote Backend` (applied to all metrics)
- **Scraped by:** Prometheus at `172.20.0.30:8080` every 15s
- **Exposed:** `health`, `info`, `prometheus`, `metrics`
- **Custom metrics:** All RabbitMQ listener throughput, HikariCP pool stats, JVM heap/GC metrics exported automatically via Micrometer

---

## Testing

```bash
cd backend
./mvnw test                          # Run all tests
./mvnw test -Dtest=BallotServiceTest # Specific test class
./mvnw test jacoco:report            # Coverage report → target/site/jacoco/
```

**Test Files:**
- `AmarvoteApplicationTests.java` — Spring context load test
- `service/ElectionServiceTest.java` — Election creation validation
- `service/EmailServiceTest.java` — SMTP mock tests
- `service/BALLOT_SERVICE_TESTS.md` — Test documentation

**Coverage target:** 85%+ overall, 90%+ on service layer.
