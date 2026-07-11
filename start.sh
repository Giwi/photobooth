#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
URL="http://localhost:3000"

# Start server
cd "$DIR"
npm start &
SERVER_PID=$!

# Wait for server to be ready
for i in $(seq 1 30); do
  curl -s "$URL" >/dev/null 2>&1 && break
  sleep 0.5
done

# Find a Chrome-like browser
launch() {
  for bin in google-chrome chromium-browser chromium google-chrome-stable microsoft-edge brave-browser; do
    if command -v "$bin" >/dev/null 2>&1; then
      "$bin" --kiosk --no-first-run --disable-infobars --disable-session-crashed-bubble --disable-restore-session-state "$URL" &
      BROWSER_PID=$!
      return 0
    fi
  done
  echo "No Chrome-like browser found. Open $URL manually."
  return 1
}

launch

# Cleanup on exit
cleanup() {
  [ -n "$BROWSER_PID" ] && kill "$BROWSER_PID" 2>/dev/null
  kill "$SERVER_PID" 2>/dev/null
  wait 2>/dev/null
}
trap cleanup EXIT INT TERM

# Wait for server to exit
wait "$SERVER_PID"
