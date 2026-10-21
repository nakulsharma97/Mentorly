# ═══════════════════════════════════════════════════════════════════════════
#  Mentorly — SINGLE-SERVICE image for Render (frontend + backend together)
#
#  One container runs:
#    * nginx  on $PORT       → serves the React build, proxies /api, /oauth2,
#                              /login/oauth2, /ws and /actuator/health
#    * Spring Boot on 8081   → internal only (127.0.0.1)
#
#  Render settings: Runtime Docker · Dockerfile Path ./Dockerfile · Context .
# ═══════════════════════════════════════════════════════════════════════════

# ── 1) Frontend build ──────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS frontend-build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
# vite & plugins are devDependencies → they MUST be installed for the build.
RUN npm ci --include=dev --no-audit --no-fund

COPY frontend/ ./

# Render passes service env vars as build args. VITE_API_BASE_URL stays EMPTY:
# the SPA calls same-origin /api/v1/* and nginx proxies it to Spring Boot.
ARG VITE_API_BASE_URL=""
ARG VITE_APP_ENV=production
ARG VITE_RAZORPAY_KEY_ID=""
ARG VITE_STRIPE_PUBLISHABLE_KEY=""
ARG VITE_SENTRY_DSN=""
ARG VITE_ENABLE_MONITORING=""
ARG VITE_MONITORING_ENDPOINT=""
ENV VITE_API_BASE_URL="$VITE_API_BASE_URL" \
    VITE_APP_ENV="$VITE_APP_ENV" \
    VITE_RAZORPAY_KEY_ID="$VITE_RAZORPAY_KEY_ID" \
    VITE_STRIPE_PUBLISHABLE_KEY="$VITE_STRIPE_PUBLISHABLE_KEY" \
    VITE_SENTRY_DSN="$VITE_SENTRY_DSN" \
    VITE_ENABLE_MONITORING="$VITE_ENABLE_MONITORING" \
    VITE_MONITORING_ENDPOINT="$VITE_MONITORING_ENDPOINT"

RUN npm run build

# ── 2) Backend build ───────────────────────────────────────────────────────
FROM maven:3.9-eclipse-temurin-21-jammy AS backend-build
WORKDIR /workspace
COPY backend/pom.xml ./
COPY backend/src ./src
RUN mvn -B -ntp clean package -Dmaven.test.skip=true

# ── 3) Runtime: JRE + nginx ────────────────────────────────────────────────
FROM eclipse-temurin:21-jre-jammy

RUN apt-get update \
 && apt-get install -y --no-install-recommends nginx gettext-base bash \
 && rm -rf /var/lib/apt/lists/* \
 && sed -i 's/^worker_processes .*/worker_processes 1;/' /etc/nginx/nginx.conf \
 && rm -f /etc/nginx/sites-enabled/default /etc/nginx/conf.d/default.conf \
 && ln -sf /dev/stdout /var/log/nginx/access.log \
 && ln -sf /dev/stderr /var/log/nginx/error.log

WORKDIR /app
COPY --from=backend-build /workspace/target/*.jar /app/app.jar
COPY --from=frontend-build /app/dist /usr/share/nginx/html

# Reuse the existing nginx config; also expose /actuator/health so Render's
# health check reaches Spring Boot instead of the SPA fallback.
COPY frontend/nginx.render.conf.template /etc/nginx/mentorly.conf.template
RUN sed -i 's|^  location /api/ {|  location = /actuator/health {\n    proxy_pass ${BACKEND_URL};\n    proxy_http_version 1.1;\n  }\n\n  location /api/ {|' /etc/nginx/mentorly.conf.template

# start.sh runs nginx + Spring Boot; strip Windows CRLF line endings if present.
COPY start.sh /app/start.sh
RUN sed -i 's/\r$//' /app/start.sh && chmod +x /app/start.sh

ENV SPRING_PROFILES_ACTIVE=prod

# ── Memory budget for a 512 MB instance (nginx + JVM share it) ─────────────
# MaxRAMPercentage only caps the HEAP. Metaspace, code cache, thread stacks and
# direct buffers are extra, so every region is capped explicitly. Render env
# vars with the same name override these defaults.
ENV JAVA_TOOL_OPTIONS="-Xms64m -Xmx190m -XX:MaxMetaspaceSize=120m -XX:ReservedCodeCacheSize=40m -XX:MaxDirectMemorySize=24m -XX:+UseSerialGC -XX:TieredStopAtLevel=1 -XX:CICompilerCount=1 -Xss256k -XX:+ExitOnOutOfMemoryError"
ENV SERVER_TOMCAT_THREADS_MAX=20 \
    SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE=5 \
    SPRING_DATASOURCE_HIKARI_MINIMUM_IDLE=1

EXPOSE 8080
CMD ["/app/start.sh"]