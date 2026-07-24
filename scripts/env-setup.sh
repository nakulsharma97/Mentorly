#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  env-setup.sh — Environment Setup Helper for SkillSwap
# ═══════════════════════════════════════════════════════════════
#  Generates secure secrets and validates your .env configuration.
#
#  Usage:
#    chmod +x scripts/env-setup.sh
#    ./scripts/env-setup.sh              # Interactive: validate + show status
#    ./scripts/env-setup.sh --generate   # Generate .env from template
#    ./scripts/env-setup.sh --check      # Validate existing .env only
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ENV_FILE=".env"
ENV_EXAMPLE=".env.example"

echo -e "${BLUE}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     SkillSwap Environment Setup Tool        ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ── Helper: check if a command exists ────────────────────────
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# ── Helper: generate a secure random value ───────────────────
generate_secret() {
  local length="${1:-32}"
  if command_exists openssl; then
    openssl rand -base64 "$length" | tr -d '\n'
  elif command_exists python3; then
    python3 -c "import secrets; print(secrets.token_urlsafe($length))"
  elif command_exists python; then
    python -c "import secrets; print(secrets.token_urlsafe($length))"
  else
    echo "ERROR: Need openssl or python to generate secrets" >&2
    exit 1
  fi
}

# ── Helper: check if a value looks like a placeholder ────────
is_placeholder() {
  local val="$1"
  [[ "$val" == "replace-me"* ]] || [[ "$val" == "your-key"* ]] || [[ "$val" == "replace-with-"* ]] || [[ "$val" == "12345" ]]
}

# ── Helper: check if a required var is missing or placeholder ─
check_var() {
  local name="$1"
  local category="$2"
  local severity="$3"  # required / recommended / optional

  local val="${!name:-}"
  local icon=""
  local color=""

  if [[ -z "$val" ]]; then
    icon="✗"
    color="$RED"
  elif is_placeholder "$val"; then
    icon="⚠"
    color="$YELLOW"
  else
    icon="✓"
    color="$GREEN"
  fi

  echo -e "  ${color}${icon}${NC} ${name}"

  # Return status for summary
  if [[ "$severity" == "required" ]]; then
    if [[ -z "$val" ]] || is_placeholder "$val"; then
      return 1
    fi
  fi
  return 0
}

# ── Generate .env from template ──────────────────────────────
do_generate() {
  if [[ ! -f "$ENV_EXAMPLE" ]]; then
    echo -e "${RED}✗ Error: $ENV_EXAMPLE not found.${NC}"
    echo "  Run this script from the project root directory."
    exit 1
  fi

  echo -e "${YELLOW}Generating $ENV_FILE from $ENV_EXAMPLE...${NC}"
  echo ""

  # Copy template
  cp "$ENV_EXAMPLE" "$ENV_FILE"

  # Generate secure secrets
  local jwt_secret
  jwt_secret=$(generate_secret 32)
  local db_password
  db_password=$(generate_secret 24)

  # Replace placeholders
  if [[ "$(uname -s)" == "Darwin" ]]; then
    # macOS sed requires an empty backup extension
    sed -i '' "s|JWT_SECRET=replace-with-a-base64-encoded-32-byte-or-longer-secret|JWT_SECRET=${jwt_secret}|" "$ENV_FILE"
    sed -i '' "s|MYSQL_ROOT_PASSWORD=replace-with-strong-password|MYSQL_ROOT_PASSWORD=${db_password}|" "$ENV_FILE"
    sed -i '' "s|MYSQL_PASSWORD=replace-with-strong-password|MYSQL_PASSWORD=${db_password}|" "$ENV_FILE"
  else
    sed -i "s|JWT_SECRET=replace-with-a-base64-encoded-32-byte-or-longer-secret|JWT_SECRET=${jwt_secret}|" "$ENV_FILE"
    sed -i "s|MYSQL_ROOT_PASSWORD=replace-with-strong-password|MYSQL_ROOT_PASSWORD=${db_password}|" "$ENV_FILE"
    sed -i "s|MYSQL_PASSWORD=replace-with-strong-password|MYSQL_PASSWORD=${db_password}|" "$ENV_FILE"
  fi

  echo -e "${GREEN}✓ Generated $ENV_FILE with secure secrets.${NC}"
  echo ""
  echo -e "${YELLOW}⚠  IMPORTANT: You still need to configure:${NC}"
  echo "   - CORS_ALLOWED_ORIGINS"
  echo "   - OAUTH2_REDIRECT_URL"
  echo "   - GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET"
  echo "   - GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET"
  echo "   - STRIPE_SECRET_KEY (if using Stripe)"
  echo "   - APP_ADMIN_EMAIL / APP_ADMIN_PASSWORD"
  echo "   - SENTRY_DSN (if using Sentry)"
  echo ""
  echo "  Edit .env now to fill in the remaining values."
}

# ── Validate existing .env ───────────────────────────────────
do_check() {
  if [[ ! -f "$ENV_FILE" ]]; then
    echo -e "${RED}✗ Error: $ENV_FILE not found.${NC}"
    echo "  Run './scripts/env-setup.sh --generate' to create one."
    exit 1
  fi

  echo "Loading variables from $ENV_FILE..."
  set -a
  source "$ENV_FILE"
  set +a
  echo ""

  local required_ok=true

  echo -e "${BLUE}── 🔴 REQUIRED (app will fail without these) ──${NC}"
  check_var "JWT_SECRET" "required" "required" || required_ok=false
  check_var "MYSQL_ROOT_PASSWORD" "required" "required" || required_ok=false
  check_var "MYSQL_PASSWORD" "required" "required" || required_ok=false
  echo ""

  echo -e "${BLUE}── 🟡 RECOMMENDED (strongly advised for prod) ──${NC}"
  check_var "CORS_ALLOWED_ORIGINS" "recommended" "recommended"
  check_var "OAUTH2_REDIRECT_URL" "recommended" "recommended"
  echo ""

  echo -e "${BLUE}── 🔵 OAUTH2 / SSO ──${NC}"
  check_var "GOOGLE_CLIENT_ID" "oauth" "optional"
  check_var "GOOGLE_CLIENT_SECRET" "oauth" "optional"
  check_var "GITHUB_CLIENT_ID" "oauth" "optional"
  check_var "GITHUB_CLIENT_SECRET" "oauth" "optional"
  echo ""

  echo -e "${BLUE}── 🟢 ADMIN USER ──${NC}"
  check_var "APP_ADMIN_EMAIL" "admin" "optional"
  check_var "APP_ADMIN_PASSWORD" "admin" "optional"
  echo ""

  echo -e "${BLUE}── 🟢 PAYMENT GATEWAYS ──${NC}"
  check_var "STRIPE_SECRET_KEY" "payment" "optional"
  check_var "RAZORPAY_KEY_ID" "payment" "optional"
  check_var "RAZORPAY_KEY_SECRET" "payment" "optional"
  echo ""

  echo -e "${BLUE}── 🟢 MONITORING ──${NC}"
  check_var "SENTRY_DSN" "monitoring" "optional"
  check_var "VITE_SENTRY_DSN" "monitoring" "optional"
  echo ""

  # Summary
  echo "──────────────────────────────────────────"
  if [[ "$required_ok" == "false" ]]; then
    echo -e "${RED}⚠  Some REQUIRED variables are still missing or are placeholders.${NC}"
    echo "   The app will fail to start in production until these are set."
    exit 1
  else
    echo -e "${GREEN}✅ All required variables are set!${NC}"
    echo "   Review the ⚠ warnings above for recommended settings."
  fi
}

# ── Main ─────────────────────────────────────────────────────
case "${1:-}" in
  --generate|-g)
    do_generate
    ;;
  --check|-c)
    do_check
    ;;
  *)
    echo "Usage: $0 [OPTION]"
    echo ""
    echo "Options:"
    echo "  --generate, -g    Generate .env from template with secure secrets"
    echo "  --check, -c       Validate existing .env configuration"
    echo "  (no option)       Run --check (validate)"
    echo ""
    if [[ -f "$ENV_FILE" ]]; then
      do_check
    else
      echo "No .env file found. Run with --generate to create one."
      echo ""
      echo "  ${BLUE}Recommended first step:${NC}"
      echo "    $0 --generate"
    fi
    ;;
esac
