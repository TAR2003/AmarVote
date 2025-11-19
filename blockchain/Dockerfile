# Use Node.js 18 LTS
FROM node:18-slim

# Install Python and build tools (required for some npm packages)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all source files
COPY . .

# Create build directory
RUN mkdir -p /app/build

# Make the deployment script executable
RUN chmod +x /app/scripts/deploy.js

# Default command
CMD ["node", "/app/scripts/deploy.js"]
