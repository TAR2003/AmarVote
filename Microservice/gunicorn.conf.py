#!/usr/bin/env python3
"""
Gunicorn configuration optimized for ElectionGuard microservice
with memory-constrained environments (1GB RAM + 8GB swap).
"""

import multiprocessing
import os

# Server socket
bind = "0.0.0.0:5000"
backlog = 2048

# Worker processes - CRITICAL: Reduced for memory optimization
# With 1GB RAM, more workers = memory exhaustion
# Single worker with threads is more memory efficient
workers = 1
worker_class = "sync"
worker_connections = 1000
max_requests = 100  # Restart worker after N requests to prevent memory leaks
max_requests_jitter = 10  # Add randomness to avoid thundering herd

# Timeouts - CRITICAL: Increased for discrete log computations
timeout = 300  # 5 minutes (was 120s) - needed for discrete log computations
keepalive = 10
graceful_timeout = 300  # Match timeout

# Memory optimization
preload_app = True  # Share code memory between workers
worker_tmp_dir = "/dev/shm"  # Use RAM disk for worker temporary files

# Logging
loglevel = "info"
accesslog = "-"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'
errorlog = "-"

# Security
limit_request_line = 4096
limit_request_fields = 100
limit_request_field_size = 8190

# Process naming
proc_name = "electionguard-microservice"

# Hooks for memory management
def on_starting(server):
    """Called just before the master process is initialized."""
    server.log.info("Starting ElectionGuard microservice with memory optimizations")

def worker_exit(server, worker):
    """Called just after a worker exited on SIGINT or SIGQUIT."""
    server.log.info(f"Worker {worker.pid} exited - memory cleanup")
    import gc
    gc.collect()

def on_exit(server):
    """Called just before exiting."""
    server.log.info("Shutting down ElectionGuard microservice")
    import gc
    gc.collect()