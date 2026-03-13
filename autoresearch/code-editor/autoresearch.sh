#!/usr/bin/env bash
set -euo pipefail

cd /Users/james/Repos/wibandwob-dos

echo "=== Spore Clock Quality Benchmark ==="

# 1. Typecheck
echo "--- typecheck ---"
bun run typecheck 2>&1 | tail -3

# 2. Ensure spore clock is running
echo "--- reload spore clock ---"
# Close existing
curl -s http://127.0.0.1:8099/state | python3 -c "
import sys,json
d=json.load(sys.stdin)
for w in d.get('windows',[]):
    if w.get('appType')=='wibwob.spore-clock':
        print(w['id'])
" 2>/dev/null | while read id; do
  curl -s -X POST http://127.0.0.1:8099/windows/close \
    -H 'Content-Type: application/json' -d "{\"id\":$id}" >/dev/null 2>&1 || true
done

sleep 0.3

# Open fresh
curl -s -X POST http://127.0.0.1:8099/commands/run \
  -H 'Content-Type: application/json' \
  -d '{"id":"microapp.wibwob.spore-clock.open"}' >/dev/null 2>&1

sleep 0.5

# 3. Get window ID
SC_ID=$(curl -s http://127.0.0.1:8099/state | python3 -c "
import sys,json
d=json.load(sys.stdin)
for w in d.get('windows',[]):
    if w.get('appType')=='wibwob.spore-clock':
        print(w['id']); break
" 2>/dev/null)

if [ -z "$SC_ID" ]; then
  echo "FAIL: Spore Clock window not found"
  exit 1
fi

echo "Window ID: $SC_ID"

# 4. Wait for some growth cycles then capture multiple frames
echo "--- capturing frames ---"
sleep 4  # let it grow more before first capture

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
    if w.get('appType')=='wibwob.spore-clock':
        import json as j
        print(j.dumps(w, indent=2))
        break
" 2>/dev/null)

# 6. Read source for analysis
SOURCE=$(cat modules/spore-clock/index.ts)
SOURCE_LINES=$(wc -l < modules/spore-clock/index.ts)

echo "--- source lines: $SOURCE_LINES ---"

# 7. Score via LLM
echo "--- scoring ---"

cat <<'SCORING_PROMPT' > /tmp/spore-score-prompt.md
You are an expert judge of generative art quality in terminal/TUI environments.
Score this Spore Clock module on 5 axes (each 1-10, one decimal place).

For each axis, first LIST the specific features you observe in the source code,
then assign a precise score. Use tenths (7.2, 7.8, 8.3) not just round halves.

## Axes

GROWTH — Organic quality of mycelial growth
Feature checklist (each present feature raises the score):
- [ ] Basic CA growth from seed nodes
- [ ] Contextual box-drawing tendrils (junction-aware)
- [ ] Nutrient zones creating asymmetric growth
- [ ] Ghost/substrate memory guiding new growth
- [ ] Fibonacci/golden-angle seed placement
- [ ] Colony ownership tracking per cell
- [ ] Boundary competition between colonies
- [ ] Decay creating visual churn and regrowth
- [ ] Wild colony emergence from spore collision
- [ ] Seasonal growth rate variation by time of day
Score: 5=basic CA, 6=tendrils+nodes, 7=nutrients+asymmetry, 8=competition+decay+wild, 9=all above+beautiful, 10=stunning

TIME — Temporal encoding quality
Feature checklist:
- [ ] Digital time in status bar
- [ ] Colony colour indicates hour
- [ ] Minute progress bar
- [ ] Growth density tracks minute progress
- [ ] Circadian colour blending between palettes
- [ ] Spore count scales with seconds
- [ ] Pulse rings mark seconds visually
- [ ] Minute transition animation (sporulation→rebirth)
- [ ] Seasonal growth rates (night=slow, day=fast)
- [ ] Cycle counter tracks minute resets
Score: 5=just digits, 6=colour+density, 7=blending+bar, 8=pulses+transitions, 9=all above, 10=time IS biology

BEAUTY — Visual richness
Feature checklist:
- [ ] Multiple glyph vocabularies (>5 character sets)
- [ ] Contextual glyph selection (not random)
- [ ] Box-drawing corners, junctions, tendrils
- [ ] Decay characters distinct from growth
- [ ] Ghost/residue characters
- [ ] Boundary competition characters
- [ ] Wild node glyphs distinct from planned
- [ ] Breathing/pulsing separator
- [ ] Rich status bar with symbolic indicators
- [ ] Progress bar visualisation
Score: 5=basic chars, 6=varied glyphs, 7=contextual+themed, 8=rich vocabulary, 9=all above, 10=art

SURPRISE — Emergent behaviour
Feature checklist:
- [ ] Wild colonies from spore drift
- [ ] Boundary competition with territory capture
- [ ] Mass sporulation at minute boundary
- [ ] Substrate memory shaping future growth
- [ ] Nutrient zones from decay feeding regrowth
- [ ] Wind-affected spore drift
- [ ] Network edges between connected nodes
- [ ] Pulse rings propagating from nodes
- [ ] Spore trails showing wind patterns
- [ ] Colony naming for agent interaction
Score: 5=predictable, 6=some emergence, 7=wild colonies, 8=competition+transitions, 9=all above, 10=alive

CRAFT — Code quality and architecture
Feature checklist:
- [ ] Clean lifecycle (createTimer/clearTimers/onCleanup)
- [ ] O(1) lookup maps for rendering (not O(n) find)
- [ ] Spore cap prevents unbounded growth
- [ ] describeState with rich semantic data
- [ ] captureText for screen capture
- [ ] onRestyle for theme changes
- [ ] onResize handling
- [ ] Proper ownership tracking (no stale refs)
- [ ] Colony naming system
- [ ] Network connection tracking
Score: 5=works, 6=clean lifecycle, 7=O(1)+caps, 8=rich state+naming, 9=all above, 10=exemplary

## Rules
- Count features ACTUALLY PRESENT in the source code
- Use the checklist counts to calibrate — 8/10 features ≈ score 8
- Be precise: 7.3 and 8.1 are different scores
- Average the 5 axis scores for AVERAGE

## Output Format (EXACTLY this — scores only, no other text)
GROWTH: X.X
TIME: X.X
BEAUTY: X.X
SURPRISE: X.X
CRAFT: X.X
AVERAGE: X.X
SCORING_PROMPT

RESULT=$(cat <<EOF | claude -p "$(cat /tmp/spore-score-prompt.md)

## Source Code
\`\`\`typescript
$SOURCE
\`\`\`

## Frame Capture 1 (after 2s growth)
\`\`\`
$FRAME1
\`\`\`

## Frame Capture 2 (after 3.5s growth)
\`\`\`
$FRAME2
\`\`\`

## Frame Capture 3 (after 5s growth)
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
