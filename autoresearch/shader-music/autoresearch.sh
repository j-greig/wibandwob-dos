#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(pwd)"
DIR="$REPO_ROOT/autoresearch/shader-music"

GENRE="${GENRE:-lofi_hiphop}"
export GENRE

echo "=== Running shader → chiptune pipeline (genre: $GENRE) ==="
cd "$DIR"
REPO_ROOT="$REPO_ROOT" uv run shader_to_chiptune.py

echo ""
echo "=== Scoring output ==="
uv run score_music.py

echo ""
echo "=== Checking output file ==="
if [ -f output.wav ]; then
    SIZE=$(stat -f%z output.wav 2>/dev/null || stat --printf="%s" output.wav 2>/dev/null)
    echo "output.wav: ${SIZE} bytes"
    uv run -q - <<'PYEOF'
import scipy.io.wavfile as wf
sr, d = wf.read("output.wav")
print(f"Duration: {len(d)/sr:.1f}s, Sample rate: {sr}Hz")
PYEOF
else
    echo "ERROR: No output.wav generated"
    exit 1
fi
