# Use official Python slim image
FROM python:3.12-slim

# Set environment variables - OPTIMIZED for memory efficiency
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    FLASK_APP=api.py \
    FLASK_ENV=production \
    FLASK_RUN_HOST=0.0.0.0 \
    FLASK_RUN_PORT=5000 \
    GUNICORN_TIMEOUT=300 \
    GUNICORN_WORKERS=1 \
    PYTHONMALLOC=malloc

# Install system dependencies for gmpy2, cryptography, pqcrypto + curl for healthcheck
# OPTIMIZED: Added memory management tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgmp-dev \
    libmpfr-dev \
    libmpc-dev \
    libssl-dev \
    libffi-dev \
    curl \
    procps \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create and set working directory
WORKDIR /app

# Copy requirements first
COPY requirements.txt .

# Install Python dependencies (prefer wheels, fallback to source build if needed)
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose the port
EXPOSE 5000

# Health check - OPTIMIZED: Increased timeout for discrete log operations
HEALTHCHECK --interval=60s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# OPTIMIZED: Use custom gunicorn configuration for memory management
CMD ["gunicorn", "--config", "gunicorn.conf.py", "api:app"]
