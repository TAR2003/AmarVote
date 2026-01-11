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

ENV JAVA_OPTS="-Xmx512m -Xms256m"

ENTRYPOINT ["sh", "-c", "java ${JAVA_OPTS} -jar app.jar"]
