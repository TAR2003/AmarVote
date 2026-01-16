# ✅ MEMORY LEAK FIXES - VERIFICATION CHECKLIST

**Date:** January 16, 2026  
**Status:** ✅ ALL FIXES APPLIED SUCCESSFULLY

---

## 🔍 PRE-DEPLOYMENT CHECKLIST

### ✅ Code Changes Verified

- [x] **Fix #1 Applied:** Line 1053 - Using projection query `findCipherTextsByElectionCenterId()`
- [x] **Fix #2 Applied:** Lines 963-985 - Election metadata cached before loop
- [x] **Fix #3 Applied:** Line 979 - Guardian count cached before loop  
- [x] **Fix #4 Applied:** Lines 1081-1091 - `entityManager.clear()` added after each chunk

### ✅ Compilation Status

- [x] No compilation errors
- [x] Only style warnings (unused null assignments - safe to ignore)
- [x] Service builds successfully

### ✅ Code Patterns Verified

- [x] Projection query used instead of full entity loading
- [x] `cachedCandidateNames` used in request builder (line ~1109)
- [x] `cachedPartyNames` used in request builder (line ~1108)
- [x] `cachedNumberOfGuardians` used in request builder (line ~1113)
- [x] `entityManager.flush()` called before clear
- [x] `entityManager.clear()` called after each save
- [x] Large objects explicitly nullified

---

## 🧪 TESTING CHECKLIST

### Test 1: Memory Monitoring

```bash
# SSH into server
ssh your-server

# Find Java process
PID=$(pgrep -f "amarvote")
echo "Monitoring PID: $PID"

# Monitor memory in real-time
watch -n 2 'jstat -gc $PID | tail -1 | awk "{print \"Used: \" (\$3+\$4+\$6+\$8)/1024 \"MB  |  Max: \" \$1/1024 \"MB\"}"'
```

**Expected Results:**
```
✅ Memory stays between 400-700 MB
✅ Memory oscillates (goes up/down) but doesn't grow linearly
✅ No OutOfMemoryError for 2000+ chunks
```

**Red Flags:**
```
❌ Memory grows linearly (500MB → 800MB → 1.1GB → 1.4GB...)
❌ Memory exceeds 1.5GB for < 1000 chunks
❌ OutOfMemoryError still occurs
```

---

### Test 2: Log Verification

**Look for these SUCCESS indicators:**

```bash
# Check for caching confirmation
grep "Election metadata cached" backend/logs/application.log

# Expected output:
✅ Election metadata cached: 50 candidates, 5 parties, 5 guardians
✅ This data will be REUSED for all 8000 operations!
```

```bash
# Check for entity clearing
grep "FIX LEAK #4" backend/logs/application.log | head -5

# Expected output:
⭐ FIX LEAK #4: CRITICAL - Clear Hibernate session to release ALL entities
```

```bash
# Check for projection query usage
grep "FIX LEAK #1" backend/logs/application.log | head -5

# Expected output:
⭐ FIX LEAK #1: MEMORY-EFFICIENT - Load only cipherText strings
```

---

### Test 3: Database Query Count

**Enable query logging** (PostgreSQL):

```sql
-- In psql or your DB admin tool
ALTER DATABASE amarvote SET log_statement = 'all';

-- Restart your app or reconnect
```

**Run a test election** with at least 100 chunks.

**Check query logs:**

```bash
# Count election_choice queries
grep "findByElectionIdOrderByChoiceIdAsc" /var/log/postgresql/postgresql-*.log | wc -l

# Expected: 1 query (not 100+)
```

```bash
# Count guardian queries with .size()
grep "findByElectionId.*FROM guardian" /var/log/postgresql/postgresql-*.log | wc -l

# Expected: 1 query (not 100+)
```

**Success Criteria:**
```
✅ Only 1 election_choice query per decryption session
✅ Only 1 guardian count query per decryption session
✅ No N+1 query patterns
```

---

### Test 4: Stress Test

**Run with these parameters:**
- Election with **2000+ chunks**
- **4 guardians** (typical scenario)
- Total operations: 2000 × 4 = **8,000 compensated decryptions**

**Monitor:**
```bash
# Terminal 1: Memory
watch -n 2 'jstat -gc $(pgrep java) | tail -1'

# Terminal 2: CPU
htop -p $(pgrep java)

# Terminal 3: Application logs
tail -f backend/logs/application.log | grep -E "(Memory|Chunk|Progress)"
```

**Expected Results:**
```
✅ Completes all 8,000 operations successfully
✅ Memory stays under 800 MB throughout
✅ No OutOfMemoryError
✅ Processing time is predictable (not slowing down)
✅ GC pauses are short and infrequent
```

---

## 📊 METRICS TO COLLECT

### Before Fix (Baseline)

Record these for comparison:

```
Memory at chunk 100:  _______ MB
Memory at chunk 500:  _______ MB
Memory at chunk 1000: _______ MB (likely OutOfMemoryError)

Total election_choice queries: _______
Total guardian queries: _______

OutOfMemoryError at chunk: _______
```

### After Fix (Expected)

```
✅ Memory at chunk 100:  ~480 MB
✅ Memory at chunk 500:  ~530 MB
✅ Memory at chunk 1000: ~560 MB
✅ Memory at chunk 2000: ~590 MB

✅ Total election_choice queries: 1
✅ Total guardian queries: 1

✅ No OutOfMemoryError (completes all chunks)
```

---

## 🚨 TROUBLESHOOTING

### Issue: Memory Still Growing Linearly

**Check:**
1. Is `entityManager.clear()` actually being called?
   ```bash
   grep "FIX LEAK #4" logs/application.log
   ```

2. Is the projection query being used?
   ```bash
   grep "findCipherTextsByElectionCenterId" logs/application.log
   ```

3. Are there other loops loading entities?
   ```bash
   grep -n "findByElectionId\|findById" PartialDecryptionService.java
   ```

---

### Issue: Still Seeing 8,000 Election Choice Queries

**Check:**
1. Is the cached metadata being used?
   ```bash
   grep "cachedCandidateNames\|cachedPartyNames" PartialDecryptionService.java
   ```

2. Verify the cache is created before the loop:
   ```bash
   grep -A 5 "FIX LEAK #2: CACHE ELECTION METADATA" PartialDecryptionService.java
   ```

---

### Issue: OutOfMemoryError Still Occurs

**Possible causes:**

1. **Heap size too small:** Increase JVM heap
   ```bash
   -Xmx2G -Xms1G
   ```

2. **Other memory leaks exist:** Profile with VisualVM or JProfiler
   ```bash
   jvisualvm &
   # Attach to Java process and take heap dump
   ```

3. **External service memory issue:** Check ElectionGuard microservice
   ```bash
   docker stats | grep electionguard
   ```

---

## ✅ SIGN-OFF CRITERIA

**The fix is successful when ALL of these are true:**

- [ ] **Memory stays constant:** No linear growth with chunk count
- [ ] **Completes 2000 chunks:** No OutOfMemoryError
- [ ] **Only 2 metadata queries:** 1 for choices, 1 for guardians  
- [ ] **Logs show caching:** "Election metadata cached" message appears
- [ ] **Logs show clearing:** "FIX LEAK #4" messages appear after each chunk
- [ ] **94% memory reduction:** Compared to baseline measurements
- [ ] **Performance is predictable:** Processing time per chunk is constant

---

## 📝 DEPLOYMENT NOTES

### Before Deploying to Production

1. **Test in staging** with production-like data (2000+ chunks)
2. **Run stress tests** with 4-5 guardians
3. **Monitor memory** for at least 1 complete election cycle
4. **Verify logs** show all optimizations are working
5. **Benchmark performance** (time to complete decryption)
6. **Document baseline metrics** for comparison

### Production Deployment

```bash
# 1. Backup current version
git tag pre-memory-fix-$(date +%Y%m%d)

# 2. Build with fixes
cd backend
mvn clean package -DskipTests

# 3. Deploy to server
# (Your deployment process here)

# 4. Monitor closely for first 24 hours
tail -f /var/log/amarvote/application.log | grep -E "(Memory|OutOfMemory|Error)"
```

### Rollback Plan

If issues occur:

```bash
# 1. Stop application
sudo systemctl stop amarvote

# 2. Restore previous version
git checkout pre-memory-fix-<date>
mvn clean package

# 3. Restart application
sudo systemctl start amarvote

# 4. Investigate logs
```

---

## 🎉 SUCCESS CONFIRMATION

Once deployed and verified, update this checklist:

**Production Verification (Date: ____________):**

- [ ] Processed election with _____ chunks successfully
- [ ] Memory stayed under _____ MB throughout
- [ ] Total database queries: _____ (expected: ~8,000)
- [ ] No OutOfMemoryError occurred
- [ ] Performance improvement: _____% faster than before
- [ ] Memory usage reduction: _____% less than before

**Confirmed by:** _______________  
**Date:** _______________

---

## 📚 ADDITIONAL RESOURCES

- [Memory Leak Analysis](./CRITICAL_MEMORY_LEAKS_ANALYSIS.md)
- [Exact Code Changes](./EXACT_CODE_CHANGES.md)
- [Industrial Fix Implementation](./PartialDecryptionService_INDUSTRIAL_FIX.java)
- [Fix Summary](./MEMORY_LEAK_FIXES_APPLIED.md)

---

**Status:** ✅ Ready for Testing  
**Next Step:** Run Test 1 (Memory Monitoring) in staging environment
