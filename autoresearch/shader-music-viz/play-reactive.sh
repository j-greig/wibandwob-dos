#!/bin/bash
set -euo pipefail
#
# play-reactive.sh — Audio-reactive shader playback.
#
# Plays a WAV while running FFT analysis that renders frequency bands
# to the terminal. The audio-reactive shader reads those pixels from
# iChannel0 and drives visual effects from the frequency data.
#
# Usage:
#   bash play-reactive.sh <shot-id-or-genre>
#   bash play-reactive.sh <wav-file>
#   bash play-reactive.sh --list
#
# The terminal becomes a live audio visualizer that the shader amplifies.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SHADER_MUSIC_DIR="$SCRIPT_DIR/../shader-music"
SHOTS_DIR="$SHADER_MUSIC_DIR/shots"
MANIFEST="$SHOTS_DIR/manifest.jsonl"
GHOSTTY_SHADER="$REPO_ROOT/scripts/ghostty-shader.sh"
FFT_SCRIPT="$SCRIPT_DIR/fft-datastrip.py"
REACTIVE_SHADER="audio-reactive-overlay"

if [[ "${1:-}" == "--list" ]]; then
    bash "$SCRIPT_DIR/play-shot.sh" --list
    exit 0
fi

QUERY="${1:?Usage: play-reactive.sh <shot-id-or-genre|wav-file> | --list}"

# Resolve WAV file
WAV_PATH=""
if [[ -f "$QUERY" ]]; then
    WAV_PATH="$QUERY"
elif [[ -f "$SHOTS_DIR/$QUERY" ]]; then
    WAV_PATH="$SHOTS_DIR/$QUERY"
else
    # Look up in manifest
    SHOT_LINE=$(python3 -c "
import json, sys
query = '$QUERY'.lower()
with open('$MANIFEST') as f:
    for line in f:
        try:
            d = json.loads(line.strip())
        except: continue
        if d.get('id','').lower() == query or query in d.get('genre','').lower() or query in d.get('shader','').lower():
            print(json.dumps(d))
            sys.exit(0)
print('')
" 2>/dev/null)

    if [[ -z "$SHOT_LINE" ]]; then
        echo "❌ No shot matching '$QUERY'. Try: play-reactive.sh --list"
        exit 1
    fi

    WAV_FILE=$(echo "$SHOT_LINE" | python3 -c "import sys,json; print(json.loads(sys.stdin.read())['file'])")
    WAV_PATH="$SHOTS_DIR/$WAV_FILE"
fi

if [[ ! -f "$WAV_PATH" ]]; then
    echo "❌ WAV not found: $WAV_PATH"
    exit 1
fi

BASENAME=$(basename "$WAV_PATH" .wav)

echo "🎵 Audio-reactive playback: $BASENAME"
echo "   WAV:    $WAV_PATH"
echo "   Shader: $REACTIVE_SHADER"
echo "   FFT:    32 bands @ 30fps → terminal datastrip → iChannel0 → shader"
echo ""

# Activate audio-reactive shader
echo "🔮 Activating shader: $REACTIVE_SHADER"
bash "$GHOSTTY_SHADER" on "$REACTIVE_SHADER" 2>/dev/null || {
    echo "⚠️  Shader activation failed — running FFT visualizer only"
}

# Small delay for shader to load
sleep 0.3

# Start FFT visualizer in background
echo "📊 Starting FFT analyzer..."
python3 "$FFT_SCRIPT" "$WAV_PATH" --both --bands 32 --fps 30 &
FFT_PID=$!

# Small delay for visualizer to init
sleep 0.2

# Play audio (blocks until done)
ffplay -nodisp -autoexit "$WAV_PATH" 2>/dev/null || true

# Cleanup
echo ""
echo "🧹 Cleaning up..."
kill "$FFT_PID" 2>/dev/null || true
wait "$FFT_PID" 2>/dev/null || true

bash "$GHOSTTY_SHADER" off 2>/dev/null || true

echo "✅ Done"
