#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API="${WIBWOB_API:-http://127.0.0.1:8099}"
SESSION="${TMUX_SESSION:-wibwob-a2}"
SCENE_NAME="${1:-dense-12-animated}"
OUTDIR="$ROOT/scratch/captures/${SCENE_NAME}-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUTDIR"

log() { printf '[s07] %s\n' "$*"; }

api_post() {
  local path="$1"
  local body="$2"
  curl -sf -X POST "$API$path" -H 'Content-Type: application/json' -d "$body"
}

api_get() {
  curl -sf "$API$1"
}

wait_for_health() {
  for _ in $(seq 1 30); do
    if api_get /health > "$OUTDIR/health.json" 2>/dev/null; then
      return 0
    fi
    sleep 1
  done
  log "health check failed"
  return 1
}

capture_text_hash_samples() {
  python3 - "$API" "$OUTDIR/render-samples.json" <<'PY'
import hashlib, json, subprocess, sys, time
api = sys.argv[1]
out = sys.argv[2]
samples = []
for i in range(12):
    text = subprocess.check_output(["curl", "-sf", f"{api}/screenshot/text"], text=True)
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
    samples.append({"index": i, "hash": digest, "chars": len(text), "timestamp": time.time()})
    time.sleep(0.5)
unique = len({s['hash'] for s in samples})
with open(out, 'w') as f:
    json.dump({"samples": samples, "uniqueHashes": unique, "changedFramesObserved": max(0, unique - 1)}, f, indent=2)
print(unique)
PY
}

log "waiting for API"
wait_for_health
api_get /help > "$OUTDIR/help.json"
api_get /openapi.json > "$OUTDIR/openapi.json"
api_get /commands/list > "$OUTDIR/commands-list.json"
api_get /state > "$OUTDIR/state-before.json"

log "clearing desktop"
api_post /commands/run '{"id":"desktop.clear-all","args":{}}' > /dev/null || true
sleep 1

log "opening benchmark scene: $SCENE_NAME"
api_post /commands/run '{"id":"figlet.open","args":{"text":"S07 DENSE"}}' > /dev/null
api_post /commands/run '{"id":"companion.open","args":{}}' > /dev/null
api_post /commands/run '{"id":"art.open","args":{}}' > /dev/null
api_post /commands/run '{"id":"plasma.open","args":{"mood":"deep-space"}}' > /dev/null
api_post /commands/run '{"id":"contour.open","args":{}}' > /dev/null
api_post /commands/run '{"id":"terrain_lab.open","args":{}}' > /dev/null
api_post /commands/run '{"id":"pattern.open","args":{}}' > /dev/null
api_post /commands/run '{"id":"inspector.open","args":{}}' > /dev/null
api_post /commands/run '{"id":"music-player.open","args":{}}' > /dev/null
api_post /commands/run '{"id":"microapp.wibwob.glitchbox.glitchbox.open","args":{}}' > /dev/null
api_post /commands/run '{"id":"microapp.wibwob.heartbeat.open","args":{}}' > /dev/null
api_post /commands/run '{"id":"microapp.wibwob.poetry-clock.open","args":{}}' > /dev/null
api_post /commands/run '{"id":"window.tile","args":{}}' > /dev/null
sleep 3

api_get /state > "$OUTDIR/state-after.json"
python3 - "$OUTDIR/state-after.json" "$OUTDIR/scene-summary.txt" <<'PY'
import json, sys
state_path, out_path = sys.argv[1], sys.argv[2]
with open(state_path) as f:
    state = json.load(f)
windows = state.get('windows', [])
animated_hits = []
for w in windows:
    details = w.get('details') or {}
    title = w.get('title', '')
    app = w.get('appType', '')
    if details.get('animated') or any(key in title.lower() for key in ['plasma', 'contour', 'glitchbox', 'heartbeat', 'music', 'terrain']) or any(key in app.lower() for key in ['generative', 'pattern', 'glitchbox', 'heartbeat', 'poetry', 'terrain', 'music']):
        animated_hits.append(f"{w.get('id')} {title} [{app}]")
with open(out_path, 'w') as out:
    out.write(f"window_count={len(windows)}\n")
    out.write("animated_candidates=\n")
    for line in animated_hits:
        out.write(f"  {line}\n")
PY

log "capturing visual/text artefacts"
bash ./scripts/minimap.sh > "$OUTDIR/minimap.txt" || true
bash ./scripts/overlap-check.sh > "$OUTDIR/overlap-check.txt" || true
bash ./scripts/capture-tui-png.sh "$OUTDIR/desktop.png" > "$OUTDIR/png-path.txt"
tmux capture-pane -pt "$SESSION:0.0" -S -220 > "$OUTDIR/tmux-pane.txt" || true
curl -sf "$API/screenshot/text" > "$OUTDIR/screenshot-text.txt"

log "sampling text-frame churn"
UNIQUE_HASHES="$(capture_text_hash_samples)"

python3 - "$OUTDIR/state-after.json" "$OUTDIR/render-samples.json" "$OUTDIR/REPORT.md" <<'PY'
import json, sys
state_path, samples_path, report_path = sys.argv[1:4]
with open(state_path) as f:
    state = json.load(f)
with open(samples_path) as f:
    samples = json.load(f)
windows = state.get('windows', [])
window_count = len(windows)
changed = samples.get('changedFramesObserved', 0)
unique = samples.get('uniqueHashes', 0)
expectation = "usable if desktop remains responsive, tile layout is legible, and repeated full-screen text captures show >1 distinct frame over 6s"
with open(report_path, 'w') as out:
    out.write("# S07 Dense Scene Smoke\n\n")
    out.write(f"window_count: {window_count}\n")
    out.write(f"unique_fullscreen_text_hashes: {unique}\n")
    out.write(f"changed_frames_observed: {changed}\n\n")
    out.write("## Provisional expectation\n\n")
    out.write(expectation + "\n\n")
    out.write("## Blind spots\n\n")
    out.write("- render-monitor exists in code but is not yet wired into the running shell\n")
    out.write("- this smoke pass uses repeated `/screenshot/text` hashes as external churn evidence, not true shell FPS\n")
    out.write("- memory/RSS is not captured yet\n")
    out.write("- tmux and PNG review are still required for visual truth\n")
PY

log "done"
log "output: $OUTDIR"
log "unique text hashes observed: $UNIQUE_HASHES"
