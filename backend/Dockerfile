FROM eclipse-temurin:21-jdk AS build

WORKDIR /app

# Copy Maven wrapper
COPY mvnw .
COPY .mvn .mvn
COPY pom.xml .

RUN chmod +x mvnw

# Download dependencies (cached layer)
RUN ./mvnw dependency:go-offline -B

# Copy source and build
COPY src src
RUN ./mvnw package -DskipTests

# Production stage
FROM eclipse-temurin:21-jre

WORKDIR /app

# Install wget for healthcheck
RUN apt-get update && apt-get install -y wget && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd -r spring && useradd -r -g spring spring

# Create directories with secure permissions
RUN mkdir -p /app/logs /app/data/credentials && \
    chown -R spring:spring /app && \
    chmod 700 /app/data/credentials

USER spring:spring

# Copy JAR from build stage
COPY --from=build /app/target/*.jar app.jar

VOLUME /app/logs
VOLUME /app/data/credentials
EXPOSE 8080

# JVM Configuration for Production
# This Dockerfile supports TWO deployment modes via SPRING_PROFILES_ACTIVE:
#
# 1. API MODE (api profile):
#    - Handles HTTP requests only
#    - Publishes to RabbitMQ
#    - Heap: 512MB (fast, stateless)
#    - Environment: SPRING_PROFILES_ACTIVE=api
#    - JAVA_OPTS: -Xms256m -Xmx512m
#
# 2. WORKER MODE (worker profile):
#    - Processes chunks from RabbitMQ
#    - ONE chunk at a time
#    - Heap: 768MB (bounded, predictable)
#    - Environment: SPRING_PROFILES_ACTIVE=worker
#    - JAVA_OPTS: -Xms256m -Xmx768m
#
# JVM Flags Explained:
# -Xms256m: Initial heap (start small)
# -Xmx512m/768m: Max heap (API=512MB, Worker=768MB)
# -XX:+UseG1GC: Use G1 garbage collector for better memory management
# -XX:MaxGCPauseMillis=200: Target max GC pause time (200ms)
# -XX:+ExitOnOutOfMemoryError: Exit cleanly on OOM (container will restart)
#
# Default (if no JAVA_OPTS provided): API mode settings
ENV JAVA_OPTS="-Xms256m -Xmx512m -XX:+UseG1GC -XX:MaxGCPauseMillis=200 -XX:+ExitOnOutOfMemoryError"

ENTRYPOINT ["sh", "-c", "java ${JAVA_OPTS} -jar app.jar"]
