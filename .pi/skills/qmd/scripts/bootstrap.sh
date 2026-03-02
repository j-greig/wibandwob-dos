#!/usr/bin/env bash
# QMD bootstrap — idempotent cold-start for this project's collections.
# Run: bash scripts/bootstrap.sh
# Safe to re-run. Skips collections that already exist.
set -euo pipefail

command -v qmd >/dev/null 2>&1 || { echo "Installing qmd..."; npm install -g @tobilu/qmd; }

existing=$(qmd collection list 2>/dev/null || true)

if ! echo "$existing" | grep -q "wwdos-planning"; then
  qmd collection add /Users/james/Repos/wibandwob-dos/.planning \
    --name wwdos-planning --mask "**/*.md"
fi

if ! echo "$existing" | grep -q "ww-memories"; then
  qmd collection add /Users/james/Repos/wibandwob-heartbeat/memories \
    --name ww-memories --mask "**/*.md"
fi

qmd update
echo "Done. Run 'qmd embed' for vector search (needs GPU or patience)."
