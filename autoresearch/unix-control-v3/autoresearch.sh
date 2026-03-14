#!/bin/bash
set -euo pipefail

SCREENSHOT_PATH="scratch/autoresearch-screenshot.png"
DISPLAY_NUM="${DISPLAY_NUM:-2}"
API="http://127.0.0.1:8099"
SCORE=0

# ── 1. Restart app (microapps.reload doesn't pick up TS changes) ────
bash scripts/restart.sh > /dev/null 2>&1 || {
  echo "WARNING: restart.sh failed, trying manual restart"
  kill $(cat scratch/wibwob.pid 2>/dev/null) 2>/dev/null || true
  sleep 2
  tmux send-keys -t wibwob "bun run start" Enter
  sleep 5
}

# Wait for health
for i in $(seq 1 20); do
  curl -sf "$API/health" > /dev/null 2>&1 && break
  sleep 1
done

# ── 2. Open Journal window ──────────────────────────────────────────
curl -sf -X POST "$API/commands/run" \
  -H 'Content-Type: application/json' \
  -d '{"id":"microapp.wibwob.journal.open"}' > /dev/null 2>&1 || true
sleep 2

# ── 3. Grab state ───────────────────────────────────────────────────
STATE=$(curl -sf "$API/state" 2>/dev/null || echo "{}")
JOURNAL_STATE=$(echo "$STATE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for w in data.get('windows', []):
    if w.get('appType') == 'wibwob.journal':
        print(json.dumps(w))
        break
" 2>/dev/null || echo "{}")

# ── Helper: check function ──────────────────────────────────────────
check() {
  local name="$1" points="$2" result="$3"
  if [ "$result" = "1" ]; then
    SCORE=$((SCORE + points))
    echo "  ✓ $name (+$points)"
  else
    echo "  ✗ $name (0/$points)"
  fi
}

SOURCE="microapps/journal/index.ts"
MANIFEST="microapps/journal/microapp.json"

echo "=== MVP (10 pts) ==="
check "manifest exists" 2 "$([ -f "$MANIFEST" ] && echo 1 || echo 0)"
check "entry point exists" 1 "$([ -f "$SOURCE" ] && echo 1 || echo 0)"
check "jsonl persistence" 2 "$(grep -q 'journal.jsonl' "$SOURCE" 2>/dev/null && echo 1 || echo 0)"
check "input line" 2 "$(grep -q 'textbox\|inputLine\|createInputLine' "$SOURCE" 2>/dev/null && echo 1 || echo 0)"
check "lifecycle hooks" 2 "$(grep -q 'describeState' "$SOURCE" 2>/dev/null && grep -q 'captureText' "$SOURCE" 2>/dev/null && echo 1 || echo 0)"
check "system entries" 1 "$(grep -q '"system"' "$SOURCE" 2>/dev/null && echo 1 || echo 0)"

echo ""
echo "=== v1 — Agent Parity (12 pts) ==="
check "journal.append command" 4 "$(grep -q 'journal.*append\|id:.*append' "$SOURCE" 2>/dev/null && grep -q 'direct.*true\|direct:true' "$SOURCE" 2>/dev/null && echo 1 || echo 0)"
check "peer visual distinction" 3 "$(grep -qE '\[H\]|\[A\]|\[S\]|peer.*fg|peer.*color|peerColor' "$SOURCE" 2>/dev/null && echo 1 || echo 0)"
check "auto-scroll" 2 "$(grep -qE 'setScrollPerc|scrollTo|scrollBottom' "$SOURCE" 2>/dev/null && echo 1 || echo 0)"
check "structured describeState" 3 "$(grep -q 'entryCount\|lastEntry' "$SOURCE" 2>/dev/null && echo 1 || echo 0)"

echo ""
echo "=== v2 — Rich Rendering (12 pts) ==="
check "day dividers" 2 "$(grep -qE 'divider|day.*sep|───|━━━|date.*header' "$SOURCE" 2>/dev/null && echo 1 || echo 0)"
check "keyboard navigation" 3 "$(grep -qE "key.*\[.*'j'|key.*\[.*'k'|'g'.*'G'" "$SOURCE" 2>/dev/null && echo 1 || echo 0)"
check "search/filter" 3 "$(grep -qE 'filterEntries|searchMode|createInlineSearch|filterByPeer' "$SOURCE" 2>/dev/null && echo 1 || echo 0)"
check "relative timestamps" 2 "$(grep -qE 'ago|relative.*time|timeAgo|formatRelative' "$SOURCE" 2>/dev/null && echo 1 || echo 0)"
check "word-wrap" 2 "$(grep -qE 'wrap|wordWrap|wrapText' "$SOURCE" 2>/dev/null && echo 1 || echo 0)"

echo ""
echo "=== v3 — Persistence (10 pts) ==="
check "persist in manifest" 2 "$(grep -q '"persist".*true' "$MANIFEST" 2>/dev/null && echo 1 || echo 0)"
check "registerSnapshot" 3 "$(grep -q 'registerSnapshot' "$SOURCE" 2>/dev/null && echo 1 || echo 0)"
check "multiple journals" 3 "$(grep -qE 'switchJournal|journalName|pickFile.*journal|multiple.*journal' "$SOURCE" 2>/dev/null && echo 1 || echo 0)"
check "markdown export" 2 "$(grep -qE 'export.*markdown\|export.*md\|toMarkdown\|exportMarkdown' "$SOURCE" 2>/dev/null && echo 1 || echo 0)"

echo ""
echo "=== v4 — Provenance (8 pts) ==="
check "entry types" 2 "$(grep -qE 'observation|decision|discovery|question.*note|entryType|kind.*observation' "$SOURCE" 2>/dev/null && echo 1 || echo 0)"
check "tags" 2 "$(grep -qE 'tags.*\[|addTag|tag.*label|entry.*tags' "$SOURCE" 2>/dev/null && echo 1 || echo 0)"
check "actor metadata" 2 "$(grep -qE 'actor.*:|actor.*metadata|peer.*actor' "$SOURCE" 2>/dev/null && echo 1 || echo 0)"
check "status bar" 2 "$(grep -qE 'createStatusBar|statusBar|stats.*bar' "$SOURCE" 2>/dev/null && echo 1 || echo 0)"

echo ""
echo "=== v5 — Composition (8 pts) ==="
check "patchbay-ready state" 2 "$(grep -qE 'peerBreakdown|mood|stats.*describe' "$SOURCE" 2>/dev/null && echo 1 || echo 0)"
check "ambient mode" 2 "$(grep -qE 'ambient|compact.*mode|sticky.*window' "$SOURCE" 2>/dev/null && echo 1 || echo 0)"
check "summarize command" 2 "$(grep -qE 'summarize|summarise|journal.*summary' "$SOURCE" 2>/dev/null && echo 1 || echo 0)"
check "linked entries" 2 "$(grep -qE 'linkedEntry|backlink|entry.*ref|referenceId' "$SOURCE" 2>/dev/null && echo 1 || echo 0)"

echo ""
echo "========================================="
echo "feature_score: $SCORE / 60"
echo "========================================="

# ── 4. Capture screenshot ────────────────────────────────────────────
# Ensure fixed tmux geometry for comparable screenshots
tmux resize-window -t wibwob -x 211 -y 56 2>/dev/null || true
sleep 1

mkdir -p "$(dirname "$SCREENSHOT_PATH")"
./scripts/capture-tui-png.sh --display "$DISPLAY_NUM" --out "$SCREENSHOT_PATH" 2>/dev/null || {
  echo "WARNING: screenshot capture failed — score UI from text screenshot"
  ./scripts/screenshot-window.sh "Journal" 2>/dev/null || true
}

# Archive
SHOTS_DIR="scratch/autoresearch-shots"
mkdir -p "$SHOTS_DIR"
NEXT_NUM=$(printf "%03d" "$(( $(ls "$SHOTS_DIR"/*.png 2>/dev/null | wc -l) + 1 ))")
STAMP=$(date +%H%M%S)
ARCHIVE_PATH="$SHOTS_DIR/${NEXT_NUM}-${STAMP}.png"
cp "$SCREENSHOT_PATH" "$ARCHIVE_PATH" 2>/dev/null || true

echo ""
echo "Screenshot: $SCREENSHOT_PATH"
echo "Archived: $ARCHIVE_PATH"
echo ""
echo "Agent: Read the screenshot, score 5 UI axes (each 1-8),"
echo "then journal_score = feature_score + sum(UI axes)."
