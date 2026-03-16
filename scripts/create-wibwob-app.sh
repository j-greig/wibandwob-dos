#!/bin/bash
# create-wibwob-app.sh — Generate a macOS .app for wibwob:// URL scheme
#
# WHY: macOS only routes custom URL schemes (wibwob://...) to .app bundles
# that declare CFBundleURLSchemes in Info.plist. A raw bun script can't
# register. Additionally, macOS delivers URLs via Apple Events (kAEGetURL)
# which only native executables or AppleScript applets can receive — plain
# shell scripts get zero arguments.
#
# HOW: osacompile builds a real AppleScript applet that handles:
#   'on open location' → wibwob:// URLs
#   'on open'          → file double-clicks (.md, .txt, etc.)
# Both delegate to scripts/wibwob-url-handler.sh → lib/wibwob-router.ts
# for smart file-type routing and instance discovery.
#
# After compilation, we patch Info.plist with PlistBuddy to add
# CFBundleURLSchemes and CFBundleDocumentTypes.
#
# USAGE:
#   bash scripts/create-wibwob-app.sh              # → ~/Applications/WibWob.app
#   bash scripts/create-wibwob-app.sh /custom/path  # → custom location
#
# NOTE: Ghostty 1.3+ has AppleScript for window/mouse/config control
# (see .agents/shell-dev/devlogs/W12.md) but that's for shell→Ghostty
# communication, not URL scheme handling. osacompile is still needed here.
#
# @see lib/wibwob-router.ts — routing logic
# @see scripts/wibwob-url-handler.sh — handler script

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_DIR="${1:-$HOME/Applications/WibWob.app}"

echo "Creating WibWob.app at: $APP_DIR"
[ -d "$APP_DIR" ] && { echo "  Removing existing install"; rm -rf "$APP_DIR"; }
mkdir -p "$(dirname "$APP_DIR")"

# ── 1. Compile AppleScript applet ────────────────────────

APPLESCRIPT_SRC=$(mktemp /tmp/wibwob-XXXXX.scpt)
cat > "$APPLESCRIPT_SRC" << APPLESCRIPT
-- WibWob-DOS URL/file handler applet
-- Receives wibwob:// URLs and file opens, delegates to handler script

on open location theURL
  do shell script "'$PROJECT_ROOT/scripts/wibwob-url-handler.sh' " & quoted form of theURL & " > /dev/null 2>&1 &"
end open location

on open theFiles
  repeat with f in theFiles
    set filePath to POSIX path of f
    do shell script "'$PROJECT_ROOT/scripts/wibwob-url-handler.sh' " & quoted form of filePath & " > /dev/null 2>&1 &"
  end repeat
end open

on run
  -- No-op when launched directly
end run
APPLESCRIPT

echo "  Compiling AppleScript applet..."
osacompile -o "$APP_DIR" "$APPLESCRIPT_SRC"
rm -f "$APPLESCRIPT_SRC"
echo "  Compiled"

# ── 2. Patch Info.plist ──────────────────────────────────

PLIST="$APP_DIR/Contents/Info.plist"
PB="/usr/libexec/PlistBuddy"

# Bundle identity
$PB -c "Set :CFBundleIdentifier com.wibwob.dos" "$PLIST" 2>/dev/null || \
  $PB -c "Add :CFBundleIdentifier string com.wibwob.dos" "$PLIST"
$PB -c "Set :CFBundleName WibWob" "$PLIST" 2>/dev/null || \
  $PB -c "Add :CFBundleName string WibWob" "$PLIST"

# wibwob:// URL scheme
$PB -c "Add :CFBundleURLTypes array" "$PLIST" 2>/dev/null || true
$PB -c "Add :CFBundleURLTypes:0 dict" "$PLIST" 2>/dev/null || true
$PB -c "Add :CFBundleURLTypes:0:CFBundleURLName string 'WibWob-DOS URL'" "$PLIST" 2>/dev/null || true
$PB -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes array" "$PLIST" 2>/dev/null || true
$PB -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes:0 string wibwob" "$PLIST" 2>/dev/null || true

# File associations (Alternate rank = opt-in via Finder → Get Info)
$PB -c "Add :CFBundleDocumentTypes array" "$PLIST" 2>/dev/null || true
# Markdown
$PB -c "Add :CFBundleDocumentTypes:0 dict" "$PLIST" 2>/dev/null || true
$PB -c "Add :CFBundleDocumentTypes:0:CFBundleTypeName string 'Markdown'" "$PLIST" 2>/dev/null || true
$PB -c "Add :CFBundleDocumentTypes:0:CFBundleTypeRole string Viewer" "$PLIST" 2>/dev/null || true
$PB -c "Add :CFBundleDocumentTypes:0:LSHandlerRank string Alternate" "$PLIST" 2>/dev/null || true
$PB -c "Add :CFBundleDocumentTypes:0:CFBundleTypeExtensions array" "$PLIST" 2>/dev/null || true
$PB -c "Add :CFBundleDocumentTypes:0:CFBundleTypeExtensions:0 string md" "$PLIST" 2>/dev/null || true
$PB -c "Add :CFBundleDocumentTypes:0:CFBundleTypeExtensions:1 string markdown" "$PLIST" 2>/dev/null || true
# Plain text / ASCII art
$PB -c "Add :CFBundleDocumentTypes:1 dict" "$PLIST" 2>/dev/null || true
$PB -c "Add :CFBundleDocumentTypes:1:CFBundleTypeName string 'Text'" "$PLIST" 2>/dev/null || true
$PB -c "Add :CFBundleDocumentTypes:1:CFBundleTypeRole string Viewer" "$PLIST" 2>/dev/null || true
$PB -c "Add :CFBundleDocumentTypes:1:LSHandlerRank string Alternate" "$PLIST" 2>/dev/null || true
$PB -c "Add :CFBundleDocumentTypes:1:CFBundleTypeExtensions array" "$PLIST" 2>/dev/null || true
$PB -c "Add :CFBundleDocumentTypes:1:CFBundleTypeExtensions:0 string txt" "$PLIST" 2>/dev/null || true
$PB -c "Add :CFBundleDocumentTypes:1:CFBundleTypeExtensions:1 string ascii" "$PLIST" 2>/dev/null || true
$PB -c "Add :CFBundleDocumentTypes:1:CFBundleTypeExtensions:2 string ans" "$PLIST" 2>/dev/null || true

echo "  Patched Info.plist"

# ── 3. Register with LaunchServices ──────────────────────

touch "$APP_DIR"
LSREGISTER="/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Versions/A/Support/lsregister"
[ -x "$LSREGISTER" ] && { "$LSREGISTER" -f "$APP_DIR" 2>/dev/null || true; echo "  Registered with LaunchServices"; }

cat << EOF

✓ WibWob.app installed: $APP_DIR

Test URL scheme:
  open 'wibwob://open?path=/tmp/test.md'

Test file association:
  Right-click .md → Get Info → Open With → WibWob → Change All

Uninstall:
  rm -rf '$APP_DIR'
EOF
