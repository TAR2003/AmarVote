#!/bin/bash
# ONE-COMMAND FIX for Debian VM

echo "🚀 AmarVote Debian VM - One Command Fix"
echo "========================================"
echo ""

# Check if running on Debian/Ubuntu
if ! [ -f /etc/debian_version ]; then
    echo "⚠️  This script is for Debian/Ubuntu systems"
    exit 1
fi

echo "This will:"
echo "  1. Fix Docker socket permissions"
echo "  2. Stop all containers"
echo "  3. Clean old data"
echo "  4. Deploy fresh blockchain network"
echo "  5. Install chaincode correctly"
echo ""

read -p "Continue? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "🔧 Step 1: Fixing Docker permissions..."
sudo chmod 666 /var/run/docker.sock
sudo chown root:docker /var/run/docker.sock 2>/dev/null || true
echo "✓ Permissions fixed"

echo ""
echo "🔧 Step 2: Running deployment fix..."
./fix-vm-deployment.sh

echo ""
echo "✅ DEPLOYMENT COMPLETE!"
echo ""
echo "🧪 Test it:"
echo "curl http://localhost:3000/api/blockchain/health"
