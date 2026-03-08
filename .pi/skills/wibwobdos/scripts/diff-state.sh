#!/usr/bin/env bash
# diff-state.sh — snapshot /state before and after a command, show what changed
# [vps-ok] WIBWOB_TOKEN optional — omit for local no-auth instances
#
# Usage:
#   bash scripts/diff-state.sh <endpoint> [body-json]
#   bash scripts/diff-state.sh windows/move '{"id":4,"left":10,"top":5}'
#   bash scripts/diff-state.sh commands/run '{"id":"plasma.open","args":{}}'
#
# Exits 0 if state changed. Exits 2 if ok:true but nothing changed (silent no-op).
set -eo pipefail

: "${WIBWOB_API:=http://127.0.0.1:8099}"
: "${WIBWOB_TOKEN:=}"

ENDPOINT="${1:?Usage: diff-state.sh <endpoint> [body-json]}"
DEFAULT_BODY='{}'
BODY="${2:-$DEFAULT_BODY}"

BEFORE=$(mktemp); AFTER=$(mktemp)
trap "rm -f $BEFORE $AFTER" EXIT

_curl() {
  if [[ -n "$WIBWOB_TOKEN" ]]; then
    curl -sf -H "Authorization: Bearer $WIBWOB_TOKEN" "$@"
  else
    curl -sf "$@"
  fi
}

_curl "$WIBWOB_API/state" > "$BEFORE"

result=$(_curl -X POST -H "Content-Type: application/json" -d "$BODY" "$WIBWOB_API/$ENDPOINT")
echo "API response: $result"

_curl "$WIBWOB_API/state" > "$AFTER"

python3 - "$BEFORE" "$AFTER" << 'EOF'
import json, sys

before = json.load(open(sys.argv[1]))
after  = json.load(open(sys.argv[2]))

bw = {w['id']: w for w in before.get('windows', [])}
aw = {w['id']: w for w in after.get('windows',  [])}
changes = []

for wid in set(bw) - set(aw):
    changes.append(f"  CLOSED  [{wid}] {bw[wid].get('title','?')}")

for wid in set(aw) - set(bw):
    w = aw[wid]
    changes.append(f"  OPENED  [{wid}] {w.get('title','?')}  {w.get('width')}x{w.get('height')}  @{w.get('left')},{w.get('top')}")

for wid in set(bw) & set(aw):
    b, a = bw[wid], aw[wid]
    diffs = []
    for field in ('left','top','width','height','title','focused'):
        if b.get(field) != a.get(field):
            diffs.append(f"{field}: {b.get(field)} → {a.get(field)}")
    if diffs:
        changes.append(f"  CHANGED [{wid}] {a.get('title','?')}  " + ", ".join(diffs))

bt = before.get('app',{}).get('theme')
at = after.get('app',{}).get('theme')
if bt != at:
    changes.append(f"  THEME   {bt} → {at}")

if changes:
    print(f"\n{len(changes)} change(s):")
    for c in changes: print(c)
    sys.exit(0)
else:
    print("\nNo state change — ok:true was a silent no-op or async effect.")
    sys.exit(2)
EOF
