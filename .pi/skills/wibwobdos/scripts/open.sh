#!/usr/bin/env bash
# open.sh — open a window or list available commands
#
# Usage:
#   bash scripts/open.sh --list                          # all commands with descriptions
#   bash scripts/open.sh --list <filter>                 # filter by keyword
#   bash scripts/open.sh <command-id>                    # open with no args
#   bash scripts/open.sh <command-id> '{"mood":"void"}'  # open with JSON args
#
# Command ids come from --list or from references/commands.md
# After opening, run `bash scripts/state.sh` to get the new window id.
#
# Examples:
#   bash scripts/open.sh microapp.wibwobworld.open
#   bash scripts/open.sh plasma.open '{"mood":"void"}'
#   bash scripts/open.sh --list art
#   bash scripts/open.sh --list world

set -euo pipefail
API="${WIBWOB_API:-http://127.0.0.1:8099}"

if [[ $# -eq 0 ]]; then
  echo "usage: $0 --list [filter] | <command-id> [json-args]" >&2
  exit 1
fi

# ── List mode ─────────────────────────────────────────────────────────────────

if [[ "${1:-}" == "--list" ]]; then
  FILTER="${2:-}"
  CMDS=$(curl -sf --connect-timeout 5 "$API/commands/list") || {
    echo "error: cannot reach $API" >&2; exit 1
  }
  echo "$CMDS" | python3 -c "
import sys, json
data   = json.loads(sys.stdin.read())
cmds   = data.get('commands', data) if isinstance(data, dict) else data
filt   = sys.argv[1].lower() if len(sys.argv) > 1 else ''
shown  = 0
for c in cmds:
  if isinstance(c, str):
    cid, desc = c, ''
  else:
    cid  = c.get('id', '')
    desc = c.get('description', c.get('label', ''))
  if filt and filt not in cid.lower() and filt not in desc.lower():
    continue
  print(f'{cid:<45}  {desc}')
  shown += 1
if shown == 0:
  print(f'(no commands matching: {filt})')
" "$FILTER"
  exit 0
fi

# ── Run mode ──────────────────────────────────────────────────────────────────

CMD_ID="$1"
ARGS="${2:-{}}"

# Validate args is JSON
if ! echo "$ARGS" | python3 -m json.tool > /dev/null 2>&1; then
  echo "error: args must be valid JSON, got: $ARGS" >&2
  exit 1
fi

PAYLOAD=$(python3 -c "
import json, sys
print(json.dumps({'id': sys.argv[1], 'args': json.loads(sys.argv[2])}))
" "$CMD_ID" "$ARGS")

RESP=$(curl -sf --connect-timeout 8 \
  -X POST "$API/commands/run" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD") || {
    echo "error: POST /commands/run failed" >&2
    exit 1
  }

OK=$(echo "$RESP" | python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(d.get('ok','?'))" 2>/dev/null)
if [[ "$OK" == "True" || "$OK" == "true" ]]; then
  echo "opened: $CMD_ID"
  echo "(run 'bash scripts/state.sh' to get the window id)"
else
  echo "response: $RESP"
fi
