# 🔐 ElectionGuard Microservice

**Technology:** Python 3.12 · Flask · Gunicorn · ElectionGuard SDK  
**Split into two containers:**

| Container | Internal URL | Port | Role |
|---|---|---|---|
| `electionguard-api` | `http://electionguard-api:5000` | `5000` | Fast, user-facing operations |
| `electionguard-worker` | `http://electionguard-worker:5001` | `5001` | Heavy cryptographic operations |

**Network IPs:** `172.20.0.10` (api), `172.20.0.11` (worker)  
**Memory Limits (prod):** `768 MiB` (api), `1536 MiB` (worker)

---

## Table of Contents

1. [Overview](#overview)
2. [Why Two Instances?](#why-two-instances)
3. [Technology Stack](#technology-stack)
4. [Project Structure](#project-structure)
5. [Post-Quantum Cryptography](#post-quantum-cryptography)
6. [Serialization Strategy](#serialization-strategy)
7. [API Endpoints — Fast API (Port 5000)](#api-endpoints--fast-api-port-5000)
8. [API Endpoints — Worker (Port 5001)](#api-endpoints--worker-port-5001)
9. [ElectionGuard Operations](#electionguard-operations)
   - [Guardian Setup (Key Ceremony)](#guardian-setup-key-ceremony)
   - [Ballot Encryption](#ballot-encryption)
   - [Benaloh Challenge](#benaloh-challenge)
   - [Encrypted Tally Creation](#encrypted-tally-creation)
   - [Partial Decryption](#partial-decryption)
   - [Compensated Decryption](#compensated-decryption)
   - [Combine Decryption Shares](#combine-decryption-shares)
10. [Security Configuration](#security-configuration)
11. [Performance Optimizations](#performance-optimizations)
12. [Dependencies](#dependencies)
13. [Testing](#testing)

---

## Overview

The ElectionGuard Python microservice implements Microsoft's ElectionGuard 2.x end-to-end verifiable voting specification. It performs all cryptographic operations:

- **Key ceremony**: Distributed guardian key generation with Shamir secret sharing
- **Ballot encryption**: ElGamal homomorphic encryption of individual votes
- **Benaloh challenge**: Ballot spoil/verify for end-to-end verifiability
- **Homomorphic tallying**: Aggregating encrypted ballots without decrypting
- **Partial decryption**: Each guardian contributes a share to decrypt the tally
- **Compensated decryption**: Present guardians regenerate absent guardians' shares via Lagrange interpolation
- **Decryption share combination**: Assembling final plaintext results + Chaum-Pedersen proofs

All big-number arithmetic uses Python's arbitrary-precision integers; ElectionGuard uses 4096-bit ElGamal.

---

## Why Two Instances?

The microservice is split to isolate fast and slow operations:

**Fast API (`electionguard-api:5000`)** — millisecond-to-second operations:
- Guardian setup (called once at election creation)
- Ballot encryption (called per voter interaction, must be fast)
- Benalah challenge

**Worker (`electionguard-worker:5001`)** — multi-second to multi-minute operations:
- Tally creation (aggregates hundreds to thousands of ballots)
- Partial decryption (memory intensive)
- Compensated decryption (Lagrange computation)
- Combine decryption shares (final result assembly)

This split prevents slow background jobs from blocking interactive voting operations.

---

## Technology Stack

| Package | Purpose |
|---|---|
| Python 3.12 | Runtime |
| Flask | HTTP framework |
| Gunicorn | Production WSGI server |
| ElectionGuard (Microsoft) | E2E-V cryptographic library |
| `pqcrypto` | ML-KEM-1024 (Kyber1024) post-quantum KEM |
| `cryptography` | AES-CBC, Scrypt KDF, HKDF, HMAC for key wrapping |
| `msgpack` | Binary serialization (10–50× faster than JSON for big integers) |
| `gmpy2` | GMP-backed big integer arithmetic |
| `psutil` | Memory monitoring |
| `python-dotenv` | Environment variable loading |
| `psycopg2-binary` | PostgreSQL adapter (for any direct DB access) |

---

## Project Structure

```
Microservice/
├── api.py                             ← Main Flask application (1739 lines)
├── ballot_publisher.py                ← Ballot broadcast helpers
├── ballot_sanitizer.py                ← Input sanitization layer
├── binary_serialize.py                ← Msgpack encode/decode utilities
├── manifest_cache.py                  ← Election manifest in-memory cache
├── __init__.py
│
├── services/
│   ├── setup_guardians.py             ← Automated key ceremony (221 lines)
│   ├── guardian_key_ceremony.py       ← Manual key ceremony (470 lines)
│   ├── create_encrypted_ballot.py     ← Ballot encryption
│   ├── create_encrypted_tally.py      ← Homomorphic tally aggregation
│   ├── create_partial_decryption.py   ← Guardian partial decryption
│   ├── create_partial_decryption_shares.py
│   ├── create_compensated_decryption_shares.py ← Lagrange compensation
│   ├── combine_decryption_shares.py   ← Final result assembly
│   ├── decrypt.py                     ← Low-level decryption helpers
│   ├── encrypt.py                     ← Low-level encryption helpers
│   ├── benaloh_challenge.py           ← Benaloh challenge protocol
│   └── __init__.py
│
├── electionguard/                     ← Microsoft ElectionGuard SDK
├── electionguard_tools/               ← Utility wrappers over the SDK
├── tests/                             ← Python test suite (9 test files)
│   ├── encrypt_decrypt_test.py
│   ├── test-api-with-time.py
│   ├── test-api.py
│   ├── test_ballot_sanitization.py
│   ├── test_benaloh_challenge.py
│   ├── test_benaloh_final.py
│   ├── test_benaloh_simple.py
│   ├── test_secure_api.py
│   └── verify_api_integration.py
│
├── requirements.txt
├── Dockerfile                         ← Base image
├── Dockerfile.api                     ← Fast API container
└── Dockerfile.worker                  ← Worker container
```

---

## Post-Quantum Cryptography

The microservice uses **ML-KEM-1024** (CRYSTALS-Kyber, NIST FIPS 203 standardized) to protect guardian private keys at rest.

### Algorithm: ML-KEM-1024

- **Type:** Key Encapsulation Mechanism (KEM)
- **Security level:** NIST Level 5 (equivalent to AES-256)
- **Resistant to:** Shor's quantum algorithm (that would break RSA/ECC)

### Key Wrapping Flow

```
Election Creation:
  For each guardian:
    1. ElectionGuard generates (private_key, public_key) pair
    2. Derive guardian-specific wrapping key from MASTER_KEY_PQ + guardian_email
    3. ML-KEM-1024 encapsulate → (ciphertext, shared_secret)
    4. AES-256-CBC encrypt private_key using derived shared_secret
    5. Store ciphertext + encrypted_private_key in guardian.key_backup

Guardian Decryption:
    1. Guardian presents their PQ-wrapped credentials
    2. ML-KEM-1024 decapsulate → shared_secret
    3. AES-256-CBC decrypt → private_key
    4. Private key stored in Redis (6h TTL) for use by workers
    5. Workers retrieve key from Redis per task
```

### Configuration

```python
PQ_ALGORITHM = "ML-KEM-1024"
SCRYPT_N = 2**16          # ~65ms hash time (memory-hard)
AES_KEY_LENGTH = 32       # AES-256
PASSWORD_LENGTH = 32
MASTER_KEY = os.environ.get('MASTER_KEY_PQ')  # base64-decoded 32-byte key
```

`PQ_AVAILABLE` flag guards all PQ usage — if `pqcrypto` cannot be imported, fallback encryption is used.

---

## Serialization Strategy

### Why msgpack?

ElectionGuard operates on 4096-bit integers (≈1240 decimal digits). JSON encoding of these as strings is slow. **msgpack binary serialization** achieves 10–50× speed improvement for large tally/decryption payloads.

### Transport Protocol

Java (backend) → Python (microservice):
- Java serializes task data via `Jackson2JsonMessageConverter` to RabbitMQ queue
- Python worker receives and processes
- **Before msgpack encoding:** `BigInteger` values are converted to decimal strings (msgpack cannot natively serialize Java `BigInteger`)
- **After msgpack decoding:** `bytes` → `str` conversion via `_bytes_to_str_deep(obj)`

### Helper Functions in `api.py`

| Function | Description |
|---|---|
| `serialize_dict_to_string(data, label)` | Dict → base64(msgpack(dict)) |
| `deserialize_string_to_dict(data, label)` | base64 string → dict |
| `serialize_list_of_dicts_to_list_of_strings(data, label)` | List[dict] → List[base64 string] |
| `deserialize_list_of_strings_to_list_of_dicts(data, label)` | List[base64 string] → List[dict] |
| `get_request_data()` | Parses `application/msgpack` or `application/json` body |
| `_bytes_to_str_deep(obj)` | Recursively converts bytes→str for msgpack raw mode |
| `_sanitize_for_msgpack(obj)` | Fixes lone surrogate characters before encoding |

---

## API Endpoints — Fast API (Port 5000)

### `GET /health`

Returns service health status.

```json
{ "status": "healthy", "service": "electionguard-api" }
```

### `POST /setup_guardians`

Performs the complete ElectionGuard key ceremony automatically.

**Body:**
```json
{
  "number_of_guardians": 3,
  "quorum": 2,
  "party_names": ["Party A", "Party B"],
  "candidate_names": ["Alice", "Bob"]
}
```

**Response:**
```json
{
  "guardians": [...],
  "joint_public_key": "decimal string (4096-bit integer)",
  "commitment_hash": "decimal string",
  "guardian_data": [
    {
      "id": "1",
      "sequence_order": 1,
      "election_public_key": "binary (msgpack encoded)",
      "backups": { "guardian_id": "binary" }
    }
  ],
  "private_keys": [{ "guardian_id": "1", "private_key": "decimal string" }],
  "public_keys":  [{ "guardian_id": "1", "public_key": "decimal string" }],
  "polynomials":  [{ "guardian_id": "1", "polynomial": "binary" }],
  "number_of_guardians": 3,
  "quorum": 2
}
```

### `POST /create_encrypted_ballot`

Encrypts a single ballot using the election's joint public key.

**Body:**
```json
{
  "candidate_name": "Alice",
  "ballot_id": "ballot_123",
  "joint_public_key": "decimal string",
  "commitment_hash": "decimal string",
  "manifest": "base64-msgpack encoded manifest"
}
```

**Response:** Encrypted ballot ciphertext + ElectionGuard zero-knowledge proof.

### `POST /benaloh_challenge`

Performs a Benalah challenge: allows a voter to demand the decryption key for their ballot (spoiling it) to verify the encryption was done correctly, then re-vote.

---

## API Endpoints — Worker (Port 5001)

### `POST /create_encrypted_tally`

Homomorphically aggregates all encrypted ballots for a chunk.

**Input:** List of ballot ciphertexts (as msgpack-encoded strings), manifest, joint public key.

**Output:** Encrypted tally ciphertext (homomorphic sum of all ballots in the chunk).  
Result stored in `election_center.encrypted_tally`.

**Why chunked?** A full election with 10,000 ballots cannot be processed in one request without OOM. The backend splits ballots into ~200-ballot chunks via `ChunkingService`.

### `POST /create_partial_decryption`

Guardian-specific partial decryption of the tally.

**Input:**
```json
{
  "guardian_id": "1",
  "guardian_private_key": "decimal string (from Redis cache)",
  "ciphertext_tally": "msgpack encoded tally",
  "submitted_ballots": ["msgpack encoded ballot list"],
  "manifest": "...",
  "joint_public_key": "...",
  "quorum": 2,
  "guardian_data": [...]
}
```

**Output:** `{ tally_share, ballot_shares, guardian_decryption_key }`  
Stored in `decryptions` table.

**Mathematical operation:** Computes $g^{a_i \cdot q}$ for each guardian $i$ where $a_i$ is the guardian's secret key share.

### `POST /create_compensated_decryption`

Compensates for absent guardians using Lagrange interpolation.

**Input:**
- `compensating_guardian_id`: the present guardian performing compensation
- `missing_guardian_id`: the absent guardian being compensated for
- `compensating_guardian_private_key`: compensating guardian's key from Redis
- `polynomial_backup`: the compensating guardian's backup polynomial for the missing guardian

**Output:** `{ compensated_tally_share, compensated_ballot_shares }`  
Stored in `compensated_decryptions` table.

**Mathematical operation:** Uses Lagrange basis coefficients to reconstruct the missing guardian's decryption share.

### `POST /combine_decryption_shares`

Combines all partial and compensated decryption shares to produce the final plaintext tally.

**Input:** All guardian decryption keys, tally shares, ballot shares, compensated shares.

**Output:** Final election result JSON with per-candidate vote counts + Chaum-Pedersen verification proofs.  
Stored in `election_center.election_result`.

---

## ElectionGuard Operations

### Guardian Setup (Key Ceremony)

Implemented in `services/setup_guardians.py` — fully automated ceremony:

```python
def setup_guardians_service(number_of_guardians, quorum, party_names, candidate_names):
    # Step 1: Create guardians with unique IDs
    guardians = [Guardian.from_nonce(str(i+1), i+1, n, quorum) for i in range(n)]
    
    # Step 2: Initialize mediator
    mediator = KeyCeremonyMediator("mediator", CeremonyDetails(n, quorum))
    
    # Round 1: Key announcement
    for g in guardians:
        mediator.announce(g.share_key())
    for i, g1 in enumerate(guardians):
        for j, g2 in enumerate(guardians):
            if i != j:
                g1.save_guardian_key(mediator.share_key(g2.id))
    
    # Round 2: Partial key backup generation and distribution
    for g in guardians:
        g.generate_election_partial_key_backups()
    for i, g1 in enumerate(guardians):
        for j, g2 in enumerate(guardians):
            if i != j:
                backup = mediator.share_election_partial_key_backup(g1.id, g2.id)
                g2.save_election_partial_key_backup(backup)
    
    # Round 3: Backup verification
    for g1 in guardians:
        for g2 in guardians:
            if g1 != g2:
                verification = g1.verify_election_partial_key_backup(g2.id)
                mediator.receive_election_partial_key_verification(verification)
    
    # Publish joint key
    joint_key = mediator.publish_joint_key()
    return { 'joint_public_key': ..., 'commitment_hash': ..., 'guardian_data': ..., ... }
```

There is also a **manual ceremony** (`services/guardian_key_ceremony.py`) for scenarios where guardians bring their own keys — `GuardianKeyCeremonyState` allows guardians to submit existing (private_key, public_key) pairs which are validated by checking $g^{private\_key} \equiv public\_key \pmod{p}$.

### Ballot Encryption

1. `create_election_manifest(party_names, candidate_names)` — builds `Manifest` with `ContestDescription(vote_variation=VoteVariationType.one_of_m, number_elected=1)`
2. `BallotFactory` creates a `PlaintextBallot` for the selected candidate
3. `InternalManifest` + `ElectionContext` constructed from joint public key
4. ElectionGuard encrypts using El-Gamal with Schnorr proof of plaintext validity

### Benaloh Challenge

Allows the voter to challenge the encryption of their ballot:
1. Voter receives encrypted ballot
2. Voter requests challenge → gets the nonce used for encryption
3. Voter (or any verifier) recomputes encryption with the nonce → verifies it matches
4. Ballot is spoiled (cannot be counted)
5. Voter re-encrypts and re-casts

### Encrypted Tally Creation

El-Gamal homomorphic property: $\text{Enc}(a) \cdot \text{Enc}(b) = \text{Enc}(a + b)$

All ballot ciphertexts for a contest are multiplied together → encrypted sum without decryption.

### Partial Decryption

Threshold decryption: requires `quorum` of `number_of_guardians` shares.

Each guardian $i$ computes: $M_i = A^{s_i}$ where $A$ is the ciphertext first component and $s_i$ is the guardian's private key share.

With $t$ shares $M_1, \ldots, M_t$, the decryption is:
$$M = \prod_{i \in S} M_i^{\lambda_i}$$
where $\lambda_i$ are Lagrange basis coefficients.

### Compensated Decryption

If guardian $j$ is absent, each present guardian $i$ computes a compensation share using guardian $j$'s polynomial backup at point $j$:
$$M_{i,j} = A^{P_i(j)}$$
where $P_i(j)$ is guardian $i$'s polynomial evaluated at position $j$.

---

## Security Configuration

```python
# Flask config
NO MAX_CONTENT_LENGTH   # Unlimited upload size (large tally payloads)
REQUEST_TIMEOUT  = 300  # 5 minutes
RESPONSE_TIMEOUT = 300  # 5 minutes
JSON_SORT_KEYS   = False

# Multiprocessing
multiprocessing.set_start_method('spawn')  # Required for Docker (prevents fork deadlock)
```

**Request tracking:** Every request gets a UUID, with start/complete/failed logged and last 100 requests retained in `request_tracking` dict.

**ElectionGuard logging:** Suppressed to WARNING level (the SDK generates verbose debug output including 512-char hex blobs via `inspect.stack()` which adds 2–5s per endpoint call).

---

## Performance Optimizations

1. **Msgpack serialization** — 10–50× faster than JSON for big-integer-heavy payloads
2. **Two-container split** — fast operations never wait on heavy operations
3. **Reduced EG logging** — eliminates `inspect.stack()` overhead in SDK internals
4. **Multiprocessing `spawn` mode** — prevents deadlocks in Docker forked processes
5. **Manifest caching** — `manifest_cache.py` caches election manifests in memory to avoid recomputation

---

## Dependencies

```
flask, gunicorn               ← Web framework + production server
pqcrypto                      ← ML-KEM-1024 (Kyber1024)
cryptography                  ← AES-CBC, Scrypt, HKDF, HMAC
msgpack                       ← Binary serialization
gmpy2                         ← Optimized big-integer arithmetic (GMP)
psutil                        ← Memory monitoring
python-dotenv                 ← .env support
psycopg2-binary               ← PostgreSQL
requests                      ← HTTP client for inter-service calls
pydantic, dacite, click       ← Data validation and CLI
pytest + hypothesis + coverage ← Test framework
```

---

## Testing

```bash
cd Microservice
python -m pytest tests/             # Run all tests
python -m pytest tests/ -v          # Verbose output
python -m pytest tests/ --cov=. --cov-report=html  # Coverage report
```

**Test Files:**

| File | Purpose |
|---|---|
| `encrypt_decrypt_test.py` | Full encryption → decryption round-trip |
| `test-api.py` | HTTP API integration tests |
| `test-api-with-time.py` | Performance timing tests |
| `test_ballot_sanitization.py` | Input sanitization validation |
| `test_benaloh_challenge.py` | Benaloh challenge protocol |
| `test_benaloh_final.py` | Benaloh challenge complete flow |
| `test_benaloh_simple.py` | Simple Benaloh unit test |
| `test_secure_api.py` | Security-focused API tests |
| `verify_api_integration.py` | Integration verification |

**Coverage target:** 70%+ (core cryptographic operations fully covered).
