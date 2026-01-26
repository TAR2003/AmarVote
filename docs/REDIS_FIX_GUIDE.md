# Redis Connection Fix Guide for AmarVote

## Problem
Backend is trying to connect to Redis at `localhost:6379` instead of the Docker service `redis:6379`.

Error:
```
RedisConnectionFailureException: Unable to connect to Redis
Caused by: Connection refused: localhost/127.0.0.1:6379
```

## Root Cause
The backend container needs to use the Redis service name `redis` (not `localhost`) to connect via Docker network.

## Solution

### Step 1: Verify Redis is Running
Run on your **Linux VM terminal**:
```bash
cd /mnt/hgfs/AmarVote
docker compose -f docker-compose.prod.yml ps redis
```

Expected output: Redis should be "Up" and healthy.

### Step 2: Test Redis Connectivity
```bash
docker exec amarvote_redis redis-cli ping
```

Expected output: `PONG`

### Step 3: Verify Environment Variables in docker-compose.prod.yml
The file should have (around line 117):
```yaml
- REDIS_HOST=redis
- REDIS_PORT=6379
- REDIS_PASSWORD=""
```

### Step 4: Restart Backend Container
```bash
cd /mnt/hgfs/AmarVote
docker compose -f docker-compose.prod.yml restart backend
```

### Step 5: Monitor Backend Logs
```bash
docker compose -f docker-compose.prod.yml logs -f backend | grep -i "redis\|connection"
```

Look for:
- ✅ Success: No Redis connection errors
- ❌ Still failing: Continue to Step 6

### Step 6: Rebuild Backend (if restart didn't work)
```bash
cd /mnt/hgfs/AmarVote
docker compose -f docker-compose.prod.yml stop backend
docker compose -f docker-compose.prod.yml rm -f backend
docker compose -f docker-compose.prod.yml up -d backend
```

### Step 7: Full Stack Restart (last resort)
```bash
cd /mnt/hgfs/AmarVote
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
```

## Verify Fix
After the backend restarts, try the guardian credentials submission again. The error should be gone.

## Why This Happens
In Docker networks:
- ❌ `localhost:6379` - tries to connect within the same container (fails)
- ✅ `redis:6379` - uses Docker DNS to find the Redis service container

## Check Current Configuration
To see what environment variables the backend is actually using:
```bash
docker exec amarvote_backend env | grep REDIS
```

Should output:
```
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=
```

If it shows `REDIS_HOST=localhost` or missing REDIS variables, the environment wasn't applied - rebuild needed.
