# 🚀 Quick Reference - AmarVote Production Deployment

## One-Command Deploy
```bash
chmod +x deploy-prod.sh && ./deploy-prod.sh
```

---

## Essential Commands

### Start/Stop
```bash
# Start all services
docker compose -f docker-compose.prod.yml up -d

# Stop all services
docker compose -f docker-compose.prod.yml down

# Restart specific service
docker compose -f docker-compose.prod.yml restart backend
```

### Monitor
```bash
# View status
docker compose -f docker-compose.prod.yml ps

# Check memory
docker stats --no-stream

# View logs
docker compose -f docker-compose.prod.yml logs -f backend
```

### Troubleshoot
```bash
# Backend health check
curl http://localhost:8080/actuator/health

# Check RabbitMQ queues
docker exec amarvote_rabbitmq rabbitmqctl list_queues

# Database check
docker exec amarvote_postgres pg_isready -U amarvote_user
```

---

## Access URLs

| Service | URL | Credentials |
|---------|-----|-------------|
| **Frontend** | http://your-ip | - |
| **Backend API** | http://your-ip:8080 | - |
| **RabbitMQ** | http://your-ip:15672 | amarvote_user / amarvote_password |
| **Grafana** | http://your-ip:3000 | admin / (see .env) |
| **Prometheus** | http://your-ip:9090 | - |

---

## Memory Allocation (4GB Server)

| Service | Limit | Reserved |
|---------|-------|----------|
| Backend | 1280M | 768M |
| ElectionGuard | 1280M | 768M |
| RabbitMQ | 512M | 256M |
| PostgreSQL | 512M | 256M |
| Frontend | 256M | 128M |
| Prometheus | 256M | 128M |
| Grafana | 256M | 128M |
| **TOTAL** | ~4.1GB | ~2.4GB |

---

## Quick Fixes

### Backend OOM
```bash
# Reduce heap in docker-compose.prod.yml
JAVA_OPTS=-Xms384m -Xmx896m -XX:+UseG1GC
docker compose -f docker-compose.prod.yml restart backend
```

### RabbitMQ Memory Alarm
```bash
docker exec amarvote_rabbitmq rabbitmqctl set_vm_memory_high_watermark 0.3
docker compose -f docker-compose.prod.yml restart rabbitmq
```

### Services Won't Start
```bash
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml logs -f
```

---

## Backup & Update

### Backup Database
```bash
docker exec amarvote_postgres pg_dump -U amarvote_user amarvote_db > backup.sql
```

### Update Application
```bash
git pull origin main
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

---

## Documentation

📚 **Full Guides:**
- [PRODUCTION_DEPLOYMENT_4GB.md](PRODUCTION_DEPLOYMENT_4GB.md) - Complete deployment guide
- [DOCKER_DEPLOYMENT_SUMMARY.md](DOCKER_DEPLOYMENT_SUMMARY.md) - Detailed summary
- [RABBITMQ_QUICK_START.md](RABBITMQ_QUICK_START.md) - RabbitMQ setup

---

## Support

🐛 **Issues?**
1. Check logs: `docker compose -f docker-compose.prod.yml logs -f`
2. Check memory: `docker stats --no-stream`
3. Review documentation above
4. Check GitHub issues

✅ **All working?** Happy Voting! 🗳️
