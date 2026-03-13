# AmarVote Frontend

This React application is the main client experience for:
- voters
- guardians
- election admins

It is no longer a template app; it contains production election workflows.

---

## Main responsibilities

- OTP login/session UX
- election discovery and election pages
- encrypted ballot flow (create, challenge, cast)
- guardian key ceremony dashboard (Round 1 + Round 2)
- tally/decryption progress visualization
- results and verification screens

---

## Important routes

- `/otp-login`
- `/dashboard`
- `/create-election`
- `/key-ceremony`
- `/election-page/:id`
- `/election-page/:id/:tab`
- `/architecture`
- `/how-it-works`
- `/security`

---

## Guardian key ceremony UX (updated)

The new guardian workflow is handled in `/key-ceremony`:

### Round 1
1. Guardian loads pending key ceremony tasks.
2. Guardian generates ElectionGuard-compatible credentials.
3. Guardian submits key ceremony data with local encryption password.
4. `credentials-election-<id>.txt` is downloaded locally.

### Round 2
1. Opens only after all guardians complete Round 1.
2. Guardian uploads local credential file.
3. Guardian generates encrypted backup shares.
4. Guardian submits backup payload.

Admin monitors status and activates the election only when all required backup shares are complete.

---

## API client modules

- `src/utils/api.js` (generic HTTP helper, CSRF/session handling)
- `src/utils/electionApi.js` (election + key ceremony + tally/decryption operations)
- `src/utils/userApi.js`

Key ceremony endpoints used by frontend include:
- `/api/guardian/key-ceremony/pending`
- `/api/guardian/key-ceremony/generate/{electionId}`
- `/api/guardian/key-ceremony/submit`
- `/api/guardian/key-ceremony/backup/generate/{electionId}`
- `/api/guardian/key-ceremony/backup/submit`
- `/api/admin/key-ceremony/status/{electionId}`
- `/api/admin/key-ceremony/activate`

---

## Run locally

- Install dependencies: `npm install`
- Run dev server: `npm run dev`
- Build: `npm run build`
- Preview build: `npm run preview`

---

## Related docs

- [../README.md](../README.md)
- [../docs/CLIENT_WORKFLOW.md](../docs/CLIENT_WORKFLOW.md)
- [../docs/services/FRONTEND.md](../docs/services/FRONTEND.md)
