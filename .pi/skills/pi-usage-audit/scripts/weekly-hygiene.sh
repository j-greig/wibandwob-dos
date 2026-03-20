#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
OUT_MD="$ROOT_DIR/scratch/reports/pi-usage-audit.md"
OUT_JSON="$ROOT_DIR/scratch/reports/pi-usage-audit.json"
DAYS="${1:-14}"

bash "$ROOT_DIR/.pi/skills/pi-usage-audit/scripts/export.sh" \
  --days "$DAYS" \
  --out "$OUT_MD" \
  --json-out "$OUT_JSON"

echo
echo "Top stale 10 (cross-surface):"
awk '
  /## Top stale 10 \(cross-surface\)/ {flag=1; next}
  flag && /^## / {exit}
  flag {print}
' "$OUT_MD"

echo
echo "Report: $OUT_MD"
echo "JSON:   $OUT_JSON"

if command -v open >/dev/null 2>&1; then
  open "$OUT_MD" >/dev/null 2>&1 || true
fi
