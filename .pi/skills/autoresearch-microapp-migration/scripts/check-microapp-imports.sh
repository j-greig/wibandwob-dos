#!/usr/bin/env bash
set -euo pipefail

TARGET_DIR="${1:-}"
if [[ -z "$TARGET_DIR" ]]; then
  echo "usage: $0 <target-microapp-dir>" >&2
  exit 2
fi

if [[ ! -d "$TARGET_DIR" ]]; then
  echo "missing target dir: $TARGET_DIR" >&2
  exit 2
fi

# Enforce microapp boundary: no direct core/windows imports.
BAD=$(grep -RInE "from ['\"](\.{1,2}/)+src/(core|windows)/|from ['\"]/Users/.*/src/(core|windows)/" "$TARGET_DIR" --include='*.ts' --include='*.tsx' || true)
if [[ -n "$BAD" ]]; then
  echo "FAIL: forbidden imports found in $TARGET_DIR" >&2
  echo "$BAD" >&2
  exit 1
fi

echo "PASS: import boundary clean for $TARGET_DIR"
