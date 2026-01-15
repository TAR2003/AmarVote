# Use official Python image - SLIM version for reduced size
FROM python:3.12-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV FLASK_APP=api.py
ENV FLASK_ENV=production

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    python3-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create and set working directory
WORKDIR /app

# Copy requirements first to leverage Docker cache
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose the port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# Optimized for 4GB RAM with reliability priority
CMD ["gunicorn", \
    "--bind", "0.0.0.0:5000", \
    "--workers", "4", \
    "--worker-class", "sync", \
    "--threads", "1", \
    "--max-requests", "500", \
    "--max-requests-jitter", "50", \
    "--timeout", "300", \
    "--worker-tmp-dir", "/dev/shm", \
    "--graceful-timeout", "30", \
    "--keep-alive", "5", \
    "--log-level", "info", \
    "api:app"]
