FROM eclipse-temurin:21-jdk AS build

WORKDIR /app

COPY mvnw .
COPY .mvn .mvn
COPY pom.xml .

RUN chmod +x mvnw
RUN ./mvnw dependency:go-offline -B

COPY src src
RUN ./mvnw package -DskipTests

FROM eclipse-temurin:21-jdk AS layers
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
RUN java -Djarmode=tools -jar app.jar extract --layers --destination extracted

FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

RUN addgroup -S spring && adduser -S spring -G spring \
    && mkdir -p /app/logs /app/data/credentials \
    && chown -R spring:spring /app \
    && chmod 700 /app/data/credentials

COPY --from=layers --chown=spring:spring /app/extracted/dependencies/ ./
COPY --from=layers --chown=spring:spring /app/extracted/spring-boot-loader/ ./
COPY --from=layers --chown=spring:spring /app/extracted/snapshot-dependencies/ ./
COPY --from=layers --chown=spring:spring /app/extracted/application/ ./

USER spring:spring

VOLUME /app/logs
VOLUME /app/data/credentials
EXPOSE 8080

ENV JAVA_OPTS="-Xmx2048m -Xms1024m -XX:+UseG1GC -XX:MaxGCPauseMillis=100 -XX:InitiatingHeapOccupancyPercent=35 -XX:+ExplicitGCInvokesConcurrent -XX:G1HeapRegionSize=16m -XX:+UseStringDeduplication -XX:+ParallelRefProcEnabled -XX:MetaspaceSize=128m -XX:MaxMetaspaceSize=384m -XX:MaxDirectMemorySize=256m -XX:+ExitOnOutOfMemoryError"

ENTRYPOINT ["sh", "-c", "exec java ${JAVA_OPTS} org.springframework.boot.loader.launch.JarLauncher"]
