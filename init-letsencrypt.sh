#!/bin/bash
# ============================================================================
# AmarVote 2026 - SSL Initialization & Recovery Script
# ============================================================================
set -e

DOMAIN="amarvote2026.me"
EMAIL="tawkir2003@gmail.com"
PROJECT_ROOT="$HOME/app"
CERT_DIR="$PROJECT_ROOT/nginx/certs"
WEBROOT_DIR="$PROJECT_ROOT/nginx/certbot-webroot"
NETWORK_NAME="app_election_net"

echo ">>> 1. Creating directory structure..."
mkdir -p "$CERT_DIR/live/$DOMAIN" "$WEBROOT_DIR"

echo ">>> 2. Checking for existing or dummy certificates..."
if [ ! -f "$CERT_DIR/live/$DOMAIN/fullchain.pem" ]; then
    echo "    No certificate found. Creating temporary 'dummy' cert to prevent Nginx crash..."
    openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
      -keyout "$CERT_DIR/live/$DOMAIN/privkey.pem" \
      -out "$CERT_DIR/live/$DOMAIN/fullchain.pem" \
      -subj "/CN=$DOMAIN"
    cp "$CERT_DIR/live/$DOMAIN/fullchain.pem" "$CERT_DIR/live/$DOMAIN/chain.pem"
fi

if [ ! -f "$CERT_DIR/dhparam.pem" ]; then
    echo "    Generating DHParam (2048-bit)..."
    openssl dhparam -out "$CERT_DIR/dhparam.pem" 2048
fi

echo ">>> 3. Starting Nginx (if not already running)..."
docker compose -f "$PROJECT_ROOT/docker-compose.prod.yml" up -d nginx

echo ">>> 4. Cleaning up dummy files before real request..."
# We only delete them if they are self-signed/dummies
if openssl x509 -in "$CERT_DIR/live/$DOMAIN/fullchain.pem" -noout -issuer | grep -q "CN = $DOMAIN"; then
    echo "    Dummy cert detected. Deleting to allow fresh Let's Encrypt request..."
    rm -rf "$CERT_DIR/live/$DOMAIN" "$CERT_DIR/archive/$DOMAIN" "$CERT_DIR/renewal/$DOMAIN.conf"
fi

echo ">>> 5. Requesting Real Let's Encrypt Certificate..."
docker run --rm -it \
  -v "$CERT_DIR:/etc/letsencrypt" \
  -v "$WEBROOT_DIR:/var/www/certbot" \
  --network "$NETWORK_NAME" \
  certbot/certbot certonly --webroot \
  --webroot-path=/var/www/certbot \
  --email "$EMAIL" \
  --agree-tos --no-eff-email \
  -d "$DOMAIN" -d "www.$DOMAIN"

echo ">>> 6. Final Nginx Reload..."
docker exec amarvote_nginx nginx -s reload

echo ">>> SUCCESS! https://$DOMAIN is now secure."