# Log Analysis Guide - Diagnosing Connection Issues

## Quick Log Checks

### 1. Is the system stuck?

```bash
# Check if requests are starting but not completing
docker logs backend 2>&1 | grep "STARTING POST REQUEST" | tail -5
docker logs backend 2>&1 | grep "REQUEST COMPLETED" | tail -5
```

**What to look for:**
- Recent "STARTING" entries without matching "COMPLETED"
- Large time gap between start and completion
- Multiple requests starting at same chunk number

### 2. What's the connection pool status?

```bash
# Get latest connection pool stats
docker logs backend 2>&1 | grep "Connection Pool Stats" -A 5 | tail -30
```

**Healthy pool:**
```
[REQ-123][POOL-BEFORE] Connection Pool Stats:
  Available: 85
  Leased (In Use): 15
  Pending: 0
  Usage: 15/100 (15%)
```

**Problem indicators:**
```
[REQ-456][POOL-BEFORE] Connection Pool Stats:
  Available: 0
  Leased (In Use): 100
  Pending: 8  ← ⚠️ REQUESTS WAITING!
  Usage: 100/100 (100%)
```

### 3. Where are requests spending time?

```bash
# Backend timing breakdown
docker logs backend 2>&1 | grep "Timing breakdown:" -A 5 | tail -30
```

**Example:**
```
📊 Timing breakdown:
   - DB fetch election center: 15ms    ← Should be < 100ms
   - DB fetch ballots: 23ms           ← Should be < 500ms
   - Microservice call: 12340ms       ← Can be long for crypto
   - DB save decryption: 18ms         ← Should be < 100ms
   - Total chunk time: 12396ms
```

### 4. Is the microservice responding?

```bash
# Check microservice request flow
docker logs microservice 2>&1 | grep -E "(RECEIVED REQUEST|COMPLETED)" | tail -20
```

**Should see pairs:**
```
🎯 [REQ-abc] RECEIVED REQUEST
✅ [REQ-abc] REQUEST COMPLETED SUCCESSFULLY
🎯 [REQ-def] RECEIVED REQUEST
✅ [REQ-def] REQUEST COMPLETED SUCCESSFULLY
```

## Detailed Analysis

### Scenario 1: System Hangs During Concurrent Processing

**Symptoms:**
- Both processes at ~84/85 chunks
- No progress for several minutes
- Logs show requests starting but not completing

**Check:**
```bash
# 1. Connection pool exhaustion?
docker logs backend 2>&1 | grep "POOL-" | tail -20

# 2. How many in-flight requests?
docker logs backend 2>&1 | grep -E "(STARTING POST|COMPLETED)" | tail -40

# 3. Are there warnings?
docker logs backend 2>&1 | grep -E "(usage HIGH|waiting for connections)"
```

**Diagnosis:**

**If you see:**
```
[POOL-BEFORE] Available: 0, Leased: 100, Pending: 10
⚠️ Connection pool usage HIGH (>80%)!
⚠️ 10 requests waiting for connections!
```

**Root cause:** Connection pool too small for concurrent load

**Solution:** Already fixed with increased pool size, but if still occurring:
1. Check `application.properties` has updated values
2. Verify backend was rebuilt after changes
3. Consider increasing limits further

---

### Scenario 2: Slow Microservice Responses

**Symptoms:**
- Requests complete eventually
- But each chunk takes very long
- No connection pool issues

**Check:**
```bash
# Microservice timing
docker logs microservice 2>&1 | grep "Total time:" | awk '{print $NF}' | sort -n | tail -20
```

**If times are consistently >5000ms per request:**

```bash
# Check what's slow in microservice
docker logs microservice 2>&1 | grep -E "(Deserialization|Service processing)" -A 1
```

**Example output:**
```
[REQ-abc] Deserialization: 50.00ms      ← Should be < 200ms
[REQ-abc] Service processing: 4500.00ms  ← Crypto operations (expected)
```

**If deserialization is slow (>500ms):** Request payloads may be too large
**If service processing is very slow (>30s):** Check microservice resources

---

### Scenario 3: Database Bottleneck

**Symptoms:**
- Microservice responds quickly
- But overall chunk time is long
- Connection pool has plenty of available connections

**Check:**
```bash
# Database operation timing
docker logs backend 2>&1 | grep "DB fetch\|DB save" | tail -30
```

**Healthy:**
```
✅ [DB] Election center fetch completed in 15ms
✅ [DB] Submitted ballots fetch completed in 45ms
✅ [DB] Decryption data saved in 18ms
```

**Problem:**
```
✅ [DB] Election center fetch completed in 2500ms  ← TOO SLOW
✅ [DB] Submitted ballots fetch completed in 3200ms  ← TOO SLOW
✅ [DB] Decryption data saved in 1800ms  ← TOO SLOW
```

**Solutions:**
- Check database connection pool
- Look for long-running queries
- Verify database performance
- Check for locks/deadlocks

---

### Scenario 4: Network Issues

**Symptoms:**
- Backend shows "Calling microservice..."
- Long delay before response or error
- Connection pool OK

**Check:**
```bash
# Look for timeouts or connection errors
docker logs backend 2>&1 | grep -E "(timeout|refused|unreachable)" -i

# Check microservice received the request
docker logs microservice 2>&1 | grep "RECEIVED REQUEST" | tail -20
```

**If backend sent but microservice didn't receive:**
- Network connectivity issue
- DNS resolution problem
- Firewall blocking

**If microservice received but backend didn't get response:**
- Response too large
- Network timeout
- Connection dropped

---

## Common Log Patterns

### ✅ Normal Operation

**Backend:**
```
[REQ-123] ===== STARTING POST REQUEST =====
[REQ-123][POOL-BEFORE] Available: 85, Leased: 15, Pending: 0
[REQ-123] ⏳ Calling ElectionGuard microservice...
[REQ-123] ===== RESPONSE RECEIVED =====
[REQ-123] Request duration: 1234ms
[REQ-123][POOL-AFTER] Available: 86, Leased: 14, Pending: 0
[REQ-123] ✅ Successfully received valid response
```

**Microservice:**
```
🎯 [REQ-abc] RECEIVED REQUEST
[REQ-abc] 📦 Request data received: Guardian ID: 1
[REQ-abc] ✅ Service function completed in 1200.50ms
[REQ-abc] ✅ REQUEST COMPLETED SUCCESSFULLY
[REQ-abc] ⏱️ Total time: 1234.56ms
```

### ⚠️ Warning Signs

**Connection pool getting full:**
```
[REQ-456][POOL-BEFORE] Available: 15, Leased: 85, Pending: 0, Usage: 85%
⚠️ Connection pool usage HIGH (>80%)! Risk of exhaustion!
```

**Requests waiting for connections:**
```
[REQ-789][POOL-BEFORE] Available: 0, Leased: 100, Pending: 5
⚠️ 5 requests waiting for connections!
```

**Slow microservice:**
```
[REQ-abc] ⏱️ Total time: 45678.90ms  ← Much longer than usual
```

### ❌ Error Patterns

**Connection timeout:**
```
[REQ-999] ❌ Failed to make POST request to /create_partial_decryption
[REQ-999] Error type: SocketTimeoutException
[REQ-999] Error message: Read timed out
```

**Connection refused:**
```
[REQ-888] ❌ Failed to make POST request
[REQ-888] Error type: ConnectException
[REQ-888] Error message: Connection refused
```

**Deserialization error:**
```
[REQ-777] ❌ REQUEST FAILED (ValueError)
[REQ-777] Error: Error deserializing ciphertext_tally
```

## Monitoring Scripts

### Real-time Connection Pool Monitor

```bash
# Watch connection pool in real-time
watch -n 2 'docker logs backend 2>&1 | grep "Connection Pool Stats" -A 5 | tail -30'
```

### Request Completion Rate

```bash
# Check request completion rate (run every minute)
STARTED=$(docker logs backend 2>&1 | grep "STARTING POST REQUEST" | wc -l)
COMPLETED=$(docker logs backend 2>&1 | grep "REQUEST COMPLETED SUCCESSFULLY" | wc -l)
echo "Started: $STARTED, Completed: $COMPLETED, In Progress: $(($STARTED - $COMPLETED))"
```

### Average Response Time

```bash
# Calculate average microservice response time
docker logs microservice 2>&1 | grep "Total time:" | \
  awk '{sum+=$NF; count++} END {print "Average:", sum/count "ms"}'
```

### Identify Slow Chunks

```bash
# Find chunks that took > 10 seconds
docker logs backend 2>&1 | grep "Total chunk time:" | \
  awk '{if ($5+0 > 10000) print}' | tail -20
```

## Alerting Conditions

Set up alerts for:

1. **Connection pool usage > 90%**
   ```bash
   docker logs backend 2>&1 | grep "Usage:" | \
     awk -F'[()]' '{if ($2+0 > 90) print "ALERT: High connection pool usage"}'
   ```

2. **Pending connections > 0**
   ```bash
   docker logs backend 2>&1 | grep "Pending:" | \
     awk '{if ($2+0 > 0) print "ALERT: Requests waiting for connections"}'
   ```

3. **Requests stuck > 5 minutes**
   ```bash
   # Check for requests that started >5 min ago without completion
   # (Implement with timestamp comparison)
   ```

4. **Error rate > 5%**
   ```bash
   ERRORS=$(docker logs backend 2>&1 | grep "REQUEST FAILED" | wc -l)
   TOTAL=$(docker logs backend 2>&1 | grep "STARTING POST REQUEST" | wc -l)
   ERROR_RATE=$(echo "scale=2; ($ERRORS * 100) / $TOTAL" | bc)
   echo "Error rate: $ERROR_RATE%"
   ```

## Log Retention

For production analysis, consider:

```bash
# Rotate logs daily
docker logs backend > logs/backend-$(date +%Y%m%d).log 2>&1
docker logs microservice > logs/microservice-$(date +%Y%m%d).log 2>&1

# Keep last 7 days
find logs/ -name "*.log" -mtime +7 -delete
```

## Quick Troubleshooting Checklist

- [ ] Check connection pool stats - are connections available?
- [ ] Look for warning messages about pool exhaustion
- [ ] Verify microservice is receiving and responding to requests
- [ ] Check timing breakdowns - where is time being spent?
- [ ] Look for error messages in both backend and microservice
- [ ] Verify database operations are completing quickly
- [ ] Check for any timeout or connection errors
- [ ] Compare current behavior to normal operation logs

---

**Remember**: With comprehensive logging in place, every issue leaves a trace. The logs will tell you exactly what's happening and where the bottleneck is.
