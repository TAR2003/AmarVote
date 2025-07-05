# Use OpenJDK 21 as the base image since that's specified in pom.xml
FROM eclipse-temurin:21-jdk AS build

# Set the working directory in the container
WORKDIR /app

# Copy the Maven wrapper and POM
COPY mvnw .
COPY .mvn .mvn
COPY pom.xml .

# Make the Maven wrapper executable
RUN chmod +x mvnw

# Download Maven dependencies
RUN ./mvnw dependency:go-offline -B

# Copy the project source
COPY src src

# Build the application
RUN ./mvnw package -DskipTests

# Use a smaller runtime image
FROM eclipse-temurin:21-jre

WORKDIR /app

# Copy the built JAR file from the build stage
COPY --from=build /app/target/*.jar app.jar

# Create a volume for logs
VOLUME /app/logs

# Expose port the Spring Boot application typically uses
EXPOSE 8080

# Environment variable to configure JVM options
ENV JAVA_OPTS=""

# Command to run the application
ENTRYPOINT ["sh", "-c", "java ${JAVA_OPTS} -jar app.jar"]