#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  db-backup.sh - Automated MySQL Backup Script for SkillSwap
# ═══════════════════════════════════════════════════════════════
#  Creates timestamped database dumps with automatic retention.
#
#  Usage:
#    ./scripts/db-backup.sh                    # Backup + keep 7 days
#    ./scripts/db-backup.sh --retention 30     # Keep 30 days of backups
#    ./scripts/db-backup.sh --backup-dir /custom/path
#
#  Cron (daily at 2 AM):
#    0 2 * * * /path/to/scripts/db-backup.sh
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ── Defaults ──────────────────────────────────────────────────
BACKUP_DIR="./backups/mysql"
RETENTION_DAYS=7
DB_HOST="${MYSQL_HOST:-localhost}"
DB_PORT="${MYSQL_PORT:-3306}"
DB_USER="${MYSQL_USER:-root}"
DB_PASSWORD="${MYSQL_PASSWORD:-}"
DB_NAME="${MYSQL_DATABASE:-skill_swap}"

# ── Parse arguments ───────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --retention)
      RETENTION_DAYS="$2"; shift 2 ;;
    --backup-dir)
      BACKUP_DIR="$2"; shift 2 ;;
    --help|-h)
      echo "Usage: $0 [--retention DAYS] [--backup-dir PATH]"
      exit 0 ;;
    *)
      echo "Unknown option: $1"
      exit 1 ;;
  esac
done

# ── Validate requirements ─────────────────────────────────────
if ! command -v mysqldump &>/dev/null; then
  echo -e "${RED}Error: mysqldump is not installed.${NC}"
  echo "  Install: apt-get install mysql-client or brew install mysql-client"
  exit 1
fi

if [[ -z "$DB_PASSWORD" ]]; then
  echo -e "${YELLOW}Warning: MYSQL_PASSWORD is not set.${NC}"
  echo "  If the database requires a password, the backup will fail."
fi

# ── Create backup directory ───────────────────────────────────
mkdir -p "$BACKUP_DIR"

# ── Create backup filename with timestamp ─────────────────────
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="${DB_NAME}_${TIMESTAMP}.sql.gz"
BACKUP_PATH="${BACKUP_DIR}/${FILENAME}"

# ── Run mysqldump ─────────────────────────────────────────────
echo -e "${GREEN}Backing up database: ${DB_NAME}@${DB_HOST}:${DB_PORT}${NC}"
echo "  Backup file: ${BACKUP_PATH}"
echo ""

MYSQLDUMP_OPTS="--single-transaction --routines --triggers --events --quick"

if mysqldump -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" ${DB_PASSWORD:+-p"$DB_PASSWORD"} \
  $MYSQLDUMP_OPTS "$DB_NAME" | gzip > "$BACKUP_PATH"; then
  BACKUP_SIZE=$(du -h "$BACKUP_PATH" | cut -f1)
  echo -e "${GREEN}Backup completed successfully!${NC}"
  echo "  Size: ${BACKUP_SIZE}"
else
  echo -e "${RED}Backup failed!${NC}"
  rm -f "$BACKUP_PATH"
  exit 1
fi

# ── Cleanup old backups ───────────────────────────────────────
echo ""
echo "Cleaning up backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete
REMAINING=$(find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -type f | wc -l)
echo -e "${GREEN}${REMAINING} backups remaining.${NC}"

echo ""
echo "──────────────────────────────────────────"
echo -e "${GREEN}Backup saved: ${BACKUP_PATH}${NC}"

# ── Optional: Copy to remote storage ─────────────────────────
# Uncomment and configure to upload to S3-compatible storage:
# if command -v aws &>/dev/null && [[ -n "${AWS_BACKUP_BUCKET:-}" ]]; then
#   aws s3 cp "$BACKUP_PATH" "s3://${AWS_BACKUP_BUCKET}/mysql/"
#   echo "  Uploaded to S3: s3://${AWS_BACKUP_BUCKET}/mysql/${FILENAME}"
# fi
