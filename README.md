# 🗳️ AmarVote — Next-Generation Secure Voting Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Java](https://img.shields.io/badge/Java-21-orange.svg)](https://openjdk.org/projects/jdk/21/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.5.0-brightgreen.svg)](https://spring.io/projects/spring-boot)
[![React](https://img.shields.io/badge/React-19.1.0-blue.svg)](https://react.dev/)
[![Python](https://img.shields.io/badge/Python-3.12-blue.svg)](https://www.python.org/)
[![ElectionGuard](https://img.shields.io/badge/ElectionGuard-2.x-purple.svg)](https://github.com/microsoft/electionguard)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue.svg)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Containerized-2496ED.svg)](https://www.docker.com/)
[![RabbitMQ](https://img.shields.io/badge/RabbitMQ-3.13-FF6600.svg)](https://www.rabbitmq.com/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D.svg)](https://redis.io/)

AmarVote is a cryptographically secure, end-to-end verifiable digital voting platform. It combines **Microsoft's ElectionGuard SDK**, **post-quantum cryptography (ML-KEM-1024 / Kyber1024)**, a **RabbitMQ worker architecture** for memory-safe large-scale processing, and optional **blockchain verification** — all orchestrated via Docker Compose.

---

## 📺 Video Demonstrations

| Video | Link |
|---|---|
| Platform Features Demo | [https://youtu.be/ixsvvl_7qVo](https://youtu.be/ixsvvl_7qVo) |
| Infrastructure Overview | [https://youtu.be/t8VOLdYIV40](https://youtu.be/t8VOLdYIV40) |

---

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Service Directory & Documentation](#service-directory--documentation)
3. [Technology Stack](#technology-stack)
4. [How AmarVote Works](#how-amarvote-works)
   - [Election Creation & Key Ceremony](#election-creation--key-ceremony)
   - [Ballot Casting & Encryption](#ballot-casting--encryption)
   - [Tally & Decryption Pipeline](#tally--decryption-pipeline)
5. [Cryptographic Design](#cryptographic-design)
6. [RabbitMQ Worker Architecture](#rabbitmq-worker-architecture)
7. [Network & Infrastructure](#network--infrastructure)
8. [Project Structure](#project-structure)
9. [Quick Start — Development](#quick-start--development)
10. [Quick Start — Production](#quick-start--production)
11. [Environment Variables Reference](#environment-variables-reference)
12. [Service Access Points](#service-access-points)
13. [REST API Quick Reference](#rest-api-quick-reference)
14. [Database Schema Overview](#database-schema-overview)
15. [Security Model](#security-model)
16. [Testing](#testing)
17. [Optional Services](#optional-services)
18. [Deployment Configurations](#deployment-configurations)
19. [Performance & Memory](#performance--memory)
20. [Monitoring](#monitoring)
21. [Contributing](#contributing)
22. [License](#license)

---

## Architecture Overview

AmarVote consists of six core services (always active) and three optional services (commented out by default):

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        EXTERNAL / USER LAYER                                    │
│   Browser ──► Nginx Reverse Proxy (nginx-proxy.conf) ──► 172.20.0.0/24 network │
└──────────────────────────────┬──────────────────────────────────────────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                     │
          ▼                    ▼                     ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐
│   React Frontend │  │  Spring Boot     │  │  ElectionGuard       │
│   Node 18/Nginx  │  │  Backend         │  │  Python Microservice  │
│   172.20.0.40    │  │  172.20.0.30     │  │  ─ API  172.20.0.10  │
│   Port: 5173/80  │  │  Port: 8080      │  │  ─ Worker 172.20.0.11│
└──────────────────┘  └────────┬─────────┘  └──────────────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                     │
          ▼                    ▼                     ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐
│     RabbitMQ     │  │   PostgreSQL     │  │   Redis 7            │
│     3.13         │  │   15 Alpine      │  │   172.20.0.70/75     │
│  172.20.0.60/25  │  │  172.20.0.20     │  │   Port: 6379         │
│  Port: 5672/15672│  │   Port: 5432     │  │   256MB / allkeys-lru│
└──────────────────┘  └──────────────────┘  └──────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  PRODUCTION ONLY                                                │
│  Prometheus (172.20.0.50:9090) ──► Grafana (172.20.0.60:3000)  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  OPTIONAL (commented out — infrastructure ready)                │
│  RAG Service (5001) │ Blockchain API (5002) │ Ganache (8545)    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Service Directory & Documentation

Each service has its own detailed documentation file:

| Service | Technology | Port | Status | Docs |
|---|---|---|---|---|
| **Frontend** | React 19.1 + Vite 6 | 5173 dev / 80 prod | ✅ Active | [FRONTEND.md](docs/services/FRONTEND.md) |
| **Backend** | Spring Boot 3.5, Java 21 | 8080 | ✅ Active | [BACKEND.md](docs/services/BACKEND.md) |
| **ElectionGuard API** | Python 3.12 + Flask | 5000 | ✅ Active | [ELECTIONGUARD.md](docs/services/ELECTIONGUARD.md) |
| **ElectionGuard Worker** | Python 3.12 + Flask | 5001 internal | ✅ Active | [ELECTIONGUARD.md](docs/services/ELECTIONGUARD.md) |
| **RabbitMQ** | RabbitMQ 3.13 | 5672 / 15672 | ✅ Active | [RABBITMQ.md](docs/services/RABBITMQ.md) |
| **Redis** | Redis 7 Alpine | 6379 | ✅ Active | [REDIS.md](docs/services/REDIS.md) |
| **PostgreSQL** | Postgres 15 (prod) | 5432 | 🏭 Prod Only | [DATABASE.md](docs/services/DATABASE.md) |
| **Prometheus** | prom/prometheus | 9090 | 🏭 Prod Only | [MONITORING.md](docs/services/MONITORING.md) |
| **Grafana** | grafana/grafana | 3000 | 🏭 Prod Only | [MONITORING.md](docs/services/MONITORING.md) |
| **RAG Service** | Python + LangChain + ChromaDB | 5001 | ⚠️ Optional | [RAG.md](docs/services/RAG.md) |
| **Blockchain API** | Flask + Web3.py + Ganache | 5002 / 8545 | ⚠️ Optional | [BLOCKCHAIN.md](docs/services/BLOCKCHAIN.md) |

---

## Technology Stack

### Backend (Spring Boot)

| Component | Technology | Version |
|---|---|---|
| Runtime | Java | 21 (OpenJDK) |
| Framework | Spring Boot | 3.5.0 |
| Security | Spring Security | 6.x (auto-managed) |
| ORM | Spring Data JPA + Hibernate | (included in Boot) |
| Message Queue | Spring AMQP (RabbitMQ) | (included in Boot) |
| Cache | Spring Data Redis (Lettuce) | (included in Boot) |
| JWT | JJWT | 0.12.6 |
| Circuit Breaker | Resilience4j | 2.1.0 |
| Binary Transport | Jackson-msgpack | 0.9.8 |
| Image Storage | Cloudinary SDK | 1.38.0 |
| AI / Chatbot | DeepSeek via OpenRouter | `deepseek/deepseek-chat-v3-0324:free` |
| Monitoring | Micrometer + Prometheus registry | (included in Boot) |
| Build | Maven | wrapper (mvnw) |
| HikariCP pool | max-pool-size=30 | min-idle=10 |
| DB connection timeout | 20s | max-lifetime=1800s |

### Frontend (React)

| Component | Technology | Version |
|---|---|---|
| UI Framework | React | 19.1.0 |
| Router | React Router DOM | 7.6.1 |
| Build Tool | Vite | 6.3.5 |
| Styling | Tailwind CSS | 3.4.17 |
| Animation | Framer Motion | 12.23.26 |
| Charts | Recharts | 2.8.0 |
| Bot Detection | FingerprintJS BotD | 1.9.1 |
| PDF Export | jsPDF + jspdf-autotable | 2.5.1 / 3.6.0 |
| HTTP | Axios | 1.9.0 |
| Testing | Vitest + Testing Library | 3.2.4 / 16.3.0 |

### ElectionGuard Microservice (Python)

| Component | Technology |
|---|---|
| Framework | Flask + Gunicorn |
| Cryptography | ElectionGuard SDK (Microsoft) |
| Post-Quantum KEM | pqcrypto (ML-KEM-1024 / Kyber1024) |
| Symmetric Crypto | cryptography (AES-256-CBC, Scrypt, HKDF) |
| Big Integer Math | gmpy2 (GMP-backed) |
| Serialization | msgpack |
| HTTP Client | requests |

### Infrastructure

| Service | Technology | Purpose |
|---|---|---|
| Database | PostgreSQL 15 | Primary data store |
| Message Queue | RabbitMQ 3.13 | Async task queuing |
| Cache | Redis 7 | Credential cache + counters + locks |
| Reverse Proxy | Nginx | API routing + SSL termination |
| Monitoring | Prometheus + Grafana | Metrics + dashboards |
| Container Orchestration | Docker Compose | Service lifecycle |

---

## How AmarVote Works

### Election Creation & Key Ceremony

```
Election Admin submits creation form
    │
    ▼
Backend (ElectionService.createElection)
    ├─ Validates: min 2 candidates, min 2 parties, unique candidate names
    ├─ Calls ElectionGuard API: POST /setup_guardians
    │     │
    │     ▼ (ElectionGuard Microservice: setup_guardians.py)
    │     ├─ Creates Guardian objects (e.g. 5 guardians, quorum 3)
    │     ├─ Round 1: All guardians announce their public keys to mediator
    │     ├─ Round 2: Each guardian generates polynomial backups for all others
    │     ├─ Round 3: Each guardian verifies their received backups
    │     └─ Mediator publishes JointPublicKey + CommitmentHash
    │
    ├─ Receives: joint_public_key, guardian_data, private_keys, polynomials
    ├─ For each guardian:
    │     └─ ML-KEM-1024 wraps private_key → encrypted blob → stored in guardians.key_backup
    ├─ Sends encrypted credentials via Gmail SMTP (smtp.gmail.com:587) to each guardian's email
    └─ Records election in PostgreSQL (status='draft' → 'active' at startingTime)
```

### Ballot Casting & Encryption

```
Voter selects candidate in Voting Booth
    │
    ▼
FingerprintJS BotD bot detection runs
    ├─ isBot: false  (or request rejected with 403)
    └─ timestamp: now (must be ≤5 minutes old when received by backend)
    │
    ▼
Frontend: ballotPadding.js pads encrypted ballot to fixed size (PKCS#7)
    → Prevents traffic analysis — all ballot requests look identical in size
    │
    ▼
POST /api/create-encrypted-ballot (Content-Type: application/octet-stream)
    │
    ▼
Backend ElectionController
    ├─ Strips PKCS#7 padding → recovers JSON payload
    ├─ Calls ElectionGuard API: POST /create_encrypted_ballot
    │     └─ Encrypts vote using joint_public_key (ElGamal, 4096-bit)
    │     └─ Generates ZK proof of ballot validity (Schnorr / Chaum-Pedersen)
    ├─ Generates unique tracking_code via ballot hash
    └─ Returns: { encryptedBallot, trackingCode, proof }
    │
    ▼
Voter optionally performs Benaloh Challenge:
    POST /api/benaloh-challenge
    → Receives encryption nonce → verifies encryption was honest → ballot spoiled
    → Voter must re-vote (spoiled ballot cannot be cast)
    │
    ▼
POST /api/cast-encrypted-ballot
    ├─ Stores ballot in PostgreSQL (ballots table, status='cast')
    ├─ Hash recorded on blockchain (if enabled): POST blockchain-microservice/record-ballot
    └─ Returns: { success, trackingCode, timestamp }
```

### Tally & Decryption Pipeline

```
[Admin: Initiate Tally] → POST /api/initiate-tally
    │
    ▼
Backend TallyService
    ├─ ChunkingService shuffles all cast ballots (SecureRandom) → divides into 200-ballot chunks
    ├─ RoundRobinTaskScheduler.registerTask(TALLY, electionId, chunks)
    └─ scheduler 100ms tick → publish 1 chunk per election per cycle → tally.creation.queue
          │
          ▼ (4 concurrent worker consumers, prefetch=1)
    TaskWorkerService.processTallyCreationTask:
        POST electionguard-worker:5001/create_encrypted_tally
        Saves ElectionCenter row (encrypted_tally per chunk)
        entityManager.clear() + System.gc() → memory release

════════════════════════════════════════════════════════════════════
[Guardian 1..N: Submit Credentials] → POST /api/guardian/initiate-decryption
    │
    ▼
Backend PartialDecryptionService
    ├─ ML-KEM-1024 unwrap → recover ElGamal private_key
    ├─ Store in Redis: guardian:privatekey:{electionId}:{guardianId} (TTL: 360 min)
    └─ RoundRobinTaskScheduler.registerTask(PARTIAL_DECRYPT, ...)
          │
          ▼ (fair round-robin across all guardians simultaneously)
    TaskWorkerService.processPartialDecryptionTask:
        Retrieves private_key from Redis
        POST electionguard-worker:5001/create_partial_decryption
        Saves Decryption row (tally_share, guardian_decryption_key)
        Redis INCR("partial_progress:{electionId}:{guardianId}")
        If count == totalChunks:
          Redis SET NX ("partial_triggered:{electionId}:{guardianId}") → exactly-once guard
          Trigger compensated decryption tasks for absent guardians

════════════════════════════════════════════════════════════════════
[Compensated Decryption — for absent guardians only]
    partial.decryption.queue → compensated.decryption.queue
          │
          ▼
    TaskWorkerService.processCompensatedDecryptionTask:
        POST electionguard-worker:5001/create_compensated_decryption
        (Uses backup polynomial evaluations + Lagrange interpolation)
        Saves CompensatedDecryption row
        Clears Redis credentials + marks guardian.decrypted_or_not = true

════════════════════════════════════════════════════════════════════
[Admin: Initiate Combine] → POST /api/initiate-combine
    │
    ▼
    RoundRobinTaskScheduler.registerTask(COMBINE, ...) → combine.decryption.queue
          │
          ▼
    TaskWorkerService.processCombineDecryptionTask:
        Assembles all Decryption + CompensatedDecryption rows for chunk
        POST electionguard-worker:5001/combine_decryption_shares
        Saves election_result JSON to ElectionCenter
        Election status → 'decrypted'

════════════════════════════════════════════════════════════════════
[Results available] → GET /api/election/{id}/results
    Returns per-candidate vote counts + Chaum-Pedersen verification proofs
```

---

## Cryptographic Design

### Encryption Layers

```
Individual Vote
    └─► ElGamal Encryption (ElectionGuard, 4096-bit modular group)
            ├─ ZK proof (ballot validity): Schnorr / Chaum-Pedersen
            ├─ Ballot ciphertext: (α, β) = (g^R, K^R · M) where K = joint public key
            └─ Tracking code: hash of ballot ciphertext (α, β)

Guardian Keys
    └─► ML-KEM-1024 Key Encapsulation (CRYSTALS-Kyber, NIST FIPS 203)
            ├─ Key derivation: Scrypt(MASTER_KEY_PQ + guardian_email, N=2^16) → wrapping key
            └─ AES-256-CBC encryption of ElGamal private key → stored as key_backup

JWTs (Session Auth)
    └─► HMAC-SHA256 (JJWT 0.12.6), 7-day expiry
        └─ Cookie: jwtToken, HttpOnly, SameSite=Strict, Secure=${cookie.secure:false}

OTP (Passwordless Login)
    └─► SecureRandom 6-digit code, 5-minute TTL, stored in otp_verifications table

Ballot Traffic Protection
    └─► Fixed-size request padding (PKCS#7) — all ballot submit requests identical in byte size
```

### Cryptographic Specifications

| Layer | Algorithm | Key Size | Standard |
|---|---|---|---|
| Vote Encryption | ElGamal (ElectionGuard) | 4096-bit group | ElectionGuard Spec 2.1 |
| Guardian Key Protection | ML-KEM-1024 (Kyber) | 1024-bit | NIST FIPS 203 |
| Symmetric Wrapping | AES-256-CBC | 256-bit | FIPS 197 |
| Key Derivation | Scrypt (N=65536) | 32-byte output | RFC 7914 |
| Session Tokens | HMAC-SHA256 | 256-bit | RFC 7519 |
| Data Integrity | SHA-256 | 256-bit | FIPS 180-4 |
| Passwords | BCrypt | strength=12 | — |
| Blockchain (optional) | ECDSA / keccak256 | 256-bit | Ethereum EIP-55 |

### Threshold Decryption — Mathematical Summary

Given `n` guardians and quorum `k` (where `k ≤ n`):

- Each guardian `i` holds secret share `s_i` from a degree-`(k-1)` polynomial
- Joint public key: `K = g^(s_1 + s_2 + ... + s_n) mod p`
- Homomorphic tally: multiply all ciphertexts → `(∏αⱼ, ∏βⱼ)`
- Each guardian computes partial decryption: `Mᵢ = α^(sᵢ)`
- Lagrange combination: `M = ∏ Mᵢ^(λᵢ)` where `λᵢ` are Lagrange basis coefficients
- Final result: `votes = log_g(∏βⱼ / M)` via baby-step giant-step table

For **absent guardians**, present guardians use backup polynomial evaluations to reconstruct missing shares via Lagrange interpolation with `CompensatedDecryptionShares`.

### End-to-End Verifiability

Any voter can independently verify:
1. **Their ballot was cast** — tracking code found in public bulletin board
2. **Their ballot was not modified** — ciphertext matches bulletin board entry
3. **Their ballot was counted** — included in encrypted tally (verifiable via submitted_ballots table)
4. **The tally was correctly decrypted** — Chaum-Pedersen ZK proofs downloadable per election
5. **Blockchain anchoring** (optional) — transaction hash proves ballot recorded before election end

---

## RabbitMQ Worker Architecture

The worker architecture solves the core memory problem of large elections.

### The Problem

An election with 10,000 ballots requires:
- ~50 tally chunks (200 ballots/chunk) → each produces megabytes of ciphertext data
- 5 guardian partial decryption phases → 250 tasks
- Processing sequentially in JVM: all 10,000 ballot ciphertexts accumulate in Hibernate L1 cache → OOM
- No parallelism across guardians → sequential bottleneck hours long

### The Solution: Worker Queues + Round-Robin Scheduling

```
RoundRobinTaskScheduler (100ms tick, in-memory, not persistent):

  Task A registerd: Election 1 Tally (500 chunks)
  Task B registered: Election 2 Tally (50 chunks)
  Task C registered: Guardian X Partial Decrypt (500 chunks)

Per 100ms tick:
  → Selects next eligible Task (currentIndex round-robin)
  → Checks: only 1 in-flight chunk per task allowed (MAX_QUEUED_CHUNKS_PER_TASK=1)
  → Publishes message to appropriate RabbitMQ queue
  → Moves to next task

Result: All elections and all guardians make progress simultaneously — no starvation
```

**Key invariants:**
- `MAX_QUEUED_CHUNKS_PER_TASK = 1` — Never more than 1 unacknowledged message per election/guardian
- `prefetch=1` — RabbitMQ consumer never takes message N+1 until N is acknowledged
- After each chunk: `entityManager.clear()` + `System.gc()` releases all cached entities
- `TARGET_CHUNKS_PER_CYCLE = 8` — Maximum chunks published per scheduler tick across all tasks
- Retry delays: 5s → 10s → 20s (3 attempts) on ElectionGuard service failure

### Four Processing Queues

| Queue Name | Exchange | Input Payload | Output |
|---|---|---|---|
| `tally.creation.queue` | `task.exchange` (Direct, durable) | 200 ballot IDs | `election_center.encrypted_tally` |
| `partial.decryption.queue` | `task.exchange` | Tally chunk + guardian key from Redis | `decryptions.tally_share` |
| `compensated.decryption.queue` | `task.exchange` | Tally chunk + backup polynomials | `compensated_decryptions` row |
| `combine.decryption.queue` | `task.exchange` | All shares for 1 chunk | `election_center.election_result` |

Full documentation: [RABBITMQ.md](docs/services/RABBITMQ.md)

---

## Network & Infrastructure

### Docker Network: `election_net`

Bridge network, subnet `172.20.0.0/24`, gateway `172.20.0.1`:

| Service | Dev IP | Prod IP | Memory Limit (prod) |
|---|---|---|---|
| `electionguard-api` | `172.20.0.10` | `172.20.0.10` | 768 MiB |
| `electionguard-worker` | `172.20.0.11` | `172.20.0.11` | 1536 MiB |
| `postgres` | N/A (Neon Cloud) | `172.20.0.20` | 512 MiB |
| `backend` | `172.20.0.30` | `172.20.0.30` | 1280 MiB |
| `frontend` | `172.20.0.40` | `172.20.0.40` | 256 MiB |
| `prometheus` | N/A | `172.20.0.50` | 256 MiB |
| `rabbitmq` (dev) | `172.20.0.60` | N/A | — |
| `rabbitmq` (prod) | N/A | `172.20.0.25` | 512 MiB |
| `redis` (dev) | `172.20.0.70` | N/A | — |
| `redis` (prod) | N/A | `172.20.0.75` | 256 MiB |
| `grafana` | N/A | `172.20.0.60` | 256 MiB |

### Nginx Reverse Proxy Configuration

File: `nginx-proxy.conf` — deployed external to Docker or as a host-level Nginx config.

| Location | Upstream | Timeout | Notes |
|---|---|---|---|
| `/api/` | `backend:8080` (least_conn) | 600s | `client_max_body_size 4G`; `proxy_buffering off` |
| `/rabbitmq/` | `rabbitmq:15672` | 60s | Management UI proxy |
| `/` | `frontend:80` | 60s | SPA catch-all (`try_files $uri /index.html`) |
| `/health` | — | — | Direct 200 `"healthy"` response |

**Server names:** `localhost amarvote2025.me www.amarvote2025.me _`

**Security headers applied:**
```
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
X-Request-ID: $request_id   (per-request unique ID for log correlation)
```

**HTTPS:** TLS block included but commented out; ready for certificates at `amarvote2025.me` (TLS 1.2/1.3).

**Production JVM flags** (`docker-compose.prod.yml`):
```
-Xms512m -Xmx1024m -XX:+UseG1GC -XX:MaxGCPauseMillis=200
-XX:+ExitOnOutOfMemoryError -XX:+HeapDumpOnOutOfMemoryError
```

---

## Project Structure

```
AmarVote/
│
├── 📱 frontend/                         React 19 + Vite SPA
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.jsx                 Landing page with animated hero
│   │   │   ├── Dashboard.jsx            Election listing and management
│   │   │   ├── ElectionPage.jsx         4974-line main election management (8 sub-sections)
│   │   │   │   ├─ Overview              Election details + status timeline
│   │   │   │   ├─ Voting Booth          Encrypted ballot cast UI
│   │   │   │   ├─ Tally                 Initiate tally + live chunk progress
│   │   │   │   ├─ Partial Decryption    Guardian credential submission
│   │   │   │   ├─ Compensated           Absent guardian compensation tracking
│   │   │   │   ├─ Combine               Combine shares + final result
│   │   │   │   ├─ Results               AnimatedResults charts (Recharts)
│   │   │   │   └─ Verification          Blockchain ballot lookup
│   │   │   ├── CreateElection.jsx       Multi-step election creation form
│   │   │   ├── Profile.jsx              User profile management
│   │   │   ├── OtpLogin.jsx             Email OTP authentication (passwordless)
│   │   │   ├── AdminLogin.jsx           Admin panel login
│   │   │   └── ApiLogs.jsx              Admin API request audit viewer
│   │   ├── components/
│   │   │   ├── AnimatedResults.jsx      Animated bar/pie chart election results
│   │   │   ├── Chatbot.jsx              AI assistant sidebar (DeepSeek + RAG)
│   │   │   ├── TallyCreationModal.jsx   Real-time tally progress modal
│   │   │   ├── DecryptionProgressModal  Per-guardian decryption live progress
│   │   │   ├── CombineProgressModal     Combine phase live progress
│   │   │   ├── WorkerProceedings.jsx    Worker log table (all phases)
│   │   │   ├── GuardianDataDisplay.jsx  Guardian keys + sequence display
│   │   │   ├── Navbar.jsx               Responsive navigation
│   │   │   └── ProtectedRoute.jsx       Auth guard HOC
│   │   ├── utils/
│   │   │   ├── api.js                   Core fetch wrapper (CSRF, auth, 5-min timeout)
│   │   │   ├── electionApi.js           Election-specific API functions
│   │   │   ├── ballotPadding.js         Fixed-size PKCS#7 anti-traffic-analysis padding
│   │   │   └── timezoneUtils.js         UTC ↔ local time conversion
│   │   └── __tests__/                   6 Vitest test files
│   ├── vite.config.js                   Proxy /api → http://backend:8080 (300s timeout)
│   ├── Dockerfile / Dockerfile.dev
│   └── package.json
│
├── 🚀 backend/                          Spring Boot 3.5, Java 21
│   └── src/main/java/com/amarvote/amarvote/
│       ├── controller/
│       │   ├── ElectionController.java  30+ endpoints: elections, voting, tally, decode
│       │   ├── AdminController.java     3 endpoints: admin login, API logs, log stats
│       │   ├── ChatbotController.java   1 endpoint: /chatbot/chat (5-intent routing)
│       │   ├── OtpAuthController.java   4 endpoints: request-otp, verify, session, logout
│       │   └── WorkerLogController.java 5 endpoints: summary + per-phase logs
│       ├── service/
│       │   ├── ElectionService.java         Create, list, manage elections
│       │   ├── BallotService.java           Encrypt, cast, spoil ballots
│       │   ├── TallyService.java            Initiate tally, schedule chunks
│       │   ├── PartialDecryptionService.java Guardian credential + schedule decryption
│       │   ├── CompensatedDecryptionService  Absent guardian handling
│       │   ├── CombineDecryptionService.java Initiate combine tasks
│       │   ├── TaskWorkerService.java        RabbitMQ message listeners (4 queues)
│       │   ├── TaskPublisherService.java     RabbitMQ message publisher
│       │   ├── RoundRobinTaskScheduler.java  In-memory fair scheduler (100ms tick)
│       │   ├── ChunkingService.java          Ballot shuffling + 200-ballot chunking
│       │   ├── CredentialCacheService.java   Redis guardian key cache (360-min TTL)
│       │   ├── RedisLockService.java         SET NX distributed locks
│       │   ├── ElectionGuardService.java     HTTP client to EG API (Resilience4j wrapped)
│       │   ├── EmailService.java             Gmail SMTP credential delivery
│       │   ├── BlockchainService.java        Web client to blockchain microservice
│       │   ├── RAGService.java               Web client to RAG service
│       │   ├── ChatbotService.java           DeepSeek LLM integration + intent routing
│       │   ├── CloudinaryService.java        Candidate image upload
│       │   ├── OtpService.java               SecureRandom OTP generation + validation
│       │   └── ApiLogService.java            Request/response audit logging
│       ├── model/                           14 JPA entities (see Database section)
│       ├── dto/                             ~60 request/response DTO classes
│       ├── config/
│       │   ├── RabbitMQConfig.java          4 queues + direct exchange config
│       │   ├── RedisConfig.java             Lettuce pool + serializer
│       │   ├── SecurityConfig.java          Public vs authenticated endpoints
│       │   ├── CorsConfig.java              Allowed origins
│       │   ├── WebClientConfig.java         Resilience4j circuit-breaker on EG calls
│       │   └── CloudinaryConfig.java        SDK initialization
│       ├── filter/
│       │   └── JWTFilter.java               Extract jwtToken cookie → SecurityContext
│       └── repository/                      Spring Data JPA repositories
│   ├── src/main/resources/application.properties
│   ├── pom.xml
│   └── Dockerfile / Dockerfile.dev
│
├── 🔐 Microservice/                     ElectionGuard Python 3.12
│   ├── api.py                           Flask app (1739 lines) — all EG operations
│   ├── services/
│   │   ├── setup_guardians.py           Automated 3-round key ceremony (221 lines)
│   │   ├── guardian_key_ceremony.py     Manual key submission ceremony (470 lines)
│   │   ├── create_encrypted_ballot.py   ElGamal ballot encryption + ZK proof
│   │   ├── create_encrypted_tally.py    Homomorphic tally aggregation
│   │   ├── create_partial_decryption.py Per-guardian partial decryption share
│   │   ├── create_compensated_decryption_shares.py  Lagrange interpolation
│   │   └── combine_decryption_shares.py Final result assembly
│   ├── tests/                           9 Python test files
│   ├── Dockerfile.api / Dockerfile.worker
│   └── requirements.txt
│
├── ⛓️ blockchain/                       Optional: Ganache + Solidity smart contracts
│   ├── contracts/VotingContract.sol     Solidity ^0.8.19 — ballot recording + election logs
│   ├── migrations/                      Truffle migration scripts
│   └── truffle-config.js                Network ID 1337, Ganache @ port 8545
│
├── 🔗 blockchain-microservice/          Optional: Flask + Web3.py API
│   ├── app/app.py                       Flask app (462 lines): 6 REST endpoints
│   └── requirements.txt                Flask 2.3.3, web3 6.11.1, gunicorn
│
├── 🤖 rag-service/                      Optional: RAG AI assistant
│   ├── app.py                           Flask app: /health, /search, /context, /reindex, /documents
│   ├── rag_processor.py                 LangChain RAG pipeline (RecursiveCharacterTextSplitter)
│   ├── AmarVote_User_Guide.md           Knowledge base: platform usage guide
│   ├── data/EG_Spec_2_1.pdf             Knowledge base: ElectionGuard Spec 2.1
│   └── requirements.txt                LangChain 0.1.20, ChromaDB 0.5.0, sentence-transformers 3.0.1
│
├── 🗄️ Database/
│   ├── creation/                        Full PostgreSQL schema SQL (15 tables, indexes, extensions)
│   ├── deletion/                        Teardown scripts
│   ├── init/                            Docker init scripts
│   ├── maintenance/                     Vacuum / analyze scripts
│   ├── diagnostics/                     Performance queries
│   └── emergency/                       Data recovery procedures
│
├── 📊 prometheus/
│   └── prometheus.yml                  Scrape: 172.20.0.30:8080/actuator/prometheus every 15s
│
├── 🐳 Docker files
│   ├── docker-compose.yml              Dev: Neon Cloud DB + core services
│   ├── docker-compose.prod.yml         Prod: local PG 15 + all services + memory limits + monitoring
│   ├── rabbitmq.conf                   vm_memory_high_watermark=0.4, disk_free_limit=1GB
│   └── nginx-proxy.conf                Reverse proxy; /api, /, /health, security headers
│
└── 📚 docs/
    └── services/
        ├── BACKEND.md                  Spring Boot deep dive
        ├── FRONTEND.md                 React app deep dive
        ├── ELECTIONGUARD.md            Cryptographic microservice deep dive
        ├── RABBITMQ.md                 Worker architecture deep dive
        ├── REDIS.md                    Cache and counter usage
        ├── DATABASE.md                 Full schema reference (15 tables)
        ├── BLOCKCHAIN.md               Smart contract and blockchain API
        ├── RAG.md                      AI assistant service
        └── MONITORING.md               Prometheus + Grafana setup
```

---

## Quick Start — Development

### Prerequisites

- Docker Desktop with Docker Compose
- Git
- 8 GB RAM recommended (4 GB minimum with swap)
- Neon Cloud PostgreSQL account (free tier sufficient)
- Gmail account for SMTP (or any SMTP provider)

### 1. Clone

```bash
git clone https://github.com/TAR2003/AmarVote.git
cd AmarVote
```

### 2. Configure Environment

Create `.env` in project root:

```env
# ─── Database (Neon Cloud — Development) ─────────────────────
NEON_HOST=your-neon-host.neon.tech
NEON_PORT=5432
NEON_DATABASE=neondb
NEON_USERNAME=your-username
NEON_PASSWORD=your-password

# ─── Security (Required) ──────────────────────────────────────
JWT_SECRET=your-jwt-secret-minimum-32-chars
MASTER_KEY_PQ=your-base64-encoded-32-byte-key

# ─── Email (Gmail SMTP) ───────────────────────────────────────
MAIL_PASSWORD=your-gmail-app-password

# ─── Cloudinary (Image Uploads) ──────────────────────────────
CLOUDINARY_NAME=your-cloudinary-name
CLOUDINARY_KEY=your-cloudinary-api-key
CLOUDINARY_SECRET=your-cloudinary-api-secret

# ─── AI Chatbot (Optional — chatbot disabled if omitted) ─────
DEEPSEEK_API_KEY=your-openrouter-api-key
```

> **Generate MASTER_KEY_PQ (PowerShell):**
> ```powershell
> python -c "import secrets,base64; print(base64.b64encode(secrets.token_bytes(32)).decode())"
> ```

### 3. Start Services

```bash
docker-compose up -d

# Check all are running
docker-compose ps

# Stream logs from backend
docker-compose logs -f backend

# Check ElectionGuard health
curl http://localhost:5000/health
```

### 4. Initialize Database

Connect to Neon Cloud and run:
```bash
psql "your-neon-connection-string" -f Database/creation/table_creation_file_AmarVote.sql
```

Or use Neon's web SQL console.

### 5. Access Points (Dev)

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8080 |
| ElectionGuard API | http://localhost:5000/health |
| RabbitMQ Management | http://localhost:15672 (guest / guest) |

---

## Quick Start — Production

### Prerequisites

- Linux server, 4–8 GB RAM (with swap)
- Docker + Docker Compose installed
- Ports 80, 443, 8080, 9090, 3000, 15672 accessible

### 1. Configure Production Environment

```env
# All dev vars plus:
GF_SECURITY_ADMIN_PASSWORD=your-grafana-admin-password
LOG_PASSWORD=your-admin-panel-password
RABBITMQ_USERNAME=amarvote
RABBITMQ_PASSWORD=strong-rabbitmq-password
SPRING_REDIS_PASSWORD=strong-redis-password
cookie.secure=true
```

### 2. Create Swap (if RAM < 8 GB)

```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile swap swap defaults 0 0' | sudo tee -a /etc/fstab
```

### 3. Deploy

```bash
docker-compose -f docker-compose.prod.yml up -d

# Verify
curl http://localhost:8080/actuator/health
curl http://localhost:5000/health
```

### 4. Access Points (Prod)

| Service | URL |
|---|---|
| Frontend | http://your-server |
| Backend API | http://your-server:8080 |
| Prometheus | http://your-server:9090 |
| Grafana | http://your-server:3000 |
| RabbitMQ Dashboard | http://your-server:15672 |

---

## Environment Variables Reference

### Required — Core

| Variable | Description |
|---|---|
| `JWT_SECRET` | HMAC-SHA256 signing key (minimum 32 characters) |
| `MASTER_KEY_PQ` | Base64-encoded 32-byte master key for ML-KEM-1024 guardian key wrapping |
| `MAIL_PASSWORD` | Gmail App Password for `amarvote2025@gmail.com` |
| `CLOUDINARY_NAME` | Cloudinary cloud name (candidate image uploads) |
| `CLOUDINARY_KEY` | Cloudinary API key |
| `CLOUDINARY_SECRET` | Cloudinary API secret |

### Required — Development Database (Neon Cloud)

| Variable | Description |
|---|---|
| `NEON_HOST` | Neon PostgreSQL hostname |
| `NEON_PORT` | Port (5432) |
| `NEON_DATABASE` | Database name |
| `NEON_USERNAME` | Username |
| `NEON_PASSWORD` | Password |

### Optional / Defaulted

| Variable | Default | Description |
|---|---|---|
| `RABBITMQ_HOST` | `rabbitmq` | RabbitMQ container hostname |
| `RABBITMQ_PORT` | `5672` | AMQP port |
| `RABBITMQ_USERNAME` | `guest` | Change this in production |
| `RABBITMQ_PASSWORD` | `guest` | Change this in production |
| `SPRING_REDIS_HOST` | `redis` | Redis hostname |
| `SPRING_REDIS_PORT` | `6379` | Redis port |
| `SPRING_REDIS_PASSWORD` | _(empty)_ | Set for production |
| `DEEPSEEK_API_KEY` | — | OpenRouter API key (chatbot AI) |
| `LOG_PASSWORD` | `amarvote123` | Admin panel login password |
| `GF_SECURITY_ADMIN_PASSWORD` | — | Grafana admin password (prod only) |
| `VOTING_API_URL` | — | Blockchain microservice URL (optional feature) |
| `cookie.secure` | `false` | Set `true` when serving over HTTPS |
| `EG_API_URL` | `http://electionguard-api:5000` | ElectionGuard API container URL |
| `EG_WORKER_URL` | `http://electionguard-worker:5001` | ElectionGuard Worker container URL |

---

## Service Access Points

| Service | Dev URL | Prod URL | Authentication |
|---|---|---|---|
| **Frontend** | http://localhost:5173 | http://your-server | Public |
| **Backend API** | http://localhost:8080 | http://your-server:8080 | `jwtToken` HttpOnly cookie |
| **ElectionGuard API** | http://localhost:5000/health | http://your-server:5000/health | Internal only |
| **RabbitMQ UI** | http://localhost:15672 | http://your-server:15672 | guest/guest (change in prod) |
| **Prometheus** | N/A | http://your-server:9090 | None |
| **Grafana** | N/A | http://your-server:3000 | admin / GF_SECURITY_ADMIN_PASSWORD |
| **RAG Service** | N/A (disabled) | N/A (optional) | Internal |
| **Blockchain API** | N/A (disabled) | N/A (optional) | Internal |

---

## REST API Quick Reference

All endpoints use prefix `/api`. Authentication via `jwtToken` HttpOnly cookie.
All state-mutating endpoints require `X-XSRF-TOKEN` header (CSRF protection).

### Authentication (OTP-based Passwordless)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/request-otp` | Public | Send 6-digit OTP to email (5-min TTL) |
| POST | `/api/auth/verify-otp` | Public | Verify OTP → set `jwtToken` cookie (7 days) |
| GET | `/api/auth/session` | Public | Check session validity; returns username if active |
| POST | `/api/auth/logout` | Authenticated | Clear `jwtToken` cookie |

### Elections

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/create-election` | Authenticated | Create election + trigger key ceremony |
| GET | `/api/all-elections` | Authenticated | All elections user can access |
| GET | `/api/election/{id}` | Authenticated | Full election detail |
| GET | `/api/election/{id}/results` | Authenticated | Final results (post-decryption) |
| GET | `/api/election/{id}/guardians` | Authenticated | Guardian list with sequence and status |

### Voting

| Method | Endpoint | Auth | Content-Type | Description |
|---|---|---|---|---|
| POST | `/api/eligibility` | Authenticated | JSON | Check if user is in allowed_voters and hasn't voted |
| POST | `/api/create-encrypted-ballot` | Authenticated | `application/octet-stream` | Encrypt vote (PKCS#7-padded binary) |
| POST | `/api/benaloh-challenge` | Authenticated | JSON | Spoil ballot to receive encryption nonce for verification |
| POST | `/api/cast-encrypted-ballot` | Authenticated | JSON | Cast a previously encrypted ballot |

### Tally & Decryption

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/initiate-tally` | Authenticated | Start async tally creation |
| GET | `/api/election/{id}/tally-status` | Authenticated | Tally chunk progress (completed/total) |
| POST | `/api/guardian/initiate-decryption` | Authenticated | Submit guardian credentials → start partial decryption |
| GET | `/api/guardian/decryption-status/{electionId}` | Authenticated | Per-guardian decryption chunk progress |
| POST | `/api/initiate-combine` | Authenticated | Start combine operation |
| GET | `/api/combine-status/{electionId}` | Authenticated | Combine chunk progress |

### Blockchain Ballot Verification (Public)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/blockchain/ballot/{electionId}/{trackingCode}` | Public | Verify specific ballot on blockchain |
| GET | `/api/blockchain/logs/{electionId}` | Public | Get all blockchain event logs for election |

### Admin

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/admin/login` | Public | Admin login with LOG_PASSWORD → admin JWT |
| GET | `/api/admin/logs` | Admin JWT | Paginated API audit logs |
| GET | `/api/admin/logs/stats` | Admin JWT | Log statistics (by endpoint, method, status) |

### AI Chatbot

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/chatbot/chat` | Public | Body: `{ userMessage, sessionId }` → response string |

The chatbot routes queries to one of 5 intents:
- `GENERAL_VOTING` — generic voting questions (uses system prompt only)
- `AMARVOTE_USER_GUIDE` — platform how-to (queries RAG service if enabled)
- `ELECTIONGUARD_TECHNICAL` — EG cryptography details (queries RAG with EG Spec PDF)
- `BANGLADESH_VOTING` — Bangladesh election context (specialized system prompt)
- `IRRELEVANT` — off-topic → polite redirect

### Worker Logs

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/worker-logs/summary/{electionId}` | Authenticated | All phases summary |
| GET | `/api/worker-logs/tally/{electionId}` | Authenticated | Tally phase worker logs |
| GET | `/api/worker-logs/decryption/partial/{electionId}` | Authenticated | Partial decryption logs |
| GET | `/api/worker-logs/decryption/compensated/{electionId}` | Authenticated | Compensated decryption logs |
| GET | `/api/worker-logs/combine/{electionId}` | Authenticated | Combine phase logs |

Full API documentation with request/response schemas: [BACKEND.md](docs/services/BACKEND.md)

---

## Database Schema Overview

PostgreSQL 15 with 15 tables, `uuid-ossp` and `pgcrypto` extensions enabled.

Full schema with all columns, types, and foreign keys: [DATABASE.md](docs/services/DATABASE.md)

| Table | Primary Key | Purpose |
|---|---|---|
| `elections` | `election_id` (UUID) | Election config: title, dates, guardian count, quorum, joint_public_key |
| `election_center` | `election_center_id` (UUID) | Encrypted tally chunks + final result JSON |
| `guardians` | `guardian_id` (UUID) | Guardian emails, PQ-encrypted key_backup, decryption status |
| `election_choices` | `choice_id` (UUID) | Candidates: name, party, image, final vote_count |
| `ballots` | `ballot_id` (UUID) | All cast encrypted ballots: ciphertext, tracking_code, timestamp |
| `allowed_voters` | `voter_id` (UUID) | Eligible voter emails + `has_voted` boolean |
| `submitted_ballots` | `submitted_ballot_id` (UUID) | Maps ballots to tally chunks (election_center FK) |
| `decryptions` | `decryption_id` (UUID) | Guardian partial decryption shares (tally_share JSON) |
| `compensated_decryptions` | `compensated_id` (UUID) | Cross-guardian compensation shares (Lagrange interpolation) |
| `election_jobs` | `job_id` (UUID) | Background job lifecycle (created/processing/done/failed) |
| `tally_worker_log` | `log_id` (UUID) | Per-chunk tally timing: start_time, end_time, status, chunk_index |
| `decryption_worker_log` | `log_id` (UUID) | Per-chunk decryption timing per guardian |
| `combine_worker_log` | `log_id` (UUID) | Per-chunk combine timing |
| `api_logs` | `log_id` (UUID) | Full HTTP audit: method, path, status, user, body, request_id, duration_ms |
| `otp_verifications` | `otp_id` (UUID) | OTP code, email, `created_at`, 5-min TTL enforced in service |

### Key Relationships

```
elections ──► guardians (election_id)
elections ──► election_choices (election_id)
elections ──► ballots (election_id)
elections ──► allowed_voters (election_id)
elections ──► election_center (election_id)
election_center ──► submitted_ballots (election_center_id)
election_center ──► decryptions (election_center_id)
election_center ──► compensated_decryptions (election_center_id)
guardians ──► decryptions (guardian_id)
guardians ──► compensated_decryptions (guardian_id, missing_guardian_id)
```

---

## Security Model

### Threat Mitigation Matrix

| Threat | Mitigation | Layer |
|---|---|---|
| Ballot stuffing | Bot detection (FingerprintJS BotD) + OTP auth + `allowed_voters` table | Application |
| Double voting | `has_voted` flag set atomically on ballot cast | Database |
| Vote buying | Benaloh challenge — observer cannot confirm actual encrypted choice | Cryptographic |
| Traffic analysis | Fixed-size ballot payloads (PKCS#7 padding to constant size) | Transport |
| Quantum attacks | ML-KEM-1024 (Kyber) for guardian private key storage | Cryptographic |
| Weak passwords | BCrypt strength=12 (admin); users have no password (OTP only) | Application |
| Session hijacking | HttpOnly + SameSite=Strict cookies; HTTPS in production | Transport |
| CSRF attacks | `X-XSRF-TOKEN` header required on all mutations | Application |
| Guardian key theft | PQ-encrypted at rest; Redis cache with 6h TTL; explicit cleanup post-use | Infrastructure |
| Single point of decryption | Threshold (k-of-n): any quorum subset can decrypt; no single party has full key | Cryptographic |
| Insider manipulation | All ballots encrypted before submission; admin has no decryption power | Cryptographic |
| Audit evasion | All HTTP requests logged to `api_logs`; optional blockchain anchoring | Audit |
| OOM / Denial of Service | RabbitMQ chunking + per-chunk GC prevents JVM heap overflow | Infrastructure |
| API abuse | Rate limiting via Resilience4j + Nginx `limit_req` (configurable) | Infrastructure |

### Public Endpoints (No Authentication Required)

```
POST /api/auth/request-otp
POST /api/auth/verify-otp
POST /api/auth/logout
GET  /api/auth/session
POST /api/admin/login
POST /api/chatbot/chat
GET  /api/blockchain/ballot/**        ← Public ballot verification
GET  /api/blockchain/logs/**          ← Public blockchain event logs
GET  /actuator/health
GET  /actuator/prometheus             ← Metrics (consider restricting in prod)
GET  /actuator/metrics
```

---

## Testing

### Backend (Java / Spring Boot)

```bash
cd backend
./mvnw test                              # All tests
./mvnw test -Dtest=BallotServiceTest     # Specific class
./mvnw test jacoco:report                # Coverage → target/site/jacoco/index.html
```

Test files: `AmarvoteApplicationTests`, `ElectionServiceTest`, `EmailServiceTest`

### Frontend (React / Vitest)

```bash
cd frontend
npm test                    # Run all tests once
npm run test:watch          # Watch mode (re-runs on file changes)
npm run test:ui             # Vitest browser UI
npm run test:coverage       # Generate Istanbul coverage report
```

Test files: `App.test`, `Hello.test`, `Home.test`, `Login.test`, `integration.test`, `utils.test`

### ElectionGuard (Python / pytest)

```bash
cd Microservice
pip install -r requirements.txt
python -m pytest tests/ -v
python -m pytest tests/ --cov=. --cov-report=html
```

Test files (9 total):
- `test_ballot_encryption.py`
- `test_tally_creation.py`
- `test_partial_decryption.py`
- `test_compensated_decryption.py`
- `test_combine_decryption.py`
- `test_key_ceremony.py`
- `test_ballot_sanitization.py`
- `test_benaloh_challenge.py`
- `test_integration.py`

### Integration Testing

```bash
# Full pipeline smoke test
docker-compose up -d
# Open test_worker_api.html in browser — exercises tally/decrypt pipeline end-to-end
```

---

## Optional Services

### Enabling RAG AI Assistant

The RAG service grounds chatbot answers in AmarVote's own documentation and ElectionGuard Spec 2.1.

1. Uncomment `rag-service` block in `docker-compose.yml`
2. Set `DEEPSEEK_API_KEY` in `.env`
3. The chatbot at `/api/chatbot/chat` will automatically use RAG for `AMARVOTE_USER_GUIDE` and `ELECTIONGUARD_TECHNICAL` intents

**Knowledge base documents:**
- `rag-service/AmarVote_User_Guide.md` — Platform usage documentation
- `rag-service/data/EG_Spec_2_1.pdf` — ElectionGuard Specification 2.1

**Stack:** Flask + LangChain 0.1.20 + ChromaDB 0.5.0 + sentence-transformers 3.0.1 + `all-MiniLM-L6-v2` embeddings

Full documentation: [RAG.md](docs/services/RAG.md)

### Enabling Blockchain Verification

Provides an immutable ballot audit trail on a local Ethereum blockchain (Ganache).

1. Uncomment in `docker-compose.yml`:
   ```yaml
   # ganache:
   # blockchain-deployer:
   # voting-api:
   ```
2. Set `VOTING_API_URL=http://voting-api:5002` in backend environment

**Smart contract functions** (`VotingContract.sol`, Solidity ^0.8.19):
- `createElection(uint256 electionId)` — Register election
- `recordBallot(uint256 electionId, string trackingCode, bytes32 ballotHash)` — Anchor ballot
- `verifyBallot(uint256 electionId, string trackingCode)` — Returns ballot hash
- `getElectionLogs(uint256 electionId)` — Returns all events for an election

**Blockchain microservice endpoints** (Port 5002):
- `POST /create-election` — Deploy election to contract
- `POST /record-ballot` — Add ballot hash to chain
- `GET /verify-ballot` — Verify ballot exists
- `GET /ballot/{id}/{code}` — Get ballot record
- `GET /get-logs/{election_id}` — Get all election blockchain events
- `GET /health` — Health check

Full documentation: [BLOCKCHAIN.md](docs/services/BLOCKCHAIN.md)

---

## Deployment Configurations

### Feature Comparison

| Feature | `docker-compose.yml` (Dev) | `docker-compose.prod.yml` (Prod) |
|---|---|---|
| Database | Neon Cloud (remote) | Local PostgreSQL 15 container |
| Hot reload | ✅ Dockerfile.dev + volume mounts | ❌ Optimized build |
| Memory limits | ❌ None | ✅ All services capped |
| JVM tuning | ❌ Default | ✅ G1GC, -Xmx1024m, ExitOnOOM |
| Monitoring | ❌ None | ✅ Prometheus + Grafana |
| DB init scripts | ❌ Manual | ✅ `Database/init/` auto-applied |
| RAG service | ❌ Commented out | ❌ Commented out (add if needed) |
| Blockchain | ❌ Commented out | ❌ Not in prod config |
| Redis IP | `172.20.0.70` | `172.20.0.75` |
| RabbitMQ IP | `172.20.0.60` | `172.20.0.25` |

### RabbitMQ Configuration (`rabbitmq.conf`)

```
vm_memory_high_watermark.relative = 0.4     # Flow control at 40% RAM = ~200MB
disk_free_limit.absolute = 1GB              # Stop accepting messages if < 1GB disk
default_vhost = /
default_user = guest
default_pass = guest
default_permissions.configure = .*
default_permissions.write = .*
default_permissions.read = .*
```

---

## Performance & Memory

### Processing Throughput (Single Instance Baseline)

| Operation | Approximate Rate | Notes |
|---|---|---|
| Ballot encryption | ~100 req/sec | EG API container |
| Vote casting (full) | ~50 req/sec | Includes DB write |
| Tally chunk | ~8 seconds/chunk | 200 ballots, 4 workers |
| Partial decryption | ~15 seconds/chunk | Per guardian |
| Combine chunk | ~10 seconds/chunk | All shares assembled |

### Memory Stability Under Load

With the worker architecture:
- 10,000-ballot election → 50 tally chunks → Spring JVM heap stays stable at ~512MB
- 5 guardians × 50 chunks = 250 partial decrypt tasks → no accumulation (entityManager.clear after each)
- Redis credential TTL: 6 hours → auto-purge prevents stale guardian key leakage
- RabbitMQ `prefetch=1` prevents consumer memory spikes

### Scaling

```
# More tally throughput — increase worker concurrency
rabbitmq.worker.concurrency.min=8
rabbitmq.worker.concurrency.max=8

# More simultaneous elections — round-robin scheduler handles N elections natively

# Horizontal scaling — run multiple backend replicas
# (stateless: JWT + Redis + RabbitMQ are external)
# Set up Nginx `upstream backend { server backend1:8080; server backend2:8080; }`
```

---

## Monitoring

Production monitoring via Prometheus + Grafana at ports 9090 and 3000.

### Prometheus Scrape Config (`prometheus/prometheus.yml`)

```yaml
scrape_configs:
  - job_name: 'spring-boot-backend'
    metrics_path: '/actuator/prometheus'
    scrape_interval: 15s
    static_configs:
      - targets: ['172.20.0.30:8080']
```

### Key Metric Categories

| Category | Metric Prefix | Includes |
|---|---|---|
| JVM Heap | `jvm_memory_used_bytes` | heap, non-heap, GC pauses |
| HTTP | `http_server_requests_seconds` | rate, latency, 4xx/5xx |
| HikariCP | `hikaricp_connections_*` | active, idle, pending, timeout |
| RabbitMQ | `rabbitmq_*` | queued messages, consumers, publish rate |
| Spring AMQP | `spring_rabbitmq_listener_*` | task listener durations |

### Recommended Grafana Dashboards

| Dashboard | ID | Purpose |
|---|---|---|
| Spring Boot Statistics | 4701 | JVM + HTTP + Hikari |
| Spring Boot 3.x | 6756 | Updated Spring metrics |
| RabbitMQ Overview | 10991 | Queue depths, rates |
| HikariCP | 14046 | DB pool health |

Full documentation: [MONITORING.md](docs/services/MONITORING.md)

---

## Contributing

### Development Workflow

```bash
# Fork and clone
git clone https://github.com/TAR2003/AmarVote.git
cd AmarVote

# Create feature branch
git checkout -b feature/your-feature-name

# Start dev environment
docker-compose up -d

# Implement changes

# Run tests
./mvnw test -f backend/pom.xml
cd frontend && npm test

# Commit (use conventional commits)
git commit -m "feat: add guardian email retry logic"

# Push and open PR
git push origin feature/your-feature-name
```

### Code Standards

| Layer | Standard |
|---|---|
| Java | Google Java Style Guide |
| JavaScript / JSX | Airbnb Style Guide (ESLint enforced) |
| Python | PEP 8 |
| Solidity | Solidity Style Guide |
| SQL | Capitalize keywords, lowercase identifiers |

---

## License

AmarVote is released under the **MIT License**.

It incorporates the following open-source components under their respective licenses:

| Component | License |
|---|---|
| ElectionGuard (Microsoft) | MIT |
| Spring Boot | Apache 2.0 |
| React | MIT |
| PostgreSQL | PostgreSQL License |
| RabbitMQ | Mozilla Public License 2.0 |
| Redis | BSD 3-Clause |
| Ganache | MIT |
| Web3.py | MIT |
| LangChain | MIT |
| pqcrypto | MIT |

---

## Repository & External Links

- **GitHub Repository:** [https://github.com/TAR2003/AmarVote](https://github.com/TAR2003/AmarVote)
- **ElectionGuard SDK:** [https://github.com/microsoft/electionguard](https://github.com/microsoft/electionguard)
- **NIST PQC (ML-KEM-1024 / Kyber):** [https://csrc.nist.gov/projects/post-quantum-cryptography](https://csrc.nist.gov/projects/post-quantum-cryptography)
- **ElectionGuard Specification 2.1:** [https://www.electionguard.vote/spec/](https://www.electionguard.vote/spec/)
- **Platform Features Demo:** [https://youtu.be/ixsvvl_7qVo](https://youtu.be/ixsvvl_7qVo)
- **Infrastructure Overview:** [https://youtu.be/t8VOLdYIV40](https://youtu.be/t8VOLdYIV40)

---

## Service Documentation Index

| Document | Contents |
|---|---|
| [docs/services/BACKEND.md](docs/services/BACKEND.md) | All 30+ REST endpoints, 22 services, 14 JPA entities, RabbitMQ/Redis config, HikariCP, Resilience4j |
| [docs/services/FRONTEND.md](docs/services/FRONTEND.md) | All pages, components, API clients, bot detection, ballot padding, Vitest tests |
| [docs/services/ELECTIONGUARD.md](docs/services/ELECTIONGUARD.md) | Two-container split, all EG operations, ML-KEM-1024 key wrapping, msgpack, 9 test files |
| [docs/services/RABBITMQ.md](docs/services/RABBITMQ.md) | 4 queues, RoundRobinTaskScheduler algorithm, full pipeline, retry logic, failure handling |
| [docs/services/REDIS.md](docs/services/REDIS.md) | Key schema (`guardian:privatekey:{electionId}:{guardianId}`), TTLs, atomic counters, distributed locks |
| [docs/services/DATABASE.md](docs/services/DATABASE.md) | All 15 tables with every column, type, constraint, index, and FK relationship |
| [docs/services/BLOCKCHAIN.md](docs/services/BLOCKCHAIN.md) | VotingContract.sol full reference, 6 Flask API endpoints, Web3.py, Ganache, how to enable |
| [docs/services/RAG.md](docs/services/RAG.md) | LangChain pipeline, ChromaDB, 2 knowledge base docs, 5 endpoints, how to enable |
| [docs/services/MONITORING.md](docs/services/MONITORING.md) | Prometheus scrape config, all metric families, Grafana dashboard IDs, alerting rules |

---

*Built with dedication by the AmarVote team — securing democracy, one cryptographic proof at a time.*
