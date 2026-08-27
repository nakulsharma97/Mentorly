#!/usr/bin/env bash
# ============================================================
#  Production Deploy Script — SkillSwap Platform
#  ============================================================
#  This script is designed to run on the production server.
#  It pulls the latest Docker images, performs a rolling
#  deployment, runs health checks, and rolls back if needed.
#
#  Usage:
#    ./scripts/deploy.sh [--tag TAG] [--no-rollback]
#
#  Environment variables (set in .env or exported):
#    REGISTRY      — Container registry (default: ghcr.io)
#    IMAGE_TAG     — Image tag to deploy (default: latest)
#    COMPOSE_DIR   — Path to docker-compose.yml (default: .)
#    BACKEND_IMAGE — Full image name (default: auto-built from repo)
#    HEALTH_CHECK  — Health check URL protocol (default: http)
# ============================================================

set -euo pipefail

# ── Colors for output ────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

log_info()  { echo -e "${CYAN}[INFO]${NC}  $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()  { echo ""; echo -e "${BOLD}── $1 ──${NC}"; }

# ── Rollback function (defined early for visibility) ─────
perform_rollback() {
  local backup_dir="$1"
  log_warn "============================================"
  log_warn "  Initiating rollback..."
  log_warn "============================================"

  if [ -f "$backup_dir/docker-compose.yml" ]; then
    cp "$backup_dir/docker-compose.yml" "$COMPOSE_FILE"
    log_info "Restored docker-compose.yml from backup"
  fi

  log_info "Restarting previous containers..."
  docker compose -f "$COMPOSE_FILE" down
  docker compose -f "$COMPOSE_FILE" up -d

  log_info "Waiting for rollback health check..."
  sleep 15

  for i in $(seq 1 15); do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_CHECK_URL" 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "401" ]; then
      log_ok "Rollback successful — backend is healthy"
      return 0
    fi
    sleep 5
  done

  log_error "Rollback also failed! Manual intervention required."
  log_error "Connect to the server and check: docker compose logs"
  exit 1
}

# ── Parse arguments ──────────────────────────────────────
ROLLBACK_ENABLED=true
IMAGE_TAG="${IMAGE_TAG:-latest}"
COMPOSE_DIR="${COMPOSE_DIR:-.}"

while [[ $# -gt 0 ]]; do
  case $1 in
    --tag)         IMAGE_TAG="$2";        shift 2 ;;
    --no-rollback) ROLLBACK_ENABLED=false; shift   ;;
    --help)
      echo "Usage: $0 [--tag TAG] [--no-rollback]"
      echo ""
      echo "Environment variables:"
      echo "  REGISTRY      Container registry   (default: ghcr.io)"
      echo "  IMAGE_TAG     Image tag to deploy  (default: latest)"
      echo "  COMPOSE_DIR   Path to compose file (default: .)"
      exit 0 ;;
    *) log_error "Unknown option: $1"; exit 1 ;;
  esac
done

REGISTRY="${REGISTRY:-ghcr.io}"
COMPOSE_FILE="$COMPOSE_DIR/docker-compose.yml"
ENV_FILE="$COMPOSE_DIR/.env"

# ── Validate prerequisites ────────────────────────────────
log_step "Prerequisites"

if [ ! -f "$COMPOSE_FILE" ]; then
  log_error "docker-compose.yml not found at $COMPOSE_FILE"
  exit 1
fi
log_ok "Found compose file: $COMPOSE_FILE"

if [ ! -f "$ENV_FILE" ]; then
  log_warn "No .env file at $ENV_FILE — using system environment variables"
fi

# Check essential commands
for cmd in docker docker compose curl; do
  if ! command -v "$cmd" &>/dev/null; then
    log_error "Required command not found: $cmd"
    exit 1
  fi
done
log_ok "All required commands available"

# ── Step 1: Pull the latest image ────────────────────────
log_step "Pulling Docker images"

BACKEND_IMAGE="${BACKEND_IMAGE:-${REGISTRY}/${GITHUB_REPOSITORY:-nakulsharma97/Mentorly}-backend:${IMAGE_TAG}}"
log_info "Pulling backend: $BACKEND_IMAGE"

# Save the current image digest for rollback
if docker image inspect "$BACKEND_IMAGE" &>/dev/null; then
  PREVIOUS_DIGEST=$(docker image inspect "$BACKEND_IMAGE" --format '{{.RepoDigests}}')
  log_info "Previous image digest: $PREVIOUS_DIGEST"
fi

docker pull "$BACKEND_IMAGE" || {
  log_error "Failed to pull $BACKEND_IMAGE"
  exit 1
}
log_ok "Image pulled successfully"

# ── Step 2: Backup current state ─────────────────────────
log_step "Backing up"

BACKUP_DIR="${COMPOSE_DIR}/backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup the current compose file and env
cp "$COMPOSE_FILE" "$BACKUP_DIR/docker-compose.yml"
[ -f "$ENV_FILE" ] && cp "$ENV_FILE" "$BACKUP_DIR/.env"

# Get current container IDs for rollback reference
docker compose -f "$COMPOSE_FILE" ps -q 2>/dev/null > "$BACKUP_DIR/container-ids.txt" || true

log_ok "Backup saved to $BACKUP_DIR"

# ── Step 3: Deploy new version ───────────────────────────
log_step "Deploying new version"

# Export the image tag so docker-compose can use it
export IMAGE_TAG

# Pull only the backend image (don't auto-upgrade MySQL/nginx)
docker compose -f "$COMPOSE_FILE" pull backend || {
  log_error "Failed to pull service images"
  exit 1
}

# Start the new containers
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans || {
  log_error "Failed to start containers"
  if [ "$ROLLBACK_ENABLED" = true ]; then
    perform_rollback "$BACKUP_DIR"
  fi
  exit 1
}
log_ok "Containers started"

# ── Step 4: Health check ─────────────────────────────────
log_step "Running health checks"

HEALTH_CHECK_URL="${HEALTH_CHECK_URL:-http://localhost:8080/actuator/health}"
MAX_RETRIES=30
RETRY_INTERVAL=5
HEALTHY=false

log_info "Waiting for backend to become healthy..."
log_info "  URL:      $HEALTH_CHECK_URL"
log_info "  Retries:  $MAX_RETRIES x ${RETRY_INTERVAL}s"

for i in $(seq 1 $MAX_RETRIES); do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_CHECK_URL" 2>/dev/null || echo "000")
  
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "401" ]; then
    HEALTHY=true
    log_ok "Backend is healthy! (HTTP $HTTP_CODE)"
    break
  fi
  
  if [ "$i" -eq "$MAX_RETRIES" ]; then
    log_warn "Last attempt — checking response body anyway..."
    BODY=$(curl -s "$HEALTH_CHECK_URL" 2>/dev/null || true)
    log_info "Response: $BODY"
  else
    echo -n "."
    sleep "$RETRY_INTERVAL"
  fi
done

if [ "$HEALTHY" != "true" ]; then
  log_error "Health check failed after $((MAX_RETRIES * RETRY_INTERVAL)) seconds"
  log_error "Last HTTP code: $HTTP_CODE"
  
  # Show recent logs for debugging
  log_step "Recent backend logs"
  docker compose -f "$COMPOSE_FILE" logs --tail=30 backend || true
  
  if [ "$ROLLBACK_ENABLED" = true ]; then
    perform_rollback "$BACKUP_DIR"
  fi
  exit 1
fi

# ── Step 5: Verify critical endpoints ────────────────────
log_step "Verifying critical endpoints"

ENDPOINTS=(
  "$HEALTH_CHECK_URL"
  "$HEALTH_CHECK_URL/liveness"
  "$HEALTH_CHECK_URL/readiness"
)

ALL_OK=true
for endpoint in "${ENDPOINTS[@]}"; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "$endpoint" 2>/dev/null || echo "000")
  if [ "$CODE" = "200" ] || [ "$CODE" = "401" ]; then
    log_ok "  $endpoint → $CODE"
  else
    log_warn "  $endpoint → $CODE (unexpected)"
  fi
done

# ── Step 6: Clean up old images ──────────────────────────
log_step "Cleaning up"

# Remove unused images older than 30 days
docker image prune -a -f --filter "until=720h" 2>/dev/null || true
log_ok "Old images cleaned"

# Keep only the last 10 backups
BACKUP_COUNT=$(ls -d "${COMPOSE_DIR}/backups"/*/ 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt 10 ]; then
  ls -d "${COMPOSE_DIR}/backups"/*/ | head -n -10 | xargs rm -rf
  log_ok "Cleaned old backups (kept 10)"
fi

# ── Done ─────────────────────────────────────────────────
log_step "Deployment complete!"
log_ok "Deployed:     $BACKEND_IMAGE"
log_ok "Tag:          $IMAGE_TAG"
log_ok "Backup:       $BACKUP_DIR"
echo ""
echo -e "  ${BOLD}Next steps:${NC}"
echo "  1. Check Sentry for any new errors"
echo "  2. Run a smoke test against the API"
echo "  3. Verify the frontend loads correctly"
