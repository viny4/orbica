#!/usr/bin/env bash
# Install (or refresh) the every-4-hours data sync cron job. Idempotent:
# re-running replaces the existing ORBICA entry rather than duplicating it.
set -euo pipefail

ROOT="/Users/vinayagam/Documents/rockets and satelights"
SYNC="$ROOT/scripts/sync.sh"
TAG="# orbica-sync"                 # marker so we can find/replace our own line
SCHEDULE="0 */4 * * *"             # at minute 0, every 4th hour

LINE="$SCHEDULE \"$SYNC\" $TAG"

# Keep every existing crontab line except a previous orbica-sync entry.
current="$(crontab -l 2>/dev/null | grep -v "$TAG" || true)"

printf '%s\n%s\n' "$current" "$LINE" | sed '/^$/d' | crontab -

echo "Installed cron job:"
crontab -l | grep "$TAG"
echo
echo "Next runs: 00:00, 04:00, 08:00, 12:00, 16:00, 20:00 (local time)."
echo "Logs:      $ROOT/logs/sync.log"
echo "Run once now: make sync"
