#!/usr/bin/env bash
set -euo pipefail
# replay-scpt.sh — Replay a .scpt.md ASCII cinema script against live WibWob-DOS
#
# Single-timeline pipeline:
#   1. Parse .scpt.md → extract voice lines + SFX + commands
#   2. Render voice audio via macOS `say` → MP3 + .timecodes
#   3. Render SFX cues at timecode positions → mixed audio track
#   4. Replay [cmd:] actions against live TUI timed to timecodes
#   5. Capture frames via /screenshot/ansi at each [frame:] marker
#   6. Export frames + audio → MP4
#
# Usage:
#   bash scripts/replay-scpt.sh script.scpt.md
#   bash scripts/replay-scpt.sh script.scpt.md --dry-run    # parse only, show timeline
#   bash scripts/replay-scpt.sh script.scpt.md --audio-only  # render audio, skip replay
#
# Requires: running WibWob-DOS on localhost, macOS `say`, ffmpeg, agg

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/.." && pwd)"

SCPT="${1:?Usage: replay-scpt.sh <script.scpt.md> [--dry-run|--audio-only]}"
MODE="${2:-full}"

# Output dir
TS=$(date +%s)
OUT_DIR="$REPO/scratch/recordings/scpt-$TS"
mkdir -p "$OUT_DIR/frames" "$OUT_DIR/voice"

WW_API="${WW_API:-http://127.0.0.1:8099}"
W="bun run $REPO/src/cli/wibwob.ts"
SMEAR="python3 $REPO/.pi/skills/vj-timeline/scripts/smear.py"

# ── Phase 1: Parse .scpt.md ──────────────────────────────────────────

PARSE_SCPT="$SCPT" PARSE_OUT="$OUT_DIR" python3 << 'PYEOF'
import sys, json, re, os

scpt_path = os.environ["PARSE_SCPT"]
out_dir = os.environ["PARSE_OUT"]

with open(scpt_path) as f:
    text = f.read()

# Split @config and @content
config_text = ""
content_text = ""
if "@config" in text and "@content" in text:
    parts = text.split("@content", 1)
    config_text = parts[0].split("@config", 1)[1]
    content_text = parts[1]
else:
    content_text = text

# Parse config
config = {
    "rate": 170,
    "pause": 0.3,
    "scene_gap": 0.6,
    "voices": {},
    "sfx_dir": "",
    "jgs_dir": "",
    "ww_dir": "",
}
for line in config_text.strip().split("\n"):
    line = line.strip()
    if not line or line.startswith("#"):
        continue
    if "=" in line:
        key, val = line.split("=", 1)
        key = key.strip()
        val = val.strip()
        if key == "rate":
            config["rate"] = int(val)
        elif key == "pause":
            config["pause"] = float(val)
        elif key == "scene_gap":
            config["scene_gap"] = float(val)
        elif key == "sfx_dir":
            config["sfx_dir"] = val
        elif key == "jgs_dir":
            config["jgs_dir"] = val
        elif key == "ww_dir":
            config["ww_dir"] = val
        elif key == "dividers":
            pass  # ignored for ASCII cinema
        else:
            # Speaker = Voice mapping
            config["voices"][key] = val

# Parse content into timeline events
events = []  # [{type, data, scene_idx}]
scene_idx = 0

for line in content_text.strip().split("\n"):
    line = line.strip()
    if not line or line.startswith("#"):
        continue

    if line == "---":
        events.append({"type": "scene_gap", "duration": config["scene_gap"], "scene": scene_idx})
        scene_idx += 1
        continue

    # [frame: name]
    m = re.match(r'\[frame:\s*(.+?)\]', line)
    if m:
        events.append({"type": "frame", "name": m.group(1).strip(), "scene": scene_idx})
        continue

    # [cmd: ...]
    m = re.match(r'\[cmd:\s*(.+?)\]', line)
    if m:
        events.append({"type": "cmd", "command": m.group(1).strip(), "scene": scene_idx})
        continue

    # [sfx: file.wav]
    m = re.match(r'\[sfx:\s*(.+?)\]', line)
    if m:
        events.append({"type": "sfx", "file": m.group(1).strip(), "scene": scene_idx})
        continue

    # [theme: name]
    m = re.match(r'\[theme:\s*(.+?)\]', line)
    if m:
        events.append({"type": "cmd", "command": f"theme.set --name {m.group(1).strip()}", "scene": scene_idx})
        continue

    # [batch: {...}]
    m = re.match(r'\[batch:\s*(.+?)\]', line)
    if m:
        events.append({"type": "batch", "json": m.group(1).strip(), "scene": scene_idx})
        continue

    # [smear: ...]
    m = re.match(r'\[smear:\s*(.+?)\]', line)
    if m:
        events.append({"type": "smear", "args": m.group(1).strip(), "scene": scene_idx})
        continue

    # [capture]
    if line == "[capture]":
        events.append({"type": "capture", "scene": scene_idx})
        continue

    # Speaker line: wob: text [modifiers]
    m = re.match(r'(\w+):\s*(.+)', line)
    if m:
        speaker = m.group(1)
        text = m.group(2)

        # Extract inline modifiers
        voice_override = None
        rate_override = None
        pad_override = None

        vm = re.search(r'\[V:([^\]]+)\]', text)
        if vm:
            voice_override = vm.group(1)
            text = text.replace(vm.group(0), "").strip()

        rm = re.search(r'\[R:(\d+)\]', text)
        if rm:
            rate_override = int(rm.group(1))
            text = text.replace(rm.group(0), "").strip()

        if "[FAST]" in text:
            rate_override = config["rate"] + 30
            text = text.replace("[FAST]", "").strip()

        if "[SLOW]" in text:
            rate_override = config["rate"] - 30
            text = text.replace("[SLOW]", "").strip()

        pm = re.search(r'\[pad:([0-9.]+)\]', text)
        if pm:
            pad_override = float(pm.group(1))
            text = text.replace(pm.group(0), "").strip()

        voice = voice_override or config["voices"].get(speaker, "Samantha")
        rate = rate_override or config["rate"]

        events.append({
            "type": "voice",
            "speaker": speaker,
            "text": text,
            "voice": voice,
            "rate": rate,
            "pad": pad_override,
            "scene": scene_idx,
        })
        continue

# Write parsed timeline
with open(os.path.join(out_dir, "timeline.json"), "w") as f:
    json.dump({"config": config, "events": events}, f, indent=2)

print(f"Parsed {len(events)} events across {scene_idx + 1} scenes")
PYEOF

echo "═══ REPLAY-SCPT: $SCPT ═══"
echo "Output: $OUT_DIR"

# ── Phase 2: Render voice audio + compute timecodes ──────────────────

RENDER_OUT="$OUT_DIR" python3 << 'PYEOF'
import json, subprocess, os, sys

out_dir = os.environ["RENDER_OUT"]

with open(os.path.join(out_dir, "timeline.json")) as f:
    data = json.load(f)

config = data["config"]
events = data["events"]

voice_dir = os.path.join(out_dir, "voice")
os.makedirs(voice_dir, exist_ok=True)

# Render each voice line to AIFF, measure duration
voice_segments = []  # [(event_idx, wav_path, duration)]
seg_idx = 0

for i, ev in enumerate(events):
    if ev["type"] != "voice":
        continue

    aiff_path = os.path.join(voice_dir, f"seg-{seg_idx:03d}.aiff")
    wav_path = os.path.join(voice_dir, f"seg-{seg_idx:03d}.wav")

    # Render via say
    subprocess.run([
        "say", "-v", ev["voice"], "-r", str(ev["rate"]),
        "-o", aiff_path, ev["text"]
    ], check=True)

    # Convert to WAV
    subprocess.run([
        "ffmpeg", "-y", "-i", aiff_path, wav_path
    ], capture_output=True, check=True)
    os.remove(aiff_path)

    # Measure duration
    result = subprocess.run(
        ["ffprobe", "-v", "quiet", "-show_entries", "format=duration", wav_path],
        capture_output=True, text=True
    )
    dur = float([l for l in result.stdout.split("\n") if "duration" in l][0].split("=")[1])

    # Apply padding if specified
    if ev.get("pad") and ev["pad"] > dur:
        dur = ev["pad"]

    voice_segments.append((i, wav_path, dur))
    seg_idx += 1

# Now walk the timeline and assign absolute timestamps to every event.
# Voice lines take time. Other events are instantaneous (placed at current time).
# Scene gaps insert silence.
timeline = []  # [(timestamp, event)]
t = 0.0

voice_lookup = {seg[0]: seg for seg in voice_segments}  # event_idx → (idx, path, dur)

for i, ev in enumerate(events):
    if ev["type"] == "scene_gap":
        t += ev["duration"]
        continue

    timeline.append((t, ev))

    if ev["type"] == "voice" and i in voice_lookup:
        _, _, dur = voice_lookup[i]
        t += dur

# Write timed timeline
timed = []
for ts, ev in timeline:
    entry = {"t": round(ts, 3)}
    entry.update(ev)
    timed.append(entry)

with open(os.path.join(out_dir, "timed-timeline.json"), "w") as f:
    json.dump(timed, f, indent=2)

# Write timecodes (one per [frame:] marker)
timecodes = [(e["t"], e["name"]) for e in timed if e["type"] == "frame"]
with open(os.path.join(out_dir, "timecodes.txt"), "w") as f:
    for ts, name in timecodes:
        f.write(f"{ts:.6f}\t{name}\n")

# Concatenate voice segments with correct timing into single audio
# We'll write a concat manifest with silence gaps
concat_entries = []
prev_end = 0.0

for i, ev in enumerate(events):
    if ev["type"] == "voice" and i in voice_lookup:
        idx, wav_path, dur = voice_lookup[i]
        # Find this event's timestamp
        ev_ts = None
        for ts, tev in timeline:
            if tev is ev:
                ev_ts = ts
                break
        if ev_ts is None:
            continue

        # Insert silence if there's a gap
        gap = ev_ts - prev_end
        if gap > 0.01:
            silence_path = os.path.join(voice_dir, f"silence-{idx:03d}.wav")
            subprocess.run([
                "ffmpeg", "-y", "-f", "lavfi", "-i",
                f"anullsrc=r=22050:cl=mono", "-t", str(gap),
                "-acodec", "pcm_s16le", silence_path
            ], capture_output=True, check=True)
            concat_entries.append(silence_path)

        concat_entries.append(wav_path)
        prev_end = ev_ts + dur

# Write concat list
concat_list = os.path.join(voice_dir, "concat.txt")
with open(concat_list, "w") as f:
    for p in concat_entries:
        f.write(f"file '{os.path.abspath(p)}'\n")

# Concatenate
voice_mp3 = os.path.join(out_dir, "voice.mp3")
if concat_entries:
    subprocess.run([
        "ffmpeg", "-y", "-f", "concat", "-safe", "0",
        "-i", concat_list, "-acodec", "libmp3lame", "-q:a", "2",
        voice_mp3
    ], capture_output=True, check=True)
    print(f"Voice audio: {voice_mp3}")
else:
    print("No voice lines found")

# Write SFX cues for mixing
sfx_cues = [(e["t"], e["file"]) for e in timed if e["type"] == "sfx"]
cues_path = os.path.join(out_dir, "sfx-cues.tsv")
sfx_dir = config.get("sfx_dir", "")
with open(cues_path, "w") as f:
    for ts, filename in sfx_cues:
        ms = int(ts * 1000)
        path = os.path.join(sfx_dir, filename) if sfx_dir else filename
        f.write(f"{ms}\t{path}\n")

print(f"SFX cues: {len(sfx_cues)} → {cues_path}")
print(f"Timecodes: {len(timecodes)} frames")
print(f"Total timeline: {t:.1f}s")
PYEOF

if [ "$MODE" = "--dry-run" ]; then
    echo ""
    echo "=== TIMED TIMELINE ==="
    python3 -c "
import json
with open('$OUT_DIR/timed-timeline.json') as f:
    for e in json.load(f):
        t = e['t']
        typ = e['type']
        if typ == 'voice':
            print(f'  {t:7.3f}s  {typ:8s}  {e[\"speaker\"]}: {e[\"text\"]}  [{e[\"voice\"]}]')
        elif typ == 'cmd':
            print(f'  {t:7.3f}s  {typ:8s}  {e[\"command\"]}')
        elif typ == 'sfx':
            print(f'  {t:7.3f}s  {typ:8s}  {e[\"file\"]}')
        elif typ == 'frame':
            print(f'  {t:7.3f}s  {typ:8s}  ── {e[\"name\"]} ──')
        elif typ == 'batch':
            print(f'  {t:7.3f}s  {typ:8s}  (batch position)')
        elif typ == 'smear':
            print(f'  {t:7.3f}s  {typ:8s}  {e[\"args\"]}')
        elif typ == 'capture':
            print(f'  {t:7.3f}s  {typ:8s}  📸')
"
    echo ""
    echo "Dry run complete. No replay performed."
    exit 0
fi

# ── Phase 3: Mix SFX into voice track ────────────────────────────────

SFX_MP3="$OUT_DIR/sfx-mix.mp3"
if [ -s "$OUT_DIR/sfx-cues.tsv" ]; then
    echo "Mixing SFX cues..."
    cd "$REPO" && uv run scratch/cli-experiments/mix-sfx-track.py "$OUT_DIR/sfx-cues.tsv" "$SFX_MP3"
fi

# Merge voice + SFX into final audio
FINAL_AUDIO="$OUT_DIR/audio.mp3"
if [ -f "$OUT_DIR/voice.mp3" ] && [ -f "$SFX_MP3" ]; then
    echo "Merging voice + SFX..."
    ffmpeg -y -i "$OUT_DIR/voice.mp3" -i "$SFX_MP3" \
        -filter_complex "[0:a]volume=1.0[v];[1:a]volume=0.7[s];[v][s]amix=inputs=2:duration=longest" \
        -acodec libmp3lame -q:a 2 "$FINAL_AUDIO" 2>/dev/null
elif [ -f "$OUT_DIR/voice.mp3" ]; then
    cp "$OUT_DIR/voice.mp3" "$FINAL_AUDIO"
elif [ -f "$SFX_MP3" ]; then
    cp "$SFX_MP3" "$FINAL_AUDIO"
fi
echo "Final audio: $FINAL_AUDIO"

if [ "$MODE" = "--audio-only" ]; then
    echo "Audio-only mode. Skipping replay."
    exit 0
fi

# ── Phase 4: Replay commands against live TUI ─────────────────────────

echo ""
echo "Replaying against live TUI..."

CAST="$OUT_DIR/recording.cast"
PANE_W=$(curl -s "$WW_API/state" | python3 -c "import sys,json; s=json.load(sys.stdin); print(s['app']['cols'])" 2>/dev/null || echo 101)
PANE_H=$(curl -s "$WW_API/state" | python3 -c "import sys,json; s=json.load(sys.stdin); print(s['app']['rows'])" 2>/dev/null || echo 73)
echo "{\"version\":2,\"width\":$PANE_W,\"height\":$PANE_H,\"timestamp\":$(date +%s)}" > "$CAST"

LAST_CAPTURE="$OUT_DIR/last-capture.txt"
FRAME_IDX=0

REPLAY_OUT="$OUT_DIR" REPLAY_API="$WW_API" REPLAY_REPO="$REPO" REPLAY_CAST="$CAST" python3 << 'PYEOF'
import json, subprocess, time, urllib.request, os, sys, re

out_dir = os.environ["REPLAY_OUT"]
api = os.environ["REPLAY_API"]
repo = os.environ["REPLAY_REPO"]
cast_path = os.environ["REPLAY_CAST"]

with open(os.path.join(out_dir, "timed-timeline.json")) as f:
    timeline = json.load(f)

with open(os.path.join(out_dir, "timeline.json")) as f:
    config = json.load(f)["config"]

sfx_dir = config.get("sfx_dir", "")
jgs_dir = config.get("jgs_dir", "")
ww_dir = config.get("ww_dir", "")

def resolve_path(p):
    """Resolve dir placeholders in paths."""
    p = p.replace("jgs_dir/", jgs_dir + "/" if jgs_dir else "")
    p = p.replace("ww_dir/", ww_dir + "/" if ww_dir else "")
    if not os.path.isabs(p):
        p = os.path.join(repo, p)
    return p

def api_post(endpoint, body=None):
    data = json.dumps(body).encode() if body else b"{}"
    req = urllib.request.Request(
        f"{api}{endpoint}",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return json.loads(r.read())
    except Exception as e:
        print(f"  API error: {e}")
        return {"ok": False}

def api_get(endpoint):
    try:
        with urllib.request.urlopen(f"{api}{endpoint}", timeout=5) as r:
            return r.read().decode("utf-8", errors="replace")
    except:
        return ""

def api_get_json(endpoint):
    try:
        with urllib.request.urlopen(f"{api}{endpoint}", timeout=5) as r:
            raw = r.read().decode("utf-8", errors="replace")
            return json.loads(raw)
    except Exception as e:
        print(f"  JSON parse error on {endpoint}: {e}")
        return {}

def capture_frame(cast_file, timestamp):
    """Capture current TUI state as a cast frame."""
    frame = api_get("/screenshot/ansi")
    if not frame:
        return
    lines = frame.split("\n")
    output = "\x1b[2J\x1b[H"
    for i, line in enumerate(lines):
        if i > 0:
            output += f"\x1b[{i+1};1H"
        output += line
    with open(cast_file, "a") as f:
        f.write(json.dumps([timestamp, "o", output]) + "\n")

def run_cmd(command):
    """Execute a wibwob CLI command."""
    parts = command.split()
    cmd_id = parts[0]

    # Parse --key value args
    args = {}
    i = 1
    while i < len(parts):
        if parts[i].startswith("--") and i + 1 < len(parts):
            key = parts[i][2:]
            val = parts[i + 1]
            # Try numeric
            try:
                val = int(val)
            except ValueError:
                try:
                    val = float(val)
                except ValueError:
                    pass
            # Resolve paths
            if key == "filePath":
                if str(val) == "LAST_SMEAR":
                    val = last_capture_path
                else:
                    val = resolve_path(str(val))
            args[key] = val
            i += 2
        else:
            i += 1

    return api_post("/commands/run", {"id": cmd_id, "args": args})

last_capture_path = os.path.join(out_dir, "last-capture.txt")
frame_idx = 0

# Walk timeline in real-time
start = time.time()

for ev in timeline:
    target_t = ev["t"]

    # Wait until the right time
    elapsed = time.time() - start
    if target_t > elapsed:
        time.sleep(target_t - elapsed)

    elapsed = time.time() - start
    typ = ev["type"]

    if typ == "frame":
        print(f"  [{elapsed:6.1f}s] ── {ev['name']} ──")
        capture_frame(cast_path, elapsed)
        # Save screenshot for smear operations
        text = api_get("/screenshot/text")
        with open(last_capture_path, "w") as f:
            f.write(text)
        # Save named frame
        frame_path = os.path.join(out_dir, "frames", f"frame-{frame_idx:03d}-{ev['name']}.txt")
        with open(frame_path, "w") as f:
            f.write(text)
        frame_idx += 1

    elif typ == "cmd":
        print(f"  [{elapsed:6.1f}s] cmd: {ev['command']}")
        run_cmd(ev["command"])
        time.sleep(0.15)  # let TUI update

    elif typ == "sfx":
        sfx_path = os.path.join(sfx_dir, ev["file"]) if sfx_dir else ev["file"]
        if not os.path.isabs(sfx_path):
            sfx_path = os.path.join(repo, sfx_path)
        subprocess.Popen(["ffplay", "-nodisp", "-autoexit", sfx_path],
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    elif typ == "voice":
        # Voice already in the audio track — just log it
        print(f"  [{elapsed:6.1f}s] 🗣  {ev['speaker']}: {ev['text']}")

    elif typ == "batch":
        batch_json = ev["json"]
        # Resolve FIGLET:N and LAST_FIGLET placeholders
        if "FIGLET:" in batch_json or "LAST_FIGLET" in batch_json:
            try:
                state = api_get_json("/state")
                figlet_ids = [w["id"] for w in state.get("windows", [])
                             if w.get("kind") == "figlet" or
                                (w.get("kind") == "microapp" and "Banner:" in w.get("title", ""))]
                if "LAST_FIGLET" in batch_json and figlet_ids:
                    batch_json = batch_json.replace('"LAST_FIGLET"', str(figlet_ids[-1]))
                def replace_figlet_ref(m):
                    idx = int(m.group(1))
                    if idx < len(figlet_ids):
                        return str(figlet_ids[idx])
                    return m.group(0)
                batch_json = re.sub(r'"FIGLET:(\d+)"', replace_figlet_ref, batch_json)
            except Exception as e:
                print(f"  batch resolve error: {e}")

        try:
            batch_data = json.loads(batch_json)
            req = urllib.request.Request(
                f"{api}/windows/batch",
                data=json.dumps(batch_data).encode(),
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            urllib.request.urlopen(req, timeout=5)
        except Exception as e:
            print(f"  batch error: {e}")
        time.sleep(0.1)

    elif typ == "smear":
        if os.path.exists(last_capture_path):
            smear_out = os.path.join(out_dir, f"smear-{frame_idx:03d}.txt")
            smear_cmd = f"python3 {repo}/.pi/skills/vj-timeline/scripts/smear.py {last_capture_path} {ev['args']} --out {smear_out}"
            subprocess.run(smear_cmd, shell=True, capture_output=True)
            # Update last_capture for next use
            if os.path.exists(smear_out):
                import shutil as _sh
                _sh.copy(smear_out, last_capture_path)
            print(f"  [{elapsed:6.1f}s] smear: {ev['args']}")

    elif typ == "capture":
        capture_frame(cast_path, elapsed)
        print(f"  [{elapsed:6.1f}s] 📸 captured")

# Final capture
elapsed = time.time() - start
capture_frame(cast_path, elapsed)
time.sleep(0.5)
capture_frame(cast_path, elapsed + 0.5)

print(f"\nReplay complete: {elapsed:.1f}s")
PYEOF

# ── Phase 5: Export → GIF → MP4 ──────────────────────────────────────

FRAME_COUNT=$(grep -c '^\[' "$CAST" || echo 0)
echo ""
echo "Cast: $CAST ($FRAME_COUNT frames)"

if [ "$FRAME_COUNT" -gt 1 ]; then
    echo "Rendering GIF..."
    GIF="$OUT_DIR/recording.gif"
    agg "$CAST" "$GIF" --font-size 32 --line-height 1.1 --theme github-dark -q 2>&1

    if [ -f "$FINAL_AUDIO" ]; then
        CAST_DUR=$(tail -1 "$CAST" | python3 -c "import sys,json; print(json.loads(sys.stdin.read())[0])")
        MP4="$OUT_DIR/recording.mp4"
        echo "Compositing MP4 (${CAST_DUR}s)..."
        ffmpeg -y -i "$GIF" -i "$FINAL_AUDIO" \
            -t "$CAST_DUR" \
            -c:v libx264 -pix_fmt yuv420p -crf 23 \
            -c:a aac -b:a 192k \
            -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" \
            -movflags +faststart \
            "$MP4" 2>/dev/null
        echo "→ $MP4"
        ls -lh "$MP4"
        open "$MP4"
    else
        echo "→ $GIF (no audio)"
        open "$GIF"
    fi
else
    echo "Not enough frames to render."
fi

echo ""
echo "═══ REPLAY COMPLETE ═══"
echo "Output: $OUT_DIR"
