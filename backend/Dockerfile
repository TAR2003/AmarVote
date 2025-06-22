# Build stage
FROM eclipse-temurin:21-jdk AS builder

WORKDIR /workspace
COPY . .
RUN chmod +x mvnw

# Build the application (includes dependency resolution)
RUN ./mvnw clean package -DskipTests

# Runtime stage
FROM eclipse-temurin:21-jre

WORKDIR /app

# Copy the built JAR (using wildcard to handle version numbers)
COPY --from=builder /workspace/target/*.jar app.jar

# Create directory for logs and ensure proper permissions
RUN mkdir -p /app/logs && \
    chmod -R 755 /app/logs

# Configure health check
HEALTHCHECK --interval=30s --timeout=3s \
    CMD curl -f http://localhost:8080/actuator/health || exit 1

# Configure non-root user
RUN useradd -m appuser && \
    chown -R appuser:appuser /app
USER appuser

# Configure JVM options (adjust based on your VM resources)
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75 -Djava.security.egd=file:/dev/./urandom"

EXPOSE 8080

# Use shell form for variable expansion
ENTRYPOINT ["sh", "-c", "exec java ${JAVA_OPTS} -jar app.jar"]