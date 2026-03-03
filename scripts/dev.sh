#!/usr/bin/env bash
# Dev launcher with hot-reload support.
# Runs the app with --dev flag. When the app exits with code 75 (reload),
# it automatically restarts. Any other exit code stops the loop.

set -e

RELOAD_CODE=75

while true; do
  echo "[dev] Starting WibWob-DOS..."
  set +e
  bun run src/app.ts --dev "$@"
  EXIT_CODE=$?
  set -e

  if [ "$EXIT_CODE" -eq "$RELOAD_CODE" ]; then
    echo "[dev] Reloading..."
    sleep 0.2
  else
    echo "[dev] Exited with code $EXIT_CODE"
    exit "$EXIT_CODE"
  fi
done
