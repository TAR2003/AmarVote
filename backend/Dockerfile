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

# OPTIMIZED JVM settings to prevent performance degradation over time
# -Xmx2048m: Max heap 2GB (enough for chunk processing)
# -Xms1024m: Initial heap 1GB (reduces heap resizing overhead)
# -XX:+UseG1GC: G1 garbage collector for low-latency
# -XX:MaxGCPauseMillis=100: Target 100ms GC pauses (aggressive)
# -XX:InitiatingHeapOccupancyPercent=35: Start GC at 35% heap (EARLY to prevent accumulation)
# -XX:+ExplicitGCInvokesConcurrent: Makes System.gc() concurrent
# -XX:G1HeapRegionSize=16m: Larger regions for better throughput
# -XX:+UseStringDeduplication: Reduce memory from duplicate strings
# -XX:+ParallelRefProcEnabled: Parallel reference processing
# -XX:MaxMetaspaceSize=256m: Limit metaspace to prevent growth
# -XX:+ExitOnOutOfMemoryError: Exit cleanly on OOM
ENV JAVA_OPTS="-Xmx2048m -Xms1024m -XX:+UseG1GC -XX:MaxGCPauseMillis=100 -XX:InitiatingHeapOccupancyPercent=35 -XX:+ExplicitGCInvokesConcurrent -XX:G1HeapRegionSize=16m -XX:+UseStringDeduplication -XX:+ParallelRefProcEnabled -XX:MaxMetaspaceSize=256m -XX:+ExitOnOutOfMemoryError"

ENTRYPOINT ["sh", "-c", "java ${JAVA_OPTS} -jar app.jar"]
