# Architecture Decisions (Current)

This document explains **why** AmarVote uses the current architecture after the guardian-flow redesign.

## 1) Split orchestration and cryptography

Decision:
- Keep Spring Boot as orchestration/business API.
- Keep ElectionGuard operations in Python services.

Why:
- ElectionGuard-native operations are easier and safer to maintain close to Python SDK primitives.
- Backend remains focused on auth, eligibility, workflow/state, and persistence.

---

## 2) Fast API + Worker split for ElectionGuard

Decision:
- `electionguard-api` handles synchronous/interactive operations.
- `electionguard-worker` handles long-running batch operations.

Why:
- Prevents heavy tally/decryption jobs from degrading voter-facing latency.
- Improves operational isolation and makes scaling strategy clearer.
- Reduces blast radius when one phase becomes expensive.

---

## 3) Queue-based chunked processing

Decision:
- Tally and decryption phases are chunked and processed through RabbitMQ.

Why:
- Avoids large in-memory spikes.
- Supports fair scheduling across elections.
- Enables retries and progress visibility per chunk.

---

## 4) Decentralized guardian key ceremony (new)

Decision:
- Election starts in `key_ceremony_pending`.
- Each guardian performs Round 1 keypair submission and Round 2 backup-share submission.
- Admin activates only after completeness checks.

Why:
- Reduces trust concentration in a single server-side ceremony process.
- Gives guardians direct participation and accountability.
- Produces clearer ceremony state transitions for auditability.

---

## 5) Encrypt guardian credentials with local-password-assisted flow

Decision:
- Guardian submission includes local encryption password used for credential protection flow.
- Round 2 uses guardian credential file to generate backup shares.

Why:
- Improves control over sensitive guardian material lifecycle.
- Keeps operational decryption flow compatible with backend orchestration.

---

## 6) PostgreSQL + Redis dual data model

Decision:
- PostgreSQL stores durable election, ballot, guardian, and progress data.
- Redis stores short-lived operational data (credentials cache/counters/locks).

Why:
- Separates durability from speed/ephemeral needs.
- Keeps state management explicit by persistence class.

---

## 7) Why not all-in-one synchronous processing

Rejected approach:
- Single service doing key ceremony, encryption, tally, decryption synchronously.

Reasons rejected:
- Poor resilience under load.
- Harder to reason about memory/latency behavior.
- Increased risk of user-facing timeout during heavy cryptographic phases.

---

## Summary

The architecture is intentionally designed for:
- security separation
- operational resilience
- predictable performance
- explicit ceremony governance
- scalable cryptographic processing
