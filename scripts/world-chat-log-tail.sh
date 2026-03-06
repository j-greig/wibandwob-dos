#!/usr/bin/env bash
set -euo pipefail

LOG_PATH="${1:-scratch/logs/world-chat.log}"

mkdir -p "$(dirname "$LOG_PATH")"
touch "$LOG_PATH"

tail -f "$LOG_PATH"
