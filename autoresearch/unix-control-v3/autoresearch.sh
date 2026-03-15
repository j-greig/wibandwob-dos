#!/bin/bash
set -euo pipefail

SCREENSHOT_PATH="scratch/autoresearch-screenshot.png"
DISPLAY_NUM="${DISPLAY_NUM:-2}"
API="http://127.0.0.1:8099"
SCORE=0

# ── 1. Restart app ──────────────────────────────────────────────
bash scripts/restart.sh --tmux > /dev/null 2>&1 || {
  echo "WARNING: restart.sh failed, trying manual restart"
  kill $(cat scratch/wibwob.pid 2>/dev/null) 2>/dev/null || true
  sleep 2
  tmux send-keys -t wibwob "bun run start" Enter
  sleep 5
}

for i in $(seq 1 20); do
  curl -sf "$API/health" > /dev/null 2>&1 && break
  sleep 1
done

# ── 2. Open Journal ────────────────────────────────────────────
curl -sf -X POST "$API/commands/run" \
  -H 'Content-Type: application/json' \
  -d '{"id":"microapp.wibwob.journal.open"}' > /dev/null 2>&1 || true
sleep 2

# ── 3. Feature checks ──────────────────────────────────────────
echo ""

check() {
  local label="$1"
  local pts="$2"
  local test="$3"
  if eval "$test" > /dev/null 2>&1; then
    echo "  ✓ $label (+$pts)"
    SCORE=$((SCORE + pts))
  else
    echo "  ✗ $label (0)"
  fi
}

echo "=== MVP — List + Read (10 pts) ==="
check "manifest exists" 2 "[ -f microapps/journal/microapp.json ]"
check "entry point exists" 1 "[ -f microapps/journal/index.ts ]"
check "entry list view" 2 "grep -q 'LIST\|list.*mode\|entryList\|listBox' microapps/journal/index.ts"
check "entry detail view" 2 "grep -q 'READ\|read.*mode\|detailBox\|bodyBox\|viewEntry' microapps/journal/index.ts"
check "create entry" 2 "grep -q 'EDIT\|NEW\|createEntry\|newEntry\|edit.*mode' microapps/journal/index.ts"
check "entry persistence" 1 "grep -q 'entries.*json\|writeFileSync\|saveEntry\|writeEntry' microapps/journal/index.ts"

echo ""
echo "=== v1 — Edit + Delete (12 pts) ==="
check "edit entry" 3 "grep -q 'editEntry\|updateEntry\|edit.*mode\|EDIT.*mode' microapps/journal/index.ts"
check "delete entry" 3 "grep -q 'deleteEntry\|removeEntry\|delete.*confirm\|archive' microapps/journal/index.ts"
check "search/filter" 3 "grep -q 'search\|filter.*text\|filterEntries' microapps/journal/index.ts"
check "keyboard shortcuts" 3 "grep -qE '\"n\"|\"e\"|\"d\".*new|edit|delete' microapps/journal/index.ts"

echo ""
echo "=== v2 — Rich List (12 pts) ==="
check "two-pane layout" 3 "grep -qE 'listPane|previewPane|splitView|twoPane|left.*pane|right.*pane' microapps/journal/index.ts"
check "responsive breakpoints" 2 "grep -q 'pickBreakpoint\|breakpoint\|w >= \|width.*<' microapps/journal/index.ts"
check "sort entries" 2 "grep -q 'sort.*created\|sort.*updated\|sortBy\|sortOrder' microapps/journal/index.ts"
check "entry stats" 2 "grep -q 'statusBar\|status.*bar\|entry.*count\|stats' microapps/journal/index.ts"
check "relative timestamps" 3 "grep -q 'timeAgo\|ago\|relative.*time\|formatRelative' microapps/journal/index.ts"

echo ""
echo "=== v3 — Agent Integration (10 pts) ==="
check "journal.create command" 2 "curl -sf '$API/commands/list' | grep -q 'journal.create\|journal\.create'"
check "journal.read command" 2 "curl -sf '$API/commands/list' | grep -q 'journal.read\|journal\.read'"
check "journal.update command" 2 "curl -sf '$API/commands/list' | grep -q 'journal.update\|journal\.update'"
check "journal.list command" 2 "curl -sf '$API/commands/list' | grep -q 'journal.list\|journal\.list'"
check "journal.delete command" 2 "curl -sf '$API/commands/list' | grep -q 'journal.delete\|journal\.delete'"

echo ""
echo "=== v4 — Polish (8 pts) ==="
check "kind icons" 2 "grep -qE '◊|░|★|■|kind.*icon\|KIND_ICON' microapps/journal/index.ts"
check "figlet header" 2 "grep -q 'renderFiglet\|figlet' microapps/journal/index.ts"
check "word wrap" 2 "grep -q 'wrapText\|wordWrap\|word.*wrap' microapps/journal/index.ts"
check "tags rendered" 2 "grep -q 'tags.*render\|tag.*display\|#.*tag\|tagStr' microapps/journal/index.ts"

echo ""
echo "=== v5 — Power Features (8 pts) ==="
check "export markdown" 2 "grep -q 'export.*markdown\|exportMarkdown\|export-markdown' microapps/journal/index.ts"
check "import from v1" 2 "grep -q 'import.*v1\|importV1\|journal.jsonl\|import-legacy' microapps/journal/index.ts"
check "linked entries" 2 "grep -q 'referenceId\|linkedEntry\|link.*entry' microapps/journal/index.ts"
check "workspace persist" 2 "grep -q 'registerSnapshot' microapps/journal/index.ts"

echo ""
echo "========================================="
echo "feature_score: $SCORE / 60"
echo "========================================="

# ── 4. Screenshot ───────────────────────────────────────────────
screencapture -D "$DISPLAY_NUM" -x "$SCREENSHOT_PATH" 2>/dev/null || {
  echo "WARN: screencapture failed"
}
file "$SCREENSHOT_PATH" 2>/dev/null || true
echo "$SCREENSHOT_PATH"

# Archive
ARCHIVE_DIR="scratch/autoresearch-shots"
mkdir -p "$ARCHIVE_DIR"
SEQ=$(printf "%03d" $(( $(ls "$ARCHIVE_DIR" 2>/dev/null | wc -l) + 1 )))
TS=$(date +%H%M%S)
cp "$SCREENSHOT_PATH" "$ARCHIVE_DIR/${SEQ}-${TS}.png" 2>/dev/null || true
echo "Archived: $ARCHIVE_DIR/${SEQ}-${TS}.png"

echo ""
echo "Screenshot: $SCREENSHOT_PATH"
echo "Agent: Read the screenshot, score 7 UI axes (LAYOUT/6, READABILITY/6, AESTHETIC/5,"
echo "COHERENCE/5, CHARACTER/5, USABILITY/6, AGENT_XP/7),"
echo "then journal_score = feature_score + sum(UI axes)."
