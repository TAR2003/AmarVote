# Dockerfile for building the Voting API microservice

# Use Python 3.9 slim image
FROM python:3.9-slim

# Set working directory
WORKDIR /app

# Install curl for healthcheck
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements.txt and install dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose Flask app port
EXPOSE 5000

# Set Flask app environment variable
ENV FLASK_APP=app/app.py

# Run the Flask server
CMD ["python", "wsgi.py"]
