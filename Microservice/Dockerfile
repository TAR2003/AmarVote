# Use official Python image (3.13-slim is not yet available, using 3.12)
FROM python:3.12

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
ENV FLASK_APP=api.py
ENV FLASK_ENV=production
ENV FLASK_RUN_HOST=0.0.0.0
ENV FLASK_RUN_PORT=5000
# Optimized Gunicorn settings for chunk processing
ENV GUNICORN_TIMEOUT=300
ENV GUNICORN_WORKERS=4
ENV GUNICORN_THREADS=4
ENV GUNICORN_MAX_REQUESTS=1000

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    python3-dev \
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

# Run the application with Gunicorn using production configuration
# This prevents hanging issues with concurrent chunk processing
CMD ["gunicorn", "-c", "gunicorn_config.py", "api:app"]