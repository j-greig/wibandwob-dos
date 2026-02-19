#!/usr/bin/env bash
# capture.sh — Trigger TUI screenshot, read text dump + state JSON
# Usage: capture.sh [--log] [--no-state] [--diff] [--window NAME]
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
API_BASE="${API_BASE:-http://127.0.0.1:8089}"
SHOTS_DIR="$REPO_ROOT/logs/screenshots"
SAVE_ROOT=true    # default: save to repo root
STATE=true
DIFF=false
WINDOW=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --log)      SAVE_ROOT=false; shift ;;
    --no-state) STATE=false; shift ;;
    --diff)     DIFF=true; shift ;;
    --window)   WINDOW="$2"; shift 2 ;;
    quick)      STATE=false; SAVE_ROOT=false; shift ;;
    full)       STATE=true; DIFF=true; shift ;;
    *)          echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

# --- Health check + auto-start ---
if ! curl -sf "$API_BASE/health" >/dev/null 2>&1; then
  echo "API server not responding. Starting..." >&2
  if [[ -x "$REPO_ROOT/start_api_server.sh" ]]; then
    "$REPO_ROOT/start_api_server.sh" &
    for i in $(seq 1 20); do
      sleep 0.5
      curl -sf "$API_BASE/health" >/dev/null 2>&1 && break
    done
    if ! curl -sf "$API_BASE/health" >/dev/null 2>&1; then
      echo "ERROR: API server failed to start after 10s" >&2
      exit 1
    fi
    echo "API server started." >&2
  else
    echo "ERROR: API server not running and start_api_server.sh not found" >&2
    exit 1
  fi
fi

# --- Capture screenshot ---
BEFORE_TS=$(date +%s)
curl -sf -X POST "$API_BASE/screenshot" >/dev/null 2>&1 || true
sleep 0.3

# Find latest .txt file (more reliable than API response)
LATEST_TXT=$(ls -t "$SHOTS_DIR"/tui_*.txt 2>/dev/null | head -1)
if [[ -z "$LATEST_TXT" ]]; then
  echo "ERROR: No screenshot .txt file found in $SHOTS_DIR" >&2
  exit 1
fi

# Verify it's recent (within last 5 seconds)
FILE_MOD=$(stat -f %m "$LATEST_TXT" 2>/dev/null || stat -c %Y "$LATEST_TXT" 2>/dev/null)
if (( FILE_MOD < BEFORE_TS - 5 )); then
  echo "WARNING: Latest screenshot may be stale ($(basename "$LATEST_TXT"))" >&2
fi

TXT_CONTENT=$(cat "$LATEST_TXT")

# --- State JSON (always fetch if --window is set) ---
STATE_JSON=""
if $STATE || [[ -n "$WINDOW" ]]; then
  STATE_JSON=$(curl -sf "$API_BASE/state" 2>/dev/null || echo '{"error": "state_fetch_failed"}')
fi

# --- Diff ---
DIFF_OUTPUT=""
if $DIFF; then
  # Look for previous screenshot (second-newest)
  PREV_TXT=$(ls -t "$SHOTS_DIR"/tui_*.txt 2>/dev/null | sed -n '2p')
  if [[ -n "$PREV_TXT" ]]; then
    DIFF_OUTPUT=$(diff --unified=1 "$PREV_TXT" "$LATEST_TXT" 2>/dev/null || true)
    if [[ -z "$DIFF_OUTPUT" ]]; then
      DIFF_OUTPUT="(no changes)"
    fi
  else
    DIFF_OUTPUT="(no previous screenshot to diff against)"
  fi
fi

# --- Window crop ---
if [[ -n "$WINDOW" ]] && [[ -n "$STATE_JSON" ]]; then
  # Extract window rect from state JSON using python
  RECT=$(echo "$STATE_JSON" | python3 -c "
import sys, json
state = json.load(sys.stdin)
for w in state.get('windows', []):
    if '$WINDOW'.lower() in w.get('title','').lower() or '$WINDOW'.lower() in w.get('type','').lower():
        r = w['rect']
        print(f\"{r['x']} {r['y']} {r['w']} {r['h']}\")
        break
" 2>/dev/null || echo "")
  if [[ -n "$RECT" ]]; then
    read -r WX WY WW WH <<< "$RECT"
    # Crop the text buffer (skip header lines, extract rect)
    TXT_CONTENT=$(echo "$TXT_CONTENT" | python3 -c "
import sys
lines = sys.stdin.readlines()
# Skip header (first 5 lines are metadata)
body = [l.rstrip('\n') for l in lines[5:]]
x, y, w, h = $WX, $WY, $WW, $WH
for row in range(y, min(y+h, len(body))):
    line = body[row] if row < len(body) else ''
    print(line[x:x+w] if len(line) > x else '')
" 2>/dev/null)
  else
    echo "WARNING: Window '$WINDOW' not found in state" >&2
  fi
fi

# --- Output ---
TS=$(basename "$LATEST_TXT" | sed 's/tui_//;s/\.txt//')
OUTPUT=""
OUTPUT+="# TUI Screenshot ${TS}"$'\n'
OUTPUT+="Source: $(basename "$LATEST_TXT")"$'\n'
OUTPUT+=""$'\n'
OUTPUT+='```'$'\n'
OUTPUT+="$TXT_CONTENT"$'\n'
OUTPUT+='```'$'\n'

if [[ -n "$STATE_JSON" ]] && $STATE; then
  OUTPUT+=""$'\n'
  OUTPUT+="## State"$'\n'
  OUTPUT+='```json'$'\n'
  OUTPUT+="$(echo "$STATE_JSON" | python3 -m json.tool 2>/dev/null || echo "$STATE_JSON")"$'\n'
  OUTPUT+='```'$'\n'
fi

if [[ -n "$DIFF_OUTPUT" ]] && $DIFF; then
  OUTPUT+=""$'\n'
  OUTPUT+="## Diff"$'\n'
  OUTPUT+='```diff'$'\n'
  OUTPUT+="$DIFF_OUTPUT"$'\n'
  OUTPUT+='```'$'\n'
fi

# --- Save ---
if $SAVE_ROOT; then
  OUTFILE="$REPO_ROOT/tui-screenshot-${TS}.md"
  echo "$OUTPUT" > "$OUTFILE"
  echo "Saved: $OUTFILE" >&2
fi

# Always print to stdout for inline consumption
echo "$OUTPUT"
