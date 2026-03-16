#!/bin/bash
set -euo pipefail

# WibMux checks — syntax validation only (no runtime deps)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Check wibmux.sh exists and has valid bash syntax
if [ -f "$SCRIPT_DIR/wibmux.sh" ]; then
  bash -n "$SCRIPT_DIR/wibmux.sh" 2>&1 | tail -10
  echo "OK: wibmux.sh syntax valid"
else
  echo "SKIP: wibmux.sh not yet created"
fi

# Check autoresearch.sh syntax
bash -n "$SCRIPT_DIR/autoresearch.sh" 2>&1 | tail -10
echo "OK: autoresearch.sh syntax valid"

# Verify osascript is available (macOS only)
if ! command -v osascript &>/dev/null; then
  echo "FAIL: osascript not found — macOS required"
  exit 1
fi
echo "OK: osascript available"

# Verify Ghostty is installed
if [ ! -d "/Applications/Ghostty.app" ]; then
  echo "FAIL: Ghostty.app not found"
  exit 1
fi
echo "OK: Ghostty.app found"

# Verify SDEF exists (AppleScript support)
if [ ! -f "/Applications/Ghostty.app/Contents/Resources/Ghostty.sdef" ]; then
  echo "FAIL: Ghostty.sdef not found — need Ghostty 1.3+"
  exit 1
fi
echo "OK: Ghostty SDEF present (AppleScript supported)"
