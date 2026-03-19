#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
SCRIPT_PATH="$ROOT_DIR/.pi/skills/pi-usage-audit/scripts/export-usage-audit.py"

HAS_CWD=0
for arg in "$@"; do
  if [[ "$arg" == "--cwd" ]]; then
    HAS_CWD=1
    break
  fi
done

if [[ $HAS_CWD -eq 1 ]]; then
  python3 "$SCRIPT_PATH" "$@"
else
  python3 "$SCRIPT_PATH" --cwd "$ROOT_DIR" "$@"
fi
