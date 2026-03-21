#!/usr/bin/env bash
# check-scaffold-sync.sh — verify scaffold template matches guide patterns
#
# Runs scaffold-microapp.sh to a temp dir, checks the generated code for:
# 1. registerMicroappHooks (not individual hooks)
# 2. SDK import path (not src/core/*)
# 3. captureText fallback (not empty string)
#
# Usage: bash scripts/checks/check-scaffold-sync.sh
# Exit 0 on pass, 1 on drift.

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

# Run scaffold silently
bash .pi/skills/microapp-creator/scripts/scaffold-microapp.sh \
  "$TMPDIR/test-app" "wibwob.test-app" "Test App" 999 > /dev/null 2>&1

INDEX="$TMPDIR/test-app/index.ts"
ERRORS=0

if [[ ! -f "$INDEX" ]]; then
  echo "✗ scaffold failed — no index.ts generated"
  exit 1
fi

# 1. registerMicroappHooks
if ! grep -q "registerMicroappHooks" "$INDEX"; then
  echo "✗ scaffold uses individual hooks instead of registerMicroappHooks"
  ERRORS=$((ERRORS + 1))
fi

# 2. SDK import path
if grep -qE 'from.*(src/core|src/ui|src/sdk/)' "$INDEX"; then
  echo "✗ scaffold imports from internal paths (should use microapp-sdk.js)"
  ERRORS=$((ERRORS + 1))
fi
if ! grep -q 'microapp-sdk' "$INDEX"; then
  echo "✗ scaffold doesn't import from microapp-sdk.js"
  ERRORS=$((ERRORS + 1))
fi

# 3. captureText fallback
if grep -q 'captureText.*() => ""' "$INDEX" || grep -q "captureText.*() => ''" "$INDEX"; then
  echo "✗ scaffold captureText returns empty string (needs fallback)"
  ERRORS=$((ERRORS + 1))
fi

# 4. No raw fs import
if grep -q 'from "node:fs"' "$INDEX"; then
  echo "✗ scaffold imports raw fs (should use safeWriteFile from SDK)"
  ERRORS=$((ERRORS + 1))
fi

if [[ $ERRORS -gt 0 ]]; then
  echo ""
  echo "✗ $ERRORS scaffold-guide drift(s) detected."
  echo "  Fix: .pi/skills/microapp-creator/scripts/scaffold-microapp.sh"
  echo "  Guide: SDK-MICROAPP-DEV.md"
  exit 1
fi

echo "✓ scaffold output matches guide patterns"
