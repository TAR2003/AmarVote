#!/bin/bash
# Run this ONCE on your server before starting the full stack
# chmod +x init-letsencrypt.sh ; ./init-letsencrypt.sh

set -e

DOMAIN="amarvote2026.me"
EMAIL="your-email@example.com"   # change this before running
CERTBOT_WEBROOT="./nginx/certbot-webroot"
CERTS_DIR="./nginx/certs"

mkdir -p "$CERTBOT_WEBROOT" "$CERTS_DIR/live/$DOMAIN"

echo ">>> Creating temporary self-signed cert so nginx can start..."
openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
  -keyout "$CERTS_DIR/live/$DOMAIN/privkey.pem" \
  -out    "$CERTS_DIR/live/$DOMAIN/fullchain.pem" \
  -subj "/CN=$DOMAIN"

echo ">>> Starting nginx only..."
docker compose -f docker-compose.prod.yml up -d nginx

echo ">>> Requesting real Let's Encrypt certificate..."
docker run --rm \
  -v "$(pwd)/nginx/certs:/etc/letsencrypt" \
  -v "$(pwd)/nginx/certbot-webroot:/var/www/certbot" \
  certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    --force-renewal \
    -d "$DOMAIN" \
    -d "www.$DOMAIN"

echo ">>> Reloading nginx with real cert..."
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload

echo ">>> Done! Your real SSL cert is active."
