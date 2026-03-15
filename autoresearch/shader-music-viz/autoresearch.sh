#!/bin/bash
set -euo pipefail
#
# Shader Music Viz — benchmark script
# Tests: overlay generation, manifest lookup, shader GLSL validity
#

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

score=0
total=0

check() {
    total=$((total + 1))
    if ( set +o pipefail; eval "$2" ) > /dev/null 2>&1; then
        score=$((score + 1))
    else
        echo "FAIL: $1"
    fi
}

# P0 checks
check "make-overlay.py exists" "test -f $SCRIPT_DIR/make-overlay.py"
check "play-shot.sh exists" "test -f $SCRIPT_DIR/play-shot.sh"
check "manifest.jsonl exists" "test -f $SCRIPT_DIR/../shader-music/shots/manifest.jsonl"
check "overlay generation works" "python3 $SCRIPT_DIR/make-overlay.py $SCRIPT_DIR/../shader-music/cathedral.glsl /tmp/test-overlay.glsl"
check "overlay has mainImage" "grep -q 'void mainImage' /tmp/test-overlay.glsl"
check "overlay has _musicPattern" "grep -q '_musicPattern' /tmp/test-overlay.glsl"
check "overlay has iChannel0" "grep -q 'iChannel0' /tmp/test-overlay.glsl"
check "overlay has luminance blend" "grep -q 'textMask' /tmp/test-overlay.glsl"
check "play-shot --list works" "bash $SCRIPT_DIR/play-shot.sh --list 2>/dev/null | grep -q cathedral"
check "at least 10 overlays generated" "test $(ls $REPO_ROOT/shaders/*-overlay.glsl 2>/dev/null | wc -l) -ge 10"

# Cleanup
rm -f /tmp/test-overlay.glsl

quality=$(echo "scale=1; $score * 10 / $total" | bc)
echo "METRIC quality_score=$quality"
echo "METRIC checks_passed=$score"
echo "METRIC checks_total=$total"
