FROM eclipse-temurin:21-jdk AS build
WORKDIR /app
COPY mvnw .
COPY .mvn .mvn
COPY pom.xml .
RUN chmod +x mvnw
RUN ./mvnw dependency:go-offline -B
COPY src src
RUN ./mvnw package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
VOLUME /app/logs
EXPOSE 8080
ENV JAVA_OPTS="-Xmx384m -Xms128m -XX:+UseSerialGC"
ENTRYPOINT ["sh", "-c", "java ${JAVA_OPTS} -jar app.jar"]