#!/usr/bin/env bash
# check-cross-platform.sh — flag macOS-only `script` patterns in shell scripts
# Exits 1 if any file uses `script -q /dev/null` without a platform guard.
# Run before committing script changes or before Docker smoke tests.
#
# Usage: bash scripts/checks/check-cross-platform.sh

set -euo pipefail

ERRORS=0
CHECKED=0

while IFS= read -r file; do
  CHECKED=$((CHECKED + 1))
  # Look for `script -q /dev/null` lines that are NOT inside a uname/Darwin/Linux guard
  while IFS= read -r match; do
    # skip comment lines
    raw_line=$(echo "$match" | cut -d: -f2-)
    [[ "$raw_line" =~ ^[[:space:]]*# ]] && continue
    lineno=$(echo "$match" | cut -d: -f1)
    content=$(echo "$match" | cut -d: -f2-)
    # Check surrounding 5 lines for a uname/Darwin/Linux guard
    start=$((lineno - 5)); [[ $start -lt 1 ]] && start=1
    context=$(sed -n "${start},$((lineno + 2))p" "$file")
    if ! echo "$context" | grep -qE 'uname|Darwin|Linux'; then
      echo "FAIL  $file:$lineno — unguarded macOS-only \`script\` syntax"
      echo "      $content"
      ERRORS=$((ERRORS + 1))
    fi
  done < <(grep -n 'script -q /dev/null' "$file" 2>/dev/null || true)
done < <(find scripts/ -name '*.sh' -type f | sort)

echo ""
echo "Checked $CHECKED script files."
if [[ $ERRORS -gt 0 ]]; then
  echo "✗ $ERRORS unguarded platform-specific pattern(s) found."
  echo "  See PATCHNOTES.md for the cross-platform fix pattern."
  exit 1
fi
echo "✓ No unguarded platform-specific patterns found."
