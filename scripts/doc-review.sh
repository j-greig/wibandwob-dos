#!/usr/bin/env bash
# doc-review.sh — semantic + functional documentation health via subagent
#
# Tier 2 (semantic): LLM delta judge scores each CAPS file 0-10
# Tier 3 (functional): agent attempts to build a microapp from CAPS files only
#
# Usage:
#   bash scripts/doc-review.sh              # both tiers
#   bash scripts/doc-review.sh --semantic   # tier 2 only
#   bash scripts/doc-review.sh --functional # tier 3 only
#
# Prereq: pi subagent tool available (runs via pi CLI)

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
  echo "Tier 2 (semantic): running delta judge via subagent..."
  echo ""

  # Build the prompt with current CAPS file contents
  CAPS_CONTENT=""
  for f in AGENTS.md PHILOSOPHY.md ARCHITECTURE.md SDK.md GOTCHAS.md; do
    CAPS_CONTENT+="=== $f ===
$(cat "$f")

"
  done

  PROMPT="You are a delta compression judge reviewing WibWob-DOS documentation.

Delta principle: only include information that is specific to this repo and non-obvious.
Standard TypeScript/Node/git knowledge does NOT belong in project docs.

For each CAPS file below, score 0-10:
- 10: every sentence is delta — specific to this codebase, not standard knowledge
- 7-9: mostly delta with minor standard patterns
- 5-6: mixed — significant standard patterns restated
- 0-4: mostly standard knowledge that any competent dev already knows

Also identify:
- Sentences that restate standard knowledge (quote the line)
- CAPS file sections that contradict each other
- References to files/paths that may no longer exist

Output ONLY valid JSON, no other text:
{
  \"files\": [
    {\"name\": \"AGENTS.md\", \"delta_score\": 8, \"issues\": [\"line X restates standard git workflow\"]},
    ...
  ],
  \"contradictions\": [\"...\"],
  \"stale_refs\": [\"...\"]
}

Files to review:
${CAPS_CONTENT}"

  # Run via pi subagent (haiku for cost/speed)
  RESULT=$(pi subagent --agent worker --model claude-haiku-4-5 --no-tools \
    --task "$PROMPT" 2>/dev/null || echo '{"error": "subagent unavailable"}')

  # Parse and display
  echo "$RESULT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    if 'error' in d:
        print(f'  ✗ {d[\"error\"]}')
        sys.exit(1)
    scores = [f['delta_score'] for f in d.get('files', [])]
    avg = sum(scores) / len(scores) if scores else 0
    print(f'  avg delta score: {avg:.1f}/10')
    for f in d.get('files', []):
        issues = f.get('issues', [])
        badge = '✓' if f['delta_score'] >= 7 else '⚠'
        print(f'  {badge} {f[\"name\"]}: {f[\"delta_score\"]}/10', end='')
        print(f' — {len(issues)} issue(s)' if issues else '')
        for issue in issues[:2]:
            print(f'      {issue}')
    contradictions = d.get('contradictions', [])
    if contradictions:
        print(f'  contradictions: {len(contradictions)}')
        for c in contradictions[:2]:
            print(f'    - {c}')
    stale = d.get('stale_refs', [])
    if stale:
        print(f'  stale refs: {len(stale)}')
        for s in stale[:2]:
            print(f'    - {s}')
except Exception as e:
    print(f'  parse error: {e}')
    print('  raw:', sys.stdin.read()[:200])
" || echo "  (parse failed — check raw output)"
}

# ── Tier 3: Functional test ───────────────────────────────────────────────

run_functional() {
  echo "Tier 3 (functional): agent builds microapp from CAPS files only..."
  echo ""

  CAPS_EXTRACT=""
  for f in AGENTS.md SDK.md GOTCHAS.md; do
    CAPS_EXTRACT+="=== $f ===
$(cat "$f")

"
  done

  PROMPT="You have access ONLY to the documentation excerpts below. No source code, no microapps/, no other files.

Using ONLY the information in these docs, write a complete minimal WibWob-DOS microapp that:
1. Opens a window titled 'Hello World'
2. Displays the text 'Hello from the guide'
3. Has all four required hooks wired correctly

Output ONLY JSON:
{
  \"success\": true,
  \"index_ts\": \"<the complete index.ts content>\",
  \"microapp_json\": \"<the complete microapp.json content>\",
  \"blockers\": [\"things that were unclear or missing from the docs\"],
  \"missing\": [\"information you needed but couldn't find\"]
}

If you cannot produce working code from the docs alone, set success: false and explain in blockers.

Documentation:
${CAPS_EXTRACT}"

  RESULT=$(pi subagent --agent worker --model claude-sonnet-4-5 --no-tools \
    --task "$PROMPT" 2>/dev/null || echo '{"error": "subagent unavailable"}')

  echo "$RESULT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    if 'error' in d:
        print(f'  ✗ {d[\"error\"]}')
        sys.exit(1)
    badge = '✓ PASS' if d.get('success') else '✗ FAIL'
    print(f'  {badge}')
    blockers = d.get('blockers', [])
    missing = d.get('missing', [])
    if blockers:
        print(f'  unclear ({len(blockers)}):')
        for b in blockers:
            print(f'    - {b}')
    if missing:
        print(f'  missing ({len(missing)}):')
        for m in missing:
            print(f'    - {m}')
    if d.get('success') and not blockers and not missing:
        print('  Agent succeeded with no blockers or missing info')
except Exception as e:
    print(f'  parse error: {e}')
" || echo "  (parse failed)"
}

# ── Run selected tiers ────────────────────────────────────────────────────

case "$MODE" in
  --semantic)   run_semantic ;;
  --functional) run_functional ;;
  both|*)
    run_semantic
    echo ""
    run_functional
    ;;
esac

echo ""
echo "doc-review complete."
