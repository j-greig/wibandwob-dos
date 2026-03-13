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

## Axes

GROWTH — Does the mycelial growth look organic, asymmetric, alive? Look for:
- Varied growth patterns (not uniform radiation)
- Organic-feeling tendrils and branching
- Multiple colony interactions
- Natural asymmetry
Score 1-4: uniform/mechanical, 5-6: basic organic, 7-8: convincing mycelium, 9-10: stunning living network

TIME — Can you tell the time? Does temporal encoding feel natural? Look for:
- Time visible somewhere (status bar or topology)
- Growth cycle tied to minutes
- Hour indicated by colour
- Seconds visible through spore activity
Score 1-4: time unclear, 5-6: basic clock, 7-8: elegant time encoding, 9-10: time deeply woven into biology

BEAUTY — Visual richness, glyph variety, colour, composition. Look for:
- Diverse character usage (not just dots)
- Contextual box-drawing (junction awareness)
- Colour harmony and transitions
- Compositional balance
- Status bar aesthetics
Score 1-4: plain text, 5-6: decent glyphs, 7-8: visually rich, 9-10: terminal art masterpiece

SURPRISE — Emergent behaviour, unexpected patterns. Look for:
- Wild colonies or self-organisation
- Decay/competition dynamics
- Memory between cycles (substrate residue)
- Spore trails, collision events
- Anything that makes you go "oh!"
Score 1-4: predictable, 5-6: some variety, 7-8: genuinely surprising, 9-10: emergent complexity

CRAFT — Code quality, performance, lifecycle. Look for:
- Clean lifecycle (createTimer/clearTimers, onCleanup)
- describeState with semantic info
- Efficient rendering (no O(n²) in hot paths)
- No memory leaks (spore/particle cleanup)
- Proper resize handling
- Status bar informative
Score 1-4: buggy/leaky, 5-6: functional, 7-8: well-crafted, 9-10: exemplary

## Rules
- Score based on source code features AND frame captures
- A basic working clock with uniform growth is 5-6
- Each implemented dream feature (substrate memory, wild colonies, colour blending,
  spore trails, nutrient zones, decay, competition, colony names, etc) adds
  real value — credit implemented features even if they're subtle in captures
- The captures are snapshots at specific moments — features like minute transitions,
  colour blending, or wild colony seeding may not trigger in every capture
- Average the 5 scores for the final number
- Be precise with decimals — distinguish between 7.2 and 7.8

## Output Format (EXACTLY this, no other text)
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
