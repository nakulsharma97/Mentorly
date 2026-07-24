FROM maven:3.9-eclipse-temurin-21-jammy AS build

WORKDIR /workspace

COPY pom.xml ./
COPY src ./src

RUN mvn -B -ntp clean package -Dmaven.test.skip=true

FROM eclipse-temurin:21-jre-jammy

WORKDIR /app

COPY --from=build /workspace/target/*.jar /app/app.jar

ENV SPRING_PROFILES_ACTIVE=prod

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app/app.jar"]