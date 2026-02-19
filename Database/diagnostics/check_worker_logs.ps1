# Worker Proceedings - Database Check and Fix Script
# This script checks if worker log tables exist and creates them if missing

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  WORKER PROCEEDINGS - DATABASE CHECKER" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Database connection settings
$DB_USER = "amarvote_admin"
$DB_NAME = "amarvote"
$DB_HOST = "localhost"
$DB_PORT = "5432"

Write-Host "🔍 Checking database configuration..." -ForegroundColor Yellow
Write-Host "   Database: $DB_NAME" -ForegroundColor Gray
Write-Host "   User: $DB_USER" -ForegroundColor Gray
Write-Host "   Host: $DB_HOST" -ForegroundColor Gray
Write-Host ""

# Check if psql is available
try {
    $psqlVersion = & psql --version 2>&1
    Write-Host "✅ PostgreSQL client found: $psqlVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ ERROR: PostgreSQL client (psql) not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install PostgreSQL or add it to your PATH:" -ForegroundColor Yellow
    Write-Host "   https://www.postgresql.org/download/" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  STEP 1: VERIFYING WORKER LOG TABLES" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Run verification script
Write-Host "Running verification script..." -ForegroundColor Yellow
$verifyScript = "Database\diagnostics\verify_worker_log_tables.sql"

if (Test-Path $verifyScript) {
    try {
        $env:PGPASSWORD = Read-Host "Enter database password for user '$DB_USER'" -AsSecureString
        $env:PGPASSWORD = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($env:PGPASSWORD))
        
        $output = & psql -U $DB_USER -d $DB_NAME -h $DB_HOST -p $DB_PORT -f $verifyScript 2>&1
        
        Write-Host ""
        Write-Host $output
        Write-Host ""
        
        # Check if tables are missing
        if ($output -match "TABLE DOES NOT EXIST" -or $output -match "MISSING") {
            Write-Host "================================================" -ForegroundColor Red
            Write-Host "  ❌ PROBLEM DETECTED: Tables are missing!" -ForegroundColor Red
            Write-Host "================================================" -ForegroundColor Red
            Write-Host ""
            
            $response = Read-Host "Would you like to create the missing tables now? (Y/N)"
            
            if ($response -eq "Y" -or $response -eq "y") {
                Write-Host ""
                Write-Host "================================================" -ForegroundColor Cyan
                Write-Host "  STEP 2: CREATING WORKER LOG TABLES" -ForegroundColor Cyan
                Write-Host "================================================" -ForegroundColor Cyan
                Write-Host ""
                
                $createScript = "Database\diagnostics\create_worker_log_tables.sql"
                
                if (Test-Path $createScript) {
                    Write-Host "Creating tables..." -ForegroundColor Yellow
                    $createOutput = & psql -U $DB_USER -d $DB_NAME -h $DB_HOST -p $DB_PORT -f $createScript 2>&1
                    
                    Write-Host ""
                    Write-Host $createOutput
                    Write-Host ""
                    
                    if ($LASTEXITCODE -eq 0) {
                        Write-Host "✅ Tables created successfully!" -ForegroundColor Green
                        Write-Host ""
                        Write-Host "================================================" -ForegroundColor Green
                        Write-Host "  NEXT STEPS" -ForegroundColor Green
                        Write-Host "================================================" -ForegroundColor Green
                        Write-Host ""
                        Write-Host "1. Restart your backend service" -ForegroundColor White
                        Write-Host "2. Create a NEW election" -ForegroundColor White
                        Write-Host "3. Process the election (voting, tallying, decryption)" -ForegroundColor White
                        Write-Host "4. Check Worker Proceedings tab" -ForegroundColor White
                        Write-Host ""
                        Write-Host "⚠️  Note: Only NEW elections will have worker logs." -ForegroundColor Yellow
                        Write-Host "   Old elections will show 'No Processing Logs Yet'" -ForegroundColor Yellow
                        Write-Host ""
                    } else {
                        Write-Host "❌ Failed to create tables. Check the error messages above." -ForegroundColor Red
                        Write-Host ""
                        exit 1
                    }
                } else {
                    Write-Host "❌ Create script not found: $createScript" -ForegroundColor Red
                    Write-Host "   Please ensure you are running this from the project root directory." -ForegroundColor Yellow
                    Write-Host ""
                    exit 1
                }
            } else {
                Write-Host ""
                Write-Host "⚠️  Tables not created. Worker Proceedings will not work until tables are created." -ForegroundColor Yellow
                Write-Host ""
                Write-Host "To create tables manually, run:" -ForegroundColor White
                Write-Host "   psql -U $DB_USER -d $DB_NAME -f Database\diagnostics\create_worker_log_tables.sql" -ForegroundColor Gray
                Write-Host ""
            }
        } elseif ($output -match "tables exist but are empty" -or $output -match "0 records") {
            Write-Host "================================================" -ForegroundColor Yellow
            Write-Host "  ⚠️  INFORMATION: Tables exist but are empty" -ForegroundColor Yellow
            Write-Host "================================================" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "This is normal if:" -ForegroundColor White
            Write-Host "  • No elections have been processed since tables were created" -ForegroundColor Gray
            Write-Host "  • You are viewing old elections" -ForegroundColor Gray
            Write-Host ""
            Write-Host "To generate worker logs:" -ForegroundColor White
            Write-Host "  1. Create a NEW election" -ForegroundColor Gray
            Write-Host "  2. Process it through voting and tallying" -ForegroundColor Gray
            Write-Host "  3. Worker logs will appear automatically" -ForegroundColor Gray
            Write-Host ""
        } else {
            Write-Host "================================================" -ForegroundColor Green
            Write-Host "  ✅ SUCCESS: Everything looks good!" -ForegroundColor Green
            Write-Host "================================================" -ForegroundColor Green
            Write-Host ""
            Write-Host "Worker log tables are properly configured." -ForegroundColor White
            Write-Host ""
            Write-Host "If Worker Proceedings still shows errors:" -ForegroundColor White
            Write-Host "  1. Check browser console for errors (F12)" -ForegroundColor Gray
            Write-Host "  2. Verify backend service is running" -ForegroundColor Gray
            Write-Host "  3. Check backend logs for errors" -ForegroundColor Gray
            Write-Host "  4. Ensure the election has been processed" -ForegroundColor Gray
            Write-Host ""
        }
        
    } catch {
        Write-Host "❌ ERROR: Failed to connect to database" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
        Write-Host ""
        Write-Host "Please check:" -ForegroundColor Yellow
        Write-Host "  • Database is running" -ForegroundColor Gray
        Write-Host "  • Credentials are correct" -ForegroundColor Gray
        Write-Host "  • Connection settings (host, port, database name)" -ForegroundColor Gray
        Write-Host ""
        exit 1
    } finally {
        $env:PGPASSWORD = $null
    }
} else {
    Write-Host "❌ Verification script not found: $verifyScript" -ForegroundColor Red
    Write-Host "   Please ensure you are running this from the project root directory." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  SCRIPT COMPLETE" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Wait for user input before closing
Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
