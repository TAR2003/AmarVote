# Quick Start Guide: RabbitMQ Worker Architecture

## Prerequisites

1. **Java 21** installed
2. **Maven** installed
3. **PostgreSQL** database running
4. **RabbitMQ** installed and running

## Step 1: Install and Start RabbitMQ

### Option A: Using Docker (Recommended)

```bash
docker run -d --name rabbitmq \
  -p 5672:5672 \
  -p 15672:15672 \
  rabbitmq:3-management
```

### Option B: Using Windows (Chocolatey)

```bash
choco install rabbitmq
```

### Option C: Manual Installation

Download from: https://www.rabbitmq.com/download.html

### Verify RabbitMQ is Running

- Access management UI: http://localhost:15672
- Default credentials: `guest` / `guest`

## Step 2: Configure Application

### Add RabbitMQ Configuration

Add to `backend/src/main/resources/application.properties`:

```properties
# RabbitMQ Configuration
spring.rabbitmq.host=localhost
spring.rabbitmq.port=5672
spring.rabbitmq.username=guest
spring.rabbitmq.password=guest
spring.rabbitmq.connection-timeout=30000
spring.rabbitmq.requested-heartbeat=60
```

Or copy the template:
```bash
# Copy the RabbitMQ configuration template
cp backend/src/main/resources/application-rabbitmq.properties backend/src/main/resources/application.properties
# Then append to your existing application.properties
```

## Step 3: Build the Project

```bash
cd backend
mvn clean install
```

## Step 4: Run the Application

```bash
mvn spring-boot:run
```

Or run the JAR:
```bash
java -jar target/amarvote-0.0.1-SNAPSHOT.jar
```

## Step 5: Verify Setup

### Check Application Logs

Look for these log messages on startup:

```
✅ RabbitMQ connection established
✅ Queues created: tally.creation.queue, partial.decryption.queue, ...
✅ Workers registered and listening
```

### Check RabbitMQ Management UI

1. Go to http://localhost:15672
2. Login with `guest` / `guest`
3. Click **Queues** tab
4. You should see 4 queues:
   - `tally.creation.queue`
   - `partial.decryption.queue`
   - `compensated.decryption.queue`
   - `combine.decryption.queue`

## Step 6: Test with a Small Election

### Create a Test Election

1. Create an election with 10-20 voters
2. Have voters cast ballots
3. Close the election

### Test Tally Creation

1. Initiate tally creation via API or UI
2. Watch the logs:
   ```
   📤 Publishing tally creation task for election X, chunk Y
   === WORKER: Processing Tally Creation Chunk Y ===
   🧠 Memory before: X MB
   ✅ Chunk Y complete. Memory freed: Z MB
   ```
3. Check progress in database:
   ```sql
   SELECT * FROM tally_creation_status WHERE election_id = X;
   ```

### Test Guardian Decryption

1. Guardian submits credentials
2. Watch the logs:
   ```
   📤 Publishing partial decryption task...
   📤 Publishing compensated decryption task...
   === WORKER: Processing Partial Decryption Chunk Y ===
   ```
3. Check progress:
   ```sql
   SELECT * FROM decryption_status WHERE election_id = X;
   ```

### Test Combine Decryption

1. Initiate combine process
2. Watch the logs:
   ```
   📤 Publishing combine decryption task...
   === WORKER: Processing Combine Decryption Chunk Y ===
   ```
3. Check final results in `election_center` table

## Step 7: Monitor Performance

### Memory Monitoring

Watch for these patterns in logs:
```
🧠 Memory before: 150 MB
🧠 Memory after: 120 MB
✅ Memory freed: 30 MB
```

### Queue Monitoring

In RabbitMQ Management UI:
- Check queue lengths (should process quickly and drain)
- Monitor message rates
- Check for any stuck messages

### Database Monitoring

```sql
-- Check if any processes are stuck
SELECT 
    election_id, 
    status, 
    processed_chunks, 
    total_chunks,
    (processed_chunks::float / total_chunks * 100) as progress
FROM tally_creation_status
WHERE status = 'in_progress';

SELECT 
    election_id, 
    guardian_id,
    status, 
    current_phase,
    processed_chunks, 
    total_chunks
FROM decryption_status
WHERE status = 'in_progress';
```

## Troubleshooting

### Issue: RabbitMQ Connection Refused

**Error**: `java.net.ConnectException: Connection refused`

**Solution**:
1. Check RabbitMQ is running: `docker ps` or check Windows services
2. Verify port 5672 is accessible
3. Check firewall settings

### Issue: Queues Not Created

**Error**: Queues don't appear in RabbitMQ UI

**Solution**:
1. Check application logs for errors
2. Verify RabbitMQ configuration in application.properties
3. Restart application

### Issue: Tasks Not Processing

**Symptom**: Tasks queue up but don't get processed

**Solution**:
1. Check application logs for worker exceptions
2. Verify workers are registered (check startup logs)
3. Check RabbitMQ management UI for consumer connections
4. Restart application if needed

### Issue: Out of Memory Still Occurring

**Symptom**: Memory still growing despite new architecture

**Solution**:
1. Check JVM heap settings: `-Xmx` parameter
2. Monitor memory usage pattern in logs
3. Profile with JVM tools (VisualVM)
4. Check for memory leaks in ElectionGuard microservice

## Production Deployment

### Environment Variables

Set these environment variables in production:

```bash
# RabbitMQ
export SPRING_RABBITMQ_HOST=your-rabbitmq-host
export SPRING_RABBITMQ_PORT=5672
export SPRING_RABBITMQ_USERNAME=your-username
export SPRING_RABBITMQ_PASSWORD=your-password

# Optional: Increase JVM heap if needed
export JAVA_OPTS="-Xms512m -Xmx2g"
```

### Docker Compose Example

```yaml
version: '3.8'
services:
  rabbitmq:
    image: rabbitmq:3-management
    ports:
      - "5672:5672"
      - "15672:15672"
    environment:
      RABBITMQ_DEFAULT_USER: amarvote
      RABBITMQ_DEFAULT_PASS: secure_password
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq

  backend:
    build: ./backend
    ports:
      - "8080:8080"
    environment:
      SPRING_RABBITMQ_HOST: rabbitmq
      SPRING_RABBITMQ_PORT: 5672
      SPRING_RABBITMQ_USERNAME: amarvote
      SPRING_RABBITMQ_PASSWORD: secure_password
    depends_on:
      - rabbitmq
      - postgres

volumes:
  rabbitmq_data:
```

### Health Checks

Add health check endpoints to monitor:
- RabbitMQ connection status
- Queue lengths
- Worker status
- Memory usage

## Performance Tuning

### Adjust Worker Concurrency

If you want more workers (for faster processing), modify `RabbitMQConfig.java`:

```java
@Bean
public SimpleRabbitListenerContainerFactory rabbitListenerContainerFactory(...) {
    factory.setConcurrentConsumers(2); // Increase from 1
    factory.setMaxConcurrentConsumers(5); // Allow up to 5
    return factory;
}
```

**Note**: Only increase if you've tested memory usage and confirmed it's safe.

### Adjust Prefetch Count

To fetch more messages at once:

```java
factory.setPrefetchCount(5); // Increase from 1
```

**Note**: This may increase memory usage. Monitor carefully.

## Next Steps

1. **Load Testing**: Test with large elections (1000+ ballots)
2. **Monitoring**: Set up proper monitoring (Prometheus, Grafana)
3. **Alerting**: Configure alerts for queue backlogs
4. **Scaling**: Consider horizontal scaling if needed
5. **Optimization**: Profile and optimize based on real-world usage

## Support

For issues or questions:
1. Check logs in `backend/logs/`
2. Check RabbitMQ management UI
3. Review documentation: `docs/RABBITMQ_WORKER_ARCHITECTURE.md`
4. Check database status tables

---

**Last Updated**: January 18, 2026
