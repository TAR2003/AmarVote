# Build stage
FROM node:18-alpine AS build

WORKDIR /app
COPY package*.json ./
# Install all dependencies including devDependencies for build
RUN npm ci --include=dev
COPY . .
# Add NODE_OPTIONS to increase memory limit
RUN NODE_OPTIONS="--max-old-space-size=8192" npm run build

# Production stage
FROM nginx:alpine

# Copy built files
COPY --from=build /app/dist /usr/share/nginx/html

# Set permissions for nginx
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]