#!/bin/sh
# ============================================================
#  SkillSwap frontend entrypoint
#  ============================================================
#  nginx refuses to start when ssl_certificate files are
#  missing, which deadlocks a FIRST-time deployment: the ACME
#  challenge (port 80) can't be served because nginx won't boot
#  without certs, and certs can't be obtained because nginx
#  never served the challenge.
#
#  Solution: if no certificate exists yet, generate a temporary
#  self-signed one. nginx starts, /.well-known/acme-challenge/
#  is served over HTTP, and scripts/setup-ssl.sh swaps in the
#  real Let's Encrypt certificate afterwards.
# ============================================================

set -e

CERT_DIR="${SSL_CERT_DIR:-/etc/nginx/ssl}"
FULLCHAIN="$CERT_DIR/fullchain.pem"
PRIVKEY="$CERT_DIR/privkey.pem"

if [ ! -f "$FULLCHAIN" ] || [ ! -f "$PRIVKEY" ]; then
  echo "[entrypoint] No TLS certificate found — generating temporary self-signed cert..."
  mkdir -p "$CERT_DIR"
  if ! openssl req -x509 -nodes -newkey rsa:2048 -days 30 \
    -keyout "$PRIVKEY" \
    -out "$FULLCHAIN" \
    -subj "/CN=skillswap.local" >/dev/null 2>&1; then
    echo "[entrypoint] ERROR: could not generate certificate in $CERT_DIR." >&2
    echo "[entrypoint] Is the certs volume writable? Check SSL_CERT_DIR / docker-compose mount." >&2
    exit 1
  fi
  echo "[entrypoint] Temporary self-signed certificate generated at $CERT_DIR"
  echo "[entrypoint] Run scripts/setup-ssl.sh to install a real Let's Encrypt certificate."
fi

echo "[entrypoint] Starting nginx..."
exec nginx -g "daemon off;"
