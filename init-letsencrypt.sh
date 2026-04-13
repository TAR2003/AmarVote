#!/bin/bash
# Run this ONCE on your server before starting the full stack
# chmod +x init-letsencrypt.sh ; ./init-letsencrypt.sh

set -e

DOMAIN="amarvote2026.me"
EMAIL="tawkir2003@gmail.com"   # change this before running
CERTBOT_WEBROOT="./nginx/certbot-webroot"
CERTS_DIR="./nginx/certs"
NGINX_CONF="./nginx-proxy.conf"
BOOTSTRAP_CONF="./nginx-proxy.bootstrap.conf"
BACKUP_CONF="./nginx-proxy.conf.bootstrap-backup"

mkdir -p "$CERTBOT_WEBROOT" "$CERTS_DIR/live/$DOMAIN"

if [ ! -f "$BOOTSTRAP_CONF" ]; then
  echo ">>> ERROR: $BOOTSTRAP_CONF not found."
  exit 1
fi

echo ">>> Creating temporary self-signed cert so nginx can start..."
openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
  -keyout "$CERTS_DIR/live/$DOMAIN/privkey.pem" \
  -out    "$CERTS_DIR/live/$DOMAIN/fullchain.pem" \
  -subj "/CN=$DOMAIN"

if [ ! -f "$CERTS_DIR/live/$DOMAIN/chain.pem" ]; then
  cp "$CERTS_DIR/live/$DOMAIN/fullchain.pem" "$CERTS_DIR/live/$DOMAIN/chain.pem"
fi

echo ">>> Switching to bootstrap HTTP-only nginx config..."
cp "$NGINX_CONF" "$BACKUP_CONF"
cp "$BOOTSTRAP_CONF" "$NGINX_CONF"

echo ">>> Starting nginx only..."
docker compose -f docker-compose.prod.yml up -d nginx

echo ">>> Requesting real Let's Encrypt certificate..."
docker compose -f docker-compose.prod.yml run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$DOMAIN" \
    -d "www.$DOMAIN"

echo ">>> Restoring hardened nginx config..."
cp "$BACKUP_CONF" "$NGINX_CONF"
rm -f "$BACKUP_CONF"

echo ">>> Reloading nginx with real cert..."
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload

echo ">>> Done! Your real SSL cert is active."
