#!/bin/bash
# planning-close.sh — move epic/spike/idea to .done/
# Usage:
#   scripts/planning-close.sh e042           # moves epic e042-* to .done/
#   scripts/planning-close.sh spk-wibmux     # moves spike spk-wibmux to .done/
#   scripts/planning-close.sh --idea NAME    # moves idea to .done/
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLANNING="$REPO_ROOT/.planning"

if [ $# -eq 0 ]; then
  echo "Usage: scripts/planning-close.sh <id-prefix>"
  echo "  e042              → moves .planning/epics/e042-*/ to .planning/epics/.done/"
  echo "  spk-wibmux        → moves .planning/spikes/spk-wibmux/ to .planning/spikes/.done/"
  echo "  --idea <name>     → moves .planning/ideas/<name> to .planning/ideas/.done/"
  exit 1
fi

# Handle --idea flag
if [ "$1" = "--idea" ]; then
  shift
  SRC=$(find "$PLANNING/ideas" -maxdepth 1 -name "$1*" ! -path "*/.*" | head -1)
  DEST="$PLANNING/ideas/.done"
elif [[ "$1" == spk* ]]; then
  SRC=$(find "$PLANNING/spikes" -maxdepth 1 -name "$1*" ! -path "*/.*" | head -1)
  DEST="$PLANNING/spikes/.done"
elif [[ "$1" == e0* ]]; then
  SRC=$(find "$PLANNING/epics" -maxdepth 1 -name "$1*" ! -path "*/.*" | head -1)
  DEST="$PLANNING/epics/.done"
else
  echo "❌ Can't determine type from '$1' — prefix with e0XX or spk-"
  exit 1
fi

if [ -z "$SRC" ] || [ ! -e "$SRC" ]; then
  echo "❌ Not found: $1"
  echo "Available:"
  ls "$PLANNING/epics/" "$PLANNING/spikes/" "$PLANNING/ideas/" 2>/dev/null | grep -v "^$" | grep "$1" || echo "  (nothing matching)"
  exit 1
fi

mkdir -p "$DEST"
BASENAME=$(basename "$SRC")

if [ -e "$DEST/$BASENAME" ]; then
  echo "⚠️  Already exists: $DEST/$BASENAME"
  exit 1
fi

mv "$SRC" "$DEST/"
echo "✅ $(basename "$SRC") → .done/"
echo "   $DEST/$BASENAME"
