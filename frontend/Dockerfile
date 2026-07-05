FROM node:20-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci --include=dev
COPY . .
RUN NODE_OPTIONS="--max-old-space-size=8192" npm run build

FROM nginx:alpine

RUN rm -rf /etc/nginx/conf.d/*
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
RUN chown -R nginx:nginx /usr/share/nginx/html && chmod -R 755 /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
