#!/bin/bash
# Zine Moodboard Spike — scoring benchmark
set -uo pipefail

SCORE=0
TOTAL=0

check() {
  local label="$1"
  local pts="$2"
  local test="$3"
  TOTAL=$((TOTAL + pts))
  if eval "$test" 2>/dev/null 1>/dev/null; then
    echo "  ✓ $label (+$pts)"
    SCORE=$((SCORE + pts))
  else
    echo "  ✗ $label (0/$pts)"
  fi
}

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

# ══════════════════════════════════════════════════════════════
# SLICE 0: Menu access (10 pts)
# ══════════════════════════════════════════════════════════════
echo "=== Slice 0: Menu access (10 pts) ==="

check "tier promoted from beta" 5 \
  "grep -q '\"wibwob.zine\"' src/core/microapp-registry.ts && ! grep 'wibwob.zine' src/core/microapp-registry.ts | grep -q 'beta'"

check "microapp.json has menu category" 5 \
  "grep -q 'applications' microapps/zine/microapp.json"

# ══════════════════════════════════════════════════════════════
# SLICE 1: COAT compliance (25 pts)
# ══════════════════════════════════════════════════════════════
echo ""
echo "=== Slice 1: COAT compliance (25 pts) ==="

# Count direct blessed.box/blessed.list calls in zine index.ts (should be 0)
check "no direct blessed widget creation" 10 \
  "! grep -E 'blessed\.(box|list|text|textarea|layout|form)\(' microapps/zine/index.ts"

check "check-coat passes" 5 \
  "bun run check-coat 2>&1 | grep -q 'COAT check passed'"

check "typecheck passes" 5 \
  "bun run typecheck 2>&1 | tail -5 | grep -vq 'error'"

check "describeState implemented" 5 \
  "grep -q 'describeState' microapps/zine/index.ts"

# ══════════════════════════════════════════════════════════════
# SLICE 1: SDK migration (15 pts)
# ══════════════════════════════════════════════════════════════
echo ""
echo "=== Slice 1: SDK migration (15 pts) ==="

check "imports only from microapp-sdk" 5 \
  "! grep -E '^import .* from .*blessed' microapps/zine/index.ts"

check "onRestyle handles theme" 5 \
  "grep -q 'onRestyle' microapps/zine/index.ts"

check "captureText implemented" 5 \
  "grep -q 'captureText' microapps/zine/index.ts"

# ══════════════════════════════════════════════════════════════
# SLICE 2: Moodboard canvas (30 pts)
# ══════════════════════════════════════════════════════════════
echo ""
echo "=== Slice 2: Moodboard canvas (30 pts) ==="

CANVAS="content/moodboard.canvas.yaml"

check "moodboard.canvas.yaml exists" 5 \
  "[ -f '$CANVAS' ]"

# Count panels using grep (no node dependency)
check "has >= 10 panels" 5 \
  "[ \$(grep -c '^ *- id:' '$CANVAS' 2>/dev/null || echo 0) -ge 10 ]"

check "has figlet panel" 5 \
  "grep -q 'type: figlet' '$CANVAS' 2>/dev/null"

check "has text panels" 5 \
  "grep -q 'type: text' '$CANVAS' 2>/dev/null"

check "has ascii-art panels" 5 \
  "grep -q 'type: ascii-art' '$CANVAS' 2>/dev/null"

check "loadCanvas parses without error" 5 \
  "bun -e \"
    import { loadCanvas } from './microapps/sy2-chronicles/content-loader.ts';
    const doc = loadCanvas('$CANVAS');
    if (!doc || doc.panels.length === 0) process.exit(1);
    console.log('panels:', doc.panels.length);
  \""

# ══════════════════════════════════════════════════════════════
# SLICE 2: Panel content (20 pts)
# ══════════════════════════════════════════════════════════════
echo ""
echo "=== Slice 2: Panel content (20 pts) ==="

check "philosophy text present" 5 \
  "grep -qi 'philosophy\|symbient\|liminal' '$CANVAS' 2>/dev/null"

check "COAT diagram present" 5 \
  "grep -qi 'coat\|command.*once.*adapt' '$CANVAS' 2>/dev/null"

check "principles present" 5 \
  "grep -qi 'principles\|canon\|one concept.*one owner' '$CANVAS' 2>/dev/null"

check "north star present" 5 \
  "grep -qi 'north.star\|vision\|shared.*desktop' '$CANVAS' 2>/dev/null"

# ── Summary ───────────────────────────────────────────────────
echo ""
echo "========================================="
echo "zine_score: $SCORE / $TOTAL"
echo "========================================="
