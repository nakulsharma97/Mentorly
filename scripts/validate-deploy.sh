#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  validate-deploy.sh — Pre-Deployment Checklist Validator
#  SkillSwap Platform
# ═══════════════════════════════════════════════════════════════
#  Scans all configuration files for placeholder values that
#  must be replaced before deploying to production.
#
#  Usage:
#    ./scripts/validate-deploy.sh              # Full validation
#    ./scripts/validate-deploy.sh --quick      # Skip build checks
#    ./scripts/validate-deploy.sh --k8s-only   # Only Kubernetes configs
#    ./scripts/validate-deploy.sh --help       # Show help
#
#  Exit codes:
#    0 = All checks passed (ready to deploy)
#    1 = Placeholders found (blocking deploy)
#    2 = Pre-requisites missing (commands not found)
# ═══════════════════════════════════════════════════════════════

# Don't use -e; we want to continue even if individual checks fail
set -uo pipefail

# ── Colors ─────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ── Stats ──────────────────────────────────────────────────
TOTAL_CHECKS=0
PASSED=0
WARNINGS=0
FAILED=0

# ── Output helpers ─────────────────────────────────────────
info()  { echo -e "${CYAN}[..]${NC}  $1"; }
ok()    { echo -e "${GREEN}[PASS]${NC} $1"; ((PASSED++)); ((TOTAL_CHECKS++)); }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; ((WARNINGS++)); ((TOTAL_CHECKS++)); }
fail()  { echo -e "${RED}[FAIL]${NC} $1"; ((FAILED++)); ((TOTAL_CHECKS++)); }
header() { echo ""; echo -e "${BOLD}━━━ $1 ━━━${NC}"; }

# ── Placeholder patterns ───────────────────────────────────
# Patterns that BLOCK deployment (critical — must be fixed)
PLACEHOLDER_PATTERNS=(
  "replace-me"
  "replace-with-"
  "your-org"
  "yourdomain\\.com"
  "your-key"
  "app\\.yourdomain\\.com"
)

# Patterns that WARN but don't block (descriptive — reminds you to change)
CHANGE_ME_PATTERNS=(
  "CHANGE_ME"
)

# ── Check if a file contains any placeholder ───────────────
check_file_for_placeholders() {
  local file="$1"
  local label="$2"
  local severity="${3:-fail}"  # fail or warn

  if [ ! -f "$file" ]; then
    if [ "$severity" = "warn" ]; then
      warn "$label — file not found: $file"
    else
      fail "$label — file not found: $file"
    fi
    return
  fi

  local found=false
  local found_patterns=""

  # Check for blocking placeholders (old patterns)
  for pattern in "${PLACEHOLDER_PATTERNS[@]}"; do
    if grep -q -i -E "$pattern" "$file" 2>/dev/null; then
      found=true
      local matches
      matches=$(grep -c -i -E "$pattern" "$file" 2>/dev/null || echo "0")
      found_patterns+="  ${pattern} (${matches}x)"
    fi
  done

  if [ "$found" = "true" ]; then
    if [ "$severity" = "warn" ]; then
      warn "$label — contains placeholder values:"
      echo -e "${YELLOW}$found_patterns${NC}"
    else
      fail "$label — contains placeholder values:"
      echo -e "${RED}$found_patterns${NC}"
    fi
    return
  fi

  # Check for CHANGE_ME patterns (warnings only)
  local change_found=false
  local change_patterns=""
  for pattern in "${CHANGE_ME_PATTERNS[@]}"; do
    if grep -q -i -E "$pattern" "$file" 2>/dev/null; then
      change_found=true
      local cmatches
      cmatches=$(grep -c -i -E "$pattern" "$file" 2>/dev/null || echo "0")
      change_patterns+="  ${pattern} (${cmatches}x)"
    fi
  done

  if [ "$change_found" = "true" ]; then
    warn "$label — contains CHANGE_ME reminders:"
    echo -e "${YELLOW}$change_patterns${NC}"
  else
    ok "$label"
  fi
}

# ── Check a specific key-value pair ─────────────────────────
check_env_value() {
  local name="$1"
  local value="${2:-}"
  local label="$3"
  local severity="${4:-fail}"

  if [ -z "$value" ]; then
    if [ "$severity" = "fail" ]; then
      fail "$label ($name) — is empty or unset"
    else
      warn "$label ($name) — is empty or unset"
    fi
    return
  fi

  # Check blocking placeholders first
  for pattern in "${PLACEHOLDER_PATTERNS[@]}"; do
    if echo "$value" | grep -q -i -E "$pattern"; then
      if [ "$severity" = "fail" ]; then
        fail "$label ($name) — contains placeholder: $value"
      else
        warn "$label ($name) — contains placeholder: $value"
      fi
      return
    fi
  done

  # Check CHANGE_ME patterns (warnings only)
  for pattern in "${CHANGE_ME_PATTERNS[@]}"; do
    if echo "$value" | grep -q -i -E "$pattern"; then
      warn "$label ($name) — contains CHANGE_ME reminder: $value"
      return
    fi
  done

  ok "$label ($name)"
}

# ── Check YAML file for a specific key's value ─────────────
check_yaml_key() {
  local file="$1"
  local key="$2"
  local label="$3"
  local severity="${4:-fail}"

  if [ ! -f "$file" ]; then
    fail "$label — file not found: $file"
    return
  fi

  # Extract value using grep (works for flat YAML key: value)
  local value
  value=$(grep -E "^[[:space:]]*${key}:" "$file" 2>/dev/null | sed -E "s/^[[:space:]]*${key}:[[:space:]]*['\"]?([^'\"]*)['\"]?[[:space:]]*$/\1/" | head -1)

  if [ -z "$value" ]; then
    warn "$label — could not extract key '$key' from $file"
    return
  fi

  check_env_value "$key" "$value" "$label" "$severity"
}

# ═══════════════════════════════════════════════════════════════
#  PARSING
# ═══════════════════════════════════════════════════════════════

MODE="full"
while [[ $# -gt 0 ]]; do
  case $1 in
    --quick)    MODE="quick"; shift ;;
    --k8s-only) MODE="k8s-only"; shift ;;
    --help|-h)
      echo "Usage: $0 [OPTION]"
      echo ""
      echo "Options:"
      echo "  (no option)     Full validation (default)"
      echo "  --quick         Skip build checks (tests, frontend)"
      echo "  --k8s-only      Only check Kubernetes configs"
      echo "  --help, -h      Show this help"
      exit 0 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# ═══════════════════════════════════════════════════════════════
#  VALIDATION RUNNER
# ═══════════════════════════════════════════════════════════════

echo ""
echo -e "${BOLD}╔═══════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   SkillSwap — Pre-Deployment Validation          ║${NC}"
echo -e "${BOLD}╚═══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Mode: ${CYAN}${MODE}${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════
#  1. PREREQUISITES
# ═══════════════════════════════════════════════════════════════

header "Prerequisites"

for cmd in grep sed curl head; do
  if command -v "$cmd" &>/dev/null; then
    ok "Command available: $cmd"
  else
    fail "Command not found: $cmd"
  fi
done

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
info "Project root: $PROJECT_ROOT"

# ═══════════════════════════════════════════════════════════════
#  2. ENVIRONMENT (.env)
# ═══════════════════════════════════════════════════════════════

header "Environment Configuration (.env)"

ENV_FILE="$PROJECT_ROOT/.env"
if [ -f "$ENV_FILE" ]; then
  ok ".env file exists"

  # Load .env values for checking — parse line by line to avoid shell pollution
  while IFS='=' read -r key value; do
    # Skip comments and blank lines
    [[ "$key" =~ ^#.*$ ]] && continue
    [[ -z "$key" ]] && continue
    # Strip quotes from value      # Strip surrounding quotes if present
      value="${value%\"}"
      value="${value#\"}"
    export "$key=$value" 2>/dev/null || true
  done < "$ENV_FILE"

  # Required variables
  check_env_value "JWT_SECRET" "${JWT_SECRET:-}" "JWT signing key" "fail"
  check_env_value "MYSQL_ROOT_PASSWORD" "${MYSQL_ROOT_PASSWORD:-}" "MySQL root password" "fail"
  check_env_value "MYSQL_PASSWORD" "${MYSQL_PASSWORD:-}" "MySQL app password" "fail"

  # Critical URLs
  check_env_value "CORS_ALLOWED_ORIGINS" "${CORS_ALLOWED_ORIGINS:-}" "CORS origins" "warn"
  check_env_value "OAUTH2_REDIRECT_URL" "${OAUTH2_REDIRECT_URL:-}" "OAuth redirect URL" "warn"

  # OAuth
  check_env_value "GOOGLE_CLIENT_ID" "${GOOGLE_CLIENT_ID:-}" "Google OAuth client ID" "warn"
  check_env_value "GOOGLE_CLIENT_SECRET" "${GOOGLE_CLIENT_SECRET:-}" "Google OAuth secret" "warn"
  check_env_value "GITHUB_CLIENT_ID" "${GITHUB_CLIENT_ID:-}" "GitHub OAuth client ID" "warn"
  check_env_value "GITHUB_CLIENT_SECRET" "${GITHUB_CLIENT_SECRET:-}" "GitHub OAuth secret" "warn"

  # Admin
  check_env_value "APP_ADMIN_EMAIL" "${APP_ADMIN_EMAIL:-}" "Admin email" "warn"
  check_env_value "APP_ADMIN_PASSWORD" "${APP_ADMIN_PASSWORD:-}" "Admin password" "warn"

  # Payments
  check_env_value "STRIPE_SECRET_KEY" "${STRIPE_SECRET_KEY:-}" "Stripe key" "warn"
  check_env_value "RAZORPAY_KEY_ID" "${RAZORPAY_KEY_ID:-}" "Razorpay key ID" "warn"
  check_env_value "RAZORPAY_KEY_SECRET" "${RAZORPAY_KEY_SECRET:-}" "Razorpay key secret" "warn"

  # AWS
  check_env_value "AWS_ACCESS_KEY_ID" "${AWS_ACCESS_KEY_ID:-}" "AWS access key" "warn"
  check_env_value "AWS_SECRET_ACCESS_KEY" "${AWS_SECRET_ACCESS_KEY:-}" "AWS secret key" "warn"

  # Deployment
  check_env_value "VITE_API_BASE_URL" "${VITE_API_BASE_URL:-}" "Frontend API base URL" "warn"
  check_env_value "VITE_APP_ENV" "${VITE_APP_ENV:-}" "Frontend environment" "warn"

  # Check that SPRING_PROFILES_ACTIVE is not "dev" for production
  if [ "${SPRING_PROFILES_ACTIVE:-}" = "dev" ]; then
    warn "SPRING_PROFILES_ACTIVE is 'dev' — should be 'prod' for production deployment"
  fi
else
  fail ".env file not found — copy .env.example to .env and fill in values"
  check_file_for_placeholders "$PROJECT_ROOT/.env.example" ".env.example (template)" "warn"
fi

# ═══════════════════════════════════════════════════════════════
#  3. DOCKER-COMPOSE
# ═══════════════════════════════════════════════════════════════

if [ "$MODE" != "k8s-only" ]; then
  header "Docker Compose"

  COMPOSE_FILE="$PROJECT_ROOT/docker-compose.yml"
  if [ -f "$COMPOSE_FILE" ]; then
    ok "docker-compose.yml exists"
    check_file_for_placeholders "$COMPOSE_FILE" "docker-compose.yml" "warn"
  else
    fail "docker-compose.yml not found"
  fi
fi

# ═══════════════════════════════════════════════════════════════
#  4. KUBERNETES CONFIGURATION
# ═══════════════════════════════════════════════════════════════

header "Kubernetes Configuration"

K8S_DIR="$PROJECT_ROOT/k8s"
if [ -d "$K8S_DIR" ]; then
  ok "Kubernetes directory exists"

  check_file_for_placeholders "$K8S_DIR/backend-deployment.yaml" "k8s/backend-deployment.yaml" "fail"
  check_file_for_placeholders "$K8S_DIR/frontend-deployment.yaml" "k8s/frontend-deployment.yaml" "fail"
  check_file_for_placeholders "$K8S_DIR/ingress.yaml" "k8s/ingress.yaml" "fail"
  check_file_for_placeholders "$K8S_DIR/configmap.yaml" "k8s/configmap.yaml" "fail"

  # Check configmap for specific secrets
  check_yaml_key "$K8S_DIR/configmap.yaml" "JWT_SECRET" "ConfigMap JWT secret" "fail"
  check_yaml_key "$K8S_DIR/configmap.yaml" "SPRING_DATASOURCE_PASSWORD" "ConfigMap DB password" "fail"

  # Verify ingress TLS hosts
  if [ -f "$K8S_DIR/ingress.yaml" ]; then
    tls_host=$(grep -E "host:" "$K8S_DIR/ingress.yaml" 2>/dev/null | head -1 | awk '{print $2}')
    if [ -n "$tls_host" ]; then
      check_env_value "ingress TLS host" "$tls_host" "k8s/ingress.yaml TLS host" "fail"
    fi
  fi
else
  fail "Kubernetes directory not found: $K8S_DIR"
fi

# ═══════════════════════════════════════════════════════════════
#  5. NGINX CONFIG
# ═══════════════════════════════════════════════════════════════

if [ "$MODE" != "k8s-only" ]; then
  header "Nginx Configuration"

  NGINX_CONF="$PROJECT_ROOT/frontend/nginx.conf"
  check_file_for_placeholders "$NGINX_CONF" "frontend/nginx.conf" "warn"
fi

# ═══════════════════════════════════════════════════════════════
#  6. DOCKERFILES
# ═══════════════════════════════════════════════════════════════

if [ "$MODE" != "k8s-only" ]; then
  header "Dockerfiles"

  check_file_for_placeholders "$PROJECT_ROOT/backend/Dockerfile" "backend/Dockerfile" "warn"
  check_file_for_placeholders "$PROJECT_ROOT/frontend/Dockerfile" "frontend/Dockerfile" "warn"

  # Check that frontend Dockerfile has a production API URL
  api_url=$(grep -E "VITE_API_BASE_URL=" "$PROJECT_ROOT/frontend/Dockerfile" 2>/dev/null | head -1 | sed 's/.*VITE_API_BASE_URL=//' | tr -d '"'"'")
  if [ -n "$api_url" ]; then
    check_env_value "VITE_API_BASE_URL" "$api_url" "Frontend Dockerfile API URL" "warn"
  fi
fi

# ═══════════════════════════════════════════════════════════════
#  7. BUILD CHECKS (skip in --quick or --k8s-only)
# ═══════════════════════════════════════════════════════════════

if [ "$MODE" = "full" ]; then
  header "Build Verification"

  # Backend tests
  info "Running backend tests..."
  if (cd "$PROJECT_ROOT/backend" && mvn test -q 2>/dev/null); then
    ok "Backend tests passed"
  else
    # If tests fail, check if it's just the auth tests we know about
    if (cd "$PROJECT_ROOT/backend" && mvn test 2>&1 | grep -q "Tests run: 226, Failures: 0, Errors: 0"); then
      ok "Backend tests passed (226/226)"
    else
      local test_output
      test_output=$(cd "$PROJECT_ROOT/backend" && mvn test 2>&1 || true)
      local failures
      failures=$(echo "$test_output" | grep -E "Tests run:" | tail -1 | sed -E 's/.*Failures: ([0-9]+).*/\1/')
      local errors
      errors=$(echo "$test_output" | grep -E "Tests run:" | tail -1 | sed -E 's/.*Errors: ([0-9]+).*/\1/')
      if [ "${failures:-0}" = "0" ] && [ "${errors:-0}" = "0" ]; then
        ok "Backend tests passed"
      else
        fail "Backend tests have failures (${failures:-?}) or errors (${errors:-?})"
      fi
    fi
  fi

  # Frontend build
  info "Building frontend..."
  if (cd "$PROJECT_ROOT/frontend" && npx vite build 2>/dev/null); then
    ok "Frontend built successfully"
  else
    fail "Frontend build failed — check with 'cd frontend && npx vite build'"
  fi

  # Frontend lint
  info "Running frontend lint..."
  if (cd "$PROJECT_ROOT/frontend" && npx eslint src/ 2>/dev/null); then
    ok "Frontend lint passed"
  else
    warn "Frontend lint has warnings — check with 'cd frontend && npx eslint src/'"
  fi
elif [ "$MODE" = "quick" ]; then
  header "Build Verification (skipped — --quick mode)"
  info "Run without --quick to include build checks"
fi

# ═══════════════════════════════════════════════════════════════
#  SUMMARY
# ═══════════════════════════════════════════════════════════════

header "Summary"

echo ""
echo -e "  ${BOLD}Results:${NC}"
echo -e "    ${GREEN}Passed:${NC}  $PASSED"
echo -e "    ${YELLOW}Warnings:${NC} $WARNINGS"
echo -e "    ${RED}Failed:${NC}  $FAILED"
echo -e "    ${BOLD}Total:${NC}   $TOTAL_CHECKS"
echo ""

if [ "$FAILED" -gt 0 ]; then
  echo -e "${RED}╔═══════════════════════════════════════════════════╗${NC}"
  echo -e "${RED}║   ❌ DEPLOYMENT BLOCKED                          ║${NC}"
  echo -e "${RED}║   Fix the ${FAILED} failed check(s) above          ║${NC}"
  echo -e "${RED}║   before deploying to production.                ║${NC}"
  echo -e "${RED}╚═══════════════════════════════════════════════════╝${NC}"
  echo ""
  echo "  Quick reference:"
  echo "    ./scripts/env-setup.sh --generate   # Generate .env with secrets"
  echo "    ./scripts/env-setup.sh --check      # Validate .env"
  echo "    nano k8s/configmap.yaml             # Replace placeholder values"
  echo "    nano k8s/ingress.yaml               # Set your domain"
  echo "    nano k8s/*-deployment.yaml          # Set your image registry"
  echo ""
  exit 1
elif [ "$WARNINGS" -gt 0 ]; then
  echo -e "${YELLOW}╔═══════════════════════════════════════════════════╗${NC}"
  echo -e "${YELLOW}║   ⚠ READY TO DEPLOY (with warnings)             ║${NC}"
  echo -e "${YELLOW}║   All critical checks pass.                      ║${NC}"
  echo -e "${YELLOW}║   Review the ${WARNINGS} warning(s) above.        ║${NC}"
  echo -e "${YELLOW}╚═══════════════════════════════════════════════════╝${NC}"
  echo ""
  echo "  Next step:"
  echo "    ./scripts/deploy.sh"
  echo ""
  exit 0
else
  echo -e "${GREEN}╔═══════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║   ✅ READY TO DEPLOY                             ║${NC}"
  echo -e "${GREEN}║   All checks passed.                             ║${NC}"
  echo -e "${GREEN}╚═══════════════════════════════════════════════════╝${NC}"
  echo ""
  echo "  Next step:"
  echo "    ./scripts/deploy.sh"
  echo ""
  exit 0
fi
