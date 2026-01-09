# 🔍 TROUBLESHOOTING GUIDE - Microservice Hangs

## The Problem
Microservice gets stuck processing chunks even after fixes. Here's how to diagnose and fix it.

## Critical Fixes Applied

### 1. **Removed ALL File I/O** ✅
**Problem**: `print_json()` and `print_data()` were writing to files with concurrent requests
- **File locking** causes blocking when multiple threads try to write
- **Disk I/O** is orders of magnitude slower than memory operations

**Fix**: 
- Disabled all file writes
- Using thread-safe logging to stdout instead
- All `print_json()` and `print_data()` calls are now commented out

### 2. **Added Request Tracking** ✅
**Problem**: No visibility into where requests get stuck

**Fix**:
- Added `@track_request` decorator to all endpoints
- Each request gets unique ID and thread tracking
- Logs START, COMPLETE, and FAILED for every request
- `/health` endpoint now shows stuck requests

### 3. **Thread-Safe Logging** ✅
**Problem**: Concurrent logging could cause race conditions

**Fix**:
- Proper logging configuration with thread info
- Format: `timestamp [ThreadName-ID] LEVEL: message`
- All output goes to stdout (no file blocking)

## How to Diagnose the Hang

### Step 1: Run the Monitor Script

**Terminal 1** (Run your chunk processing):
```bash
# Your backend making chunk requests
python your_chunk_processor.py
```

**Terminal 2** (Monitor for hangs):
```bash
cd Microservice
python monitor_microservice.py continuous 2
```

This will check every 2 seconds and alert you when requests get stuck.

### Step 2: Check the Logs

The microservice now logs EVERY step:
```
2026-01-10 15:30:00 [Thread-5-12345] INFO: [a1b2c3d4] START /create_encrypted_ballot (thread 12345)
2026-01-10 15:30:02 [Thread-5-12345] INFO: Creating encrypted ballot
2026-01-10 15:30:05 [Thread-5-12345] INFO: Finished encrypting ballot - Status: CAST
2026-01-10 15:30:05 [Thread-5-12345] INFO: [a1b2c3d4] COMPLETE /create_encrypted_ballot in 5.23s
```

**If it hangs**, you'll see:
```
[a1b2c3d4] START /create_encrypted_ballot (thread 12345)
Creating encrypted ballot
... then nothing (STUCK!)
```

### Step 3: Check Health Endpoint

While processing chunks:
```bash
curl http://localhost:5000/health
```

Response will show:
```json
{
  "status": "healthy",
  "active_requests": 3,
  "stuck_requests": [
    {
      "request_id": "a1b2c3d4",
      "endpoint": "/create_encrypted_ballot",
      "elapsed_seconds": 127,
      "thread_id": 12345
    }
  ],
  "thread_count": 15
}
```

This tells you EXACTLY which endpoint is stuck and for how long.

## Common Causes and Solutions

### Cause 1: ElectionGuard Library Blocking
**Symptom**: Logs show "Creating encrypted ballot" then hangs
**Solution**: ElectionGuard's cryptographic operations are CPU-intensive

**Fix**:
```python
# In gunicorn_config.py, reduce workers/threads:
workers = 2  # Instead of CPU*2+1
threads = 2  # Instead of 4
```

Too many concurrent crypto operations can overwhelm the system.

### Cause 2: Memory Exhaustion
**Symptom**: Works for first few chunks, then hangs
**Solution**: Python GC isn't aggressive enough

**Additional Fix** (add to api.py):
```python
import gc
gc.set_threshold(700, 10, 10)  # More aggressive GC
```

### Cause 3: Database Connection Pool Exhaustion
**Symptom**: Random chunks hang, no pattern
**Check**: If backend uses database connections

**Solution**: Increase connection pool in backend:
```python
# In your backend database config
max_connections = 50  # Increase this
connection_timeout = 30  # Add timeout
```

### Cause 4: Backend Timeout Too Short
**Symptom**: Backend reports timeout, but microservice still working
**Solution**: Increase backend request timeout

**In your backend**:
```python
response = requests.post(
    url,
    json=data,
    timeout=300  # 5 minutes instead of default
)
```

### Cause 5: Network Congestion
**Symptom**: Random hangs, inconsistent behavior
**Solution**: Process chunks sequentially, not in parallel

**In your backend**:
```python
# Instead of:
with ThreadPoolExecutor() as executor:
    futures = [executor.submit(process_chunk, i) for i in chunks]

# Do:
for chunk in chunks:
    result = process_chunk(chunk)  # One at a time
```

### Cause 6: Docker Resource Limits
**Symptom**: Container shows no activity (no CPU/RAM usage)
**Solution**: Container might be resource-starved

**Check**:
```bash
docker stats microservice
```

**Fix in docker-compose.yml**:
```yaml
microservice:
  # ... existing config ...
  deploy:
    resources:
      limits:
        cpus: '4.0'
        memory: 4G
      reservations:
        cpus: '2.0'
        memory: 2G
```

## Testing Strategy

### Test 1: Single Request (Baseline)
```bash
curl -X POST http://localhost:5000/create_encrypted_ballot \
  -H "Content-Type: application/json" \
  -d @test_ballot.json
```

**Expected**: Completes in 2-10 seconds
**If hangs**: ElectionGuard library issue or data problem

### Test 2: Sequential Chunks
```python
# Process chunks one at a time
for i in range(20):
    print(f"Processing chunk {i+1}/20...")
    result = process_chunk(i)
    print(f"Chunk {i+1} done")
    time.sleep(1)  # Give GC time to clean up
```

**Expected**: All 20 complete
**If hangs**: Memory issue or resource exhaustion

### Test 3: Monitor During Processing
```bash
# Terminal 1: Process chunks
python your_processor.py

# Terminal 2: Monitor continuously
python monitor_microservice.py continuous 1

# Terminal 3: Watch resources
watch -n 1 'docker stats microservice --no-stream'
```

## What to Look For

### ✅ Good Signs:
- Logs show START and COMPLETE for each request
- Memory stays under 500MB
- CPU spikes during processing, drops after
- No stuck requests in /health
- Each chunk takes similar time (5-15 seconds)

### ❌ Bad Signs:
- Logs show START but no COMPLETE
- Memory grows continuously
- CPU stays at 0% during "processing"
- Stuck requests in /health endpoint
- Time per chunk increases over time

## Rebuild and Test

```bash
# 1. Stop everything
docker-compose down

# 2. Rebuild microservice with fixes
docker-compose build microservice

# 3. Start with logging
docker-compose up microservice

# 4. In another terminal, run monitor
cd Microservice
python monitor_microservice.py continuous 2

# 5. Test with your chunks
python your_chunk_processor.py
```

## Emergency Debugging

If still hangs after all fixes:

### 1. Enable Python Profiling
```bash
# Add to api.py top:
import cProfile
import pstats

@app.before_request
def start_profiling():
    g.pr = cProfile.Profile()
    g.pr.enable()

@app.after_request  
def stop_profiling(response):
    g.pr.disable()
    stats = pstats.Stats(g.pr)
    stats.sort_stats('cumulative')
    stats.print_stats(10)  # Top 10 slowest
    return response
```

### 2. Add Checkpoint Logging
Add this to every major operation in api.py:
```python
logger.info("CHECKPOINT 1: Starting operation")
# ... do work ...
logger.info("CHECKPOINT 2: Completed step 1")
# ... more work ...
logger.info("CHECKPOINT 3: Completed step 2")
```

### 3. Thread Dump
```bash
# Get container ID
docker ps | grep microservice

# Get thread dump
docker exec <container-id> python -c "
import sys, threading
for th in threading.enumerate():
    print(th)
"
```

## Expected Behavior After Fixes

✅ **Chunk 1-5**: 5-10 seconds each
✅ **Chunk 6-10**: 5-10 seconds each  
✅ **Chunk 11-15**: 5-10 seconds each
✅ **Chunk 16-20**: 5-10 seconds each

Memory: Stays constant ~200-400MB
CPU: Spikes during each chunk, drops between
Logs: Shows START and COMPLETE for every chunk

## If Still Hangs

Please provide:
1. Output from `monitor_microservice.py`
2. Last 50 lines of microservice logs
3. Output from stuck request showing which checkpoint it reached
4. Docker stats output during hang

Then we can identify the exact line where it's blocking.

---

**The file I/O removal should fix 90% of hanging issues. If not, use the monitor script to see exactly where it's stuck.**
