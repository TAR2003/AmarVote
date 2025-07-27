# Build stage
FROM node:20-alpine AS build
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies step by step
RUN npm cache clean --force
RUN npm config set registry https://registry.npmjs.org/
RUN npm install --production=false --no-audit --no-fund

# Explicitly install vite if not present
RUN npm list vite || npm install vite@latest

# Copy source code
COPY . .

# Build using explicit vite path
RUN ./node_modules/.bin/vite build

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