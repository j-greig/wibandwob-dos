#!/bin/bash
set -euo pipefail
#
# Correctness checks for audio-reactive shader evolution
#

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Shader must exist and contain mainImage
SHADER="$REPO_ROOT/shaders/audio-reactive-overlay.glsl"
if [[ ! -f "$SHADER" ]]; then
    echo "FAIL: shader missing: $SHADER"
    exit 1
fi

if ! grep -q "void mainImage" "$SHADER"; then
    echo "FAIL: shader missing mainImage function"
    exit 1
fi

# Shader must read from iChannel0 (terminal texture)
if ! grep -q "iChannel0" "$SHADER"; then
    echo "FAIL: shader doesn't read iChannel0 (terminal texture)"
    exit 1
fi

# FFT script must exist
if [[ ! -f "$SCRIPT_DIR/../shader-music-viz/fft-datastrip.py" ]]; then
    echo "FAIL: fft-datastrip.py missing"
    exit 1
fi

# Python deps available
python3 -c "import numpy, scipy" 2>/dev/null || {
    echo "FAIL: numpy/scipy not available"
    exit 1
}
