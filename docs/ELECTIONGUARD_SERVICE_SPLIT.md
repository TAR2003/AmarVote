# ElectionGuard Service Split - Architecture Documentation

## Overview
The ElectionGuard microservice has been split into two separate services to optimize performance and resource utilization:

1. **ElectionGuard API Service** - Fast, user-facing operations
2. **ElectionGuard Worker Service** - Heavy, long-running cryptographic operations

## Problem Statement
Previously, a single ElectionGuard service handled both quick API calls and resource-intensive worker tasks. This caused:
- **Lagging user experience**: Heavy worker operations blocked fast API responses
- **Resource contention**: Worker tasks consumed resources needed for user interactions
- **Poor scalability**: Single service couldn't be optimized for different workload types

## Solution Architecture

### 1. ElectionGuard API Service
**Container**: `electionguard_api`  
**Port**: `5000`  
**IP**: `172.20.0.10`  
**URL**: `http://electionguard-api:5000`

#### Handled Endpoints:
- `/setup_guardians` - Guardian initialization
- `/create_encrypted_ballot` - Ballot encryption
- `/benaloh_challenge` - Benaloh challenge verification
- `/api/encrypt` - Generic encryption
- `/api/decrypt` - Generic decryption
- `/health` - Health check

#### Configuration:
- **Workers**: 4 (optimized for concurrency)
- **Threads per worker**: 2
- **Timeout**: 120 seconds
- **Memory (Production)**: 512MB limit, 256MB reservation
- **Focus**: Fast response times, low latency, user satisfaction

#### Gunicorn Settings:
```bash
--workers 4
--worker-class sync
--threads 2
--timeout 120
--max-requests 1000
--keepalive 5
```

### 2. ElectionGuard Worker Service
**Container**: `electionguard_worker`  
**Port**: `5001`  
**IP**: `172.20.0.11`  
**URL**: `http://electionguard-worker:5001`

#### Handled Endpoints:
- `/create_encrypted_tally` - Encrypted tally generation (heavy)
- `/create_partial_decryption` - Partial decryption computation (heavy)
- `/create_compensated_decryption` - Compensated decryption (heavy)
- `/combine_decryption_shares` - Decryption share combination (heavy)

#### Configuration:
- **Workers**: 1 (matches `rabbitmq.worker.concurrency.max=1`)
- **Threads per worker**: 1 (single-threaded for memory stability)
- **Timeout**: 600 seconds (10 minutes for crypto operations)
- **Memory (Production)**: 1280MB limit, 768MB reservation
- **Focus**: Heavy computational loads, memory efficiency, task completion

#### Gunicorn Settings:
```bash
--workers 1
--worker-class sync
--threads 1
--timeout 600
--max-requests 50
--graceful-timeout 120
```

## Memory Allocation (4GB Total Available)

| Service | Memory Limit | Memory Reservation | Purpose |
|---------|-------------|-------------------|---------|
| PostgreSQL | 512M | 256M | Database |
| Redis | 256M | 128M | Cache & Sessions |
| RabbitMQ | 512M | 256M | Message Queue |
| Backend | 1280M | 768M | Spring Boot API |
| ElectionGuard API | 512M | 256M | Fast crypto operations |
| ElectionGuard Worker | 1280M | 768M | Heavy crypto operations |
| Prometheus | 256M | 128M | Metrics |
| Grafana | 256M | 128M | Monitoring |
| **Total** | **~4GB** | **~2.6GB** | **Balanced for 4GB server** |

## Backend Integration

### Application Properties Updates
```properties
# ElectionGuard Service Configuration
# API Service - Fast user-facing operations
electionguard.api.url=${ELECTIONGUARD_API_URL:http://electionguard-api:5000}

# Worker Service - Heavy cryptographic operations  
electionguard.worker.url=${ELECTIONGUARD_WORKER_URL:http://electionguard-worker:5001}

# Legacy base URL for backward compatibility
electionguard.base.url=${ELECTIONGUARD_API_URL:http://electionguard-api:5000}
```

### Intelligent Routing
The `ElectionGuardService` now automatically routes requests to the appropriate service:

```java
private boolean isWorkerEndpoint(String endpoint) {
    return endpoint.contains("/create_encrypted_tally") ||
           endpoint.contains("/create_partial_decryption") ||
           endpoint.contains("/create_compensated_decryption") ||
           endpoint.contains("/combine_decryption_shares");
}
```

**API Endpoints** → routed to `electionguard-api:5000`  
**Worker Endpoints** → routed to `electionguard-worker:5001`

## Files Modified

### New Files Created:
1. `/Microservice/Dockerfile.api` - API service Docker configuration
2. `/Microservice/Dockerfile.worker` - Worker service Docker configuration
3. `/.env.example` - Environment variables template

### Modified Files:
1. `/docker-compose.yml` - Development environment configuration
2. `/docker-compose.prod.yml` - Production environment configuration
3. `/backend/src/main/resources/application.properties` - Service URL configuration
4. `/backend/src/main/java/com/amarvote/amarvote/service/ElectionGuardService.java` - Intelligent routing logic

## Environment Variables

Add to your `.env` file:
```bash
# ElectionGuard Services Configuration
ELECTIONGUARD_API_URL=http://electionguard-api:5000
ELECTIONGUARD_WORKER_URL=http://electionguard-worker:5001
```

## Deployment Instructions

### Development Environment:
```bash
# Pull latest code
git pull origin main

# Stop existing services
docker-compose down

# Rebuild and start new services
docker-compose up -d --build

# Verify both services are running
docker ps | grep electionguard
```

### Production Environment:
```bash
# Pull latest code
git pull origin main

# Stop existing services
docker-compose -f docker-compose.prod.yml down

# Rebuild and start new services
docker-compose -f docker-compose.prod.yml up -d --build

# Verify services
docker ps | grep electionguard
docker logs electionguard_api
docker logs electionguard_worker
```

## Health Checks

### Check API Service:
```bash
curl http://localhost:5000/health
```

### Check Worker Service:
```bash
curl http://localhost:5001/health
```

### Check from Backend:
The backend's health check now verifies both services automatically.

## Performance Benefits

### Before (Single Service):
- ❌ User operations delayed by worker tasks
- ❌ Resource contention between workload types
- ❌ Single point of bottleneck
- ❌ Cannot optimize for different needs

### After (Split Services):
- ✅ **Fast API responses**: User operations complete in <120s (typically <5s)
- ✅ **Heavy worker tasks**: 10-minute timeout for complex crypto operations
- ✅ **Independent scaling**: Each service optimized for its workload
- ✅ **Better resource allocation**: Worker gets more memory, API gets more workers
- ✅ **No blocking**: Worker tasks don't affect user experience
- ✅ **Matches backend concurrency**: Worker service matches `rabbitmq.worker.concurrency.max=1`

## Monitoring

Both services expose the same endpoints and logging:
```bash
# View API logs
docker logs -f electionguard_api

# View Worker logs
docker logs -f electionguard_worker

# Monitor resource usage
docker stats electionguard_api electionguard_worker
```

## Troubleshooting

### API Service Issues:
```bash
# Check API container
docker logs electionguard_api

# Restart API service
docker-compose restart electionguard-api

# Check connectivity
curl http://localhost:5000/health
```

### Worker Service Issues:
```bash
# Check Worker container
docker logs electionguard_worker

# Restart Worker service
docker-compose restart electionguard-worker

# Check connectivity
curl http://localhost:5001/health
```

### Backend Not Connecting:
```bash
# Check environment variables
docker exec amarvote_backend env | grep ELECTIONGUARD

# Verify routing logic
docker logs amarvote_backend | grep "Service Type:"
```

## Rollback Procedure

If needed, rollback to single service:
```bash
# Checkout previous version
git checkout <previous-commit>

# Rebuild services
docker-compose down
docker-compose up -d --build
```

## Future Enhancements

1. **Horizontal Scaling**: Scale worker service independently during high load
2. **Load Balancing**: Add multiple worker instances with load balancer
3. **Metrics**: Add Prometheus metrics for request routing decisions
4. **Circuit Breaker**: Add resilience patterns for service failures
5. **Caching**: Add Redis caching for frequently accessed API responses

## Support

For issues or questions:
- Check logs: `docker logs electionguard_api` or `docker logs electionguard_worker`
- Review metrics: Grafana dashboard at http://localhost:3000
- Backend logs: `docker logs amarvote_backend`
