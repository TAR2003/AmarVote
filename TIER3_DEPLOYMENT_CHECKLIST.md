# Tier 3 Implementation Checklist

## ✅ Pre-Deployment Checklist

### Infrastructure
- [x] RabbitMQ service added to docker-compose.prod.yml
- [x] RabbitMQ management UI exposed on port 15672
- [x] RabbitMQ persistent volume configured
- [x] RabbitMQ health check configured
- [x] Backend service depends on RabbitMQ

### Backend Configuration
- [x] Spring AMQP dependency added to pom.xml
- [x] RabbitMQ connection properties in application.properties
- [x] Environment variables for RabbitMQ credentials
- [x] Queue configuration with TTL and max length
- [x] Message converter (JSON) configured

### Code Implementation
- [x] RabbitMQConfig class created
- [x] Queue definitions (tally, decryption, combine, compensated)
- [x] Exchange and binding configuration
- [x] ChunkMessage DTO created
- [x] OperationType enum created
- [x] JobResponse and JobStatusResponse DTOs created
- [x] ElectionJob entity created
- [x] ElectionJobRepository created
- [x] TallyWorker service created
- [x] DecryptionWorker service created
- [x] QueuePublisherService created
- [x] TallyQueueService created
- [x] JobController created
- [x] New endpoint: POST /api/create-tally-queue
- [x] New endpoint: GET /api/jobs/{jobId}/status
- [x] New endpoint: GET /api/jobs/election/{electionId}
- [x] New endpoint: GET /api/jobs/active

### Database
- [x] Database migration script created
- [ ] Migration script executed (RUN THIS!)

### Documentation
- [x] TIER3_QUICK_START.md created
- [x] TIER3_MESSAGE_QUEUE_GUIDE.md created
- [x] TIER3_IMPLEMENTATION_SUMMARY.md created
- [x] This checklist created

***

## 🚀 Deployment Steps

### Step 1: Run Database Migration
```bash
# Connect to PostgreSQL
docker exec -it amarvote_postgres psql -U amarvote_user -d amarvote_db

# Run migration
\i /path/to/migration_add_election_jobs.sql

# Or copy-paste the SQL from Database/migration_add_election_jobs.sql
```

**Verify table was created:**
```sql
\dt election_jobs
SELECT * FROM information_schema.tables WHERE table_name = 'election_jobs';
```

### Step 2: Set Environment Variables
```bash
# Windows PowerShell
$env:RABBITMQ_PASSWORD="your-secure-password-here"

# Linux/Mac
export RABBITMQ_PASSWORD="your-secure-password-here"
```

### Step 3: Build and Start Services
```bash
cd C:\Users\TAWKIR\Documents\GitHub\AmarVote

# Rebuild backend (to include new dependencies)
docker-compose -f docker-compose.prod.yml build backend

# Start all services
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to start (30 seconds)
timeout /t 30

# Check status
docker-compose -f docker-compose.prod.yml ps
```

### Step 4: Verify RabbitMQ
```bash
# Check RabbitMQ is running
docker ps | findstr rabbitmq

# Check RabbitMQ logs
docker logs amarvote_rabbitmq

# Access management UI
# Open browser: http://localhost:15672
# Login: amarvote / your-password
```

### Step 5: Verify Backend Connection
```bash
# Check backend logs for RabbitMQ connection
docker logs amarvote_backend | findstr "RabbitMQ"

# Should see: "Successfully connected to RabbitMQ"
```

### Step 6: Verify Queues Created
```bash
# Open RabbitMQ UI: http://localhost:15672
# Go to "Queues" tab
# Should see:
# - tally.queue
# - decryption.queue
# - combine.queue
# - compensated.decryption.queue
```

### Step 7: Test the New Endpoint
```bash
# Get JWT token first (login)
$token = "your-jwt-token"

# Create tally using queue
$body = @{
    election_id = 123
} | ConvertTo-Json

$response = Invoke-RestMethod `
  -Uri "http://localhost:8080/api/create-tally-queue" `
  -Method POST `
  -Body $body `
  -ContentType "application/json" `
  -Headers @{Authorization="Bearer $token"}

# Check response
$response

# Should see:
# jobId: abc-123-def-456
# status: IN_PROGRESS
# totalChunks: X
# pollUrl: /api/jobs/abc-123-def-456/status
```

### Step 8: Monitor Progress
```bash
# Poll job status
$jobId = $response.jobId
$status = Invoke-RestMethod `
  -Uri "http://localhost:8080/api/jobs/$jobId/status"

$status

# Should see progress increasing:
# processedChunks: 10
# totalChunks: 100
# progressPercent: 10.0
```

### Step 9: Scale Workers (Optional)
```bash
# Scale to 10 workers
docker-compose -f docker-compose.prod.yml up -d --scale backend=10

# Verify workers
docker ps | findstr backend

# Should see 10 backend containers
```

### Step 10: Monitor in RabbitMQ
```bash
# Open RabbitMQ UI: http://localhost:15672
# Go to "Queues" tab
# Click "tally.queue"
# Watch "Message rates" graph
# Should see messages being consumed
```

***

## 🧪 Testing Checklist

### Basic Functionality
- [ ] RabbitMQ management UI accessible
- [ ] Can login to RabbitMQ UI
- [ ] All 4 queues visible in RabbitMQ
- [ ] Backend connects to RabbitMQ successfully
- [ ] POST /api/create-tally-queue returns job ID
- [ ] GET /api/jobs/{jobId}/status returns progress
- [ ] Workers process messages (check logs)
- [ ] Progress increases over time
- [ ] Job status changes to COMPLETED

### Scaling
- [ ] Can scale to 10 workers
- [ ] All workers connect to RabbitMQ
- [ ] Processing speed increases proportionally
- [ ] Memory usage distributed across workers

### Error Handling
- [ ] Failed chunks retry automatically
- [ ] Failed jobs marked as FAILED
- [ ] Error messages captured in job record
- [ ] Workers continue after individual chunk failure

### Performance
- [ ] 100 chunks: completes in reasonable time
- [ ] 500 chunks: completes without memory issues
- [ ] 2000 chunks: completes with scaled workers
- [ ] Memory per worker stays under 300 MB

***

## 📊 Performance Benchmarks

After deployment, run these tests:

### Test 1: Small (100 chunks)
```bash
# Expected with 1 worker: ~2 minutes
# Expected with 10 workers: ~12 seconds
```

### Test 2: Medium (500 chunks)
```bash
# Expected with 1 worker: ~8 minutes
# Expected with 10 workers: ~50 seconds
```

### Test 3: Large (2000 chunks)
```bash
# Expected with 1 worker: ~33 minutes
# Expected with 10 workers: ~3 minutes
# Expected with 50 workers: ~40 seconds
```

***

## 🔧 Troubleshooting

### Issue: Database table not found
**Solution:** Run the migration script (Step 1)

### Issue: Workers not processing messages
**Solution:** 
```bash
# Check RabbitMQ connection
docker logs amarvote_backend | findstr "RabbitMQ"

# Restart backend
docker-compose -f docker-compose.prod.yml restart backend
```

### Issue: Job stuck at 0%
**Solution:**
```bash
# Check if messages are in queue (RabbitMQ UI)
# Manually restart workers
docker-compose -f docker-compose.prod.yml restart backend
```

### Issue: High memory usage
**Solution:**
```bash
# Normal: ~200 MB per worker
# If higher, check for memory leaks:
docker stats --no-stream | findstr backend

# Restart if needed
docker-compose -f docker-compose.prod.yml restart backend
```

***

## 📝 Post-Deployment Tasks

### 1. Update Frontend
- [ ] Replace /api/create-tally with /api/create-tally-queue
- [ ] Add progress bar UI
- [ ] Implement polling logic (every 2 seconds)
- [ ] Handle COMPLETED and FAILED states
- [ ] Show user-friendly messages

### 2. Monitor Production
- [ ] Set up RabbitMQ monitoring
- [ ] Configure alerts for failed jobs
- [ ] Track processing times
- [ ] Monitor worker memory usage
- [ ] Set up log aggregation

### 3. Apply to Other Operations
- [ ] Create DecryptionQueueService
- [ ] Add /api/create-decryption-queue endpoint
- [ ] Update frontend for decryption
- [ ] Test with real guardians

### 4. Documentation
- [ ] Update API documentation
- [ ] Train team on new system
- [ ] Document scaling procedures
- [ ] Create runbook for operations

***

## ✅ Success Criteria

Your implementation is successful when:

- ✅ Can process 2000+ chunks without OutOfMemoryError
- ✅ Can scale to 10+ workers
- ✅ Processing time decreases with more workers
- ✅ Failed messages retry automatically
- ✅ Progress tracking works in real-time
- ✅ System recovers from crashes
- ✅ Memory usage stays constant per worker

***

## 🎉 Next Steps

After successful deployment:

1. **Test with real election data**
2. **Scale workers based on load**
3. **Monitor performance metrics**
4. **Update frontend to use new endpoints**
5. **Apply pattern to decryption operations**
6. **Train team on monitoring and scaling**

**Congratulations! You now have an industrial-grade, unlimited-scalability election system! 🚀**
