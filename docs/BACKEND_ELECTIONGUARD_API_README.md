# Backend to ElectionGuard Microservice Calls

This document lists every backend call to the ElectionGuard microservice, with request body shapes and a clear split between the ElectionGuard API service and the ElectionGuard Worker service.

## Transport and Routing

- Backend uses `ElectionGuardService.postRequest()` which sends MessagePack (`application/msgpack`).
- GET requests use plain JSON.
- Routing to API vs Worker is based on endpoint name:
  - **Worker**: `/create_encrypted_tally`, `/create_partial_decryption`, `/create_compensated_decryption`, `/combine_decryption_shares`
  - **API**: everything else (for example `/setup_guardians`, `/create_encrypted_ballot`, `/benaloh_challenge`, `/api/encrypt`, `/api/decrypt`).

## ElectionGuard API Service (lightweight operations)

### POST `/setup_guardians`

Request body (`ElectionGuardianSetupRequest`):

```json
{
  "number_of_guardians": 3,
  "quorum": 2,
  "party_names": ["string"],
  "candidate_names": ["string"]
}
```

### POST `/create_encrypted_ballot`

Request body (`ElectionGuardBallotRequest`):

```json
{
  "party_names": ["string"],
  "candidate_names": ["string"],
  "candidate_names_to_vote": ["string"],
  "ballot_id": "string",
  "joint_public_key": "string",
  "commitment_hash": "string",
  "number_of_guardians": 3,
  "quorum": 2,
  "max_choices": 1
}
```

### POST `/benaloh_challenge`

Request body (`ElectionGuardBenalohRequest`):

```json
{
  "party_names": ["string"],
  "candidate_names": ["string"],
  "candidate_names_to_verify": ["string"],
  "ballot_id": "string",
  "joint_public_key": "string",
  "commitment_hash": "string",
  "number_of_guardians": 3,
  "quorum": 2,
  "encrypted_ballot_with_nonce": "string"
}
```

### POST `/api/encrypt`

Request body (map built in `ElectionGuardCryptoService`):

```json
{
  "private_key": "string (combined private key + polynomial)",
  "password": "string (optional; if omitted, service generates a password)"
}
```

### POST `/api/decrypt`

Request body (map built in `ElectionGuardCryptoService`):

```json
{
  "encrypted_data": "string",
  "credentials": "string"
}
```

### GET `/health`

- Request body: none.
- Used for health checks (API and Worker services are checked separately).

## ElectionGuard Worker Service (heavy operations)

### POST `/create_encrypted_tally`

Request body (`ElectionGuardTallyRequest`):

```json
{
  "party_names": ["string"],
  "candidate_names": ["string"],
  "joint_public_key": "string",
  "commitment_hash": "string",
  "encrypted_ballots": ["string"],
  "number_of_guardians": 3,
  "quorum": 2,
  "max_choices": 1
}
```

### POST `/create_partial_decryption`

Request body (`ElectionGuardPartialDecryptionRequest`). Complex fields are encoded as maps/lists before MessagePack:

```json
{
  "guardian_id": "string",
  "guardian_data": { "id": "string", "sequence_order": 1, "election_public_key": "...", "backups": { "2": "..." } },
  "private_key": { "guardian_id": "string", "private_key": "string" },
  "public_key": { "guardian_id": "string", "public_key": "string" },
  "polynomial": { "guardian_id": "string", "polynomial": "string" },
  "party_names": ["string"],
  "candidate_names": ["string"],
  "ciphertext_tally": { "...": "..." },
  "submitted_ballots": [{ "...": "..." }],
  "joint_public_key": "string",
  "commitment_hash": "string",
  "number_of_guardians": 3,
  "quorum": 2,
  "max_choices": 1
}
```

### POST `/create_compensated_decryption`

Request body (`ElectionGuardCompensatedDecryptionRequest`). Complex fields are encoded as maps/lists before MessagePack:

```json
{
  "available_guardian_id": "string",
  "missing_guardian_id": "string",
  "available_guardian_data": { "...": "..." },
  "missing_guardian_data": { "...": "..." },
  "available_private_key": { "...": "..." },
  "available_public_key": { "...": "..." },
  "available_polynomial": { "...": "..." },
  "party_names": ["string"],
  "candidate_names": ["string"],
  "ciphertext_tally": { "...": "..." },
  "submitted_ballots": [{ "...": "..." }],
  "joint_public_key": "string",
  "commitment_hash": "string",
  "number_of_guardians": 3,
  "quorum": 2,
  "max_choices": 1
}
```

### POST `/combine_decryption_shares`

Request body (`ElectionGuardCombineDecryptionSharesRequest`). Complex fields are encoded as maps/lists before MessagePack:

```json
{
  "party_names": ["string"],
  "candidate_names": ["string"],
  "joint_public_key": "string",
  "commitment_hash": "string",
  "ciphertext_tally": { "...": "..." },
  "submitted_ballots": [{ "...": "..." }],
  "guardian_data": [{ "...": "..." }],
  "available_guardian_ids": ["string"],
  "available_guardian_public_keys": ["string"],
  "available_tally_shares": [{ "...": "..." }],
  "available_ballot_shares": [{ "...": "..." }],
  "missing_guardian_ids": ["string"],
  "compensating_guardian_ids": ["string"],
  "compensated_tally_shares": [{ "...": "..." }],
  "compensated_ballot_shares": [{ "...": "..." }],
  "quorum": 2,
  "number_of_guardians": 3,
  "max_choices": 1
}
```

### GET `/health`

- Request body: none.
- Used for worker health checks in `ElectionGuardService.isHealthy()`.
