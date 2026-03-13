# 📱 AmarVote Frontend — React Application

## 2026 Update (Client Workflow)

Frontend workflow has been updated to align with the new guardian ceremony model.

### Primary client-facing lifecycle

1. OTP authentication and session bootstrap.
2. Election browsing/creation.
3. Guardian key ceremony through `/key-ceremony`:

- Round 1: generate + submit keypair payload.
- Round 2: generate + submit encrypted backup shares.

1. Voting: create encrypted ballot, optional challenge, cast.
2. Admin tally/decryption orchestration with progress modals.
3. Final result viewing and verification.

### Important route correction

The active election route pattern is:

- `/election-page/:id`
- `/election-page/:id/:tab`

The `/key-ceremony` route is now a first-class operational page for guardians and admins.

---

**Technology:** React 19.1.0 · Vite 6.3.5 · Tailwind CSS 3  
**Dev Port:** `5173`  
**Prod Port:** `80` (nginx)  
**Network IP:** `172.20.0.40` (both dev and prod)  
**Memory Limit (prod):** `256 MiB`

---

## Table of Contents

1. [Overview](#overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Pages & Routes](#pages--routes)
5. [Components](#components)
6. [API Clients](#api-clients)
7. [Authentication Flow](#authentication-flow)
8. [Bot Detection](#bot-detection)
9. [Election Page Sub-Sections](#election-page-sub-sections)
10. [Build Configuration](#build-configuration)
11. [Styling](#styling)
12. [Testing](#testing)

---

## Overview

The AmarVote frontend is a single-page application (SPA) built with React 19 and Vite. It provides the complete voter, guardian, and admin experience:

- OTP-based passwordless authentication
- Election browsing, creation, and management
- Encrypted ballot casting with real-time bot detection
- Benaloh challenge (vote spoil/re-vote for verification)
- Guardian key submission and decryption progress tracking
- Animated real-time results visualization with multiple chart types
- AI chatbot integration for voter assistance
- Admin panel for API log monitoring

All communication with the backend happens via `/api` proxy (Vite dev proxy → `http://backend:8080`), with session carried through `HttpOnly` JWT cookies.

---

## Technology Stack

| Package | Version | Purpose |
|---|---|---|
| `react` | ^19.1.0 | UI framework |
| `react-dom` | ^19.1.0 | DOM rendering |
| `react-router-dom` | ^7.6.1 | Client-side routing |
| `axios` | ^1.9.0 | HTTP client (some endpoints) |
| `@fingerprintjs/botd` | ^1.9.1 | Real-time bot detection during voting |
| `framer-motion` | ^12.23.26 | Page transitions and animations |
| `recharts` | ^2.8.0 | BarChart, PieChart, LineChart, AreaChart for election results |
| `react-hot-toast` | ^2.5.2 | Toast notifications |
| `react-markdown` | ^10.1.0 | Chatbot response rendering |
| `react-circular-progressbar` | ^2.1.0 | Per-task completion ring progress |
| `react-datepicker` | ^7.5.0 | Election start/end time selection |
| `react-syntax-highlighter` | latest | Code blocks in chatbot responses |
| `jspdf` + `jspdf-autotable` | ^2.5.1 / ^3.6.0 | Export election results to PDF |
| `file-saver` | ^2.0.5 | Download generated files (results, receipts) |
| `html2canvas` | ^1.4.1 | Screenshot for PDF export |
| Vite | ^6.3.5 | Build tool |
| Tailwind CSS | ^3.4.17 | Utility-first styling |
| PostCSS | latest | CSS transformation |

**Dev / Test Dependencies:**

| Package | Version | Purpose |
|---|---|---|
| `vitest` | ^3.2.4 | Test runner |
| `@testing-library/react` | ^16.3.0 | React component testing |
| `@testing-library/user-event` | latest | User interaction simulation |
| `@testing-library/jest-dom` | latest | Custom DOM matchers |
| `jsdom` | latest | Browser environment simulation |
| `@vitest/coverage-v8` | latest | Coverage reporting |

---

## Project Structure

```
frontend/
├── public/                          ← Static assets
├── certs/                           ← SSL certificates (dev HTTPS)
├── src/
│   ├── main.jsx                     ← React entry point, root render
│   ├── App.jsx                      ← Router setup, route definitions
│   ├── App.css                      ← Global app styles
│   ├── index.css                    ← Tailwind directives + base styles
│   ├── assets/                      ← Images, icons, SVGs
│   ├── constants/                   ← Shared constants
│   │
│   ├── utils/
│   │   ├── api.js                   ← Core fetch wrapper, CSRF, auth, all API calls
│   │   ├── electionApi.js           ← Election-specific API calls
│   │   ├── userApi.js               ← User profile API calls
│   │   ├── ballotPadding.js         ← Fixed-size payload padding (anti-traffic-analysis)
│   │   └── timezoneUtils.js         ← Date/time display formatting helpers
│   │
│   ├── pages/
│   │   ├── Layout.jsx               ← Root layout (navbar, footer)
│   │   ├── AuthenticatedLayout.jsx  ← Layout requiring login
│   │   ├── Home.jsx                 ← Landing page
│   │   ├── About.jsx                ← About page
│   │   ├── Features.jsx             ← Feature showcase
│   │   ├── HowItWorks.jsx           ← Platform walkthrough
│   │   ├── Dashboard.jsx            ← Election listing for logged-in user
│   │   ├── AllElections.jsx         ← Public election directory
│   │   ├── ElectionPage.jsx         ← Full election workspace (sub-menu router)
│   │   ├── CreateElection.jsx       ← Multi-step election creation form
│   │   ├── Profile.jsx              ← User profile management
│   │   ├── OtpLogin.jsx             ← OTP-based login page
│   │   ├── AdminLogin.jsx           ← Admin login page
│   │   ├── ApiLogs.jsx              ← Admin API log viewer
│   │   ├── Loading.jsx              ← Full-screen loading state
│   │   └── Hello.jsx                ← Health check / test page
│   │
│   ├── components/
│   │   ├── AnimatedResults.jsx      ← Animated result bars with chart options
│   │   ├── Chatbot.jsx              ← AI assistant sidebar/modal
│   │   ├── CombineProgressModal.jsx ← Combine operation progress tracker
│   │   ├── CompensatedDecryptionDisplay.jsx ← Shows compensated decryption status
│   │   ├── DecryptionProgressModal.jsx ← Per-guardian decryption progress ring
│   │   ├── election/                ← (placeholder for sub-components)
│   │   ├── ElectionImageUpload.jsx  ← Drag-and-drop election image upload
│   │   ├── ElectionTimeline.jsx     ← Visual election start/end timeline
│   │   ├── ErrorBoundary.jsx        ← React error boundary wrapper
│   │   ├── GuardianDataDisplay.jsx  ← Guardian key status display
│   │   ├── ImageUpload.jsx          ← Generic image upload component
│   │   ├── TallyCreationModal.jsx   ← Tally initiation + progress modal
│   │   └── WorkerProceedings.jsx    ← Worker log viewer with timing stats
│   │
│   ├── __tests__/                   ← Unit and integration tests
│   │   ├── App.test.jsx
│   │   ├── Hello.test.jsx
│   │   ├── Home.test.jsx
│   │   ├── Login.test.jsx
│   │   ├── integration.test.jsx
│   │   └── utils.test.jsx
│   │
│   └── test/
│       ├── setup.js                 ← Vitest setup (jest-dom extends)
│       └── utils.js                 ← Test helper utilities
│
├── Dockerfile                       ← Production nginx build
├── Dockerfile.dev                   ← Development hot-reload build
├── vite.config.js                   ← Vite + Vitest configuration
├── tailwind.config.js               ← Tailwind theme configuration
├── postcss.config.js                ← PostCSS configuration
├── eslint.config.js                 ← ESLint rules
├── index.html                       ← HTML entry point
├── package.json                     ← Dependencies and scripts
├── nginx.conf                       ← Nginx config for production container
├── TESTING.md                       ← Testing guide
└── README-CHAT-SESSIONS.md          ← Chat session documentation
```

---

## Pages & Routes

### Public Routes

| Route | Component | Purpose |
|---|---|---|
| `/` | `Home` | Landing page with hero, features overview |
| `/about` | `About` | Platform description |
| `/features` | `Features` | Feature showcase |
| `/how-it-works` | `HowItWorks` | Step-by-step platform walkthrough |
| `/all-elections` | `AllElections` | Public election directory |
| `/otp-login` | `OtpLogin` | Login via email OTP |
| `/admin/login` | `AdminLogin` | Admin panel login |

### Authenticated Routes

| Route | Component | Purpose |
|---|---|---|
| `/dashboard` | `Dashboard` | User's election overview |
| `/create-election` | `CreateElection` | Multi-step election creation form |
| `/profile` | `Profile` | User profile management |
| `/admin/logs` | `ApiLogs` | Admin API log viewer |
| `/election/:id` | `ElectionPage` | Full election workspace |
| `/election/:id/:sub` | `ElectionPage` | Specific sub-section of election |

### ElectionPage Sub-Routes

`ElectionPage` is the most complex page. It has an internal sub-menu that renders different sections under `/election/:id/:section`:

| Sub-Route | Key | Section Name | Purpose |
|---|---|---|---|
| _(none)_ | `info` | Election Info | Election overview, timeline, stats |
| `voting-booth` | `voting` | Voting Booth | Ballot selection + bot detection + cast |
| `guardian-keys` | `guardian` | Guardian Keys | Key submission, PQ credential upload |
| `results` | `results` | Results | Final decrypted results with charts |
| `ballots-in-tally` | `ballots` | Ballots in Tally | View encrypted ballots included in tally |
| `verify-vote` | `verify` | Verify Your Vote | Track ballot by tracking code |
| `verification` | `verification` | Verification | Cryptographic proof verification |
| `worker-proceedings` | `worker-proceedings` | Worker Proceedings | Real-time worker log viewer |

---

## Components

### `ElectionPage.jsx` (4974 lines — the core UI)

Most complex component in the codebase. Renders the entire election workspace with:

- **`ElectionTimer`** — tracks `timeLeft`, `progress` (0→100%), `phase` (`calculating` / `upcoming` / `active` / `ended`) relative to `startTime`/`endTime`
- **Sub-menu navigation** — renders different sections via internal routing
- **Charts available:** `BarChart`, `PieChart`, `LineChart`, `AreaChart` (via recharts)
- **Export:** `jsPDF` + `jspdf-autotable` for PDF results download
- **File download:** ballot receipt as JSON via `file-saver`

### `AnimatedResults.jsx`

Animated results display using Framer Motion bars with Recharts integration. Shows:
- Candidate vote counts with animated fill bars
- Multiple chart type switcher
- Victory/result summary

### `Chatbot.jsx`

AI assistant sidebar component:
- Communicates with `/api/chatbot/chat`
- Renders responses with `react-markdown`
- Maintains `sessionId` for conversation context
- Shows loading indicators during AI response generation

### `TallyCreationModal.jsx`

Progress modal shown when admin initiates tally:
- Polls `/api/election/{id}/tally-status` every few seconds
- Displays chunk-level progress (`chunksCompleted / chunksTotal`)
- Shows current status

### `DecryptionProgressModal.jsx`

Per-guardian decryption progress tracker:
- Shows progress ring via `react-circular-progressbar`
- Polls `/api/guardian/decryption-status/{electionId}`
- Animates completion state

### `CombineProgressModal.jsx`

Tracks the combine operation after all guardians have decrypted:
- Polls `/api/combine-status/{electionId}`
- Shows combined chunk completion

### `WorkerProceedings.jsx`

Detailed worker log viewer:
- Fetches from `/api/worker-logs/summary/{electionId}`
- Shows per-chunk timing stats for all 4 phases (tally, partial decrypt, compensated decrypt, combine)
- Expandable log entries with error messages

### `GuardianDataDisplay.jsx`

Shows guardian list with their decryption status:
- `decryptedOrNot` boolean per guardian
- Compensation status for absent guardians

### `CompensatedDecryptionDisplay.jsx`

Visualizes cross-guardian compensation relationships (which guardian compensated for which absent guardian).

---

## API Clients

### `utils/api.js` (524 lines) — Core API client

**Base URL:** `/api`  
**Default timeout:** 300,000 ms (5 minutes)

#### `apiRequest(endpoint, options, timeout)`

The core fetch wrapper:
1. Always sends `credentials: 'include'` (carries JWT cookie)
2. Reads `XSRF-TOKEN` cookie → sets `X-XSRF-TOKEN` header on non-GET requests
3. Races `fetch()` against timeout promise
4. On `401`: clears `localStorage('email')`, sets `localStorage('logout', Date.now())`, redirects to `/otp-login`

#### `apiBinaryRequest(endpoint, binaryData, contentType, timeout)`

Same auth/timeout logic but for binary (`ArrayBuffer` / `Uint8Array`) payloads with `application/octet-stream` content type. Used for fixed-size encrypted ballot submission.

#### Exported API Functions

| Function | Method | Endpoint |
|---|---|---|
| `fetchAllElections()` | GET | `/api/all-elections` |
| `createElection(data)` | POST | `/api/create-election` |
| `getUserSession()` | GET | `/api/auth/session` |
| `loginUser(email, password)` | POST | `/api/auth/login` |
| `logoutUser()` | POST | `/api/auth/logout` |
| `getUserProfile()` | GET | `/api/auth/profile` |
| `updateUserProfile(data)` | PUT | `/api/auth/profile` |
| `uploadProfilePicture(file)` | POST | `/api/auth/profile/upload-picture` (FormData) |
| `uploadCandidateImage(file, name)` | POST | `/api/upload-candidate-image` (FormData) |
| `uploadPartyImage(file, name)` | POST | `/api/upload-party-image` (FormData) |
| `uploadElectionPicture(file, id)` | POST | `/api/images/election` (FormData) |
| `uploadCandidatePicture(file, id)` | POST | `/api/images/candidate` (FormData) |
| `uploadPartyPicture(file, id)` | POST | `/api/images/party` (FormData) |

### `utils/ballotPadding.js`

Implements fixed-size request padding for the encrypted ballot submission endpoint to prevent traffic analysis:

- Pads `application/octet-stream` payload to `TARGET_SIZE` bytes using PKCS#7 padding
- Backend strips padding before JSON parsing
- This prevents observers from inferring candidate selection from payload size

---

## Authentication Flow

```
User enters email
  → POST /api/auth/request-otp
  → Email receives 6-digit OTP (valid 5 min)

User enters OTP
  → POST /api/auth/verify-otp
  → Backend issues "jwtToken" HttpOnly cookie (7-day MaxAge)
  → Redirect to /dashboard

All subsequent requests:
  → Cookie automatically sent by browser
  → JWTFilter validates token
  → SecurityContextHolder populated

On 401 response:
  → api.js clears localStorage email
  → localStorage 'logout' event set (multi-tab sync)
  → Redirect to /otp-login

Logout:
  → POST /api/auth/logout
  → Backend sets jwtToken cookie MaxAge=0 (deletes it)
```

---

## Bot Detection

The `@fingerprintjs/botd` library (`^1.9.1`) is used during the **Voting Booth** section of `ElectionPage`:

1. `BotD.load()` called when voting section mounts
2. `botd.detect()` called when voter clicks "Vote"
3. Result object `{ isBot: boolean, requestId: string, timestamp: Date }` attached to cast ballot request
4. Backend `BallotService.castBallot()` validates:
   - `isBot === false` (required)
   - `timestamp` within last 5 minutes (freshness check)
5. Stale or bot-identified requests are rejected with HTTP 400

---

## Election Page Sub-Sections

### Voting Booth

- Displays all candidates with name, party, and image
- Bot detection runs on vote submission
- Benaloh challenge option: spoil ballot → re-encrypt → re-cast (for election verification)
- Encrypted ballot submission uses fixed-size octet-stream via `apiBinaryRequest`

### Guardian Keys

- Guardians see encrypted credential block delivered to them via email
- They paste or upload their PQ-encrypted credentials
- Frontend sends credentials to `/api/guardian/initiate-decryption`
- `DecryptionProgressModal` tracks chunk-by-chunk progress

### Results

- Only visible after election end and combine completion
- Charts rendered via `recharts`: BarChart, PieChart, AreaChart, LineChart
- `AnimatedResults` component provides animated candidate bars
- Export to PDF via jsPDF with table formatting

### Worker Proceedings

- Shows all 4 processing phases (Tally, Partial Decrypt, Compensated Decrypt, Combine)
- Per-chunk timing, status, error messages
- Useful for debugging and performance auditing

### Verify Your Vote

- Voter enters their ballot tracking code
- Frontend calls `/api/ballot-details/{electionId}/{trackingCode}`
- Shows ciphertext and inclusion proof

---

## Build Configuration

### `vite.config.js`

```js
server: {
  host: "0.0.0.0",        // bind all interfaces (Docker)
  proxy: {
    "/api": {
      target: "http://backend:8080",
      changeOrigin: true,
      secure: false,
      timeout: 300000,     // 5-minute proxy timeout
      proxyTimeout: 300000
    }
  }
}
```

Vitest config:
- `globals: true` — no explicit import of `describe`, `it`, `expect` needed
- `environment: 'jsdom'` — browser simulation
- Coverage via V8

### `Dockerfile` (production)

```
node:18-alpine  →  npm ci  →  npm run build  →  nginx:alpine serving dist/
```

### `Dockerfile.dev` (development)

```
node:18-alpine  →  npm install  →  npm run dev
```

---

## Styling

- **Tailwind CSS** `^3.4.17` — utility-first classes
- **Custom Tailwind config** in `tailwind.config.js` — theme extensions for custom colors, animations
- **PostCSS** for processing
- **Framer Motion** for component-level animations (page transitions, result bar animations)
- **CSS Modules** for scoped component styles where needed

---

## Testing

### Running Tests

```bash
cd frontend
npm test                  # Run all tests
npm run test:watch        # Watch mode
npm run test:ui           # Vitest UI browser mode
npm run test:coverage     # Coverage report
```

### Test Files

| File | Coverage |
|---|---|
| `__tests__/App.test.jsx` | Router and app-level rendering |
| `__tests__/Hello.test.jsx` | Health page component |
| `__tests__/Home.test.jsx` | Landing page rendering |
| `__tests__/Login.test.jsx` | OTP login form interaction |
| `__tests__/integration.test.jsx` | Full login → dashboard workflow |
| `__tests__/utils.test.jsx` | `api.js` utility functions |

### Mocking Strategy

```js
vi.fn()                          // Mock functions
vi.mock('react-router-dom')       // Mock navigation
fetch.mockResolvedValueOnce(...)  // Mock HTTP responses
```

### Coverage Goals

| Metric | Target |
|---|---|
| Statements | > 80% |
| Branches | > 75% |
| Functions | > 80% |
| Lines | > 80% |
