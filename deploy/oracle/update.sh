#!/usr/bin/env bash
# Pull latest code and restart the bot. Run on the Oracle VM:
#
#   bash deploy/oracle/update.sh
#
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
SERVICE_NAME="dota-cup-bot"

cd "$APP_DIR"
git pull --ff-only
npm ci
mkdir -p public/uploads/matches
sudo systemctl restart "$SERVICE_NAME"
sudo systemctl --no-pager --full status "$SERVICE_NAME"
