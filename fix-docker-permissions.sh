#!/bin/bash
# Fix Docker socket permissions on Debian VM

echo "🔧 Fixing Docker socket permissions for chaincode installation..."

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    echo "⚠️  This script needs sudo privileges for Docker socket permissions"
    echo "Please run: sudo ./fix-docker-permissions.sh"
    exit 1
fi

# Set Docker socket permissions
echo "📝 Setting Docker socket permissions..."
chmod 666 /var/run/docker.sock
chown root:docker /var/run/docker.sock 2>/dev/null || true

# Add current user to docker group if not already
CURRENT_USER=${SUDO_USER:-$USER}
if ! groups $CURRENT_USER | grep -q docker; then
    echo "👤 Adding user $CURRENT_USER to docker group..."
    usermod -aG docker $CURRENT_USER
    echo "✓ User added to docker group"
    echo "⚠️  You may need to log out and back in for group changes to take effect"
else
    echo "✓ User already in docker group"
fi

# Verify Docker socket is accessible
if [ -S /var/run/docker.sock ]; then
    echo "✓ Docker socket exists"
    ls -l /var/run/docker.sock
else
    echo "❌ Docker socket not found!"
    exit 1
fi

# Test Docker access
if docker ps >/dev/null 2>&1; then
    echo "✓ Docker is accessible"
else
    echo "❌ Cannot access Docker daemon"
    echo "Try: sudo systemctl restart docker"
    exit 1
fi

echo ""
echo "✅ Docker permissions fixed!"
echo ""
echo "Next steps:"
echo "1. Run: ./fix-vm-deployment.sh"
echo "2. This will redeploy with correct Docker socket mounts"
