#!/usr/bin/env bash
set -euo pipefail

cd /Users/james/Repos/wibandwob-dos

echo "=== Asciicker Quality Benchmark ==="

# 1. Typecheck
echo "--- typecheck ---"
bun run typecheck 2>&1 | tail -3

# 2. Ensure asciicker is running
echo "--- reload asciicker ---"
# Close existing
curl -s http://127.0.0.1:8099/state | python3 -c "
import sys,json
d=json.load(sys.stdin)
for w in d.get('windows',[]):
    if w.get('appType')=='wibwob.asciicker':
        print(w['id'])
" 2>/dev/null | while read id; do
  curl -s -X POST http://127.0.0.1:8099/windows/close \
    -H 'Content-Type: application/json' -d "{\"id\":$id}" >/dev/null 2>&1 || true
done

sleep 0.3

# Open fresh
curl -s -X POST http://127.0.0.1:8099/commands/run \
  -H 'Content-Type: application/json' \
  -d '{"id":"microapp.wibwob.asciicker.open"}' >/dev/null 2>&1

sleep 0.5

# 3. Get window ID
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

echo "Window ID: $SC_ID"

# 3b. Maximize window for full resolution scoring
curl -sf -X POST http://127.0.0.1:8099/windows/maximize \
  -H 'Content-Type: application/json' -d "{\"id\":$SC_ID}" > /dev/null 2>&1
sleep 0.5

# 4. Wait for rendering then capture frames
echo "--- capturing frames ---"
sleep 4

FRAME1=$(curl -s "http://127.0.0.1:8099/screenshot/text?id=$SC_ID" 2>/dev/null)
sleep 2
FRAME2=$(curl -s "http://127.0.0.1:8099/screenshot/text?id=$SC_ID" 2>/dev/null)
sleep 2
FRAME3=$(curl -s "http://127.0.0.1:8099/screenshot/text?id=$SC_ID" 2>/dev/null)

# 5. Get describeState
STATE=$(curl -s http://127.0.0.1:8099/state | python3 -c "
import sys,json
d=json.load(sys.stdin)
for w in d.get('windows',[]):
    if w.get('appType')=='wibwob.asciicker':
        import json as j
        print(j.dumps(w, indent=2))
        break
" 2>/dev/null)

# 6. Read source for analysis — all .ts files in the module
SOURCE=$(cat modules/asciicker/*.ts)
SOURCE_LINES=$(cat modules/asciicker/*.ts | wc -l)
SOURCE_FILE_COUNT=$(ls modules/asciicker/*.ts | wc -l)

echo "--- source: $SOURCE_LINES lines in $SOURCE_FILE_COUNT files ---"

# 7. Score via LLM
echo "--- scoring ---"

cat <<'SCORING_PROMPT' > /tmp/asciicker-score-prompt.md
You are an expert judge of ASCII art game rendering in terminal/TUI environments.
Score this Asciicker module on 5 axes (each 1-10, one decimal place).

For each axis, first LIST the specific features you observe in the source code,
then assign a precise score. Use tenths (7.2, 7.8, 8.3) not just round halves.

## Axes

RENDER — 3D ASCII rendering quality
Feature checklist (each present feature raises the score):
- [ ] Heightmap terrain data structure
- [ ] Back-to-front (painter's algorithm) rendering
- [ ] Height creates visual depth (cells shift up)
- [ ] Occlusion (higher cells hide lower ones behind)
- [ ] Surface normal shading (top vs side faces)
- [ ] Directional light / shadows
- [ ] Depth buffer or z-sorting
- [ ] Isometric or perspective projection
- [ ] Camera yaw rotation
- [ ] Zoom level control
Score: 1=no 3D, 3=flat grid, 5=basic height, 7=convincing depth, 9=impressive 3D, 10=asciicker-quality

WORLD — Terrain and world quality
Feature checklist:
- [ ] Procedural terrain generation (noise-based)
- [ ] Multiple biomes (grass, water, stone, sand, forest)
- [ ] Height variation creating hills/valleys/mountains
- [ ] Water bodies (rivers, lakes, ocean)
- [ ] Trees/vegetation as distinct features
- [ ] Settlements or structures
- [ ] Terrain extends beyond viewport (scrollable)
- [ ] Biome transitions feel natural
- [ ] World feels explorable and interesting
- [ ] Day/night cycle or weather
Score: 1=empty, 3=flat colour, 5=basic terrain, 7=varied biomes, 9=rich world, 10=living landscape

CONTROLS — Interactivity and responsiveness
Feature checklist:
- [ ] Keyboard input handling
- [ ] WASD or arrow key movement
- [ ] Camera follows player/cursor
- [ ] Yaw rotation (Q/E or similar)
- [ ] Zoom control
- [ ] Smooth movement (not jerky)
- [ ] Player character visible on terrain
- [ ] Collision with terrain height
- [ ] Status bar shows position/info
- [ ] Responsive at 8fps (no lag)
Score: 1=no input, 3=basic keys, 5=movement works, 7=smooth controls, 9=polished, 10=game-quality

BEAUTY — Visual quality and aesthetics
Feature checklist:
- [ ] Multiple glyph types for different terrain
- [ ] Colour variety (not monochrome)
- [ ] Height shading creates depth illusion
- [ ] Water effects (animation, colour)
- [ ] Vegetation variety
- [ ] Sky/background treatment
- [ ] Status bar with useful info
- [ ] Compositional balance
- [ ] Character/glyph choices feel right
- [ ] Overall aesthetic coherence
Score: 1=text only, 3=basic chars, 5=themed glyphs, 7=visually rich, 9=beautiful, 10=art

CRAFT — Code quality and architecture
Feature checklist:
- [ ] Clean lifecycle (createTimer/clearTimers/onCleanup)
- [ ] Efficient rendering (no unnecessary redraws)
- [ ] describeState with semantic info
- [ ] captureText for screen capture
- [ ] onRestyle for theme changes
- [ ] onResize handling
- [ ] Terrain data structure is clean
- [ ] Rendering pipeline is well-organised
- [ ] Input handling is clean
- [ ] No memory leaks or unbounded growth
Score: 5=works, 6=clean lifecycle, 7=efficient, 8=well-architected, 9=exemplary, 10=perfect

## Rules
- Count features ACTUALLY PRESENT in the source code
- Use the checklist counts to calibrate — 8/10 features ≈ score 8
- Be precise: 7.3 and 8.1 are different scores
- A scaffold with no rendering = scores of 1 except CRAFT
- Average the 5 axis scores for AVERAGE

## Output Format (EXACTLY this — scores only, no other text)
RENDER: X.X
WORLD: X.X
CONTROLS: X.X
BEAUTY: X.X
CRAFT: X.X
AVERAGE: X.X
SCORING_PROMPT

RESULT=$(cat <<EOF | claude -p "$(cat /tmp/asciicker-score-prompt.md)

## Source Code
\`\`\`typescript
$SOURCE
\`\`\`

## Frame Capture 1 (after 4s)
\`\`\`
$FRAME1
\`\`\`

## Frame Capture 2 (after 6s)
\`\`\`
$FRAME2
\`\`\`

## Frame Capture 3 (after 8s)
\`\`\`
$FRAME3
\`\`\`

## describeState
\`\`\`json
$STATE
\`\`\`

## Source line count: $SOURCE_LINES
"
EOF
)

echo "$RESULT"

# Parse the average
AVG=$(echo "$RESULT" | grep -i "AVERAGE:" | head -1 | sed 's/.*: *//' | tr -d ' ')
echo ""
echo "FINAL_SCORE: $AVG"
