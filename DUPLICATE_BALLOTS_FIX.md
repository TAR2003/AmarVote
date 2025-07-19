# Fix for Duplicate Submitted Ballots Issue

## Problem
The submitted_ballots table was allowing duplicate entries because:
1. The database table had no unique constraint
2. Race conditions could occur where multiple inserts bypassed the Java duplicate check

## Solution Applied

### 1. Database Fix
Run the SQL script `Database/fix_duplicate_ballots.sql` to:
- Remove existing duplicates (keeping the earliest created)
- Add a unique constraint to prevent future duplicates
- Add an index for better performance

### 2. Backend Code Fix
Modified `TallyService.java` to:
- Add proper exception handling for database constraint violations
- Catch `DataIntegrityViolationException` specifically
- Add better logging for duplicate detection
- Added utility method `removeDuplicateSubmittedBallots()` for cleanup

### 3. How to Apply the Fix

1. **Database Update:**
   ```sql
   -- Run this in your PostgreSQL database
   \i Database/fix_duplicate_ballots.sql
   ```

2. **Restart Backend:**
   The Java code changes will take effect after restarting the Spring Boot application.

### 4. Verification
After applying the fix:
- New `create_encrypted_tally` calls will not create duplicates
- Any constraint violations will be logged and handled gracefully
- The database will enforce uniqueness at the schema level

### 5. Manual Cleanup (if needed)
If you need to clean existing duplicates for a specific election, you can call the new utility method or run the SQL cleanup directly.

## Root Cause Analysis
The issue occurred because:
1. The `create_encrypted_tally` microservice response contains an array of submitted_ballots
2. These were being saved to the database without proper duplicate prevention at the database level
3. The Java-level check could be bypassed in race conditions or if called multiple times

## Prevention
The fix prevents future occurrences by:
1. Database-level unique constraint (cannot be bypassed)
2. Proper exception handling in Java code
3. Better logging for debugging
4. Transactional integrity
