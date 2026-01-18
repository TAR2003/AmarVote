# 🚀 Production Deployment Guide for 4GB RAM Server

This guide covers deploying AmarVote with RabbitMQ worker architecture on a 4GB RAM server.

---

## 📋 Table of Contents

- [System Requirements](#system-requirements)
- [Memory Allocation Strategy](#memory-allocation-strategy)
- [Pre-Deployment Setup](#pre-deployment-setup)
- [Deployment Steps](#deployment-steps)
- [Post-Deployment Verification](#post-deployment-verification)
- [Monitoring and Maintenance](#monitoring-and-maintenance)
- [Troubleshooting](#troubleshooting)

---

## 🖥️ System Requirements

### Minimum Requirements
- **RAM**: 4GB (optimized configuration included)
- **CPU**: 2 cores minimum
- **Disk**: 20GB minimum (SSD recommended)
- **OS**: Ubuntu 20.04+ / Debian 11+ / CentOS 8+
- **Docker**: 24.0+ with Docker Compose V2

### Recommended Requirements
- **RAM**: 6GB+ for better performance
- **CPU**: 4 cores for faster processing
- **Disk**: 50GB SSD
- **Swap**: 2GB swap file configured

---

## 💾 Memory Allocation Strategy (4GB RAM)

The docker-compose.prod.yml has been optimized for 4GB RAM with the following allocation:

| Service | Memory Limit | Memory Reserved | Purpose |
|---------|-------------|-----------------|---------|
| **Backend** | 1280M | 768M | Spring Boot + JVM (Xmx1024m) |
| **ElectionGuard** | 1280M | 768M | Cryptographic operations |
| **RabbitMQ** | 512M | 256M | Message queue (512MB watermark) |
| **PostgreSQL** | 512M | 256M | Database |
| **Frontend** | 256M | 128M | Nginx static files |
| **Prometheus** | 256M | 128M | Metrics collection |
| **Grafana** | 256M | 128M | Monitoring dashboards |
| **System** | ~300M | - | OS overhead |
| **TOTAL** | ~4.1GB | ~2.4GB | Within 4GB limit |

### Why This Works
- ✅ **Worker Architecture**: RabbitMQ processes tasks one at a time, preventing memory accumulation
- ✅ **Aggressive GC**: Backend uses G1GC with optimized pause times
- ✅ **Memory Cleanup**: `entityManager.clear()` + `System.gc()` after each task
- ✅ **Concurrency=1**: Only one task processed at a time per queue

---

## 🔧 Pre-Deployment Setup

### 1. Install Docker and Docker Compose

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify installation
docker --version
docker compose version
```

### 2. Configure System Swap (Recommended)

```bash
# Create 2GB swap file
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make swap permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Verify swap
free -h
```

### 3. Optimize System Memory Settings

```bash
# Edit sysctl.conf
sudo nano /etc/sysctl.conf

# Add these lines:
vm.swappiness=10
vm.vfs_cache_pressure=50
vm.overcommit_memory=1

# Apply settings
sudo sysctl -p
```

### 4. Clone Repository

```bash
cd /opt
sudo git clone https://github.com/yourusername/AmarVote.git
cd AmarVote
```

### 5. Configure Environment Variables

```bash
# Copy .env.example to .env
cp .env.example .env

# Edit .env with your values
nano .env
```

**Required Environment Variables:**

```bash
# Database
POSTGRES_PASSWORD=your_secure_password

# Backend
MASTER_KEY_PQ=your_master_key
JWT_SECRET=your_jwt_secret
MAIL_PASSWORD=your_email_app_password

# Cloudinary
CLOUDINARY_NAME=your_cloudinary_name
CLOUDINARY_KEY=your_cloudinary_key
CLOUDINARY_SECRET=your_cloudinary_secret

# Monitoring
GF_SECURITY_ADMIN_PASSWORD=your_grafana_password
LOG_PASSWORD=your_log_password

# API Keys
DEEPSEEK_API_KEY=your_deepseek_key

# Blockchain
VOTING_API_URL=http://your-blockchain-service:5002
```

---

## 🚀 Deployment Steps

### Step 1: Build Images

```bash
cd /opt/AmarVote

# Build all images
docker compose -f docker-compose.prod.yml build

# This will take 10-15 minutes on first build
```

### Step 2: Start Services

```bash
# Start all services in detached mode
docker compose -f docker-compose.prod.yml up -d

# Check status
docker compose -f docker-compose.prod.yml ps
```

### Step 3: Monitor Initial Startup

```bash
# Watch all logs
docker compose -f docker-compose.prod.yml logs -f

# Watch specific service logs
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f rabbitmq

# Press Ctrl+C to exit logs
```

**Expected Startup Time:**
- PostgreSQL: 5-10 seconds
- RabbitMQ: 10-15 seconds
- Backend: 30-60 seconds
- Frontend: 10-20 seconds
- ElectionGuard: 20-30 seconds

---

## ✅ Post-Deployment Verification

### 1. Check Service Health

```bash
# Check all containers are running
docker compose -f docker-compose.prod.yml ps

# Expected output: All services should show "Up" status
```

### 2. Verify RabbitMQ

```bash
# Access RabbitMQ Management UI
# Open browser: http://your-server-ip:15672
# Login: amarvote_user / amarvote_password

# Check queues are created:
# - tally.creation.queue
# - partial.decryption.queue
# - compensated.decryption.queue
# - combine.decryption.queue
```

### 3. Test Backend API

```bash
# Health check
curl http://localhost:8080/actuator/health

# Expected response: {"status":"UP"}
```

### 4. Test Frontend

```bash
# Access frontend
# Open browser: http://your-server-ip

# You should see the AmarVote homepage
```

### 5. Check Memory Usage

```bash
# View container memory usage
docker stats --no-stream

# Expected: All services within allocated limits
```

---

## 📊 Monitoring and Maintenance

### Access Monitoring Dashboards

1. **Grafana Dashboard**
   - URL: `http://your-server-ip:3000`
   - Login: `admin` / `your_grafana_password`
   - Import pre-configured dashboards for JVM, RabbitMQ, PostgreSQL

2. **Prometheus Metrics**
   - URL: `http://your-server-ip:9090`
   - Query metrics directly

3. **RabbitMQ Management**
   - URL: `http://your-server-ip:15672`
   - Monitor queue depths, message rates, memory usage

### Regular Maintenance Tasks

#### Daily Checks

```bash
# Check container status
docker compose -f docker-compose.prod.yml ps

# Check memory usage
docker stats --no-stream

# View recent logs
docker compose -f docker-compose.prod.yml logs --tail=100
```

#### Weekly Maintenance

```bash
# Clean up unused Docker resources
docker system prune -f

# Backup database
docker exec amarvote_postgres pg_dump -U amarvote_user amarvote_db > backup_$(date +%Y%m%d).sql

# Check disk usage
df -h
du -sh /var/lib/docker
```

#### Monthly Tasks

```bash
# Update Docker images
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d

# Vacuum PostgreSQL
docker exec amarvote_postgres psql -U amarvote_user -d amarvote_db -c "VACUUM ANALYZE;"
```

---

## 🐛 Troubleshooting

### Issue: Backend OOM Errors

**Symptoms:**
- Backend container restarts frequently
- Error: "OutOfMemoryError: Java heap space"

**Solution:**

```bash
# Check current memory usage
docker stats amarvote_backend

# If backend uses > 1.2GB consistently:
# 1. Reduce heap size in docker-compose.prod.yml
JAVA_OPTS=-Xms384m -Xmx896m -XX:+UseG1GC

# 2. Restart backend
docker compose -f docker-compose.prod.yml restart backend
```

### Issue: RabbitMQ Memory Alarm

**Symptoms:**
- RabbitMQ shows "memory alarm" in management UI
- Tasks not processing

**Solution:**

```bash
# Clear memory alarm
docker exec amarvote_rabbitmq rabbitmqctl set_vm_memory_high_watermark 0.4

# Restart RabbitMQ
docker compose -f docker-compose.prod.yml restart rabbitmq
```

### Issue: ElectionGuard Microservice Slow

**Symptoms:**
- Decryption/tallying takes very long
- ElectionGuard container using 100% CPU

**Solution:**

```bash
# This is normal for large elections (1000+ chunks)
# Monitor progress in backend logs:
docker compose -f docker-compose.prod.yml logs -f backend | grep "Processing chunk"

# If stuck, check ElectionGuard logs:
docker compose -f docker-compose.prod.yml logs -f electionguard
```

### Issue: Database Connection Errors

**Symptoms:**
- Backend logs: "Connection refused" or "Connection timeout"

**Solution:**

```bash
# Check PostgreSQL health
docker exec amarvote_postgres pg_isready -U amarvote_user

# Restart PostgreSQL
docker compose -f docker-compose.prod.yml restart postgres

# Wait 10 seconds, then restart backend
sleep 10
docker compose -f docker-compose.prod.yml restart backend
```

### Issue: Frontend Not Loading

**Symptoms:**
- Blank page or 502 Bad Gateway

**Solution:**

```bash
# Check frontend container
docker compose -f docker-compose.prod.yml logs frontend

# Rebuild and restart frontend
docker compose -f docker-compose.prod.yml build frontend
docker compose -f docker-compose.prod.yml up -d frontend
```

### Issue: System Running Out of Memory

**Symptoms:**
- `docker stats` shows high memory usage across all containers
- System becomes unresponsive

**Emergency Actions:**

```bash
# 1. Stop non-critical services
docker compose -f docker-compose.prod.yml stop grafana prometheus

# 2. Restart critical services one by one
docker compose -f docker-compose.prod.yml restart backend

# 3. Enable swap if not already done (see Pre-Deployment Setup)

# 4. Consider upgrading to 6GB RAM server
```

---

## 🔄 Updating the Application

### Rolling Update (Zero Downtime)

```bash
# Pull latest code
cd /opt/AmarVote
git pull origin main

# Rebuild and restart backend only
docker compose -f docker-compose.prod.yml build backend
docker compose -f docker-compose.prod.yml up -d backend

# Rebuild and restart frontend
docker compose -f docker-compose.prod.yml build frontend
docker compose -f docker-compose.prod.yml up -d frontend
```

### Full Update (With Downtime)

```bash
# Stop all services
docker compose -f docker-compose.prod.yml down

# Pull latest code
git pull origin main

# Rebuild all images
docker compose -f docker-compose.prod.yml build

# Start services
docker compose -f docker-compose.prod.yml up -d
```

---

## 📝 Backup Strategy

### Automated Daily Backup Script

Create `/opt/backup-amarvote.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/opt/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
docker exec amarvote_postgres pg_dump -U amarvote_user amarvote_db | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Backup credentials
tar -czf $BACKUP_DIR/credentials_$DATE.tar.gz -C /var/lib/docker/volumes amarvote_credentials_data

# Keep only last 7 days
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

**Set up cron job:**

```bash
# Make script executable
chmod +x /opt/backup-amarvote.sh

# Add to crontab (run at 2 AM daily)
crontab -e

# Add line:
0 2 * * * /opt/backup-amarvote.sh >> /var/log/amarvote-backup.log 2>&1
```

---

## 🎯 Performance Optimization Tips

### For 4GB RAM Server

1. **Disable unused services:**
   ```bash
   # If you don't need Grafana/Prometheus:
   docker compose -f docker-compose.prod.yml stop grafana prometheus
   ```

2. **Adjust RabbitMQ prefetch:**
   - Edit backend `application.properties`:
   ```properties
   spring.rabbitmq.listener.simple.prefetch=1
   ```

3. **Reduce PostgreSQL connections:**
   ```bash
   docker exec amarvote_postgres psql -U postgres -c "ALTER SYSTEM SET max_connections = 50;"
   docker compose -f docker-compose.prod.yml restart postgres
   ```

### For Better Performance (6GB+ RAM)

Increase memory limits in docker-compose.prod.yml:

```yaml
backend:
  deploy:
    resources:
      limits:
        memory: 2048M  # Increase to 2GB
```

---

## 📞 Support

- **Documentation**: [RABBITMQ_WORKER_ARCHITECTURE.md](RABBITMQ_WORKER_ARCHITECTURE.md)
- **Quick Start**: [RABBITMQ_QUICK_START.md](RABBITMQ_QUICK_START.md)
- **Issues**: Check backend logs first, then RabbitMQ

---

## ✅ Deployment Checklist

Before going live:

- [ ] Swap configured (2GB minimum)
- [ ] All environment variables set in `.env`
- [ ] All services running (`docker compose ps`)
- [ ] RabbitMQ queues created (check Management UI)
- [ ] Backend health check passes
- [ ] Frontend accessible
- [ ] Database backup script configured
- [ ] Monitoring dashboards accessible
- [ ] Firewall rules configured (ports 80, 8080, 5672, 15672)
- [ ] SSL/TLS certificates configured (recommended)
- [ ] Load testing completed on test election

---

## 🎉 Success!

Your AmarVote instance is now running in production with RabbitMQ worker architecture, optimized for 4GB RAM!

**Next Steps:**
1. Create your first election
2. Test with small election (10-50 voters)
3. Monitor memory usage during tally/decryption
4. Scale up when needed

Happy Voting! 🗳️
