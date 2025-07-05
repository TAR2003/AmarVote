# Stage 1: Build with memory limits
FROM node:18-alpine AS builder
WORKDIR /app
ENV NODE_OPTIONS="--max-old-space-size=512"
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npm run build

# Stage 2: Production runtime
FROM nginx:alpine
RUN rm -rf /etc/nginx/conf.d/*
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]