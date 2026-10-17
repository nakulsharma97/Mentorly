# ═══════════════════════════════════════════════════════════════════════════
#  Mentorly — repository-root Dockerfile  →  SPRING BOOT API ONLY
# ═══════════════════════════════════════════════════════════════════════════
#
#  Why this file exists
#  --------------------
#  Render's Docker runtime defaults to <repo-root>/Dockerfile when a service is
#  created with "Root Directory" and "Dockerfile Path" left empty. The real
#  backend image lives at backend/Dockerfile, so such a service used to fail
#  before the first build step with:
#      error: failed to solve: failed to read dockerfile:
#             open Dockerfile: no such file or directory
#
#  This file builds the same backend image from the repository root, so a Render
#  Web Service created with the defaults now works with no dashboard changes.
#
#  Relationship to the other Dockerfiles
#  -------------------------------------
#    backend/Dockerfile          the canonical API image (context = backend/)
#    ./Dockerfile  (this file)   same image, context = repository root
#    frontend/Dockerfile         SPA + TLS nginx, for docker-compose / VPS
#    frontend/Dockerfile.render  SPA + plain-HTTP nginx proxy, for Render
#
#  ⚠ THIS IS NOT THE FRONTEND IMAGE. A frontend service must use
#    Root Directory = frontend, Dockerfile Path = Dockerfile.render.
#
#  Preferred Render configuration (smaller context, no backend/ prefixes):
#    Root Directory: backend · Dockerfile Path: Dockerfile · Build Context: (empty)
#  Use this root file when you would rather keep Root Directory empty.
# ═══════════════════════════════════════════════════════════════════════════

# ── Build stage ────────────────────────────────────────────────────────────
FROM maven:3.9-eclipse-temurin-21-jammy AS build

WORKDIR /workspace

# Context is the repository root, so every backend path needs its prefix.
# Only pom.xml + src are needed: the pom is standalone (parent is resolved from
# Maven Central, not from a sibling directory).
COPY backend/pom.xml ./
COPY backend/src ./src

# Tests are skipped in the image build: they need a live MySQL/Redis and run in
# CI instead. Produces target/backend-0.0.1-SNAPSHOT.jar.
RUN mvn -B -ntp clean package -Dmaven.test.skip=true

# ── Runtime stage ──────────────────────────────────────────────────────────
FROM eclipse-temurin:21-jre-jammy

WORKDIR /app

COPY --from=build /workspace/target/*.jar /app/app.jar

ENV SPRING_PROFILES_ACTIVE=prod

# Free Render instances have 512 MB. Override by setting JAVA_TOOL_OPTIONS as a
# service environment variable (env vars win over image ENV).
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=65 -XX:+UseSerialGC -Xss512k"

# Documentation only — the actual binding comes from $PORT at runtime.
EXPOSE 8080

# Render injects PORT (default 10000) and routes traffic to it. Spring Boot does
# not read PORT on its own and application.yml hardcodes server.port=8080, so it
# is passed as a command-line argument, which outranks both the yml value and
# SERVER_PORT. Falls back to 8080 for plain `docker run`.
ENTRYPOINT ["sh", "-c", "exec java ${JAVA_OPTS:-} -jar /app/app.jar --server.port=${PORT:-8080}"]
