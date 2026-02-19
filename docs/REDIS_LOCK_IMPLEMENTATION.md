# Redis Distributed Lock Implementation for Worker Tasks

## Overview

This document describes the Redis-based distributed lock system implemented to prevent redundant worker task operations in the AmarVote election system.

## Purpose

The Redis lock system ensures that when multiple users attempt to initiate the same operation simultaneously (e.g., from different devices), only one request is processed while others are notified about the ongoing process with relevant metadata.

## Use Cases

### 1. Guardian Decryption Lock
**Lock Key Format**: `lock:decryption:election:{electionId}:guardian:{guardianId}`

**Scenario**: Guardian submits decryption credentials from two devices simultaneously

**Behavior**:
- First request acquires the lock and starts processing
- Second request receives a response with:
  - Who initiated the process (email)
  - When the process started (timestamp)
  - Message indicating decryption is already in progress

### 2. Tally Creation Lock
**Lock Key Format**: `lock:tally:election:{electionId}`

**Scenario**: Two election officials click "Create Tally" at the same time

**Behavior**:
- First request acquires the lock and starts tally creation
- Second request receives notification with:
  - User email who started the process
  - Start timestamp
  - Message indicating tally creation is already in progress

### 3. Combine Decryption Shares Lock
**Lock Key Format**: `lock:combine:election:{electionId}`

**Scenario**: Multiple users attempt to combine decryption shares simultaneously

**Behavior**:
- First request acquires the lock and starts combination
- Subsequent requests are informed about the ongoing process with metadata

## Implementation Components

### 1. RedisLockService
**Location**: `backend/src/main/java/com/amarvote/amarvote/service/RedisLockService.java`

**Key Methods**:

#### try AcquireLock()
```java
public boolean tryAcquireLock(
    String lockKey, 
    String userEmail, 
    String operationType, 
    String context
)
```
- Attempts to acquire a lock with metadata
- Returns `true` if lock acquired, `false` if already locked
- Uses Redis `SETNX` (Set if Not Exists) operation for atomicity
- Stores lock metadata as JSON

#### getLockMetadata()
```java
public Optional<LockMetadata> getLockMetadata(String lockKey)
```
- Retrieves metadata for an existing lock
- Returns lock information including user email and start time
- Used to inform users about ongoing operations

#### releaseLock()
```java
public boolean releaseLock(String lockKey)
```
- Releases a lock when operation completes
- Called in `finally` blocks to ensure cleanup

### 2. LockMetadata DTO
**Location**: `backend/src/main/java/com/amarvote/amarvote/dto/LockMetadata.java`

**Fields**:
- `userEmail`: Email of user who initiated the operation
- `startTime`: When the lock was acquired (Instant)
- `expectedEndTime`: Optional expected completion time
- `operationType`: Type of operation (TALLY_CREATION, GUARDIAN_DECRYPTION, COMBINE_DECRYPTION)
- `lockKey`: Unique identifier for the lock
- `context`: Additional context information

### 3. Updated Status Response DTOs

#### TallyCreationStatusResponse
**New Fields**:
- `lockHeldBy`: Email of user holding the lock
- `lockStartTime`: When the lock was acquired
- `isLocked`: Whether a lock currently exists

#### DecryptionStatusResponse
**New Fields**:
- `lockHeldBy`: Email of user holding the lock
- `lockStartTime`: When the lock was acquired
- `isLocked`: Whether a lock currently exists

#### CombineStatusResponse
**New Fields**:
- `lockHeldBy`: Email of user holding the lock
- `lockStartTime`: Instant when the lock was acquired
- `isLocked`: Whether a lock currently exists

## Service Updates

### TallyService
**Changes**:
1. Removed `ConcurrentHashMap<Long, Boolean> tallyCreationLocks`
2. Added `RedisLockService` dependency
3. Updated `createTally()` to use Redis locks
4. Updated `createTallyAsync()` to release locks in finally block
5. Updated `getTallyStatus()` to include lock metadata

**Code Flow**:
```java
// In createTally()
String lockKey = RedisLockService.buildTallyLockKey(electionId);
boolean lockAcquired = redisLockService.tryAcquireLock(
    lockKey, userEmail, "TALLY_CREATION", context
);

if (!lockAcquired) {
    // Get lock metadata and inform user
    Optional<LockMetadata> existingLock = redisLockService.getLockMetadata(lockKey);
    return response with lock information
}

// In createTallyAsync() finally block
redisLockService.releaseLock(lockKey);
```

### PartialDecryptionService
**Changes**:
1. Removed `ConcurrentHashMap<String, Boolean> decryptionLocks`
2. Removed `ConcurrentHashMap<Long, Boolean> combineLocks`
3. Added `RedisLockService` dependency
4. Updated guardian decryption operations
5. Updated combine decryption operations
6. Updated all status methods to include lock metadata

### Decryption Lock Flow**:
```java
// In initiateDecryption()
String lockKey = RedisLockService.buildDecryptionLockKey(
    electionId, String.valueOf(guardianId)
);
boolean lockAcquired = redisLockService.tryAcquireLock(
    lockKey, userEmail, "GUARDIAN_DECRYPTION", context
);

// In processDecryptionAsync() finally block
redisLockService.releaseLock(lockKey);
```

**Combine Lock Flow**:
```java
// In combinePartialDecryption()
String lockKey = RedisLockService.buildCombineLockKey(electionId);
boolean lockAcquired = redisLockService.tryAcquireLock(
    lockKey, "system", "COMBINE_DECRYPTION", context
);

// In processCombineAsync() finally block
redisLockService.releaseLock(lockKey);
```

## Lock Configuration

### Expiration
- **Default TTL**: 2 hours (7200 seconds)
- Prevents deadlocks if a process crashes without releasing the lock
- Can be customized per operation type

### Redis Configuration
**Location**: `backend/src/main/resources/application.properties`

```properties
spring.data.redis.host=${SPRING_REDIS_HOST:redis}
spring.data.redis.port=${SPRING_REDIS_PORT:6379}
spring.data.redis.password=${SPRING_REDIS_PASSWORD:}
spring.data.redis.timeout=5000
spring.data.redis.lettuce.pool.max-active=20
spring.data.redis.lettuce.pool.max-idle=10
spring.data.redis.lettuce.pool.min-idle=5
```

## Benefits

### 1. Prevention of Redundant Operations
- Only one instance of an operation runs at a time
- Prevents duplicate processing and race conditions
- Saves computational resources

### 2. Better User Experience
- Users are informed when an operation is already in progress
- Shows who initiated the operation and when
- Prevents confusion from multiple simultaneous submissions

### 3. Distributed System Support
- Works across multiple backend instances (scaled horizontally)
- Redis provides centralized lock coordination
- No dependency on single-server in-memory structures

### 4. Automatic Cleanup
- Locks expire automaticallyafter TTL to prevent deadlocks
- `finally` blocks ensure locks are released even on errors
- No manual intervention required for cleanup

### 5. Observability
- Lock metadata provides audit trail
- Status endpoints show current lock state
- Easy debugging of concurrent operations

## Example User Flows

### Example 1: Guardian Submits from Two Devices

**Device 1** (at 10:00:00):
```
POST /api/decryption/initiate
Response: {
    "success": true,
    "message": "Decryption is being processed..."
}
```

**Device 2** (at 10:00:02):
```
POST /api/decryption/initiate
Response: {
    "success": true,
    "message": "Decryption is already in progress. Started by guardian@example.com at 2026-02-19T10:00:00Z"
}
```

### Example 2: Two Officials Create Tally

**Official 1** (at 14:30:00):
```
POST /api/tally/create
Response: {
    "success": true,
    "message": "Request accepted. Preparing to process 100 chunks...",
    "encryptedTally": "INITIATED:100"
}
```

**Official 2** (at 14:30:01):
```
POST /api/tally/create
Response: {
    "success": true,
    "message": "Tally creation is already in progress. Started by official1@example.com at 2026-02-19T14:30:00Z"
}
```

### Example 3: Status Check During Locked Operation

```
GET /api/decryption/status?electionId=123&guardianId=1
Response: {
    "success": true,
    "status": "in_progress",
    "totalChunks": 50,
    "processedChunks": 25,
    "progressPercentage": 50.0,
    "isLocked": true,
    "lockHeldBy": "guardian@example.com",
    "lockStartTime": "2026-02-19T10:00:00Z"
}
```

## Testing Recommendations

### Unit Tests
1. Test lock acquisition when no lock exists
2. Test lock acquisition failure when lock exists
3. Test lock metadata retrieval
4. Test lock release

### Integration Tests
1. Simulate concurrent requests to same endpoint
2. Verify only one request succeeds in acquiring lock
3. Verify lock metadata is correctly stored and retrieved
4. Verify locks are automatically released after operation

### Load Tests
1. Test with many concurrent requests
2. Verify Redis connection pool handles load
3. Monitor lock expiration and cleanup
4. Test failover scenarios

## Monitoring

### Metrics to Track
1. **Lock Acquisition Rate**: How often locks are successfully acquired vs. rejected
2. **Lock Duration**: How long operations hold locks
3. **Lock Expiration**: How many locks expire (indicates crashes/errors)
4. **Concurrent Requests**: Number of rejected requests due to existing locks

### Redis Commands for Debugging
```bash
# Check if a lock exists
redis-cli EXISTS "lock:tally:election:123"

# Get lock metadata
redis-cli GET "lock:tally:election:123"

# Check lock TTL
redis-cli TTL "lock:tally:election:123"

# List all locks
redis-cli KEYS "lock:*"

# Force release a stuck lock (use with caution!)
redis-cli DEL "lock:tally:election:123"
```

## Error Handling

### Scenarios Handled
1. **Redis Connection Failure**: Lock acquisition fails gracefully, returns false
2. **Lock Already Exists**: Returns metadata to inform user
3. **Lock Expiration During Operation**: Operation continues, lock auto-expires
4. **Process Crash**: Lock expires after TTL, next request can proceed

### Logging
- Lock acquisition logged with user email and timestamp
- Lock release logged with operation completion
- Failed lock acquisitions logged with existing lock metadata
- Errors in lock operations logged with details

## Future Enhancements

1. **Lock Extension**: Extend lock TTL for long-running operations
2. **Lock Priority**: Allow admins to override locks
3. **Lock Queue**: Queue requests instead of rejecting them
4. **Lock Analytics**: Dashboard showing lock usage patterns
5. **Custom TTL**: Different TTL per operation type
6. **Lock Notifications**: Notify users when locked operation completes

## Conclusion

The Redis distributed lock system provides robust protection against redundant operations while maintaining excellent user experience through informative feedback. The implementation is production-ready, scalable, and provides strong guarantees for operation exclusivity across distributed backend instances.
