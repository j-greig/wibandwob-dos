#!/bin/bash
set -euo pipefail
#
# play-shot.sh — Play a shader-music shot with synchronized Ghostty overlay.
#
# Usage:
#   bash play-shot.sh <shot-id-or-genre>   # e.g. "001" or "cathedral"
#   bash play-shot.sh --list               # show available shots
#
# Looks up the shot in manifest.jsonl, activates the matching overlay shader,
# plays the WAV, then deactivates the shader on finish.
#
# Requires: Ghostty 1.3+, ffplay, jq

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SHADER_MUSIC_DIR="$SCRIPT_DIR/../shader-music"
SHOTS_DIR="$SHADER_MUSIC_DIR/shots"
MANIFEST="$SHOTS_DIR/manifest.jsonl"
GHOSTTY_SHADER="$REPO_ROOT/scripts/ghostty-shader.sh"

if [[ ! -f "$MANIFEST" ]]; then
    echo "❌ Manifest not found: $MANIFEST"
    exit 1
fi

if [[ "${1:-}" == "--list" ]]; then
    echo "Available shots:"
    while IFS= read -r line; do
        id=$(echo "$line" | python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(f\"  {d.get('id','?'):>3}  {d.get('genre','?'):<20} {d.get('file','?'):<35} shader={d.get('shader','?')}\")" 2>/dev/null)
        echo "$id"
    done < "$MANIFEST"
    exit 0
fi

QUERY="${1:?Usage: play-shot.sh <shot-id-or-genre> | --list}"

# Look up shot: try by ID first, then by genre
SHOT_LINE=$(python3 -c "
import json, sys
query = '$QUERY'.lower()
with open('$MANIFEST') as f:
    for line in f:
        try:
            d = json.loads(line.strip())
        except: continue
        # Match by ID (exact) or genre (substring)
        if d.get('id','').lower() == query or query in d.get('genre','').lower() or query in d.get('shader','').lower():
            print(json.dumps(d))
            sys.exit(0)
print('')
" 2>/dev/null)

if [[ -z "$SHOT_LINE" ]]; then
    echo "❌ No shot matching '$QUERY'. Try: play-shot.sh --list"
    exit 1
fi

WAV_FILE=$(echo "$SHOT_LINE" | python3 -c "import sys,json; print(json.loads(sys.stdin.read())['file'])")
SHADER_NAME=$(echo "$SHOT_LINE" | python3 -c "import sys,json; print(json.loads(sys.stdin.read())['shader'])")
GENRE=$(echo "$SHOT_LINE" | python3 -c "import sys,json; print(json.loads(sys.stdin.read()).get('genre','unknown'))")
SHOT_ID=$(echo "$SHOT_LINE" | python3 -c "import sys,json; print(json.loads(sys.stdin.read())['id'])")

WAV_PATH="$SHOTS_DIR/$WAV_FILE"
if [[ ! -f "$WAV_PATH" ]]; then
    echo "❌ WAV not found: $WAV_PATH"
    exit 1
fi

# Derive overlay name from shader filename (basename only, strip subdirs)
SHADER_BASE=$(basename "$SHADER_NAME" .glsl)
OVERLAY_NAME="${SHADER_BASE}-overlay"
OVERLAY_PATH="$REPO_ROOT/shaders/${OVERLAY_NAME}.glsl"

# Resolve source shader path (may be in shader-music/ or a subdir like ghostty-shaders/)
SHADER_SOURCE="$SHADER_MUSIC_DIR/$SHADER_NAME"

# Generate overlay if it doesn't exist
if [[ ! -f "$OVERLAY_PATH" ]]; then
    if [[ ! -f "$SHADER_SOURCE" ]]; then
        echo "⚠️  Source shader not found: $SHADER_SOURCE — playing audio only"
        ffplay -nodisp -autoexit "$WAV_PATH" 2>/dev/null
        exit 0
    fi
    echo "⚙️  Generating overlay for $SHADER_NAME..."
    python3 "$SCRIPT_DIR/make-overlay.py" "$SHADER_SOURCE" "$OVERLAY_PATH"
fi

echo "🎵 Shot #$SHOT_ID: $GENRE"
echo "   Shader: $SHADER_NAME → $OVERLAY_NAME"
echo "   Audio:  $WAV_FILE"
echo ""

# Activate shader overlay
echo "🔮 Activating Ghostty shader: $OVERLAY_NAME"
bash "$GHOSTTY_SHADER" on "$OVERLAY_NAME" 2>/dev/null || {
    echo "⚠️  Shader activation failed — playing audio only"
}

# Play audio (blocks until done)
echo "▶️  Playing..."
ffplay -nodisp -autoexit "$WAV_PATH" 2>/dev/null || true

# Deactivate shader
echo "🔮 Deactivating shader"
bash "$GHOSTTY_SHADER" off 2>/dev/null || true

echo "✅ Done"
