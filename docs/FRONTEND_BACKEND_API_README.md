# Frontend to Backend API Calls

This document lists every API call the frontend makes to the backend, with request body shapes as implemented in the frontend and backend. Endpoints are grouped by feature area and show the payload the frontend sends.

## Conventions

- Base URL: `/api`
- Auth: cookie-based (`jwtToken`); CSRF header `X-XSRF-TOKEN` for non-GET JSON requests.
- JSON requests use `Content-Type: application/json`.
- File uploads use `multipart/form-data` with `FormData` fields.
- Encrypted ballot creation uses `application/octet-stream` with a padded JSON payload.

## Health

**GET** `/api/health`

- Request body: none.

## Auth, Session, MFA, and Registration

**POST** `/api/auth/register/send-email-code`

```json
{ "email": "user@example.com" }
```

**POST** `/api/auth/register/verify-email-code`

```json
{ "email": "user@example.com", "code": "123456" }
```

**POST** `/api/auth/register`

```json
{
  "email": "user@example.com",
  "password": "string",
  "emailVerificationToken": "string (optional; can be read from cookie)",
  "enableMfa": true
}
```

**POST** `/api/auth/login`

```json
{ "email": "user@example.com", "password": "string" }
```

**POST** `/api/auth/mfa/verify`

```json
{ "totpCode": "123456" }
```

**POST** `/api/auth/request-otp`

```json
{ "email": "user@example.com" }
```

**POST** `/api/auth/verify-otp`

```json
{ "email": "user@example.com", "otpCode": "123456" }
```

**GET** `/api/auth/session`

- Request body: none.

**POST** `/api/auth/logout`

- Request body: none.

**POST** `/api/auth/password/send-email-code`

```json
{ "email": "user@example.com" }
```

**POST** `/api/auth/password/verify-email-code`

```json
{ "email": "user@example.com", "code": "123456" }
```

**POST** `/api/auth/password/reset`

```json
{ "newPassword": "string", "resetPasswordToken": "string (optional; can be read from cookie)" }
```

**GET** `/api/auth/profile`

- Request body: none.

**POST** `/api/auth/profile/password`

```json
{ "currentPassword": "string", "newPassword": "string" }
```

**POST** `/api/auth/profile/mfa/setup`

- Request body: none.

**POST** `/api/auth/profile/mfa/confirm`

```json
{ "totpCode": "123456" }
```

**POST** `/api/auth/profile/mfa/disable`

- Request body: none.

### Frontend calls without a backend handler (as of current controllers)

These calls exist in the frontend but do not map to any controller endpoint in the backend codebase right now.

**PUT** `/api/auth/profile`

```json
{ "userName": "string", "profilePic": "string" }
```

**POST** `/api/auth/profile/upload-picture` (multipart)

FormData fields:
- `file`: image file

## Elections and Key Ceremony

**GET** `/api/all-elections`

- Request body: none.

**POST** `/api/create-election`

```json
{
  "electionTitle": "string",
  "electionDescription": "string",
  "candidateNames": ["string"],
  "partyNames": ["string"],
  "candidatePictures": ["string"],
  "partyPictures": ["string"],
  "guardianNumber": "string",
  "quorumNumber": "string",
  "guardianEmails": ["string"],
  "electionPrivacy": "string",
  "electionEligibility": "string",
  "voterEmails": ["string"],
  "startingTime": "2026-01-01T12:00:00Z",
  "endingTime": "2026-01-01T18:00:00Z",
  "maxChoices": 1
}
```

**GET** `/api/election/{electionId}`

- Request body: none.

**DELETE** `/api/election/{electionId}`

- Request body: none.

**GET** `/api/guardian/key-ceremony/pending`

- Request body: none.

**GET** `/api/guardian/key-ceremony/generate/{electionId}`

- Request body: none.

**POST** `/api/guardian/key-ceremony/submit`

```json
{
  "electionId": 123,
  "guardianPrivateKey": "string",
  "guardianPublicKey": "string",
  "guardianPolynomial": "string",
  "localEncryptionPassword": "string",
  "guardianKeyBackup": "string (optional)"
}
```

**GET** `/api/admin/key-ceremony/status/{electionId}`

- Request body: none.

**GET** `/api/key-ceremony/status/{electionId}`

- Request body: none.

**GET** `/api/guardian/key-ceremony/backup/context/{electionId}`

- Request body: none.

**GET** `/api/guardian/key-ceremony/credential-metadata/{electionId}`

- Request body: none.

**POST** `/api/guardian/key-ceremony/backup/submit`

```json
{ "electionId": 123, "guardianKeyBackup": "string" }
```

**POST** `/api/guardian/key-ceremony/backup/generate/{electionId}`

```json
{ "encrypted_data": "string" }
```

**POST** `/api/admin/key-ceremony/activate`

```json
{
  "electionId": 123,
  "startingTime": "2026-01-01T12:00:00Z",
  "endingTime": "2026-01-01T18:00:00Z",
  "sendReminder": true,
  "reminderRecipients": ["string"],
  "reminderSubject": "string",
  "reminderBody": "string",
  "reminderTime": "2026-01-01T10:00:00Z"
}
```

**GET** `/api/guardian/key-ceremony/password/{electionId}`

- Request body: none.

## Voting, Ballots, and Verification

**POST** `/api/eligibility`

```json
{ "electionId": 123 }
```

**POST** `/api/cast-ballot`

```json
{
  "electionId": 123,
  "selectedCandidate": "string",
  "botDetection": {
    "isBot": false,
    "requestId": "string",
    "timestamp": "string"
  }
}
```

**POST** `/api/create-encrypted-ballot`

- Content-Type: `application/octet-stream`
- Body: PKCS#7 padded JSON, based on `CreateEncryptedBallotRequest`.

Unpadded JSON structure:

```json
{
  "electionId": 123,
  "selectedCandidates": ["string"],
  "botDetection": {
    "isBot": false,
    "requestId": "string",
    "timestamp": "string"
  },
  "padding": "string (added by client padding utility)"
}
```

**POST** `/api/benaloh-challenge`

```json
{
  "electionId": 123,
  "encrypted_ballot_with_nonce": "string",
  "candidate_names_to_verify": ["string"]
}
```

**POST** `/api/cast-encrypted-ballot`

```json
{
  "electionId": 123,
  "encrypted_ballot": "string",
  "ballot_hash": "string",
  "ballot_tracking_code": "string"
}
```

**GET** `/api/ballot-details/{electionId}/{trackingCode}`

- Request body: none.

### Frontend calls without a backend handler (as of current controllers)

**POST** `/api/verify-vote`

```json
{
  "election_id": 123,
  "tracking_code": "string",
  "hash_code": "string"
}
```

**GET** `/api/ballots-in-tally/{electionId}`

- Request body: none.

## Tally and Decryption

**POST** `/api/initiate-tally`

```json
{ "election_id": 123 }
```

**POST** `/api/create-tally` (legacy alias)

```json
{ "election_id": 123 }
```

**GET** `/api/election/{electionId}/tally-status`

- Request body: none.

**POST** `/api/guardian/initiate-decryption`

```json
{ "election_id": 123, "encrypted_data": "string" }
```

**POST** `/api/create-partial-decryption` (legacy)

```json
{ "election_id": 123, "encrypted_data": "string" }
```

**GET** `/api/guardian/decryption-status/{electionId}`

- Request body: none.

**GET** `/api/guardian/decryption-status/{electionId}/{guardianId}`

- Request body: none.

**POST** `/api/initiate-combine?electionId={electionId}`

- Request body: none.

**GET** `/api/combine-status/{electionId}`

- Request body: none.

**POST** `/api/combine-partial-decryption` (legacy)

```json
{ "election_id": 123 }
```

**GET** `/api/election/{electionId}/cached-results`

- Request body: none.

**GET** `/api/election/{electionId}/results`

- Request body: none.

## Election Verification Data

**GET** `/api/election/{electionId}/guardians`

- Request body: none.

**GET** `/api/election/{electionId}/compensated-decryptions`

- Request body: none.

## Blockchain Verification

**GET** `/api/blockchain/ballot/{electionId}/{trackingCode}`

- Request body: none.

**GET** `/api/blockchain/logs/{electionId}`

- Request body: none.

## Images and Assets

**POST** `/api/upload-candidate-image` (multipart)

FormData fields:
- `file`: image file
- `candidateName`: string

**POST** `/api/upload-party-image` (multipart)

FormData fields:
- `file`: image file
- `partyName`: string

**POST** `/api/images/election` (multipart)

FormData fields:
- `file`: image file
- `electionId`: string/number

**POST** `/api/images/candidate` (multipart)

FormData fields:
- `file`: image file
- `choiceId`: string/number

**POST** `/api/images/party` (multipart)

FormData fields:
- `file`: image file
- `choiceId`: string/number

## Authorized Users

**GET** `/api/authorized-users/me`

- Request body: none.

**GET** `/api/authorized-users`

- Request body: none.

**POST** `/api/authorized-users`

```json
{
  "email": "user@example.com",
  "userType": "user|admin|owner",
  "apiLogViewerAllowed": true
}
```

**PUT** `/api/authorized-users/{authorizedUserId}`

```json
{
  "email": "user@example.com",
  "userType": "user|admin|owner",
  "canCreateElections": true,
  "apiLogViewerAllowed": true
}
```

**DELETE** `/api/authorized-users/{authorizedUserId}`

- Request body: none.

**POST** `/api/authorized-users/bulk-upload` (multipart)

FormData fields:
- `file`: CSV file

**GET** `/api/authorized-users/audit-logs`

- Request body: none.

**PUT** `/api/authorized-users/permission-settings`

```json
{
  "registrationOpenToAll": true,
  "electionCreationPermissionScope": "string"
}
```

## Admin Logs

**GET** `/api/admin/access-check`

- Request body: none.

**GET** `/api/admin/logs` (query params)

Query params used by the frontend:
- `page` (number)
- `size` (number)
- `email` (optional)
- `ip` (optional)
- `path` (optional)
- `method` (optional)
- `statusCode` (optional)
- `dateFrom` (optional)
- `dateTo` (optional)
- `sortBy` (optional)
- `sortOrder` (optional)

**GET** `/api/admin/logs/stats`

- Request body: none.

## Worker Logs (Progress UI)

**GET** `/api/worker-logs/tally/{electionId}`

- Request body: none.

**GET** `/api/worker-logs/decryption/partial/{electionId}`

- Request body: none.

**GET** `/api/worker-logs/decryption/compensated/{electionId}`

- Request body: none.

**GET** `/api/worker-logs/combine/{electionId}`

- Request body: none.

## Chat

**POST** `/api/chat`

```json
{ "userMessage": "string", "sessionId": "string (optional)" }
```

**POST** `/api/chat/electionguard`

```json
{ "userMessage": "string", "sessionId": "string (optional)" }
```

**POST** `/api/chatbot/chat`

```json
{ "userMessage": "string", "sessionId": "string (optional)" }
```
