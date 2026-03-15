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

echo "=== F1 — Markdown Body (10 pts) ==="
check "renderMarkdown imported" 2 "grep -q 'renderMarkdown' microapps/journal/index.ts"
check "markdown in preview pane" 2 "grep -qE 'renderMarkdown.*preview|preview.*renderMarkdown|markdown.*detail|detail.*markdown|renderBody' microapps/journal/index.ts"
check "markdown in read mode" 2 "grep -qE 'renderMarkdown.*read|read.*renderMarkdown|renderRead.*markdown|markdown.*body|renderBody.*body' microapps/journal/index.ts"
check "heading styles" 2 "grep -qE 'PLAIN_HEADING|headingConfig|heading.*style' microapps/journal/index.ts"
check "code/rule/list rendering" 2 "grep -q 'renderMarkdown' microapps/journal/index.ts && grep -qE 'wrapText|word.*wrap' microapps/journal/index.ts"

echo ""
echo "=== F2 — Sort & Date (10 pts) ==="
check "sort toggle key" 2 "grep -qE 'key.*\"s\"|\"s\".*key|sortBy.*SORT_CYCLE|cycleSort|sortKey' microapps/journal/index.ts"
check "sort modes" 2 "grep -qE 'updatedAt.*createdAt.*title|sortBy|sortOrder|sortMode|SortMode' microapps/journal/index.ts"
check "sort in status bar" 2 "grep -qE 'SORT_LABEL|sortLabel|sort.*status|↓updated|↓created|↓title' microapps/journal/index.ts"
check "date group headers" 2 "grep -qE 'dateHeader|groupHeader|date.*group|day.*header|separator.*row' microapps/journal/index.ts"
check "header index mapping" 2 "grep -qE 'indexMap|headerMap|skipHeader|isHeader|entryIndex' microapps/journal/index.ts"

echo ""
echo "=== F3 — Session Viewer (14 pts) ==="
check "detect ~/.pi" 2 "grep -qE 'existsSync.*\\.pi|PI_DIR|piDir|dotPi|sessions.*dir' microapps/journal/index.ts"
check "session list view" 2 "grep -qE 'sessionList|session.*list|sessions.*mode|listSessions' microapps/journal/index.ts"
check "session detail view" 2 "grep -qE 'sessionDetail|session.*detail|session.*read|viewSession' microapps/journal/index.ts"
check "mode toggle" 2 "grep -qE 'view.*mode|journal.*sessions|sessions.*journal|toggleView|viewMode' microapps/journal/index.ts"
check "message rendering" 2 "grep -qE 'renderMessage|message.*block|role.*color|user.*assistant' microapps/journal/index.ts"
check "role coloring" 2 "grep -qE 'user.*color|assistant.*color|role.*style|roleColor' microapps/journal/index.ts"
check "tool call summary" 2 "grep -qE 'toolCall|tool.*summary|toolResult|tool.*name' microapps/journal/index.ts"

echo ""
echo "=== F4 — Integration (6 pts) ==="
check "journal.sessions command" 2 "curl -sf '$API/commands/list' | grep -q 'journal.sessions\|journal\.sessions'"
check "journal.session.read command" 2 "curl -sf '$API/commands/list' | grep -q 'journal.session\|session\.read'"
check "describeState view mode" 2 "grep -qE 'view.*journal|view.*sessions|viewMode.*describe|describeState.*view' microapps/journal/index.ts"

echo ""
echo "========================================="
echo "feature_score: $SCORE / 40"
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
echo "Agent: Read the screenshot, score 6 UI axes (MD_RENDER/10, LIST_UX/10, SESSION_UX/10,"
echo "COHERENCE/10, LAYOUT/10, POLISH/10),"
echo "then journal_score = feature_score + sum(UI axes)."
