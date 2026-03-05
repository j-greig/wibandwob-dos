#!/usr/bin/env bash
# Timeline Smoke Test — capture-then-review
#
# Fires each cue via API, screenshots TUI after each one (real macOS screencapture),
# dumps state JSON + tmux text. Then review pass on everything collected.
#
# Usage:
#   ./tests/timeline-smoke/run.sh [timeline.json]
#   DISPLAY_NUM=1 ./tests/timeline-smoke/run.sh   # main monitor instead

set -euo pipefail

TIMELINE="${1:-scratch/timelines/test-8bar.json}"
API="${API:-http://127.0.0.1:8099}"
DISPLAY_NUM="${DISPLAY_NUM:-2}"
TMUX_SESSION="${TMUX_SESSION:-wibwob-screenshot}"
REPAINT_WAIT="${REPAINT_WAIT:-1.0}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TIMELINE_SLUG=$(basename "$TIMELINE" .json | tr '[:upper:]' '[:lower:]' | tr ' /' '--')
CAPDIR="$REPO_ROOT/scratch/smoke-capture-${TIMELINE_SLUG}-$(date +%Y%m%d-%H%M%S)-$$"
mkdir -p "$CAPDIR"

log()  { echo "$(date +%H:%M:%S)  $*"; }
pass() { echo "  ✓ $*"; }
fail() { echo "  ✗ $*"; exit 1; }

api_get()  { curl -sf "${API}$1" 2>/dev/null || echo "{}"; }
api_post() { curl -sf -X POST "${API}$1" -H "Content-Type: application/json" -d "$2" 2>/dev/null || echo '{}'; }

screenshot() {
  local label="$1" expected="$2"
  sleep "$REPAINT_WAIT"
  screencapture -x -D "$DISPLAY_NUM" "$CAPDIR/${label}.png" 2>/dev/null
  tmux capture-pane -t "$TMUX_SESSION" -p 2>/dev/null > "$CAPDIR/${label}.txt"
  api_get "/state" > "$CAPDIR/${label}_state.json"
  printf '{"step":"%s","expected":"%s"}\n' "$label" "$expected" >> "$CAPDIR/expected.jsonl"
  log "  📸 $label"
}

clear_desktop() {
  log "Clearing desktop..."
  local ids
  ids=$(api_get "/state" | python3 -c "
import sys,json
s=json.load(sys.stdin)
print(' '.join(str(w['id']) for w in s.get('windows',[]) if w.get('appType')!='wibwob-agent'))
" 2>/dev/null || echo "")
  for id in $ids; do
    api_post "/windows/close" "{\"id\":$id}" > /dev/null
  done
  sleep 0.5
}

# ── preflight ───────────────────────────────────────────────────────────────

log ""
log "Timeline Smoke Test"
log "═══════════════════════════════════════"
log "Timeline:  $TIMELINE"
log "Capture:   $CAPDIR"
log "Display:   $DISPLAY_NUM"
log ""

curl -sf "${API}/health" >/dev/null 2>&1 && pass "App healthy" || fail "App not running at $API"
tmux has-session -t "$TMUX_SESSION" 2>/dev/null && pass "tmux session found" || fail "tmux session '$TMUX_SESSION' not found"

# ── validate + dry run ──────────────────────────────────────────────────────

log ""
log "── Validate ────────────────────────────"
cd "$REPO_ROOT"
bun run scripts/timeline-validate.ts "$TIMELINE" 2>&1 | tee "$CAPDIR/validate.txt"

log ""
log "── Dry run ─────────────────────────────"
bun run scripts/timeline-dry-run.ts "$TIMELINE" 2>&1 | tee "$CAPDIR/dry-run.txt"

# ── capture pass ────────────────────────────────────────────────────────────

log ""
log "── Capture pass ────────────────────────"
clear_desktop
screenshot "00-baseline" "clean desktop, agent window only"

python3 "$SCRIPT_DIR/fire-cues.py" \
  "$REPO_ROOT/$TIMELINE" "$API" "$CAPDIR" "$REPAINT_WAIT" "$DISPLAY_NUM" "$TMUX_SESSION"

screenshot "99-final" "desktop after all cues"

# ── timed run + review ──────────────────────────────────────────────────────

log ""
log "── Timed run + review ──────────────────"
clear_desktop
bun run scripts/timeline-capture.ts "$TIMELINE" --no-audio 2>&1 | tee "$CAPDIR/timed-capture.txt"
TLDIR=$(ls -td "$REPO_ROOT/scratch/timeline-captures"/*/ 2>/dev/null | head -1)
if [ -n "$TLDIR" ]; then
  bun run scripts/timeline-review.ts "$TLDIR" 2>&1 | tee "$CAPDIR/review.txt"
fi

# ── summary ─────────────────────────────────────────────────────────────────

log ""
log "══════════════════════════════════════════"
log "All captures: $CAPDIR"
log ""
log "PNGs:"
ls -1 "$CAPDIR"/*.png 2>/dev/null | sed 's|.*/||' | sed 's/^/  /'
log ""
log "Review:"
grep -E "^  (✓|✗|⚠|Issues|Cues)" "$CAPDIR/review.txt" 2>/dev/null | sed 's/^/  /' || true
