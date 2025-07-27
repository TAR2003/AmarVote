# Build stage
FROM node:20-alpine AS build

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Configure npm for better memory management
RUN npm config set registry https://registry.npmjs.org/ && \
    npm config set fetch-timeout 600000 && \
    npm config set maxsockets 1

# Copy package files
COPY package*.json ./

# Install dependencies with frozen lockfile
RUN npm ci --include=dev --frozen-lockfile

# Copy source code
COPY . .

# Build with optimized settings
RUN NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=2048 --optimize-for-size" \
    npm run build

# Verify build output
RUN ls -la dist/ && echo "Build completed successfully"

# Production stage
FROM nginx:alpine

# Remove default nginx config
RUN rm -rf /etc/nginx/conf.d/*

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Set permissions for nginx
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]