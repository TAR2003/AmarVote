# Production Deploy vs Load Testing

This document separates **what GitHub auto-deploy does** from **what you must do manually on the cloud server** before/after k6 load tests.

**Rule:** `nginx-proxy.conf` (DDoS rate limits) is **never** changed by deploy or load-test tooling. Load tests use a **separate file** switched manually on the server.

---

## What GitHub deploy does (unchanged)

Push to `main` runs `.github/workflows/docker-deploy.yml`:

```bash
docker compose --env-file .env -f docker-compose.prod.yml down
docker compose --env-file .env -f docker-compose.prod.yml build
docker compose --env-file .env -f docker-compose.prod.yml up -d --force-recreate
```

| Item | Value |
|------|--------|
| Compose file | `docker-compose.prod.yml` **only** |
| Nginx config | `nginx-proxy.conf` (rate limits **ON**) |
| Load-test overlay | **Not used** (`docker-compose.loadtest.yml` is never run by CI) |
| Secrets | Server `~/.env` copied to `~/app/.env` (not from git) |

### Production nginx limits (`nginx-proxy.conf`) — keep these for real elections

| Zone | Limit | Purpose |
|------|-------|---------|
| `conn_limit` | 20 connections / IP | Connection flood protection |
| `global_limit` | 100 req/s / IP | General abuse |
| `api_limit` | 10 req/s on `/api/` | API flood protection |
| `auth_limit` | 10 req/min on auth paths | Brute-force protection |
| `email_code_limit` | 1 req/min | Email abuse |

**Do not edit `nginx-proxy.conf` for load testing.** Use `nginx-proxy.loadtest.conf` instead.

---

## Files: production vs load test

| File | Used by deploy? | Rate limits | When |
|------|-----------------|-------------|------|
| `nginx-proxy.conf` | **Yes** | Strict (DDoS) | Normal production & election day |
| `nginx-proxy.loadtest.conf` | **No** | Relaxed (email codes only) | Manual load-test window only |
| `docker-compose.prod.yml` | **Yes** | — | Every deploy |
| `docker-compose.loadtest.yml` | **No** | — | Manual overlay on server only |

---

## Before load testing (manual on cloud server)

Run these **on the VM** (`ssh` into amarvote2026.me). **Do not** change the GitHub workflow.

### 1. Deploy latest code (normal — keeps production nginx)

Either push to `main` (auto-deploy) or on the server:

```bash
cd ~/app
docker compose --env-file .env -f docker-compose.prod.yml up -d --build
```

Confirm nginx is using production config:

```bash
docker inspect amarvote_nginx --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{"\n"}}{{end}}' | grep default.conf
# Should show: .../nginx-proxy.conf -> .../default.conf
```

### 2. Switch to load-test nginx (temporary)

```bash
cd ~/app
docker compose --env-file .env \
  -f docker-compose.prod.yml \
  -f docker-compose.loadtest.yml \
  up -d nginx

# Verify load-test config is active
docker inspect amarvote_nginx --format '{{range .Mounts}}{{.Source}}{{"\n"}}{{end}}' | grep nginx-proxy
# Should show: nginx-proxy.loadtest.conf
```

Optional — free ~256 MB RAM before peak test:

```bash
docker compose -f docker-compose.prod.yml stop prometheus grafana
```

### 3. Seed test voters (once per test election)

Edit `load-tests/scripts/seed-loadtest-users.sql` (email domain), then:

```bash
docker exec -i amarvote_postgres psql -U amarvote_user -d amarvote_db \
  < load-tests/scripts/seed-loadtest-users.sql
```

### 4. Run k6 from your machine

```bash
cp load-tests/.env.loadtest.example load-tests/.env.loadtest
# Set JWT_SECRET from server .env (or use root .env — run.sh loads it)

./load-tests/run.sh scenarios/smoke.js
./load-tests/run.sh scenarios/vote-encrypt-2000.js
./load-tests/run.sh scenarios/mixed-2000.js
```

Election 10 candidates (configured in `.env.loadtest.example`): `A big name`, `nobo tobo`, `masnoon muztahid`.

---

## After load testing — restore production (required)

```bash
cd ~/app

# Restore DDoS nginx (production config)
docker compose --env-file .env -f docker-compose.prod.yml up -d nginx

# Restart monitoring if stopped
docker compose -f docker-compose.prod.yml up -d prometheus grafana

# Confirm production nginx is back
docker inspect amarvote_nginx --format '{{range .Mounts}}{{.Source}}{{"\n"}}{{end}}' | grep nginx-proxy
# Must show: nginx-proxy.conf (NOT loadtest)
```

---

## Before real election day (production checklist)

Complete **before** voters use the system in production. Load-test nginx must **not** be active.

### Infrastructure

- [ ] `nginx-proxy.conf` is mounted (not `nginx-proxy.loadtest.conf`)
- [ ] `free -h` shows 4 GB RAM + 4 GB swap
- [ ] All containers healthy: `docker compose -f docker-compose.prod.yml ps`
- [ ] `GET https://amarvote2026.me/api/health` returns OK
- [ ] Cloudflare / DNS pointing to correct origin

### Security (rate limits)

- [ ] `api_limit` 10 r/s active on `/api/`
- [ ] `auth_limit` 10 r/min active on auth paths
- [ ] `conn_limit` 20 per IP active
- [ ] Email code endpoints limited to 1 r/min

### Election readiness

- [ ] Election created and key ceremony completed
- [ ] Election activated with correct start/end times
- [ ] Voter allowlist correct (if `listed` eligibility)
- [ ] Guardian accounts tested
- [ ] Spot-vote test: eligibility → encrypt → cast (one real user)

### Monitoring

- [ ] Prometheus scraping backend metrics
- [ ] Grafana dashboards accessible (SSH tunnel)
- [ ] Know how to run: `docker compose -f docker-compose.prod.yml logs -f backend electionguard_api nginx`

### What NOT to do on election day

- Do **not** run k6 against production with load-test nginx
- Do **not** leave `nginx-proxy.loadtest.conf` active
- Do **not** commit `.env` or `load-tests/.env.loadtest`
- Do **not** add `docker-compose.loadtest.yml` to GitHub Actions

---

## Quick reference

| Action | Command |
|--------|---------|
| Normal deploy (GitHub or manual) | `docker compose -f docker-compose.prod.yml up -d --build` |
| Enable load-test nginx | `docker compose -f docker-compose.prod.yml -f docker-compose.loadtest.yml up -d nginx` |
| Restore production nginx | `docker compose -f docker-compose.prod.yml up -d nginx` |
| Run k6 | `./load-tests/run.sh scenarios/vote-encrypt-2000.js` |

See also: [K6_LOAD_TEST_2000_USERS.md](./K6_LOAD_TEST_2000_USERS.md), [PRODUCTION_DEPLOYMENT_4GB.md](./PRODUCTION_DEPLOYMENT_4GB.md).
