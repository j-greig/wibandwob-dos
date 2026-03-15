#!/bin/bash
set -euo pipefail
#
# Audio-Reactive Shader Evolution — benchmark script
#
# Activates the current shader, runs FFT with a reference WAV,
# captures a screenshot, saves artifacts to runs/NNN/, outputs metrics.
#

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
GHOSTTY_SHADER="$REPO_ROOT/scripts/ghostty-shader.sh"
FFT_SCRIPT="$SCRIPT_DIR/../shader-music-viz/fft-datastrip.py"
SHOTS_DIR="$SCRIPT_DIR/../shader-music/shots"
RUNS_DIR="$SCRIPT_DIR/runs"

# Config
SHADER_NAME="${SHADER_NAME:-audio-reactive-overlay}"
SHADER_PATH="$REPO_ROOT/shaders/${SHADER_NAME}.glsl"
TEST_WAV="${TEST_WAV:-$SHOTS_DIR/021-cathedral.wav}"
FFT_BANDS=32
FFT_FPS=30
CAPTURE_DELAY=4  # seconds to let visuals develop before screenshot

# ── Validate ──────────────────────────────────────────────────────

if [[ ! -f "$SHADER_PATH" ]]; then
    echo "❌ Shader not found: $SHADER_PATH"
    echo "METRIC creative_score=0"
    exit 0
fi

if [[ ! -f "$TEST_WAV" ]]; then
    echo "❌ Test WAV not found: $TEST_WAV"
    echo "METRIC creative_score=0"
    exit 0
fi

# ── Determine run number ─────────────────────────────────────────

mkdir -p "$RUNS_DIR"
LAST_RUN=$(ls -1d "$RUNS_DIR"/[0-9][0-9][0-9] 2>/dev/null | sort -V | tail -1 | xargs basename 2>/dev/null || echo "000")
RUN_NUM=$(printf "%03d" $((10#$LAST_RUN + 1)))
RUN_DIR="$RUNS_DIR/$RUN_NUM"
mkdir -p "$RUN_DIR"

echo "═══ Run $RUN_NUM: $SHADER_NAME ═══"
echo "WAV: $(basename "$TEST_WAV")"
echo "Artifacts: $RUN_DIR/"
echo ""

# ── Save shader source ───────────────────────────────────────────

cp "$SHADER_PATH" "$RUN_DIR/shader.glsl"

# ── Save config ──────────────────────────────────────────────────

cat > "$RUN_DIR/config.json" << EOF
{
  "run": "$RUN_NUM",
  "shader_name": "$SHADER_NAME",
  "shader_path": "$SHADER_PATH",
  "wav": "$(basename "$TEST_WAV")",
  "bands": $FFT_BANDS,
  "fps": $FFT_FPS,
  "capture_delay": $CAPTURE_DELAY,
  "timestamp": "$(date -Iseconds)"
}
EOF

# ── Activate shader ──────────────────────────────────────────────

echo "🔮 Activating shader: $SHADER_NAME"
bash "$GHOSTTY_SHADER" on "$SHADER_NAME" 2>/dev/null || {
    echo "⚠️  Shader activation failed"
    echo "METRIC creative_score=0"
    exit 0
}
sleep 0.5

# ── Start FFT + audio ────────────────────────────────────────────

echo "📊 Starting FFT analyzer + audio..."

# FFT visualizer (renders to terminal for shader to read)
python3 "$FFT_SCRIPT" "$TEST_WAV" --both --bands "$FFT_BANDS" --fps "$FFT_FPS" &
FFT_PID=$!

sleep 0.3

# Audio playback
ffplay -nodisp -autoexit "$TEST_WAV" &>/dev/null &
AUDIO_PID=$!

# ── Wait for visual state to develop ─────────────────────────────

echo "⏳ Waiting ${CAPTURE_DELAY}s for visuals to develop..."
sleep "$CAPTURE_DELAY"

# ── Capture FFT snapshot ─────────────────────────────────────────

# Read current FFT state by sampling the WAV at current position
python3 -c "
import json, numpy as np
from scipy.io import wavfile
from scipy.fft import rfft

sr, data = wavfile.read('$TEST_WAV')
if data.dtype != np.float64:
    data = data.astype(np.float64) / np.iinfo(data.dtype).max

# Sample at capture_delay position
idx = int($CAPTURE_DELAY * sr)
chunk_size = sr // $FFT_FPS
chunk = data[idx:idx+chunk_size]
if len(chunk.shape) > 1:
    chunk = chunk.mean(axis=1)

window = np.hanning(len(chunk))
spectrum = np.abs(rfft(chunk * window))
freqs = np.fft.rfftfreq(len(chunk), 1.0/sr)

band_edges = np.logspace(np.log10(30), np.log10(min(16000, sr/2)), $FFT_BANDS+1)
energies = []
for i in range($FFT_BANDS):
    mask = (freqs >= band_edges[i]) & (freqs < band_edges[i+1])
    energies.append(float(np.mean(spectrum[mask]**2)) if mask.any() else 0.0)

mx = max(energies) if max(energies) > 0 else 1.0
energies = [round(np.sqrt(e/mx), 3) for e in energies]

snapshot = {
    'band_energies': energies,
    'peak_band': int(np.argmax(energies)),
    'total_energy': round(sum(energies) / len(energies), 3),
    'bass_energy': round(sum(energies[:8]) / 8, 3),
    'mid_energy': round(sum(energies[8:20]) / 12, 3),
    'treble_energy': round(sum(energies[20:]) / 12, 3),
    'dynamic_range': round(max(energies) - min(energies), 3),
}
with open('$RUN_DIR/fft-snapshot.json', 'w') as f:
    json.dump(snapshot, f, indent=2)
print(json.dumps(snapshot))
" 2>/dev/null || echo '{"error": "fft snapshot failed"}'

# ── Capture screenshot ───────────────────────────────────────────

# ── Capture screenshot (Ghostty front window) ────────────────────

echo "📸 Capturing Ghostty window screenshot..."
# Bring Ghostty to front, get front window bounds, capture that region
osascript -e 'tell application "Ghostty" to activate' 2>/dev/null
sleep 0.3
BOUNDS=$(osascript -e '
tell application "System Events"
    tell process "Ghostty"
        set frontWin to front window
        set {x, y} to position of frontWin
        set {w, h} to size of frontWin
        return "" & x & "," & y & "," & w & "," & h
    end tell
end tell
' 2>/dev/null) && {
    screencapture -x -R "$BOUNDS" "$RUN_DIR/screenshot.png" 2>/dev/null
} || {
    screencapture -x "$RUN_DIR/screenshot.png" 2>/dev/null
    echo "⚠️  Fell back to full-screen capture"
}

# ── Cleanup ──────────────────────────────────────────────────────

echo "🧹 Stopping audio + FFT..."
kill "$AUDIO_PID" 2>/dev/null || true
kill "$FFT_PID" 2>/dev/null || true
wait "$AUDIO_PID" 2>/dev/null || true
wait "$FFT_PID" 2>/dev/null || true

bash "$GHOSTTY_SHADER" off 2>/dev/null || true

# ── Technical metrics (from FFT snapshot) ────────────────────────

# Read FFT snapshot for technical scoring
TECH_METRICS=$(python3 -c "
import json
try:
    with open('$RUN_DIR/fft-snapshot.json') as f:
        snap = json.load(f)
    
    # Dynamic range: how much variation in frequency response
    dr = snap.get('dynamic_range', 0)
    dr_score = min(10, dr * 12)  # scale up
    
    # Band coverage: non-zero bands
    energies = snap.get('band_energies', [])
    active = sum(1 for e in energies if e > 0.1)
    coverage = min(10, active / len(energies) * 10) if energies else 0
    
    # Bass/mid/treble balance
    b = snap.get('bass_energy', 0)
    m = snap.get('mid_energy', 0)
    t = snap.get('treble_energy', 0)
    
    print(f'dr_score={dr_score:.1f}')
    print(f'coverage={coverage:.1f}')
    print(f'bass={b:.3f}')
    print(f'mid={m:.3f}')
    print(f'treble={t:.3f}')
    print(f'total={snap.get(\"total_energy\", 0):.3f}')
except Exception as e:
    print(f'dr_score=0')
    print(f'coverage=0')
" 2>/dev/null)

# Parse tech metrics
DR_SCORE=$(echo "$TECH_METRICS" | grep "dr_score" | cut -d= -f2)
COVERAGE=$(echo "$TECH_METRICS" | grep "coverage" | cut -d= -f2)

# ── Output metrics ───────────────────────────────────────────────

echo ""
echo "═══ Run $RUN_NUM complete ═══"
echo "Artifacts saved to: $RUN_DIR/"
echo "Files: $(ls -1 "$RUN_DIR/" | tr '\n' ' ')"
echo ""
echo "Technical metrics:"
echo "$TECH_METRICS"
echo ""

# Screenshot exists = agent can score creatively via Read tool
if [[ -f "$RUN_DIR/screenshot.png" ]]; then
    echo "📸 Screenshot saved: $RUN_DIR/screenshot.png"
    echo "   (Score creatively via the Read tool)"
fi

# Output metrics for autoresearch
# creative_score is set by the agent after viewing the screenshot
# For now output technical metrics; agent overrides creative_score
echo ""
echo "METRIC creative_score=5.0"
echo "METRIC responsiveness=5.0"
echo "METRIC readability=5.0"
echo "METRIC band_coverage=${COVERAGE:-5.0}"
echo "METRIC dynamic_range=${DR_SCORE:-5.0}"
