#!/usr/bin/env bash
#
# cleanup-runtime.sh — remove accidental runtime / OS junk from the repo root.
#
# Removes (all already gitignored — this just keeps the working tree tidy):
#   1. Root `node_modules/`             — stray install artifact (real deps live in frontend/node_modules)
#   2. Root `*.log` and `backend_logs*.txt` — runtime log dumps captured at the repo root
#   3. Stray `%AppData%/` / `%LOCALAPPDATA%/` — Windows global-npm path leakage (see .gitignore
#      safeguard comment); only removed if a folder with that literal name exists at the root
#
# Usage:
#   ./scripts/cleanup-runtime.sh             # delete everything listed above
#   ./scripts/cleanup-runtime.sh --dry-run   # show what WOULD be deleted, delete nothing
#
# Safe to re-run at any time: it is a no-op when there is nothing to clean.

set -u

DRY_RUN=0
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1

deleted=0

remove() {
  local target="$1"
  if [ -e "$target" ]; then
    if [ "$DRY_RUN" = 1 ]; then
      echo "[dry-run] would delete: $target"
    else
      rm -rf "$target"
      echo "[deleted] $target"
      deleted=$((deleted + 1))
    fi
  fi
}

echo "== Mentorly repo-root cleanup ($ROOT) =="

# 1. Stray root node_modules (dependencies are installed under frontend/)
if [ -d "$ROOT/node_modules" ]; then
  remove "$ROOT/node_modules"
else
  echo "[ok] no root node_modules — nothing to clean"
fi

# 2. Root-level runtime log dumps (gitignored via *.log / backend_logs*.txt)
found=0
for f in "$ROOT"/*.log "$ROOT"/backend_logs*.txt; do
  if [ -e "$f" ]; then
    remove "$f"
    found=1
  fi
done
[ "$found" = 0 ] && echo "[ok] no root log dumps — nothing to clean"

# 3. Stray Windows env-var path folders (accidental global npm leakage, see .gitignore)
for dir in "%AppData%" "%LOCALAPPDATA%"; do
  if [ -d "$ROOT/$dir" ]; then
    remove "$ROOT/$dir"
  fi
done

if [ "$DRY_RUN" = 1 ]; then
  echo "== dry run complete — nothing was deleted =="
else
  echo "== cleanup complete — $deleted item(s) removed =="
fi
