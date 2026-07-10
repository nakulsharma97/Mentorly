#!/usr/bin/env bash
# ============================================================
#  SSL Setup Script — SkillSwap Platform
#  ============================================================
#  This script obtains Let's Encrypt SSL certificates for
#  your production domain and copies them into the certs/
#  directory where the nginx container can mount them.
#
#  Prerequisites:
#    1. Your domain's DNS points to this server's public IP
#    2. Port 80 and 443 are publicly accessible
#    3. Docker and Docker Compose are installed
#    4. You have set DOMAIN=<your-domain.com> in .env or exported it
#    5. The docker compose stack is running (frontend container up)
#
#  Usage:
#    chmod +x scripts/setup-ssl.sh
#    ./scripts/setup-ssl.sh yourdomain.com
# ============================================================

set -euo pipefail

DOMAIN="${1:-${DOMAIN:-}}"
if [ -z "$DOMAIN" ]; then
  echo "Usage: $0 <yourdomain.com>"
  echo "   or: export DOMAIN=yourdomain.com && $0"
  exit 1
fi

echo "=========================================="
echo "  Setting up SSL for: $DOMAIN"
echo "=========================================="

# ── 1. Create certs directory ────────────────────────────
mkdir -p certs

# ── 2. Start nginx temporarily to serve the challenge ────
echo ""
echo "[1/5] Starting nginx for ACME challenge..."
docker compose up -d frontend
echo "  ✓ Frontend is running on port 80/443"

# ── 3. Obtain certificates via Let's Encrypt ────────────
echo ""
echo "[2/5] Requesting Let's Encrypt certificate for $DOMAIN..."
echo "  (This may take a moment...)"
docker compose --profile ssl run --rm \
  certbot certonly --webroot \
  -w /var/www/certbot \
  -d "$DOMAIN" \
  --non-interactive \
  --agree-tos \
  --email "admin@${DOMAIN}" \
  --force-renewal || true

# ── 4. Copy certificates to certs/ directory ────────────
echo ""
echo "[3/5] Copying certificates to ./certs/..."
# Note: certbot image ENTRYPOINT is ["certbot"], so we override
# with --entrypoint sh to run bare cp commands.
docker compose --profile ssl run --rm \
  --entrypoint sh \
  certbot -c "
    cp -L /etc/letsencrypt/live/$DOMAIN/fullchain.pem /certs/ &&
    cp -L /etc/letsencrypt/live/$DOMAIN/privkey.pem /certs/
  "

if [ -f "certs/fullchain.pem" ] && [ -f "certs/privkey.pem" ]; then
  echo "  ✓ Certificates saved to ./certs/"
  ls -la certs/
else
  echo "  ✗ Failed to copy certificates."
  echo "    Check /etc/letsencrypt/live/$DOMAIN/ inside the certbot container:"
  echo "    docker compose --profile ssl run --rm certbot certificates"
fi

# ── 5. Restart frontend to load new certificates ─────────
echo ""
echo "[4/5] Reloading nginx to pick up new certificates..."
docker compose exec frontend nginx -s reload || true
echo "  ✓ Nginx reloaded"

# ── 6. Set up auto-renewal cron job ──────────────────────
echo ""
echo "[5/5] Setting up auto-renewal..."
RENEW_SCRIPT="cd $(pwd) && docker compose --profile ssl run --rm certbot renew && docker compose exec frontend nginx -s reload"
(crontab -l 2>/dev/null; echo "0 3 * * * $RENEW_SCRIPT") | crontab -
echo "  ✓ Cron job added: daily renewal check at 3:00 AM"

echo ""
echo "=========================================="
echo "  SSL setup complete for $DOMAIN"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Verify HTTPS:       curl -I https://$DOMAIN"
echo "  2. Check expiry:       openssl x509 -in certs/fullchain.pem -noout -dates"
echo ""
echo "To manually renew later:"
echo "  docker compose --profile ssl run --rm certbot renew"
echo "  docker compose exec frontend nginx -s reload"
