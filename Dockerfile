FROM maven:3.9.11-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -B dependency:go-offline
COPY src ./src
RUN mvn -B verify
FROM eclipse-temurin:21-jre
WORKDIR /app
RUN groupadd --system stockflow && useradd --system --gid stockflow stockflow
COPY --from=build /app/target/stockflow-1.0.0.jar app.jar
USER stockflow
EXPOSE 8080
ENTRYPOINT ["java","-jar","app.jar"]
