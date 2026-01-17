# API Logging System - Quick Start Guide

## ✅ Implementation Complete!

The API Logging system has been successfully implemented with full tracking capabilities and an admin dashboard.

## 🚀 Quick Start

### 1. Run Database Migration (For Existing Databases)

**Windows:**
```bash
migrate-api-logs.bat
```

**Linux/Mac:**
```bash
chmod +x migrate-api-logs.sh
./migrate-api-logs.sh
```

### 2. Start the Application

```bash
docker-compose -f docker-compose.prod.yml up --build
```

### 3. Access Admin Panel

1. Open your browser and go to: `http://localhost` (or your deployed URL)
2. Click "API Logs" button in the top navigation
3. Login with:
   - **Username:** `admin`
   - **Password:** `amarvote123` (or your custom LOG_PASSWORD from .env)

## 📊 Features Implemented

### Backend
- ✅ API logging filter capturing all requests
- ✅ JWT token and email extraction
- ✅ IP address tracking
- ✅ Response time monitoring
- ✅ Admin authentication endpoint
- ✅ Logs retrieval with filtering
- ✅ Statistics endpoint

### Frontend
- ✅ Admin login page
- ✅ Beautiful logs dashboard
- ✅ Real-time statistics cards
- ✅ Advanced filtering (by email, IP, path)
- ✅ Pagination support
- ✅ Color-coded status indicators
- ✅ API Logs button on home page

### Database
- ✅ api_logs table with optimized indexes
- ✅ Migration scripts included
- ✅ Deletion script updated

## 🔐 Security

- Admin-only access with password protection
- Email validation ensures only "admin" user can access logs
- JWT token authentication
- HTTP-only cookies prevent XSS
- Sensitive data (passwords, OTP codes) excluded from logs

## 📝 Default Credentials

- **Username:** `admin`
- **Password:** Value of `LOG_PASSWORD` environment variable (default: `amarvote123`)

**⚠️ IMPORTANT:** Change the LOG_PASSWORD in `.env` for production deployments!

## 📂 Files Created/Modified

### Backend (Java)
- ✅ `ApiLog.java` - Model
- ✅ `ApiLogRepository.java` - Repository
- ✅ `ApiLogService.java` - Service
- ✅ `ApiLoggingFilter.java` - Request interceptor
- ✅ `AdminController.java` - REST endpoints
- ✅ `JWTFilter.java` - Updated (added admin login to public routes)

### Frontend (React)
- ✅ `AdminLogin.jsx` - Admin login page
- ✅ `ApiLogs.jsx` - Logs dashboard
- ✅ `App.jsx` - Updated (added routes)
- ✅ `Home.jsx` - Updated (added API Logs button)

### Database
- ✅ `table_creation_file_AmarVote.sql` - Added api_logs table
- ✅ `table_deletion_file_AmarVote.sql` - Added api_logs cleanup
- ✅ `migrate-api-logs.sql` - Migration script
- ✅ `migrate-api-logs.bat` - Windows migration
- ✅ `migrate-api-logs.sh` - Linux/Mac migration

### Configuration
- ✅ `docker-compose.prod.yml` - Added LOG_PASSWORD env var
- ✅ `.env` - Already has LOG_PASSWORD variable

## 🎯 Usage Examples

### View All Logs
1. Login as admin
2. Dashboard shows all logs by default
3. Navigate with pagination

### Filter by Email
1. Click "By Email" filter
2. Enter email address
3. Click "Apply"

### Filter by IP
1. Click "By IP" filter
2. Enter IP address
3. Click "Apply"

### Filter by API Path
1. Click "By Path" filter
2. Enter path (e.g., `/api/auth`)
3. Click "Apply"

## 📈 Statistics Dashboard

The dashboard shows:
- **Total Requests** - All API calls logged
- **Error Requests** - Failed requests (4xx, 5xx)
- **Success Rate** - Percentage of successful requests

## 🔧 Troubleshooting

### Can't Login as Admin
- Check LOG_PASSWORD in `.env` matches your input
- Restart backend container after changing .env

### Logs Not Appearing
- Run migration script: `migrate-api-logs.bat` or `migrate-api-logs.sh`
- Check backend logs: `docker logs amarvote_backend`

### Access Denied on Logs Page
- Ensure you logged in with correct admin credentials
- Clear cookies and login again

## 📖 Full Documentation

For comprehensive documentation, see: [API_LOGGING_IMPLEMENTATION.md](API_LOGGING_IMPLEMENTATION.md)

## ✨ What's Next?

The system is production-ready! Consider:
- Changing default admin password
- Setting up log rotation/cleanup
- Monitoring with Grafana (already configured)
- Enabling HTTPS in production

---

**Enjoy monitoring your API requests! 🎉**
