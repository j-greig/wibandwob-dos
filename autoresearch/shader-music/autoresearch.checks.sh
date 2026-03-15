#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== output.wav exists ==="
test -f "$DIR/output.wav" || { echo "FAIL: no output.wav"; exit 1; }
echo "OK"

echo "=== shader_data.json exists ==="
test -f "$DIR/shader_data.json" || { echo "FAIL: no shader_data.json"; exit 1; }
echo "OK"

echo "=== output.wav is valid audio ==="
uv run -q - <<PYEOF
import scipy.io.wavfile as wf
sr, d = wf.read("$DIR/output.wav")
assert sr > 0, "Bad sample rate"
assert len(d) > sr, "Audio too short (< 1s)"
print(f"OK: {len(d)/sr:.1f}s at {sr}Hz")
PYEOF

echo "=== score parses ==="
cd "$DIR"
SCORE_LINE=$(uv run score_music.py 2>/dev/null | grep "^SCORE:" | tail -1)
SCORE=$(echo "$SCORE_LINE" | sed 's/SCORE: //')
echo "Score: $SCORE"
# Fail if score is 0 (means something is broken)
python3 -c "assert float('$SCORE') > 0, 'Score is zero — broken pipeline'"
echo "OK"

echo "=== all checks passed ==="
