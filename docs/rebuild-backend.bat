@echo off
echo ========================================
echo Rebuilding Backend with RabbitMQ Support
echo ========================================

cd backend

echo.
echo [1/3] Cleaning old build...
call mvnw.cmd clean

echo.
echo [2/3] Downloading dependencies (including RabbitMQ)...
call mvnw.cmd dependency:resolve

echo.
echo [3/3] Compiling and packaging...
call mvnw.cmd package -DskipTests

echo.
echo ========================================
echo Build Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Run database migration: Database\migration_add_election_jobs.sql
echo 2. Start services: docker-compose -f docker-compose.prod.yml up -d --build
echo.
pause
