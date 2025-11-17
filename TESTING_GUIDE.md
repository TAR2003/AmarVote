# Quick Testing Guide - Packet Size Padding

## Test 1: Frontend Console Verification

1. Open your application in a browser
2. Open Developer Tools (F12)
3. Go to Console tab
4. Navigate to an election and prepare to vote
5. Select different candidates and submit

**Expected Output:**
```
📦 [PACKET PADDING] Original: 145B, Final: 4096B, Target: 4096B
📦 [PACKET PADDING] Original: 178B, Final: 4096B, Target: 4096B
📦 [PACKET PADDING] Original: 203B, Final: 4096B, Target: 4096B
```

**✅ Pass:** All show `Final: 4096B`  
**❌ Fail:** Different final sizes or no padding messages

---

## Test 2: Network Tab Verification

1. Open Developer Tools (F12)
2. Go to Network tab
3. Filter for: `create-encrypted-ballot`
4. Vote with 3 different candidates
5. Check the **Size** column for each request

**Expected:**
- All requests: ~4.0 KB
- Request Payload: ~4.0 KB

**✅ Pass:** All requests same size  
**❌ Fail:** Different sizes visible

---

## Test 3: Backend Log Verification

1. Check backend logs while voting
2. Look for padding-related messages

**Expected Output:**
```
Creating encrypted ballot for election ID: 1 by user: voter@example.com
✅ Encrypted ballot created successfully
```

**Should NOT See:**
```
⚠️ [SECURITY WARNING] No padding detected
⚠️ [PADDING WARNING] Very short padding detected
```

**✅ Pass:** No warnings  
**❌ Fail:** Security warnings present

---

## Test 4: Packet Capture (Advanced)

### Using Wireshark or tcpdump:

```bash
# Capture traffic on port 80
sudo tcpdump -i any port 80 -w capture.pcap

# Vote with different candidates
# Stop capture (Ctrl+C)

# Analyze with tshark
tshark -r capture.pcap -Y "http.request.uri contains create-encrypted-ballot" \
  -T fields -e frame.len
```

**Expected:**
- All packet sizes should be identical
- Size should be ~4100-4200 bytes (4KB payload + headers)

---

## Test 5: Candidate Name Length Test

Test with various name lengths:

```javascript
// In browser console, test the padding function:

function testPadding(candidateName) {
  const req = {
    electionId: 1,
    selectedCandidate: candidateName,
    botDetection: {
      isBot: false,
      confidence: 0.1,
      requestId: "test-123"
    }
  };
  
  const json = JSON.stringify(req);
  const size = new Blob([json]).size;
  console.log(`"${candidateName}" → ${size} bytes`);
}

// Test various lengths
testPadding("A");                                    // 1 char
testPadding("John Doe");                             // 8 chars
testPadding("Dr. Muhammad Abdullah Rahman Khan");    // 36 chars
testPadding("A".repeat(100));                        // 100 chars

// After padding, all should be ~4096 bytes
```

**✅ Pass:** All padded requests are 4096 bytes  
**❌ Fail:** Variable sizes after padding

---

## Test 6: Integration Test

Full end-to-end test:

```bash
# 1. Start all services
docker-compose -f docker-compose.prod.yml up -d

# 2. Login as a voter
# 3. Navigate to an election
# 4. Vote for Candidate A (short name)
# 5. Check network/console logs
# 6. Login as another voter
# 7. Vote for Candidate B (long name)
# 8. Compare packet sizes

# Expected: Both votes should have identical packet sizes
```

---

## Test 7: Performance Test

Measure impact on performance:

```bash
# Install Apache Bench (if not already)
apt-get install apache2-utils

# Test without load
time curl -X POST https://your-domain/api/create-encrypted-ballot \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"electionId":1,"selectedCandidate":"Test","padding":"'$(printf 'X%.0s' {1..3900})'"}'

# Repeat 100 times
for i in {1..100}; do
  curl -X POST https://your-domain/api/create-encrypted-ballot \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"electionId":1,"selectedCandidate":"Test","padding":"'$(printf 'X%.0s' {1..3900})'"}'
done
```

**Expected:**
- Response time: < 500ms (similar to before)
- Success rate: 100%
- No timeouts

---

## Test Results Checklist

- [ ] Console shows padding messages with 4096B
- [ ] Network tab shows all requests ~4KB
- [ ] Backend logs show no warnings
- [ ] Packet capture shows identical sizes
- [ ] Various name lengths all produce 4096B
- [ ] End-to-end voting works correctly
- [ ] Performance is acceptable (< 500ms)

---

## Common Issues

### Issue: "addConstantSizePadding is not defined"

**Solution:**
```bash
# Clear browser cache
Ctrl + Shift + Delete

# Hard refresh
Ctrl + Shift + R

# Rebuild frontend
cd frontend
npm run build
```

### Issue: Padding size is incorrect

**Check:**
```javascript
// In browser console
console.log(TARGET_PACKET_SIZE);  // Should be 4096
```

**Fix:**
- Verify `TARGET_PACKET_SIZE = 4096` in electionApi.js
- Clear cache and rebuild

### Issue: Backend warns "No padding detected"

**Possible Causes:**
1. Frontend code not deployed
2. Browser cache serving old code
3. Direct API call bypassing frontend

**Solutions:**
1. Rebuild and redeploy frontend
2. Clear browser cache
3. Use only the web interface for testing

---

## Automated Test Script

Create `test-padding.sh`:

```bash
#!/bin/bash

echo "🧪 Testing Packet Size Padding..."
echo ""

# Test 1: Check frontend file
echo "1. Checking frontend code..."
if grep -q "addConstantSizePadding" frontend/src/utils/electionApi.js; then
  echo "   ✅ Padding function exists"
else
  echo "   ❌ Padding function missing"
  exit 1
fi

# Test 2: Check backend DTO
echo "2. Checking backend DTO..."
if grep -q "private String padding" backend/src/main/java/com/amarvote/amarvote/dto/CreateEncryptedBallotRequest.java; then
  echo "   ✅ Padding field exists"
else
  echo "   ❌ Padding field missing"
  exit 1
fi

# Test 3: Check backend service
echo "3. Checking backend validation..."
if grep -q "validateAndRemovePadding" backend/src/main/java/com/amarvote/amarvote/service/BallotService.java; then
  echo "   ✅ Validation method exists"
else
  echo "   ❌ Validation method missing"
  exit 1
fi

# Test 4: Check nginx config
echo "4. Checking nginx configuration..."
if grep -q "client_body_buffer_size 20M" frontend/nginx.conf; then
  echo "   ✅ Nginx buffer size is sufficient"
else
  echo "   ⚠️  Nginx buffer size may be too small"
fi

echo ""
echo "✅ All checks passed! Ready for manual testing."
echo ""
echo "Next steps:"
echo "1. Start the application"
echo "2. Open browser DevTools"
echo "3. Vote and check console logs"
echo "4. Verify all packets are 4096 bytes"
```

Run it:
```bash
chmod +x test-padding.sh
./test-padding.sh
```

---

## Success Criteria

✅ **Implementation Complete** when:

1. All frontend requests show 4096B in console
2. Network tab shows identical packet sizes
3. Backend logs have no padding warnings
4. Different candidate names produce same packet size
5. Voting still works correctly end-to-end
6. Performance is acceptable (< 500ms response time)
7. Documentation is complete

**Status Check:** Review each item above before marking as complete.
