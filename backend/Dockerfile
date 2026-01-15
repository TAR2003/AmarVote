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

# Increased heap size for large decryption operations with multiple chunks
# -Xmx2560m: Max heap 2.5GB (increased from 512MB)
# -Xms512m: Initial heap 512MB
# -XX:+UseG1GC: Use G1 garbage collector for better memory management
# -XX:MaxGCPauseMillis=200: Target max GC pause time
# -XX:+ExitOnOutOfMemoryError: Exit cleanly on OOM
ENV JAVA_OPTS="-Xmx2560m -Xms512m -XX:+UseG1GC -XX:MaxGCPauseMillis=200 -XX:+ExitOnOutOfMemoryError"

ENTRYPOINT ["sh", "-c", "java ${JAVA_OPTS} -jar app.jar"]
