#!/bin/bash
# Professional SSL Initialization & Cleanup Script for amarvote2026.me
set -e

DOMAIN="amarvote2026.me"
EMAIL="tawkir2003@gmail.com"
PROJECT_ROOT="$HOME/app"
CERT_DIR="$PROJECT_ROOT/nginx/certs"
WEBROOT_DIR="$PROJECT_ROOT/nginx/certbot-webroot"
NETWORK_NAME="app_election_net"

echo ">>> 1. Cleaning up potential duplicate folders..."
# If certbot created a -0001 folder, we want the real certs in the main folder
if [ -d "$CERT_DIR/live/${DOMAIN}-0001" ]; then
    echo "    Found duplicate -0001 folder. Merging..."
    rm -rf "$CERT_DIR/live/$DOMAIN" "$CERT_DIR/archive/$DOMAIN"
    mv "$CERT_DIR/live/${DOMAIN}-0001" "$CERT_DIR/live/$DOMAIN"
    mv "$CERT_DIR/archive/${DOMAIN}-0001" "$CERT_DIR/archive/$DOMAIN"
    # Update renewal config file name as well
    mv "$CERT_DIR/renewal/${DOMAIN}-0001.conf" "$CERT_DIR/renewal/${DOMAIN}.conf" || true
    sed -i "s/${DOMAIN}-0001/${DOMAIN}/g" "$CERT_DIR/renewal/${DOMAIN}.conf" || true
fi

echo ">>> 2. Creating directory structure..."
mkdir -p "$CERT_DIR" "$WEBROOT_DIR"

echo ">>> 3. Generating DHParam (2048-bit) if missing..."
if [ ! -f "$CERT_DIR/dhparam.pem" ]; then
    echo "    This might take a minute..."
    openssl dhparam -out "$CERT_DIR/dhparam.pem" 2048
else
    echo "    DHParam already exists, skipping."
fi

echo ">>> 4. Running Certbot (Request/Renew)..."
# This will renew if expired, or skip if the cert is still valid and real
docker run --rm -i \
  -v "$CERT_DIR:/etc/letsencrypt" \
  -v "$WEBROOT_DIR:/var/www/certbot" \
  --network "$NETWORK_NAME" \
  certbot/certbot certonly --webroot \
  --webroot-path=/var/www/certbot \
  --email "$EMAIL" \
  --agree-tos --no-eff-email \
  -d "$DOMAIN" -d "www.$DOMAIN" --keep-until-expiring

echo ">>> 5. Verifying certificate issuer..."
if [ -f "$CERT_DIR/live/$DOMAIN/fullchain.pem" ]; then
    ISSUER=$(openssl x509 -in "$CERT_DIR/live/$DOMAIN/fullchain.pem" -noout -issuer)
    echo "    $ISSUER"
    
    if [[ $ISSUER == *"Let's Encrypt"* ]]; then
        echo "    VALID: Real Let's Encrypt certificate found."
    else
        echo "    WARNING: This is still a SELF-SIGNED (Fake) certificate."
    fi
else
    echo "    ERROR: Certificate file not found at $CERT_DIR/live/$DOMAIN/fullchain.pem"
    exit 1
fi

echo ">>> 6. Reloading Nginx..."
if docker ps | grep -q amarvote_nginx; then
    docker exec amarvote_nginx nginx -s reload
    echo ">>> SUCCESS: amarvote2026.me is now secured with HTTPS!"
else
    echo ">>> ERROR: Nginx container (amarvote_nginx) is not running."
    exit 1
fi