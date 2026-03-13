#!/usr/bin/env bash
set -euo pipefail

echo "=== Unix Control Brief Quality Benchmark ==="

cd /Users/james/Repos/wibandwob-dos

# Collect all source docs (exclude meta-files and kickoff)
SOURCE_DIR="autoresearch/unix-control"
SOURCE_FILES=$(ls "$SOURCE_DIR"/*.md \
  | grep -v KICKOFF-PROMPT \
  | grep -v autoresearch-brief-enhancement)

FILE_COUNT=$(echo "$SOURCE_FILES" | wc -l | tr -d ' ')
LINE_COUNT=$(cat $SOURCE_FILES | wc -l | tr -d ' ')

echo "--- source: $LINE_COUNT lines in $FILE_COUNT files ---"

# Concatenate all docs with file headers
DOCS=""
for f in $SOURCE_FILES; do
  fname=$(basename "$f")
  DOCS+="
=== FILE: $fname ===
$(cat "$f")
"
done

# Build scoring prompt
cat <<'SCORING_PROMPT' > /tmp/unix-control-score-prompt.md
You are scoring a research document suite about Unix philosophy for AI agent control interfaces.
The suite should help an engineer build a CLI tool that auto-derives from an existing TypeScript
command catalog using Zod schemas. Score each axis 1-10 (one decimal place).

EVIDENCE — are claims backed by specific, verifiable references?
Checklist: performance claims cite benchmarks/papers, URLs are real not hallucinated,
academic citations have author/year/venue, statistics have sample sizes, no weasel phrases,
counter-evidence acknowledged, primary vs secondary sources distinguished.

ACTIONABILITY — can a reader build the CLI from this documentation?
Checklist: concrete first steps per recommendation, runnable code examples,
time/effort estimates, success metrics defined, specific package recommendations,
anti-patterns alongside patterns, clear priority ordering.

COHERENCE — does the suite work as a unified whole?
Checklist: no claim in more than one file (DRY), cross-references correct,
each file has distinct purpose, no overlap, consistent terminology,
could reduce file count without losing information, reading order clear.

DENSITY — information per byte, is there filler?
Checklist: no throat-clearing paragraphs, no repeated introductions,
tables for structured data, minimal code examples, every paragraph passes
"so what?" test, could be shorter without losing content, no emoji noise.

RIGOUR — honest about what it knows vs guesses?
Checklist: proven claims separated from hypotheses, anecdotal evidence labelled,
benchmark methodology described, alternative explanations considered,
limitations discussed, confidence levels on performance claims.

Output EXACTLY this format (no other text before or after):
EVIDENCE: N.N
ACTIONABILITY: N.N
COHERENCE: N.N
DENSITY: N.N
RIGOUR: N.N
AVERAGE: N.N
WEAKEST_AXIS: name
WEAKEST_SECTION: filename — brief description of the weakest section
SCORING_PROMPT

echo "--- scoring ---"

RESULT=$(claude -p "$(cat /tmp/unix-control-score-prompt.md)

## Document Suite ($FILE_COUNT files, $LINE_COUNT lines)

$DOCS
")

echo "$RESULT"

# Parse scores
EVIDENCE=$(echo "$RESULT" | grep "^EVIDENCE:" | grep -oE '[0-9]+\.[0-9]+' | head -1)
ACTIONABILITY=$(echo "$RESULT" | grep "^ACTIONABILITY:" | grep -oE '[0-9]+\.[0-9]+' | head -1)
COHERENCE=$(echo "$RESULT" | grep "^COHERENCE:" | grep -oE '[0-9]+\.[0-9]+' | head -1)
DENSITY=$(echo "$RESULT" | grep "^DENSITY:" | grep -oE '[0-9]+\.[0-9]+' | head -1)
RIGOUR=$(echo "$RESULT" | grep "^RIGOUR:" | grep -oE '[0-9]+\.[0-9]+' | head -1)
AVERAGE=$(echo "$RESULT" | grep "^AVERAGE:" | grep -oE '[0-9]+\.[0-9]+' | head -1)

# Fallback: compute average if LLM didn't
if [ -z "$AVERAGE" ] && [ -n "$EVIDENCE" ] && [ -n "$ACTIONABILITY" ] && [ -n "$COHERENCE" ] && [ -n "$DENSITY" ] && [ -n "$RIGOUR" ]; then
  AVERAGE=$(echo "scale=1; ($EVIDENCE + $ACTIONABILITY + $COHERENCE + $DENSITY + $RIGOUR) / 5" | bc)
fi

echo ""
echo "FINAL_SCORE: ${AVERAGE:-0}"
