#!/usr/bin/env bash
# QMD bootstrap — idempotent cold-start from a collections config file.
# Run: bash scripts/bootstrap.sh [config]
# Config default: scripts/collections.yml (sibling of this script)
# Safe to re-run. Skips collections that already exist.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG="${1:-$SCRIPT_DIR/collections.yml}"

command -v qmd >/dev/null 2>&1 || { echo "Installing qmd..."; npm install -g @tobilu/qmd; }

if [ ! -f "$CONFIG" ]; then
  echo "No collections config at $CONFIG — nothing to bootstrap."
  echo "Create one with entries like:"
  echo "  - name: my-docs"
  echo "    path: /absolute/path/to/docs"
  echo "    mask: \"**/*.md\""
  exit 0
fi

existing=$(qmd collection list 2>/dev/null || true)

# Parse YAML-lite: lines matching "name:", "path:", "mask:"
name="" path="" mask=""
while IFS= read -r line; do
  case "$line" in
    *"name:"*)  name=$(echo "$line" | sed 's/.*name:[[:space:]]*//' | tr -d '"') ;;
    *"path:"*)  path=$(echo "$line" | sed 's/.*path:[[:space:]]*//' | tr -d '"') ;;
    *"mask:"*)  mask=$(echo "$line" | sed 's/.*mask:[[:space:]]*//' | tr -d '"')
      if [ -n "$name" ] && [ -n "$path" ]; then
        if echo "$existing" | grep -q "$name"; then
          echo "skip: $name (exists)"
        else
          qmd collection add "$path" --name "$name" --mask "${mask:-**/*.md}"
        fi
      fi
      name="" path="" mask=""
      ;;
  esac
done < "$CONFIG"

qmd update
echo "Done. Run 'qmd embed' for vector search (needs GPU or patience)."
