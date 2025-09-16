# ElectionGuard Memory Optimization Fix

This document explains the memory optimization fixes applied to resolve the worker timeout and memory exhaustion issues in the ElectionGuard microservice.

## Problem Summary

The ElectionGuard microservice was experiencing:
- **Worker timeouts** after 30 seconds during discrete log computations
- **Memory exhaustion** with only 11 ballots (would be impossible with 1000+ ballots)
- **Out of memory kills** by the system due to excessive memory usage

## Root Cause

The discrete logarithm computation in ElectionGuard's `discrete_log.py` was:
1. Using an extremely high max exponent limit (100,000,000)
2. Creating massive memory caches with large prime numbers (4096-bit)
3. No memory management or cleanup mechanisms
4. No batching or progressive processing

## Optimizations Applied

### 1. Discrete Log Cache Optimizations (`electionguard/discrete_log.py`)

**Key Changes:**
- Reduced `_DLOG_MAX_EXPONENT` from 100,000,000 to 1,000,000 (99% reduction)
- Added cache size limit (`_CACHE_SIZE_LIMIT = 100,000`)
- Implemented cache trimming to keep only most useful entries
- Added batch processing with adaptive batch sizes
- Integrated memory monitoring and garbage collection

**Memory Impact:**
- Maximum cache size limited to ~100K entries vs unlimited
- Periodic cleanup prevents memory leaks
- Adaptive batching based on available memory

### 2. Gunicorn Configuration Optimization (`gunicorn.conf.py`)

**Key Changes:**
- Reduced workers from 4 to 1 (memory efficiency over parallelism)
- Increased timeout from 120s to 300s (5 minutes)
- Added memory management hooks
- Configured worker recycling after 100 requests
- Enabled preload_app for memory sharing

**Resource Impact:**
- Single worker uses ~250-400MB vs 4 workers using 1GB+
- Prevents worker multiplication of memory usage
- Allows discrete log operations to complete

### 3. Docker Container Optimization (`Dockerfile`)

**Key Changes:**
- Updated environment variables for memory optimization
- Added system memory monitoring tools
- Optimized health check timings
- Added memory-friendly Python settings

### 4. Memory Monitoring System (`memory_monitor.py`)

**New Features:**
- Real-time memory usage tracking
- Automatic cleanup when thresholds are exceeded
- Adaptive batch sizing based on available memory
- Operation-level memory monitoring

## Deployment Instructions

### 1. Build the Updated Container

```bash
# In the Microservice directory
docker build -t amarvote-electionguard:optimized .
```

### 2. Test Memory Optimization (Optional)

```bash
# Run the memory test inside the container
docker run --rm -it amarvote-electionguard:optimized python test_memory_optimization.py
```

### 3. Deploy with Optimized Configuration

```bash
# Stop the current container
docker stop a43595dd78d6
docker rm a43595dd78d6

# Run with memory optimizations
docker run -d \
  --name electionguard-optimized \
  --memory="1g" \
  --memory-swap="2g" \
  --oom-kill-disable=false \
  -p 5000:5000 \
  amarvote-electionguard:optimized
```

### 4. Monitor Deployment

```bash
# Check container status
docker ps

# Monitor logs
docker logs -f electionguard-optimized

# Monitor memory usage
docker stats electionguard-optimized
```

## Expected Performance Improvements

### Memory Usage
- **Before**: 1GB+ with worker timeouts
- **After**: 250-500MB with completion

### Processing Time
- **11 ballots**: Should complete in 2-5 minutes (was timing out)
- **1000+ ballots**: Should scale linearly with memory management

### System Stability
- No more worker kills due to memory exhaustion
- Graceful handling of memory pressure
- Automatic cleanup and optimization

## Configuration Options

### Environment Variables (Optional)

```bash
# Adjust memory thresholds (in MB)
MEMORY_WARNING_THRESHOLD=600   # Default: 800MB
MEMORY_CRITICAL_THRESHOLD=900  # Default: 950MB

# Adjust discrete log limits
DLOG_MAX_EXPONENT=500000      # Default: 1,000,000
CACHE_SIZE_LIMIT=50000        # Default: 100,000
```

### Gunicorn Tuning (if needed)

```python
# In gunicorn.conf.py, adjust based on your specific requirements:

# For very memory-constrained environments (512MB):
timeout = 600  # 10 minutes
max_requests = 50  # More frequent worker recycling

# For more memory (2GB+):
workers = 2  # Can handle more workers
timeout = 180  # Less timeout needed
```

## Monitoring and Troubleshooting

### Memory Monitoring Commands

```bash
# Inside container
docker exec electionguard-optimized ps aux --sort=-%mem | head -10
docker exec electionguard-optimized free -h

# From host
docker stats --no-stream electionguard-optimized
```

### Log Analysis

```bash
# Look for memory optimization logs
docker logs electionguard-optimized | grep "MEMORY-"

# Check for discrete log progress
docker logs electionguard-optimized | grep "discrete_log_cache"

# Monitor worker status
docker logs electionguard-optimized | grep -E "(WORKER|timeout|memory)"
```

### Common Issues and Solutions

1. **Still getting timeouts?**
   - Increase timeout further: `timeout = 600` (10 minutes)
   - Reduce max exponent: `_DLOG_MAX_EXPONENT = 500_000`

2. **Memory still high?**
   - Reduce cache size: `_CACHE_SIZE_LIMIT = 50_000`
   - More aggressive cleanup: reduce batch sizes

3. **Performance too slow?**
   - If you have more RAM, increase worker count to 2
   - Increase cache size for better hit rates

## Validation

Test with your typical workload:

```bash
# Test with 11 ballots (should complete successfully)
curl -X POST http://localhost:5000/combine_decryption_shares \
  -H "Content-Type: application/json" \
  -d @your_test_payload.json

# Monitor during processing
watch -n 1 "docker stats --no-stream electionguard-optimized"
```

The optimizations should allow the system to handle 1000+ ballots within your 1GB RAM + 8GB swap configuration, with processing times proportional to the ballot count rather than exponential memory growth.