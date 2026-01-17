# 🧪 Memory Optimization Testing Guide

## Quick Verification Steps

### Step 1: Compile and Start Application
```bash
cd backend
mvn clean install
java -Xms512m -Xmx2048m -jar target/amarvote-backend.jar
```

### Step 2: Monitor Memory During Processing

#### Terminal 1: Watch Logs
```bash
tail -f backend/logs/application.log
```

#### Terminal 2: Monitor JVM Memory
```bash
# Find Java PID
jps

# Watch garbage collection
jstat -gc <pid> 1000
```

### Step 3: Expected Log Output

#### ✅ Good Signs (Every 50 chunks)
```
📊 Progress [Tally Creation]: 50/400 | Memory: 650MB/2048MB (31.7%)
🧠 Memory before chunk 51: 645 MB
🧠 Memory after chunk 51: 648 MB (freed 3 MB)
✅ Chunk 51 completed. Progress: 51/400

📊 Progress [Tally Creation]: 100/400 | Memory: 680MB/2048MB (33.2%)
```

#### ❌ Bad Signs (Memory Leak)
```
🧠 Memory before chunk 300: 2513 MB
🧠 Memory before chunk 310: 2523 MB
🧠 Memory before chunk 320: 2535 MB
🗑️ Memory usage high (85.2%) - Suggesting GC
❌ OutOfMemoryError: Java heap space
```

---

## Testing Scenarios

### Scenario 1: Small Election (50-100 chunks)
**Purpose**: Verify basic functionality
**Expected**: Completes in < 5 minutes, memory < 500MB

```bash
# Create election with 1000 ballots
# Expected: ~50 chunks at 20 ballots/chunk
```

### Scenario 2: Medium Election (500 chunks)
**Purpose**: Verify memory optimization
**Expected**: Completes in 20-30 minutes, memory < 800MB

```bash
# Create election with 10,000 ballots
# Expected: ~500 chunks
# Watch for: Periodic GC hints every 50 chunks
# Memory should stay constant
```

### Scenario 3: Large Election (2000 chunks)
**Purpose**: Stress test
**Expected**: Completes in 2-3 hours, memory < 1GB

```bash
# Create election with 40,000 ballots
# Expected: ~2000 chunks
# This should succeed without OOM
```

---

## Memory Monitoring Commands

### Check Current Memory Usage
```bash
jstat -gc <pid> | tail -1
```

### Get Heap Histogram (Top 20 Objects)
```bash
jmap -histo:live <pid> | head -20
```

### Trigger Manual GC (for testing)
```bash
jcmd <pid> GC.run
```

### Get Memory Summary
```bash
jcmd <pid> VM.native_memory summary
```

---

## Verification Checklist

### Before Running Tests
- [ ] Code compiled successfully
- [ ] All repository projection queries added
- [ ] `suggestGCIfNeeded()` method present in both services
- [ ] Projection queries used in chunk processing
- [ ] `entityManager.clear()` called after each chunk
- [ ] Guardian count queries use `countByElectionId()`

### During Processing
- [ ] Memory stays relatively constant
- [ ] GC hints appear every 50 chunks
- [ ] No "High memory usage" warnings
- [ ] No OutOfMemoryError
- [ ] Progress logs show memory usage < 70%

### After Completion
- [ ] All chunks processed successfully
- [ ] Memory returns to baseline (~300-400MB)
- [ ] No residual memory leaks
- [ ] Application remains responsive

---

## Troubleshooting

### Issue: Memory still growing linearly
**Check**:
1. Is `entityManager.clear()` being called after each chunk?
2. Are you using projection queries (`findCipherTextsByElectionCenterId`)?
3. Are you using count query (`countByElectionId`)?
4. Any static collections accumulating data?

**Fix**:
```bash
# Take heap dump
jmap -dump:live,format=b,file=/tmp/heap.hprof <pid>

# Analyze with VisualVM or Eclipse MAT
# Look for: Retained size of Hibernate session
```

### Issue: OutOfMemoryError still occurs
**Check**:
1. Heap size setting: `-Xmx2048m` should be sufficient
2. Code changes applied correctly
3. Using old code path accidentally

**Fix**:
```bash
# Increase heap temporarily for diagnosis
java -Xms1024m -Xmx4096m -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/tmp/heap.hprof -jar app.jar

# Then analyze why extra memory is needed
```

### Issue: GC pauses too long (> 500ms)
**Check**:
1. GC algorithm in use
2. Heap size too small
3. Old generation full

**Fix**:
```bash
# Use G1GC for better pause times
java -XX:+UseG1GC -XX:MaxGCPauseMillis=200 -jar app.jar

# Enable GC logging
java -Xlog:gc*:file=gc.log -jar app.jar
```

---

## Success Metrics

| Metric | Target | How to Check |
|--------|--------|--------------|
| **Max Memory** | < 1GB for 2000 chunks | Watch logs: `Memory: XXX/2048MB` |
| **GC Frequency** | Every 50 chunks | Count "🗑️" in logs |
| **GC Pause** | < 200ms | Check GC logs |
| **Memory Leak** | None | Memory stays constant |
| **Completion** | No OOM | Process completes successfully |

---

## Performance Baseline

### Expected Timings (approximate)
- **50 chunks**: ~2-3 minutes
- **500 chunks**: ~20-30 minutes
- **2000 chunks**: ~2-3 hours

### Expected Memory Pattern
```
Chunk 0-50:     400MB → 650MB (ramp up)
Chunk 50-500:   650MB → 750MB (stable)
Chunk 500-2000: 750MB → 800MB (stable)
```

---

## Advanced Monitoring

### Enable JMX Monitoring
```bash
java -Dcom.sun.management.jmxremote \
     -Dcom.sun.management.jmxremote.port=9090 \
     -Dcom.sun.management.jmxremote.authenticate=false \
     -Dcom.sun.management.jmxremote.ssl=false \
     -jar app.jar
```

### Connect with VisualVM
```bash
jvisualvm
# Connect to localhost:9090
# Watch: Heap, Threads, GC activity
```

### Enable Flight Recorder
```bash
java -XX:StartFlightRecording=duration=60m,filename=/tmp/recording.jfr -jar app.jar

# Analyze with JDK Mission Control
jmc
```

---

## Quick Test Script

```bash
#!/bin/bash
# memory-test.sh - Quick memory optimization test

echo "=== Memory Optimization Test ==="
echo "Starting application with memory monitoring..."

# Start app with memory settings
java -Xms512m -Xmx2048m \
     -XX:+HeapDumpOnOutOfMemoryError \
     -XX:HeapDumpPath=/tmp/heap-$(date +%Y%m%d-%H%M%S).hprof \
     -Xlog:gc*:file=/tmp/gc-$(date +%Y%m%d-%H%M%S).log \
     -jar target/amarvote-backend.jar &

APP_PID=$!
echo "Application PID: $APP_PID"

# Monitor memory every 30 seconds
while kill -0 $APP_PID 2>/dev/null; do
    MEMORY=$(jstat -gc $APP_PID | tail -1 | awk '{print int(($3+$4+$6+$8)/1024)" MB"}')
    echo "[$(date +%H:%M:%S)] Heap usage: $MEMORY"
    sleep 30
done

echo "Application stopped"
```

---

## Testing Checklist Summary

### Pre-Test
- [ ] Code changes applied
- [ ] Application compiles
- [ ] Test environment ready
- [ ] Monitoring tools installed

### During Test
- [ ] Monitor logs in real-time
- [ ] Watch memory usage
- [ ] Note any warnings
- [ ] Check GC frequency

### Post-Test
- [ ] Verify completion
- [ ] Check final memory
- [ ] Review GC logs
- [ ] Document results

---

## Expected vs Actual Results Template

```markdown
## Test Results - [Date]

### Configuration
- Ballots: [number]
- Expected Chunks: [number]
- Heap Size: -Xmx[size]

### Results
| Metric | Expected | Actual | Status |
|--------|----------|--------|--------|
| Max Memory | < 1GB | [actual] | ✅/❌ |
| GC Frequency | Every 50 | [actual] | ✅/❌ |
| Completion | Success | [status] | ✅/❌ |
| OOM Errors | 0 | [count] | ✅/❌ |

### Observations
- [Note any unexpected behavior]
- [Performance issues]
- [Recommendations]
```

---

## Quick Validation (1 minute)

```bash
# 1. Check projection query exists
grep -n "findCipherTextsByElectionCenterId" backend/src/main/java/com/amarvote/amarvote/repository/SubmittedBallotRepository.java

# 2. Check count query exists
grep -n "countByElectionId" backend/src/main/java/com/amarvote/amarvote/repository/GuardianRepository.java

# 3. Check memory utility method
grep -n "suggestGCIfNeeded" backend/src/main/java/com/amarvote/amarvote/service/TallyService.java

# 4. Check entityManager.clear() usage
grep -n "entityManager.clear" backend/src/main/java/com/amarvote/amarvote/service/TallyService.java

# All should return results ✅
```

---

**Ready to Test**: Follow steps above to verify memory optimization
**Expected Outcome**: Handle 2000+ chunks with < 1GB memory
**Success Indicator**: Consistent memory usage throughout processing
