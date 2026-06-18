# AmarVote Load Testing Guide

k6 load tests for [https://amarvote2026.me](https://amarvote2026.me).  
Stepped scenarios run **one VU level at a time** (50 → 100 → 200 → …), print a **full report after each step**, then continue.

---

## Prerequisites

1. **k6** installed locally (`sudo gpg -k && …` — see [k6 docs](https://grafana.com/docs/k6/latest/set-up/install-k6/))
2. **`load-tests/.env.loadtest`** with production `JWT_SECRET` (from server `~/.env`)
3. **Load-test nginx** enabled on the server before heavy tests:
   ```bash
   # on server
   bash load-tests/scripts/server-enable-loadtest-nginx.sh
   ```
4. After testing, restore production nginx:
   ```bash
   bash load-tests/scripts/server-disable-loadtest-nginx.sh
   ```

---

## Quick start

```bash
# 1. Verify JWT auth
./load-tests/verify-auth.sh

# 2. Check nginx is not rate-limiting
./load-tests/run.sh scenarios/nginx-limit-check.js

# 3. Smoke test (10 users, 2 min)
./load-tests/run.sh scenarios/smoke.js

# 4. Stepped browse test (50 → 100 → 200 → …)
./load-tests/run.sh scenarios/browse.js
```

---

## How stepped tests work

When you run `browse.js`, `vote-flow.js`, `vote-encrypt-only.js`, `vote-encrypt-2000.js`, or `mixed-2000.js`:

1. **50 VUs** — ramp 2m + hold 3m  
   - **Live dashboard** in terminal: overall + per-API ok/fail every ~3s  
   - **Full report printed immediately** when step ends → also saved to `load-tests/results/browse-step-50-report.txt`

2. **5 second pause**

3. **100 VUs** — same pattern → report → `browse-step-100-report.txt`

4. Continues through **200, 500, 1000, 2000** (configurable)

5. **Combined report** at end → `browse-combined-report.txt`

### Live dashboard (during each step)

While a step runs, a live panel prints every ~3 seconds:

```
┌─ LIVE 01:23 │ step 50 VUs ─────────────────────────────────────
│  Overall: 4520 ok / 180 failed (3.84% fail) — 4700 requests
│  Per API:
│    session                   1130 ok /    45 fail (3.83%)
│    all-elections             1130 ok /    45 fail (3.83%)
│    election-detail           1130 ok /    45 fail (3.83%)
│    eligibility               1130 ok /    45 fail (3.83%)
└────────────────────────────────────────────────────────────────
```

k6 progress lines still print above this. When the step ends, the **STEP FINAL REPORT** block prints, then the next VU level starts after 5 seconds.

Disable live dashboard: `LIVE_REPORT=0 ./load-tests/run.sh scenarios/browse.js`

### Reading a step report

```
╔══════════════════════════════════════════════════════════════╗
║  STEP COMPLETE — 50 VUs — browse                             ║
║  Result: PASS                                                ║
╚══════════════════════════════════════════════════════════════╝

  Overall
    HTTP requests : 12400 total
                    11800 ok / 600 failed (4.84% fail)
    Checks          : 47200 passed / 800 failed (98.33% pass)
    Latency         : avg 45ms  p95 120ms

  Per API endpoint
    session
      2950 ok / 50 failed (1.67%)  avg 42ms  p95 98ms
    all-elections
      ...
```

- **PASS** = &lt; 5% HTTP failures at that step  
- **FAIL** = ≥ 5% — treat this as roughly your capacity ceiling  
- Last **PASS** step ≈ safe concurrent user count

### Stop on first failure

```bash
STOP_ON_STEP_FAIL=1 ./load-tests/run.sh scenarios/browse.js
```

### Run all steps in one long k6 process (legacy)

```bash
SINGLE_RUN=1 ./load-tests/run.sh scenarios/browse.js
```

---

## Scenarios

| Script | What it tests | Endpoints / flow |
|--------|---------------|------------------|
| **`smoke.js`** | Sanity check before scaling | `/api/health`, session, elections, election detail |
| **`nginx-limit-check.js`** | Is nginx rate-limiting your IP? | Parallel burst to health, session, API (looks for HTTP 429) |
| **`browse.js`** | Read-heavy dashboard load | session → all-elections → election detail → eligibility |
| **`vote-encrypt-only.js`** | Encrypt ballot stress only | eligibility → create-encrypted-ballot (same email may repeat) |
| **`vote-encrypt-2000.js`** | Full encrypted vote path | eligibility → encrypt (repeat) → cast once per email |
| **`vote-flow.js`** | Full vote path (with crypto) | Same lifecycle as vote-encrypt-2000 |
| **`mixed-2000.js`** | Realistic mix | ~65% browse, ~30% vote, ~5% static pages |

### Vote test behaviour

Candidates are loaded from `GET /api/election/:ELECTION_ID` in k6 `setup()` (`electionChoices[].optionTitle`).

| Scenario | Email | Encrypt | Cast |
|----------|-------|---------|------|
| **vote-encrypt-only** | One per VU (`voterEmail`) | Unlimited | Never |
| **vote-encrypt-2000**, **vote-flow**, **mixed** (vote) | Stride allocation (`email-allocator.js`) | Per cycle | Once per email, then next seq (unlimited) |

**Collision-free emails** (`email-allocator.js`):

Each VU gets unlimited distinct emails via stride partitioning — **no two VUs can share an email**:

```
index = STEP_EMAIL_OFFSET + (seq - 1) × stepVus + (VU - 1)
```

- `stepVus` = target VUs for the step (e.g. 50, 200)
- VU1 seq 1,2,3… → a1, a51, a101… (when stepVus=50)
- VU2 seq 1,2,3… → a2, a52, a102…
- No per-VU cap; `seq` increments each vote cycle (or on skip after already-voted)

Between steps, `STEP_EMAIL_OFFSET` advances by an **estimate** (`stepVus × estimatedCyclesPerVu`) for planning only.

Seed `allowed_voters` for the full estimated range across all steps.

Lifecycle (production rules):

1. One email per cast — after cast, backend blocks further encrypt/cast for that email.
2. Load test VUs pick the **next sequential email** and keep cycling (no permanent idle).
3. First `ENCRYPT_WARMUP_ITERS` iterations (default **2**) per cycle — encrypt only on the same email.
4. Next iteration in the cycle — encrypt + cast once, then advance to the next email.

```bash
ENCRYPT_WARMUP_ITERS=3 ./load-tests/run.sh scenarios/vote-encrypt-2000.js
```

After heavy cast tests, change `TEST_EMAIL_PREFIX` or use a dedicated test election.

### Commands

```bash
./load-tests/run.sh scenarios/smoke.js
./load-tests/run.sh scenarios/nginx-limit-check.js
./load-tests/run.sh scenarios/browse.js
./load-tests/run.sh scenarios/vote-encrypt-only.js
./load-tests/run.sh scenarios/vote-flow.js
./load-tests/run.sh scenarios/vote-encrypt-2000.js
./load-tests/run.sh scenarios/mixed-2000.js
```

Recommended order: **smoke** → **nginx-limit-check** → **browse** → **vote-encrypt-only** → **vote-encrypt-2000** → **mixed-2000**

---

## Configuration (`load-tests/.env.loadtest`)

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | `https://amarvote2026.me` | Target server |
| `JWT_SECRET` | — | Must match server `~/.env` |
| `ELECTION_ID` | `10` | Election under test |
| `TEST_EMAIL_PREFIX` | `loadtest-voter` | Synthetic voter emails |
| `TEST_EMAIL_DOMAIN` | `example.com` | Email domain for JWT `sub` |
| `TEST_EMAIL_START_OFFSET` | `0` | Skip first N voters when resuming |
| `VOTE_CYCLE_SECONDS` | `~32` | Avg vote-cycle duration (sizes stepped email estimate) |
| `LOG_FAILURES` | `1` | Print `[VOTE-FAIL]` JSON lines for each failure (set `0` to silence) |
| `MAX_VUS` | `2000` | Final step in the ramp |
| `VU_STEPS` | `50,100,200,500,1000` | Intermediate steps (+ `MAX_VUS` appended) |
| `STAGE_RAMP_DURATION` | `2m` | Time to reach each VU level |
| `STAGE_HOLD_DURATION` | `3m` | Soak time at each level |
| `JWT_EXPIRATION_MS` | `3600000` | Must match backend `jwt.expiration` |

**Candidate names** are not configured. Vote scenarios call `GET /api/election/{ELECTION_ID}` before the test (`verify-election.sh` preflight + k6 `setup()`).

---

## Reports (output files)

| File pattern | When |
|--------------|------|
| `{test}-step-{N}-report.txt` | After each VU step (50, 100, …) |
| `{test}-step-{N}-report.json` | Machine-readable same data |
| `{test}-combined-report.txt` | Summary of all steps at end |
| `nginx-limit-check-report.txt` | Nginx diagnostic |
| `smoke-report.txt` | Smoke test summary |

All saved under **`load-tests/results/`** (gitignored).

---

## Server setup checklist

```bash
# SSH to amarvote2026.me

# 1. Enable load-test nginx
cd ~/app && bash load-tests/scripts/server-enable-loadtest-nginx.sh

# 2. Optional — free RAM
docker compose -f docker-compose.prod.yml stop prometheus grafana

# 3. From your laptop — run tests
./load-tests/run.sh scenarios/browse.js

# 4. Restore production nginx
bash load-tests/scripts/server-disable-loadtest-nginx.sh
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| JWT preflight fails (401) | Wrong `JWT_SECRET` locally | `docker exec amarvote_backend printenv JWT_SECRET` on server |
| Many HTTP 429 | Production nginx active | `server-enable-loadtest-nginx.sh` |
| ~50% failures at high VUs | Server overload (not nginx) | Check step report — last PASS step is your limit |
| ~33% encrypt fails, eligibility ok | Wrong/stale candidate names (fixed: names now fetched from API) | Set `ELECTION_ID`; run `verify-election.sh` |
| Encrypt fails, browser works | Load test paced too fast vs browser | `vote-encrypt-only.js` uses 5–15s think time |
| All eligibility fails | Election not open / not active | Set election `eligibility=unlisted`, check schedule |

---

## Skip preflight checks

```bash
SKIP_JWT_VERIFY=1 SKIP_NGINX_CHECK=1 SKIP_ELECTION_VERIFY=1 ./load-tests/run.sh scenarios/browse.js
```

See also: [docs/K6_LOAD_TEST_2000_USERS.md](../docs/K6_LOAD_TEST_2000_USERS.md), [docs/PRODUCTION_DEPLOY_AND_LOADTEST.md](../docs/PRODUCTION_DEPLOY_AND_LOADTEST.md)
