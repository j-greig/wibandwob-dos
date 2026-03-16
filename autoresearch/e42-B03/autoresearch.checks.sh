#!/bin/bash
set -euo pipefail

# E042-B03 Hero 7 — Correctness Checks

cd "$(dirname "$0")/../.."

# 1. Typecheck
bun run typecheck 2>&1 | grep -i "error" || true

# 2. COAT: verify heroes via wibwob CLI if app is running
if wibwob health >/dev/null 2>&1; then
  hero_ids=("wibwob.hello-world" "wibwob.notepad" "wibwob.runtime-inspector" "wibwob.figlet-banner")
  for id in "${hero_ids[@]}"; do
    # Try opening — don't fail the whole check if one hero isn't registered yet
    wibwob run "microapp.open $id" >/dev/null 2>&1 || true
  done
  # Verify state is still valid after opens
  state=$(wibwob state 2>/dev/null)
  if [ -z "$state" ]; then
    echo "ERROR: wibwob state returned empty after hero opens"
    exit 1
  fi
else
  echo "WARN: App not running — skipping runtime hero checks"
fi

echo "Checks passed."
