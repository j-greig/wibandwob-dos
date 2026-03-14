#!/usr/bin/env bash
set -euo pipefail

# Visual checkpoint — compare current renderer output against reference frame
# Usage: visual-checkpoint.sh <phase> [reference-frame]
#
# Captures a PNG of the running asciicker window, then asks Claude to
# compare it against a reference frame with phase-specific yes/no questions.
# Returns exit 0 if all checks pass, exit 1 if any fail.

PHASE="${1:?Usage: visual-checkpoint.sh <phase> [reference-frame]}"
REF_FRAME="${2:-autoresearch/asciicker/reference-frames/frame-00-t0.0s.png}"
SHOTS_DIR="autoresearch/asciicker/shots"
SHOT="$SHOTS_DIR/checkpoint-${PHASE}-$(date +%s).png"

cd /Users/james/Repos/wibandwob-dos

# Ensure asciicker is open and maximized
SC_ID=$(curl -s http://127.0.0.1:8099/state | python3 -c "
import sys,json
d=json.load(sys.stdin)
for w in d.get('windows',[]):
    if w.get('appType')=='wibwob.asciicker':
        print(w['id']); break
" 2>/dev/null)

if [ -z "$SC_ID" ]; then
  echo "FAIL: Asciicker window not found"
  exit 1
fi

curl -sf -X POST http://127.0.0.1:8099/windows/maximize \
  -H 'Content-Type: application/json' -d "{\"id\":$SC_ID}" > /dev/null 2>&1
sleep 2

# Capture screenshot
./scripts/capture-tui-png.sh --display 1 --out "$SHOT" 2>/dev/null
echo "Captured: $SHOT"

# Also grab text capture for structural checks
TEXT=$(curl -s "http://127.0.0.1:8099/screenshot/text?id=$SC_ID" 2>/dev/null)

# Structural checks (no LLM needed)
echo "--- structural checks ---"

# Count non-empty lines in terrain area (skip first 2 and last 2 lines for chrome)
TERRAIN_LINES=$(echo "$TEXT" | sed '1,2d' | head -n -2 | grep -c '[^ ]' || true)
echo "Terrain lines with content: $TERRAIN_LINES"

# Count unique ANSI colour codes
COLOUR_COUNT=$(echo "$TEXT" | grep -oP '\x1b\[38;5;\d+m' | sort -u | wc -l | tr -d ' ')
echo "Unique fg colours: $COLOUR_COUNT"

# Count unique non-space glyphs
GLYPH_COUNT=$(echo "$TEXT" | sed 's/\x1b\[[0-9;]*m//g' | grep -oP '[^ \n]' | sort -u | wc -l | tr -d ' ')
echo "Unique glyphs: $GLYPH_COUNT"

# Phase-specific structural gates
echo "--- phase gates ---"
case "$PHASE" in
  phase0)
    # Pure refactor — output should be unchanged
    echo "Phase 0: refactor only, no visual checks"
    ;;
  phase1)
    # Triangle rasterizer — terrain should fill screen, no gaps
    if [ "$TERRAIN_LINES" -lt 20 ]; then
      echo "FAIL: terrain coverage too low ($TERRAIN_LINES lines)"
      exit 1
    fi
    echo "PASS: terrain coverage ($TERRAIN_LINES lines)"
    ;;
  phase2)
    # auto_mat — colour diversity should jump
    if [ "$COLOUR_COUNT" -lt 40 ]; then
      echo "FAIL: colour diversity too low ($COLOUR_COUNT unique fg colours)"
      exit 1
    fi
    echo "PASS: colour diversity ($COLOUR_COUNT unique fg colours)"
    if [ "$GLYPH_COUNT" -lt 15 ]; then
      echo "FAIL: glyph diversity too low ($GLYPH_COUNT unique glyphs)"
      exit 1
    fi
    echo "PASS: glyph diversity ($GLYPH_COUNT unique glyphs)"
    ;;
  phase3)
    # Water — should have water glyphs
    WATER_GLYPHS=$(echo "$TEXT" | sed 's/\x1b\[[0-9;]*m//g' | grep -c '[≈~∼∽≋∿]' || true)
    if [ "$WATER_GLYPHS" -lt 5 ]; then
      echo "WARN: few water glyphs ($WATER_GLYPHS)"
    else
      echo "PASS: water glyphs present ($WATER_GLYPHS)"
    fi
    ;;
esac

# Visual comparison via Claude (the expensive check — only if structural passes)
echo "--- visual comparison ---"
echo "Reference: $REF_FRAME"
echo "Current:   $SHOT"

# Build phase-specific visual questions
case "$PHASE" in
  phase1)
    QUESTIONS="1. Is the terrain a continuous filled surface with NO gaps showing background/sky colour between cells? (YES/NO)
2. Does higher terrain appear higher on screen, creating visible 3D depth? (YES/NO)
3. Is the overall shape roughly diamond/isometric (not a flat grid or random scatter)? (YES/NO)
4. Does the terrain fill most of the screen (not a tiny island in the centre)? (YES/NO)"
    PASS_THRESHOLD=3  # need 3/4 YES
    ;;
  phase2)
    QUESTIONS="1. Does the terrain show smooth colour gradients (not flat blocky biome boundaries)? (YES/NO)
2. Are there visible cliff/ledge edges where terrain height drops? (YES/NO)
3. Does the colour richness look closer to the reference frame than a simple 8-colour palette? (YES/NO)
4. Can you see the dithering effect (mixed characters creating colour blends within cells)? (YES/NO)
5. Does the overall look feel closer to the reference frame than the previous version? (YES/NO)"
    PASS_THRESHOLD=3  # need 3/5 YES
    ;;
  phase3)
    QUESTIONS="1. Is there a visible water area with blue/purple tones? (YES/NO)
2. Does the water show any reflection of terrain or objects above it? (YES/NO)
3. Does the water surface have visual variation (not flat single colour)? (YES/NO)"
    PASS_THRESHOLD=2  # need 2/3 YES
    ;;
  *)
    QUESTIONS="1. Does this look like a functioning 3D ASCII terrain renderer? (YES/NO)
2. Does it look closer to the reference frame than a blank screen? (YES/NO)"
    PASS_THRESHOLD=1
    ;;
esac

cat > /tmp/visual-checkpoint-prompt.md << PROMPT
You are comparing two images of an ASCII art game engine.

IMAGE 1 (reference): The original C++ asciicker engine output.
IMAGE 2 (current): Our TypeScript port's current output.

Answer each question with exactly YES or NO, followed by a brief reason.

$QUESTIONS

Then on a final line write: PASS_COUNT: N (where N is the number of YES answers)
PROMPT

echo ""
echo "Visual checkpoint questions:"
echo "$QUESTIONS"
echo ""
echo "To run the visual comparison manually:"
echo "  Read both PNGs and answer the questions above"
echo ""
echo "Checkpoint saved: $SHOT"
