#!/usr/bin/env bash
# doc-review.sh — LLM-powered semantic + functional doc health
#
# Uses pi -p (headless) with haiku/sonnet — no API keys needed.
#
# Tier 2 (semantic): haiku delta-judges each CAPS file 0-10
# Tier 3 (functional): sonnet attempts to build a microapp from docs only
#
# Usage:
#   bash scripts/doc-review.sh              # both tiers
#   bash scripts/doc-review.sh --semantic   # tier 2 only
#   bash scripts/doc-review.sh --functional # tier 3 only

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

MODE="${1:-both}"
DATE=$(date +%Y-%m-%d)
STRUCTURAL=$(bash scripts/doc-health.sh 2>/dev/null | grep -oE '[0-9]+' || echo "?")

echo "doc-review — $DATE"
echo ""
echo "Tier 1 (structural): ${STRUCTURAL}/15"
echo ""

# ── Tier 2: Semantic delta judge ──────────────────────────────────────────

run_semantic() {
  echo "Tier 2 (semantic): running delta judge via haiku..."
  echo ""

  CAPS_CONTENT=""
  for f in AGENTS.md PHILOSOPHY.md ARCHITECTURE.md GOTCHAS.md; do
    CAPS_CONTENT+="=== $f ===
$(cat "$f")

"
  done

  PROMPT="You are a delta compression judge reviewing WibWob-DOS documentation.

Delta principle: only include information specific to this repo. Standard TypeScript/Node/git
knowledge does NOT belong in project docs.

For each CAPS file below, score 0-10:
- 10: every sentence is delta — specific to this codebase
- 7-9: mostly delta with minor standard patterns
- 5-6: mixed — some standard restated
- 0-4: mostly standard knowledge

Also identify:
- Sentences that restate standard knowledge (quote the line)
- Sections that contradict another CAPS file
- References to files/paths that may no longer exist

Output format:
## <filename>: <score>/10
- issue 1
- issue 2

## Contradictions
- ...

## Stale references
- ...

Files:
${CAPS_CONTENT}"

  echo "$PROMPT" | pi -p \
    --model anthropic/claude-haiku-4-5 \
    --no-tools --no-skills -ne --no-session \
    2>/dev/null
}

# ── Tier 3: Functional test ───────────────────────────────────────────────

run_functional() {
  echo "Tier 3 (functional): can an agent build a microapp from docs alone?..."
  echo ""

  CAPS_CONTENT=""
  for f in AGENTS.md GOTCHAS.md SDK-MICROAPP-DEV.md; do
    CAPS_CONTENT+="=== $f ===
$(cat "$f")

"
  done

  PROMPT="You have access ONLY to the documentation excerpts below. No source code, no
microapps/, no other files.

Using ONLY the information in these docs, write a complete minimal WibWob-DOS microapp that:
1. Opens a window titled 'Test App'
2. Displays current date/time, updating every 2 seconds
3. Has all four required hooks wired via registerMicroappHooks

Write the complete index.ts and microapp.json.

Then report:
## Success: yes/no
## Blockers (things that were unclear or missing from the docs)
## Missing (information you needed but couldn't find)

If you cannot produce working code, explain what's missing.

Documentation:
${CAPS_CONTENT}"

  echo "$PROMPT" | pi -p \
    --model anthropic/claude-haiku-4-5 \
    --no-tools --no-skills -ne --no-session \
    2>/dev/null
}

# ── Run ───────────────────────────────────────────────────────────────────

case "$MODE" in
  --semantic)   run_semantic ;;
  --functional) run_functional ;;
  both|*)
    run_semantic
    echo ""
    echo "---"
    echo ""
    run_functional
    ;;
esac

echo ""
echo "doc-review complete."
