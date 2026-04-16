# AmarVote

AmarVote is a multi-service voting platform repository with a React frontend, a Spring Boot backend, ElectionGuard-based cryptographic services, and infrastructure for queueing, caching, persistence, reverse proxying, and monitoring.

This README is intentionally based on code and configuration present in this repository. It avoids claims that are not directly supported by the current source tree.

## Repository Status At A Glance

- Primary orchestration is containerized with Docker Compose.
- Active compose topology includes frontend, backend, ElectionGuard API/worker, PostgreSQL, Redis, RabbitMQ, Nginx, Prometheus, and Grafana.
- Repository also contains optional or separately deployable modules (blockchain stack and RAG service) that are present in code but not active in the default compose files.

## Core Architecture

```text
Browser
  -> Nginx reverse proxy
      -> Frontend (React/Vite, served via Nginx in container)
      -> Backend (Spring Boot REST API)
          -> PostgreSQL (persistent state)
          -> Redis (temporary secure cache + counters/locks)
          -> RabbitMQ (async chunk task queues)
          -> ElectionGuard API (fast crypto endpoints)
          -> ElectionGuard Worker (heavy crypto endpoints)
          -> Optional integrations (Blockchain microservice, RAG service)

Monitoring:
  Prometheus scrapes backend /actuator/prometheus
  Grafana visualizes metrics
```

## Top-Level Repository Map

### Directories

- `backend/`: Java 21 + Spring Boot 3.5 service (main orchestration API).
- `frontend/`: React 19 + Vite SPA.
- `Microservice/`: Python ElectionGuard service code, including `api.py`, service modules, and tests.
- `Database/`: SQL scripts grouped by lifecycle operations (`creation`, `maintenance`, `cleanup`, etc.).
- `blockchain/`: Solidity + Truffle project (`contracts`, `migrations`, `scripts`).
- `blockchain-microservice/`: Flask + Web3 API that wraps smart-contract operations.
- `rag-service/`: Flask + LangChain + Chroma retrieval service.
- `nginx/`: TLS/cert-related Nginx assets.
- `prometheus/`: Prometheus scrape configuration.
- `docs/`: extensive project and service documentation, runbooks, and implementation notes.
- `test-results/`: test artifacts.

### Key Root Files

- `docker-compose.yml`: main stack definition.
- `docker-compose.local.yml`: local/development variant.
- `docker-compose.prod.yml`: production-oriented variant.
- `nginx-proxy.dev.conf`: dev reverse proxy rules.
- `nginx-proxy.conf`: HTTPS production reverse proxy and hardening config.
- `rabbitmq.conf`: RabbitMQ runtime config.
- `init-letsencrypt.sh`: certificate setup helper.
- `infrastructure.txt`: infrastructure notes (contains sensitive examples; treat as confidential).
- `.github/workflows/ci.yml`: CI build/test workflow.
- `.github/workflows/docker-deploy.yml`: remote VM deployment workflow.

## Services And Runtime Topology

### Services Active In Compose Files

| Service | Tech | Container Role | Default Internal Port |
|---|---|---|---|
| `frontend` | React + Vite build, served by Nginx | Web UI | `80` |
| `backend` | Spring Boot 3.5 / Java 21 | Main API and orchestration | `8080` |
| `electionguard-api` | Flask / Python | Fast cryptographic endpoints | `5000` |
| `electionguard-worker` | Flask / Python | Heavy cryptographic endpoints | `5001` |
| `postgres` | PostgreSQL 15 alpine | Primary relational store | `5432` |
| `redis` | Redis 7 alpine | Key cache, counters, distributed guards | `6379` |
| `rabbitmq` | RabbitMQ 3.13 management | Task queue/broker | `5672` (`15672` mgmt) |
| `nginx` | Nginx alpine | Reverse proxy | `80` |
| `prometheus` | Prometheus | Metrics collection | `9090` |
| `grafana` | Grafana | Metrics dashboarding | `3000` |

### Services Present In Repo But Not Active By Default Compose

| Service | Location | Purpose |
|---|---|---|
| Blockchain contract project | `blockchain/` | Solidity smart contract compilation and migration (Truffle) |
| Blockchain API microservice | `blockchain-microservice/` | Flask endpoints for election/ballot on-chain operations |
| RAG service | `rag-service/` | Retrieval-augmented context service for chatbot |

## Technology Stack (From Manifests)

### Backend (`backend/pom.xml`)

- Java 21
- Spring Boot 3.5.0
- Spring Web + Security + Validation + Data JPA + Actuator + Mail
- RabbitMQ via Spring AMQP
- Redis via Spring Data Redis
- PostgreSQL driver
- Resilience4j (`2.1.0`)
- JWT (`jjwt 0.12.6`)
- Cloudinary (`1.38.0`)
- MessagePack (`jackson-dataformat-msgpack 0.9.8`)

### Frontend (`frontend/package.json`)

- React 19.1
- React Router DOM 7.6
- Vite 6.3
- Tailwind CSS 3.4
- Vitest + Testing Library
- Framer Motion, Recharts, jsPDF, BotD, Axios

### ElectionGuard Service (`Microservice/requirements.txt`)

- Flask/FastAPI packages present
- ElectionGuard support libraries and utilities
- `pqcrypto`, `cryptography`, `msgpack`, `gmpy2`, `psycopg2-binary`, `gunicorn`

### Blockchain API (`blockchain-microservice/requirements.txt`)

- Flask 2.3.3
- web3 6.11.1
- gunicorn
- requests

### RAG Service (`rag-service/requirements.txt`)

- Flask 3.0, flask-cors
- langchain + langchain-community
- chromadb, sentence-transformers, faiss-cpu
- pypdf, openai, tiktoken

## Main Functional Areas

### 1. Authentication And User Access

Backend provides OTP/password-related and profile routes under `/api/auth` (from `OtpAuthController`).

Examples:
- `/api/auth/register/send-email-code`
- `/api/auth/login`
- `/api/auth/request-otp`
- `/api/auth/verify-otp`
- `/api/auth/session`
- `/api/auth/logout`

There is also authorized-user management under `/api/authorized-users`.

### 2. Election Lifecycle And Voting

Primary election routes are under `/api` (`ElectionController`).

Implemented groups include:
- Election creation and retrieval (`/create-election`, `/all-elections`, `/election/{id}`)
- Guardian key ceremony routes (`/guardian/key-ceremony/...`, `/admin/key-ceremony/...`)
- Ballot encryption and casting (`/create-encrypted-ballot`, `/cast-encrypted-ballot`, `/benaloh-challenge`)
- Eligibility checks (`/eligibility`)
- Tally/decryption/combine orchestration (`/initiate-tally`, `/guardian/initiate-decryption`, `/initiate-combine`, status endpoints)
- Results and audit retrieval (`/election/{id}/results`, worker logs, blockchain lookup proxies)

### 3. ElectionGuard Cryptographic Service

From `Microservice/api.py`, key endpoints include:

- `/setup_guardians`
- `/generate_guardian_credentials`
- `/generate_guardian_backup_shares`
- `/combine_guardian_public_keys`
- `/create_encrypted_ballot`
- `/benaloh_challenge`
- `/create_encrypted_tally`
- `/create_partial_decryption`
- `/create_compensated_decryption`
- `/combine_decryption_shares`
- `/health`

Additional helper endpoints also exist for ballot publication and crypto utility operations (`/ballots/*`, `/publish_ballot`, `/api/encrypt`, `/api/decrypt`, `/api/health`).

### 4. Async Worker Pipeline

Backend queue processing uses RabbitMQ with separate queues for:

- Tally creation
- Partial decryption
- Compensated decryption
- Combine decryption

Worker log tables and controller endpoints exist for per-phase observability (`/api/worker-logs/...`).

### 5. Monitoring

- Backend exposes Actuator metrics at `/actuator/prometheus`.
- Prometheus scrapes backend target `172.20.0.30:8080` per `prometheus/prometheus.yml`.
- Grafana is configured as a dashboard UI service.

### 6. Optional Blockchain Integration

`blockchain-microservice/app/app.py` defines endpoints such as:

- `GET /health`
- `POST /create-election`
- `POST /record-ballot`
- `GET /verify-ballot`
- `GET /ballot/<election_id>/<tracking_code>`

Backend includes blockchain-related API proxy/read routes in `ElectionController`.

### 7. Optional RAG Integration

`rag-service/app.py` defines:

- `GET /health`
- `POST /search`
- `POST /context`
- `POST /reindex`
- `GET /documents`

Backend has chatbot and RAG health/chat routes in `ChatbotController` and `ChatController`.

## Frontend Application Routes

From `frontend/src/App.jsx`:

### Public

- `/`
- `/login`
- `/register`
- `/forgot-password`
- `/about`
- `/features`
- `/how-it-works`
- `/architecture`
- `/security`
- `/hello`

### Authenticated Layout

- `/dashboard`
- `/create-election`
- `/election-page/:id`
- `/election-page/:id/:tab`
- `/all-elections`
- `/profile`
- `/authenticated-users`
- `/api-logs`

Authenticated users also get chatbot UI mounted globally.

## Configuration And Environment Variables

### Root `.env`

Compose files expect `.env` for secrets and runtime configuration.

Common variable names referenced in compose or application config include:

- `MASTER_KEY_PQ`
- `JWT_SECRET`
- `MAIL_PASSWORD`
- `DEEPSEEK_API_KEY`
- `CLOUDINARY_NAME`
- `CLOUDINARY_KEY`
- `CLOUDINARY_SECRET`
- `GF_SECURITY_ADMIN_PASSWORD`
- `VOTING_API_URL`
- `ADMIN_EMAILS`

Do not commit real secrets. If a historical file includes real values, rotate them.

### Backend Config Source

Main backend settings live in:

- `backend/src/main/resources/application.properties`

Notable settings present there:

- DB, RabbitMQ, Redis, ElectionGuard service URLs
- HikariCP pool tuning
- chunk size (`amarvote.chunking.chunk-size=200`)
- OTP validity minutes
- Actuator/Prometheus exposure

## Running The Project

### Prerequisites

- Docker Desktop / Docker Engine + Docker Compose plugin
- Git
- Enough RAM for multi-container stack

### Start (Default Stack)

```bash
docker compose up --build
```

### Start (Local Variant)

```bash
docker compose -f docker-compose.local.yml up --build
```

### Start (Production Variant)

```bash
docker compose --env-file .env -f docker-compose.prod.yml up --build -d
```

### Stop

```bash
docker compose down
```

For production file:

```bash
docker compose --env-file .env -f docker-compose.prod.yml down
```

## Service Access Notes

Access ports differ by compose variant. Confirm against the exact compose file you are running.

Commonly exposed examples:

- Frontend or proxy HTTP: `80` or `8088`
- Backend API (usually behind Nginx): internal `8080`
- RabbitMQ AMQP: `5672`
- RabbitMQ management UI: `15672` (often localhost-bound)
- Redis: `6379` (often localhost-bound)
- Prometheus: `9090` (often localhost-bound)
- Grafana: `3000` (often localhost-bound)

## Reverse Proxy Profiles

- `nginx-proxy.dev.conf`: simple dev routing (`/api` -> backend, `/` -> frontend).
- `nginx-proxy.conf`: production TLS, redirects, security headers, rate limiting, static asset caching, and sensitive-path blocking.

## Testing And Quality

### Backend

From `backend/`:

```bash
./mvnw test
```

or on Windows:

```powershell
.\mvnw.cmd test
```

### Frontend

From `frontend/`:

```bash
npm ci
npm run lint
npx vitest run
npx vitest run --coverage
```

### Python Service Tests

ElectionGuard and RAG directories contain Python test files. Run with the corresponding virtual environment/dependencies for each service.

## CI/CD In This Repository

### Continuous Integration

Defined in `.github/workflows/ci.yml`:

- Backend: JDK 21 setup, Maven build/test.
- Frontend: Node 20 setup, install, lint (best-effort), test, coverage, build.

### Deployment Workflow

Defined in `.github/workflows/docker-deploy.yml`:

- Trigger: push to `main`.
- Copies project to remote VM via SSH/rsync.
- Runs compose deployment using `docker-compose.prod.yml`.

## Data Layer And SQL Assets

- Runtime DB is PostgreSQL.
- SQL assets are organized in `Database/` by lifecycle intent:
  - `creation/`
  - `init/`
  - `maintenance/`
  - `cleanup/`
  - `deletion/`
  - `diagnostics/`
  - `emergency/`

Entity and migration behavior is also influenced by JPA auto-update settings in backend configuration.

## Documentation Index

### Service Docs

- `docs/services/BACKEND.md`
- `docs/services/FRONTEND.md`
- `docs/services/ELECTIONGUARD.md`
- `docs/services/RABBITMQ.md`
- `docs/services/REDIS.md`
- `docs/services/DATABASE.md`
- `docs/services/MONITORING.md`
- `docs/services/BLOCKCHAIN.md`
- `docs/services/RAG.md`

### Architecture And Operational Notes

The `docs/` directory contains many implementation summaries and runbooks (queueing, memory fixes, decryption flow, deployment guides, etc.). Use those files for deep operational details.

## Honesty And Source-Of-Truth Notes

- This repository contains historical docs and implementation notes from multiple phases; some files may reflect older behavior.
- For current runtime behavior, use this precedence:
  1. Source code (`backend/`, `frontend/`, `Microservice/`, service apps)
  2. Active compose file in use
  3. Current proxy and app config files
  4. Supplemental docs in `docs/`

If you are onboarding or preparing production rollout, verify final routes, secrets, and integration toggles against the exact branch and compose profile you deploy.

## Contributing

1. Create a branch from your working baseline.
2. Keep changes scoped per service when possible.
3. Run relevant tests locally before opening PR.
4. Update service docs in `docs/services/` if API or operational behavior changes.
