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

# Optimized heap and GC settings for sustained high-throughput chunk processing (1000+ chunks)
# -Xmx2560m: Max heap 2.5GB (adequate for worker processing)
# -Xms512m: Initial heap 512MB (faster startup)
# -XX:+UseG1GC: Use G1 garbage collector (best for heap >2GB)
# -XX:MaxGCPauseMillis=100: Target max GC pause time (reduced for consistent performance)
# -XX:InitiatingHeapOccupancyPercent=35: Start concurrent GC earlier (prevents accumulation)
# -XX:G1ReservePercent=10: Reserve 10% heap for to-space (prevents allocation failures)
# -XX:+ExplicitGCInvokesConcurrent: CRITICAL - Makes System.gc() concurrent (no STW pauses)
# -XX:+ParallelRefProcEnabled: Parallel reference processing for faster GC
# -XX:+AlwaysPreTouch: Touch all memory pages at startup (eliminates allocation pauses)
# -XX:+DisableExplicitGC: REMOVED - We need System.gc() for chunk cleanup
# -XX:+ExitOnOutOfMemoryError: Exit cleanly on OOM
ENV JAVA_OPTS="-Xmx2560m -Xms512m -XX:+UseG1GC -XX:MaxGCPauseMillis=100 -XX:InitiatingHeapOccupancyPercent=35 -XX:G1ReservePercent=10 -XX:+ExplicitGCInvokesConcurrent -XX:+ParallelRefProcEnabled -XX:+AlwaysPreTouch -XX:+ExitOnOutOfMemoryError"

ENTRYPOINT ["sh", "-c", "java ${JAVA_OPTS} -jar app.jar"]
