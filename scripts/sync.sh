#!/usr/bin/env bash
# Refresh all live data (launches, TLEs, satellites, news) in one shot.
# Designed for cron — runs every 4h. Loads .env, uses the pipeline venv, and
# appends a timestamped block to logs/sync.log. Self-contained: no server needed.
set -uo pipefail

ROOT="/Users/vinayagam/Documents/rockets and satelights"
PIPELINE="$ROOT/services/pipeline"
PY="$PIPELINE/.venv/bin/python"
LOG_DIR="$ROOT/logs"
mkdir -p "$LOG_DIR"

# Load environment (POSTGRES_URL, LL2/CelesTrak settings, etc.).
set -a
[ -f "$ROOT/.env" ] && . "$ROOT/.env"
set +a

cd "$PIPELINE"
{
  echo "===== sync start $(date '+%Y-%m-%d %H:%M:%S %z') ====="
  PYTHONPATH="$PIPELINE" "$PY" -m src.sync.refresh
  rc=$?
  echo "===== sync end   $(date '+%Y-%m-%d %H:%M:%S %z') rc=$rc ====="
  echo
} >>"$LOG_DIR/sync.log" 2>&1
exit "${rc:-0}"
