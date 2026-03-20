#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT_DIR="$ROOT/deploy/figlet-fonts-extra"
FONT_DIR="${FIGLET_FONT_DIR:-$(figlet -I2)}"

if [[ ! -d "$FONT_DIR" ]]; then
  echo "Figlet font dir not found: $FONT_DIR" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
rm -f "$OUT_DIR"/*.flf "$OUT_DIR"/*.tlf

copied=0
for ext in flf tlf; do
  shopt -s nullglob
  files=("$FONT_DIR"/*."$ext")
  shopt -u nullglob
  if [[ ${#files[@]} -gt 0 ]]; then
    cp "${files[@]}" "$OUT_DIR"/
    copied=$((copied + ${#files[@]}))
  fi
done

cat > "$OUT_DIR/README.md" <<EOF
# Figlet font pack (synced)

Source directory:
- $FONT_DIR

Synced by:
- scripts/devops/sync-figlet-font-pack.sh

File count:
- $copied

Purpose:
- Docker smoke/human-view parity with local figlet font availability.
EOF

echo "Synced $copied figlet font files to $OUT_DIR"
