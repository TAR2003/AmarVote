# Build stage
FROM node:18-alpine AS build
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with explicit dev dependencies
RUN npm install --production=false

# Copy source code
COPY . .

# Build using npx to ensure vite is found
RUN NODE_OPTIONS="--max-old-space-size=4096" npx vite build

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