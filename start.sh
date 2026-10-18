#!/bin/bash
# Runs nginx (public, $PORT) + Spring Boot (internal, 8081) in one container.
set -u
export PORT="${PORT:-8080}"
export BACKEND_URL="http://127.0.0.1:8081"

envsubst '${PORT} ${BACKEND_URL}' < /etc/nginx/mentorly.conf.template > /etc/nginx/conf.d/default.conf
nginx -t || exit 1

java ${JAVA_OPTS:-} -jar /app/app.jar --server.port=8081 &
JAVA_PID=$!

nginx -g 'daemon off;' &
NGINX_PID=$!

trap 'kill $JAVA_PID $NGINX_PID 2>/dev/null' TERM INT

# If either process dies, stop the container so Render restarts it.
wait -n $JAVA_PID $NGINX_PID
CODE=$?
kill $JAVA_PID $NGINX_PID 2>/dev/null
exit $CODE