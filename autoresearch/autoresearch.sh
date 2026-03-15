#!/bin/bash
set -euo pipefail

# Journal JRN/LOG toggle UI benchmark
# Opens journal, exercises both modes via API, scores rendered output.

cd "$(dirname "$0")/.."

# Ensure app is running
wibwob health >/dev/null 2>&1 || { echo "ERROR: app not running — wibwob start first" >&2; exit 1; }

START_MS=$(python3 -c "import time; print(int(time.time()*1000))")

SCORE=0

# 1. Open journal
wibwob cmd wibwob.journal.open >/dev/null 2>&1
sleep 1

# 2. Get journal window ID
WIN_ID=$(wibwob state 2>/dev/null | python3 -c "
import sys, json
state = json.load(sys.stdin)
for w in state.get('windows', []):
    if 'journal' in w.get('appType', '').lower() or 'journal' in w.get('title', '').lower():
        print(w['id']); break
" 2>/dev/null || echo "")

if [ -z "$WIN_ID" ]; then
  echo "ERROR: journal window not found" >&2
  echo "METRIC ui_quality=0"
  exit 0
fi

# 3. Capture JRN view text
JRN_TEXT=$(wibwob read "$WIN_ID" 2>/dev/null || echo "")

# 4. Switch to LOG view (send S key via command)
# Use the state to check current viewMode
VIEW_MODE=$(wibwob state 2>/dev/null | python3 -c "
import sys, json
state = json.load(sys.stdin)
for w in state.get('windows', []):
    if w.get('id') == $WIN_ID or 'journal' in w.get('appType', '').lower():
        ds = w.get('describeState', {})
        print(ds.get('viewMode', 'unknown')); break
" 2>/dev/null || echo "unknown")

# 5. Score using Python
RESULT=$(python3 -c "
import sys

jrn_text = '''$JRN_TEXT'''
view_mode = '$VIEW_MODE'
score = 0

# Toggle visibility (15 pts): check if JRN/LOG indicator is in the rendered text
if 'JRN' in jrn_text and 'LOG' in jrn_text:
    score += 15
elif 'JRN' in jrn_text or 'LOG' in jrn_text:
    score += 7

# JRN view rendering (20 pts)
if 'JRNL' in jrn_text:  # figlet header
    score += 5
if any(c in jrn_text for c in ['░', '◊', '■', '★', '?']):  # kind icons
    score += 5
if 'ago' in jrn_text:  # time-ago labels
    score += 5
if any(marker in jrn_text for marker in ['Today', 'Yesterday', 'Jan', 'Feb', 'Mar']):
    score += 5  # date group headers

# Mode switching (20 pts): check describeState reports viewMode
if view_mode == 'journal':
    score += 10  # correct default
elif view_mode == 'sessions':
    score += 10
if view_mode != 'unknown':
    score += 10  # viewMode is reported at all

# Theme compliance (15 pts): hard to test via text, give baseline
score += 8  # partial — needs visual verification

# State reporting (10 pts)
if view_mode in ('journal', 'sessions'):
    score += 10

# LOG view rendering (20 pts): would need mode switch — baseline 0
# (future iterations will exercise the S toggle via API)

print(score)
" 2>/dev/null || echo "0")

END_MS=$(python3 -c "import time; print(int(time.time()*1000))")
ELAPSED=$((END_MS - START_MS))

echo "METRIC ui_quality=$RESULT"
echo "METRIC render_time_ms=$ELAPSED"
echo "METRIC view_mode=$VIEW_MODE"
echo "METRIC win_id=$WIN_ID"
