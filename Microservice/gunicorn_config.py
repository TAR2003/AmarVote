"""
Gunicorn configuration for production deployment of ElectionGuard Microservice
Optimized for handling concurrent chunk processing without hanging
"""
import multiprocessing
import os

# Bind to all interfaces on port 5000
bind = "0.0.0.0:5000"

# Worker configuration
# Use more workers to handle concurrent chunk requests
workers = multiprocessing.cpu_count() * 2 + 1  # Recommended formula
worker_class = "gthread"  # Use threaded workers for better concurrency
threads = 4  # 4 threads per worker for handling concurrent requests
worker_connections = 1000

# Timeout configuration - critical for preventing hangs
timeout = 300  # 5 minutes - enough for large operations
graceful_timeout = 30  # Grace period for shutdown
keepalive = 5  # Keep connections alive

# Memory management
max_requests = 1000  # Restart workers after 1000 requests to prevent memory leaks
max_requests_jitter = 50  # Add randomness to prevent all workers restarting at once

# Logging
accesslog = "-"  # Log to stdout
errorlog = "-"   # Log to stderr
loglevel = "info"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# Process naming
proc_name = "electionguard-microservice"

# Server mechanics
daemon = False
pidfile = None
umask = 0
user = None
group = None
tmp_upload_dir = None

# Performance tuning
preload_app = False  # Don't preload to avoid sharing state between workers
reload = False  # Disable auto-reload in production

# Security
limit_request_line = 0  # No limit on request line size
limit_request_fields = 100
limit_request_field_size = 0  # No limit on header size

def on_starting(server):
    """Called just before the master process is initialized."""
    print(f"Starting ElectionGuard Microservice with {workers} workers and {threads} threads per worker")

def on_reload(server):
    """Called to recycle workers during a reload via SIGHUP."""
    print("Reloading workers...")

def when_ready(server):
    """Called just after the server is started."""
    print(f"ElectionGuard Microservice ready at {bind}")
    print("Configured for stateless operation with aggressive memory management")

def worker_int(worker):
    """Called just after a worker exited on SIGINT or SIGQUIT."""
    print(f"Worker {worker.pid} received INT/QUIT signal")

def worker_abort(worker):
    """Called when a worker receives the SIGABRT signal."""
    print(f"Worker {worker.pid} aborted - possible memory issue")
