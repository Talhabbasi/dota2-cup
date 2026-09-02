#!/usr/bin/env bash
# Install Node, dependencies, and a systemd service so the Discord bot
# stays online after reboot. Run on the Oracle Cloud Ubuntu VM:
#
#   bash deploy/oracle/setup.sh
#
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
SERVICE_NAME="dota-cup-bot"
NODE_MAJOR="${NODE_MAJOR:-22}"
APP_USER="${SUDO_USER:-$USER}"

if [[ "$(id -u)" -eq 0 && -n "${SUDO_USER:-}" ]]; then
  APP_USER="$SUDO_USER"
fi

if [[ "$(id -u)" -eq 0 && "$APP_USER" == "root" ]]; then
  echo "Run this as ubuntu/opc (the SSH user), not as root:"
  echo "  bash deploy/oracle/setup.sh"
  exit 1
fi

sudo -v

echo "==> Installing Node.js ${NODE_MAJOR} (if needed)"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | sed 's/v//;s/\..*//')" -lt "$NODE_MAJOR" ]]; then
  sudo apt-get update -y
  sudo apt-get install -y ca-certificates curl gnupg
  sudo mkdir -p /etc/apt/keyrings
  curl -fsSL "https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key" \
    | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" \
    | sudo tee /etc/apt/sources.list.d/nodesource.list >/dev/null
  sudo apt-get update -y
  sudo apt-get install -y nodejs
fi

echo "==> Node $(node -v) / npm $(npm -v)"

if [[ ! -f "$APP_DIR/.env" ]]; then
  cp "$APP_DIR/.env.example" "$APP_DIR/.env"
  echo
  echo "Created $APP_DIR/.env from the example."
  echo "Fill DATABASE_URL and Discord vars, then re-run this script (or restart the service)."
  echo
  echo "  nano $APP_DIR/.env"
  echo
  echo "From your laptop you can also copy a filled file:"
  echo "  scp .env ubuntu@YOUR_VM_IP:~/dota-cup/.env"
  NEED_ENV=1
else
  NEED_ENV=0
fi

mkdir -p "$APP_DIR/public/uploads/matches"

echo "==> Installing npm packages"
cd "$APP_DIR"
npm ci

NPM_BIN="$(command -v npm)"
UNIT_SRC="$APP_DIR/deploy/oracle/dota-cup-bot.service"
UNIT_DST="/etc/systemd/system/${SERVICE_NAME}.service"

echo "==> Installing systemd service (${SERVICE_NAME})"
sed \
  -e "s|__USER__|${APP_USER}|g" \
  -e "s|__APP_DIR__|${APP_DIR}|g" \
  -e "s|__NPM__|${NPM_BIN}|g" \
  "$UNIT_SRC" | sudo tee "$UNIT_DST" >/dev/null

sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME"

token="$(grep -E '^DISCORD_TOKEN=' "$APP_DIR/.env" | cut -d= -f2- | tr -d '"' | tr -d "'" || true)"
if [[ "$NEED_ENV" -eq 1 || -z "$token" ]]; then
  sudo systemctl stop "$SERVICE_NAME" 2>/dev/null || true
  echo
  echo "Service is installed but not started — .env is missing DISCORD_TOKEN."
  echo "Edit .env, then:"
  echo "  sudo systemctl start ${SERVICE_NAME}"
  echo "  sudo systemctl status ${SERVICE_NAME}"
  exit 0
fi

sudo systemctl restart "$SERVICE_NAME"
sleep 2
sudo systemctl --no-pager --full status "$SERVICE_NAME" || true

echo
echo "Bot is set to start on boot."
echo "  Logs:    journalctl -u ${SERVICE_NAME} -f"
echo "  Restart: sudo systemctl restart ${SERVICE_NAME}"
echo "  Update:  bash deploy/oracle/update.sh"
