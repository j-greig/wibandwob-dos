#!/bin/bash
set -euo pipefail

# Journal JRN/LOG toggle UI benchmark
# Scores rendered output of both views via the control API.

cd "$(dirname "$0")/.."

# Find live socket
SOCK=""
for s in scratch/instances/*.sock; do
  if curl -s --max-time 1 --unix-socket "$s" http://localhost/health >/dev/null 2>&1; then
    SOCK="$s"
    break
  fi
done

if [ -z "$SOCK" ]; then
  echo "ERROR: app not running" >&2
  echo "METRIC ui_quality=0"
  exit 0
fi

# Ensure journal is open
curl -s --unix-socket "$SOCK" -X POST http://localhost/commands/run \
  -H 'Content-Type: application/json' \
  -d '{"id":"microapp.wibwob.journal.open"}' >/dev/null 2>&1
sleep 1

# Get window state
STATE=$(curl -s --unix-socket "$SOCK" http://localhost/state)
WIN_ID=$(echo "$STATE" | python3 -c "
import sys, json
s = json.load(sys.stdin)
for w in s.get('windows', []):
    if 'journal' in w.get('appType', '').lower():
        print(w['id']); break
" 2>/dev/null || echo "")

if [ -z "$WIN_ID" ]; then
  echo "METRIC ui_quality=0"
  exit 0
fi

# Capture JRN view text
JRN_TEXT=$(curl -s --unix-socket "$SOCK" "http://localhost/screenshot/text?id=$WIN_ID" 2>/dev/null || echo "")

# Get describeState for JRN mode
JRN_DETAILS=$(echo "$STATE" | python3 -c "
import sys, json
s = json.load(sys.stdin)
for w in s.get('windows', []):
    if w.get('id') == $WIN_ID:
        print(json.dumps(w.get('details', {})))
        break
" 2>/dev/null || echo "{}")

# Switch to LOG view via command
# Send Shift-S via tmux to toggle
tmux send-keys -t journal 'S' 2>/dev/null || true
sleep 1

# Re-fetch state
STATE2=$(curl -s --unix-socket "$SOCK" http://localhost/state)
LOG_TEXT=$(curl -s --unix-socket "$SOCK" "http://localhost/screenshot/text?id=$WIN_ID" 2>/dev/null || echo "")
LOG_DETAILS=$(echo "$STATE2" | python3 -c "
import sys, json
s = json.load(sys.stdin)
for w in s.get('windows', []):
    if w.get('id') == $WIN_ID:
        print(json.dumps(w.get('details', {})))
        break
" 2>/dev/null || echo "{}")

# Switch back to JRN
tmux send-keys -t journal 'S' 2>/dev/null || true
sleep 0.5

# Score
python3 -c "
import json

jrn_text = '''$(echo "$JRN_TEXT" | sed "s/'/'\\''/g")'''
log_text = '''$(echo "$LOG_TEXT" | sed "s/'/'\\''/g")'''
jrn_details = json.loads('$JRN_DETAILS')
log_details = json.loads('$LOG_DETAILS')

score = 0

# 1. Toggle visibility (15 pts)
has_jrn = 'JRN' in jrn_text
has_log = 'LOG' in jrn_text
if has_jrn and has_log:
    score += 10
# Active indicator visible (brackets or inverse)
if '[ JRN ]' in jrn_text or '[ LOG ]' in log_text:
    score += 5

# 2. Mode switching (20 pts)
jrn_vm = jrn_details.get('viewMode', '')
log_vm = log_details.get('viewMode', '')
if jrn_vm == 'journal':
    score += 10
if log_vm == 'sessions':
    score += 10

# 3. JRN view rendering (20 pts)
if 'JRNL' in jrn_text:
    score += 5  # figlet header
if any(c in jrn_text for c in ['░', '◊', '■', '★']):
    score += 5  # kind icons
if 'ago' in jrn_text:
    score += 5  # time labels
if any(d in jrn_text for d in ['Today', 'Yesterday']):
    score += 5  # date headers

# 4. LOG view rendering (20 pts)
if 'session' in log_text.lower() or 'SESSIONS' in log_text:
    score += 5  # session mode active
if '▸' in log_text or '▹' in log_text:
    score += 5  # role glyphs
if '🔧' in log_text:
    score += 5  # tool call summaries
if 'msgs' in log_text:
    score += 5  # message counts

# 5. Theme compliance (10 pts)
# Can't test deeply via text, but if toggle renders = theme works
if has_jrn and has_log:
    score += 10

# 6. State reporting (15 pts)
if jrn_vm:
    score += 5
if jrn_details.get('entryCount') is not None:
    score += 5
if log_details.get('sessionCount') is not None:
    score += 5

print(f'METRIC ui_quality={score}')
print(f'METRIC jrn_view_mode={jrn_vm}')
print(f'METRIC log_view_mode={log_vm}')
print(f'METRIC jrn_has_toggle={1 if has_jrn and has_log else 0}')
print(f'METRIC log_has_role_glyphs={1 if chr(9656) in log_text or chr(9657) in log_text else 0}')
print(f'METRIC log_has_tool_calls={1 if chr(128295) in log_text else 0}')
"
