# Client Workflow Guide (Frontend-Facing)

This guide is for clients/stakeholders to understand the live application flow.

## 1) Authentication

1. User enters email.
2. OTP is sent and verified.
3. Session is established via secure cookie.

---

## 2) Election creation (admin)

1. Admin creates election with candidates, guardians, quorum, and metadata.
2. Election is created in `key_ceremony_pending`.
3. Guardians are assigned and invited to complete ceremony tasks.

---

## 3) Guardian key ceremony (new flow)

### Round 1: Keypair generation + submission
- Guardian opens `/key-ceremony`.
- Generates credentials for a pending election.
- Submits ceremony payload.
- Downloads local credentials file.

### Round 2: Encrypted backup-share submission
- Starts only after all guardians finish Round 1.
- Guardian uploads local credentials file.
- Generates encrypted backup shares.
- Submits backup payload.

### Admin completion
- Admin monitors ceremony status.
- Admin activates election when all requirements are met.

---

## 4) Voting flow

1. Voter enters election page.
2. Voter chooses candidate(s).
3. Frontend requests encrypted ballot creation.
4. Optional Benaloh challenge can be performed.
5. Voter casts encrypted ballot.

---

## 5) Tally and decryption flow

1. Admin initiates tally.
2. Backend chunks tasks and pushes to RabbitMQ.
3. Worker processes tally + decryption phases.
4. Frontend shows progress and status.
5. Final results become available after combine completes.

---

## 6) Why users see phased progress screens

The platform intentionally shows phased statuses because the cryptographic workload is asynchronous and auditable by design. This improves:
- transparency
- fault recovery
- large-election performance

---

## 7) Primary user-facing screens

- `/dashboard`
- `/key-ceremony`
- `/election-page/:id`
- `/election-page/:id/:tab`
- `/how-it-works`
- `/architecture`
- `/security`
