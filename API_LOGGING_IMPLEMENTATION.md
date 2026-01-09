# API Logging System - Implementation Guide

## Overview

The AmarVote API Logging System provides comprehensive tracking and monitoring of all API requests. It captures request details, authentication tokens, user emails, response status, and performance metrics.

## Features

✅ **Automatic Request Logging** - All API requests are automatically logged
✅ **Authentication Tracking** - Captures JWT tokens and extracts user emails
✅ **IP Address Tracking** - Records requester IP addresses
✅ **Performance Monitoring** - Tracks response times for each request
✅ **Admin Dashboard** - Beautiful web interface to view and filter logs
✅ **Secure Access** - Admin-only access with password protection
✅ **Advanced Filtering** - Filter logs by email, IP, path, or view all

## Architecture

### Backend Components

1. **ApiLog Model** - Entity representing a log entry
2. **ApiLogRepository** - JPA repository for database operations
3. **ApiLogService** - Service layer for log management
4. **ApiLoggingFilter** - Filter that captures all requests before processing
5. **AdminController** - REST endpoints for admin login and log retrieval

### Frontend Components

1. **AdminLogin.jsx** - Admin login page
2. **ApiLogs.jsx** - Logs dashboard with filtering and pagination
3. **Updated Home.jsx** - Added "API Logs" button
4. **Updated App.jsx** - New routes for admin functionality

### Database

- **api_logs table** - Stores all log entries
- **Indexes** - Optimized for fast querying by email, IP, path, time, and status

## Setup Instructions

### 1. Database Migration

If you have an existing database, run the migration script:

**On Windows:**
```bash
migrate-api-logs.bat
```

**On Linux/Mac:**
```bash
chmod +x migrate-api-logs.sh
./migrate-api-logs.sh
```

**For new installations:**
The table is already included in `table_creation_file_AmarVote.sql`

### 2. Environment Configuration

The admin password is configured in `.env`:
```env
LOG_PASSWORD=amarvote123
```

Change this to a secure password in production!

### 3. Build and Deploy

**Using Docker Compose:**
```bash
docker-compose -f docker-compose.prod.yml up --build
```

The LOG_PASSWORD environment variable is automatically passed to the backend container.

## Usage Guide

### Accessing the Admin Panel

1. **Navigate to Home Page**
   - Go to the AmarVote homepage
   - Click the "API Logs" button in the top navigation

2. **Admin Login**
   - Username: `admin`
   - Password: Value from `LOG_PASSWORD` environment variable (default: `amarvote123`)
   - Click "Sign In"

3. **View Logs**
   - After successful login, you'll be redirected to the API Logs dashboard
   - View comprehensive statistics and log entries

### Dashboard Features

#### Statistics Cards
- **Total Requests** - Total number of API requests logged
- **Error Requests** - Number of failed requests (4xx, 5xx status codes)
- **Success Rate** - Percentage of successful requests

#### Filtering Options

1. **All Logs** - View all requests (default)
2. **By Email** - Filter by user email address
3. **By IP** - Filter by IP address
4. **By Path** - Filter by API endpoint path

#### Log Table Columns

| Column | Description |
|--------|-------------|
| Time | Request timestamp |
| Method | HTTP method (GET, POST, PUT, DELETE, etc.) |
| Path | API endpoint path |
| Status | HTTP response status code (color-coded) |
| IP | Requester IP address |
| Email | Extracted user email from JWT token |
| Response Time | Time taken to process request (in milliseconds) |

#### Pagination

- Navigate through pages using Previous/Next buttons
- View up to 50 logs per page
- Current page and total pages displayed

### Status Code Colors

- 🟢 **Green** (2xx) - Successful requests
- 🟡 **Yellow** (3xx) - Redirects
- 🟠 **Orange** (4xx) - Client errors
- 🔴 **Red** (5xx) - Server errors

## Security Features

### Authentication Flow

1. Admin enters username and password
2. Backend validates credentials (username must be "admin", password must match LOG_PASSWORD)
3. JWT token generated with email set as "admin"
4. Token stored in HTTP-only cookie
5. All subsequent requests include this token

### Access Control

- **Admin Login Endpoint** (`/api/admin/login`) - Public (but requires valid credentials)
- **Logs Endpoints** (`/api/admin/logs`, `/api/admin/logs/stats`) - Protected
- **Email Validation** - Backend checks that token email equals "admin"
- **Automatic Rejection** - Non-admin users are denied access

### Token Security

- JWT tokens are HTTP-only cookies (protected from XSS)
- Tokens expire after 7 days
- Same-site cookie policy prevents CSRF attacks

## API Endpoints

### Admin Authentication

#### POST /api/admin/login
**Description:** Admin login endpoint

**Request Body:**
```json
{
  "username": "admin",
  "password": "your_password"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Admin login successful",
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

### Log Management

#### GET /api/admin/logs
**Description:** Retrieve paginated logs

**Query Parameters:**
- `page` (optional, default: 0) - Page number
- `size` (optional, default: 50) - Items per page
- `email` (optional) - Filter by email
- `ip` (optional) - Filter by IP address
- `path` (optional) - Filter by path

**Response:**
```json
{
  "content": [
    {
      "logId": 1,
      "requestMethod": "POST",
      "requestPath": "/api/auth/verify-otp",
      "requestIp": "192.168.1.100",
      "userAgent": "Mozilla/5.0...",
      "bearerToken": "eyJhbGciOiJ...",
      "extractedEmail": "user@example.com",
      "responseStatus": 200,
      "requestTime": "2026-01-09T10:30:00Z",
      "responseTime": 150
    }
  ],
  "totalPages": 10,
  "totalElements": 500,
  "number": 0,
  "size": 50
}
```

#### GET /api/admin/logs/stats
**Description:** Get log statistics

**Response:**
```json
{
  "totalLogs": 1500,
  "errorLogs": 45
}
```

## Database Schema

### api_logs Table

```sql
CREATE TABLE api_logs (
    log_id BIGSERIAL PRIMARY KEY,
    request_method VARCHAR(10) NOT NULL,
    request_path TEXT NOT NULL,
    request_ip VARCHAR(50),
    user_agent TEXT,
    bearer_token TEXT,
    extracted_email VARCHAR(255),
    request_body TEXT,
    response_status INTEGER,
    request_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    response_time BIGINT,
    error_message TEXT
);
```

### Indexes

- `idx_api_logs_email` - On extracted_email
- `idx_api_logs_time` - On request_time (descending)
- `idx_api_logs_path` - On request_path
- `idx_api_logs_ip` - On request_ip
- `idx_api_logs_status` - On response_status

## Configuration

### Backend Configuration

The following can be configured in `application.properties` or via environment variables:

```properties
# Admin password (from environment)
LOG_PASSWORD=${LOG_PASSWORD:amarvote123}

# Cookie security
cookie.secure=false  # Set to true in production with HTTPS
```

### Filter Configuration

The `ApiLoggingFilter` runs before all other filters (Order = 1) to ensure all requests are captured.

**Public routes that skip JWT validation:**
- `/api/admin/login` - Admin login
- `/api/auth/*` - User authentication
- `/api/health` - Health check
- Other public endpoints

## Performance Considerations

### Asynchronous Logging

Logs are saved asynchronously to avoid impacting request performance. If logging fails, the request continues normally.

### Request Body Truncation

- Request bodies larger than 5000 characters are truncated
- Sensitive fields (password, otp_code) are excluded from logging

### Database Optimization

- Indexed on frequently queried columns
- Pagination limits memory usage
- Efficient query patterns

## Maintenance

### Cleanup Old Logs

To prevent database bloat, periodically clean old logs:

```sql
-- Delete logs older than 90 days
DELETE FROM api_logs 
WHERE request_time < NOW() - INTERVAL '90 days';
```

Consider setting up a scheduled job for automatic cleanup.

### Monitoring Log Growth

```sql
-- Check total log count
SELECT COUNT(*) FROM api_logs;

-- Check database size
SELECT pg_size_pretty(pg_total_relation_size('api_logs'));
```

## Troubleshooting

### Issue: Admin can't login

**Solution:**
1. Verify LOG_PASSWORD in `.env` matches the password you're entering
2. Check backend logs for authentication errors
3. Ensure backend container has LOG_PASSWORD environment variable

### Issue: Logs not appearing

**Solution:**
1. Check if `api_logs` table exists in database
2. Run migration script if needed
3. Check backend logs for filter errors
4. Verify ApiLoggingFilter is registered (should see in startup logs)

### Issue: "Access Denied" on logs page

**Solution:**
1. Ensure you logged in with admin credentials
2. Check that JWT token email is "admin"
3. Clear cookies and login again

### Issue: Slow log loading

**Solution:**
1. Check database indexes are created
2. Reduce page size in query
3. Apply specific filters instead of viewing all logs

## Production Recommendations

1. **Change Default Password**
   ```env
   LOG_PASSWORD=your_secure_password_here
   ```

2. **Enable HTTPS**
   - Set `cookie.secure=true`
   - Use SSL certificates

3. **Implement Log Rotation**
   - Archive old logs
   - Set up automated cleanup

4. **Monitor Performance**
   - Use Grafana/Prometheus (already configured)
   - Set up alerts for high error rates

5. **Secure Database Access**
   - Use strong database passwords
   - Limit database network access
   - Enable SSL for database connections

## Files Modified/Created

### Backend Files Created
- `backend/src/main/java/com/amarvote/amarvote/model/ApiLog.java`
- `backend/src/main/java/com/amarvote/amarvote/repository/ApiLogRepository.java`
- `backend/src/main/java/com/amarvote/amarvote/service/ApiLogService.java`
- `backend/src/main/java/com/amarvote/amarvote/filter/ApiLoggingFilter.java`
- `backend/src/main/java/com/amarvote/amarvote/controller/AdminController.java`

### Backend Files Modified
- `backend/src/main/java/com/amarvote/amarvote/filter/JWTFilter.java`

### Frontend Files Created
- `frontend/src/pages/AdminLogin.jsx`
- `frontend/src/pages/ApiLogs.jsx`

### Frontend Files Modified
- `frontend/src/App.jsx`
- `frontend/src/pages/Home.jsx`

### Database Files Modified
- `Database/table_creation_file_AmarVote.sql`
- `Database/table_deletion_file_AmarVote.sql`

### Database Files Created
- `Database/migrate-api-logs.sql`

### Scripts Created
- `migrate-api-logs.bat`
- `migrate-api-logs.sh`

### Configuration Files Modified
- `docker-compose.prod.yml`

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review backend logs in Docker: `docker logs amarvote_backend`
3. Review database logs: `docker logs amarvote_postgres`
4. Check browser console for frontend errors

## License

Part of the AmarVote project.
