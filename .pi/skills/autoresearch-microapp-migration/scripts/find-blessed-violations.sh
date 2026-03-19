#!/usr/bin/env bash
set -euo pipefail

# Find microapp TypeScript files that use raw blessed directly.
# Usage:
#   bash .pi/skills/autoresearch-microapp-migration/scripts/find-blessed-violations.sh
#   bash .pi/skills/autoresearch-microapp-migration/scripts/find-blessed-violations.sh --lines
#   bash .pi/skills/autoresearch-microapp-migration/scripts/find-blessed-violations.sh --path microapps/.disabled

ROOT="microapps"
SHOW_LINES=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --path)
      ROOT="${2:-microapps}"
      shift 2
      ;;
    --lines)
      SHOW_LINES=1
      shift
      ;;
    *)
      echo "unknown arg: $1" >&2
      exit 2
      ;;
  esac
done

if [[ ! -d "$ROOT" ]]; then
  echo "missing path: $ROOT" >&2
  exit 2
fi

# "Wrong" patterns = direct blessed usage in microapps TS files.
# (SDK-first policy: raw blessed only for edge interop.)
PATTERN='import[[:space:]]+blessed[[:space:]]+from[[:space:]]+["\x27]blessed["\x27]|from[[:space:]]+["\x27]blessed["\x27]|require\(["\x27]blessed["\x27]\)|\bblessed\.(box|list|screen|textarea|form|button|table|text)\('

if [[ "$SHOW_LINES" -eq 1 ]]; then
  grep -RInE --include='*.ts' --include='*.tsx' "$PATTERN" "$ROOT" || true
  exit 0
fi

# file-only report
grep -RIlE --include='*.ts' --include='*.tsx' "$PATTERN" "$ROOT" | sort || true
