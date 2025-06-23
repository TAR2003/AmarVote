# Build stage
FROM node:18-alpine AS build

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json or pnpm-lock.yaml or yarn.lock
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all source files
COPY . .

# Build the Vite app (outputs to /app/dist)
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files from build stage (now from /app/dist)
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx config to handle SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start nginx server
CMD ["nginx", "-g", "daemon off;"]