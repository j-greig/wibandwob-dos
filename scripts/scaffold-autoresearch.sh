#!/bin/bash
set -euo pipefail
#
# Scaffold a new autoresearch subdirectory with all starter files.
#
# Usage:
#   bash scripts/scaffold-autoresearch.sh <name> "<objective>" [metric_name] [direction]
#
# Examples:
#   bash scripts/scaffold-autoresearch.sh settings-panel "Improve Settings Panel UI quality" ui_score higher
#   bash scripts/scaffold-autoresearch.sh render-perf "Optimize render loop latency" render_ms lower
#
# Creates: autoresearch/<name>/ with:
#   autoresearch.md          — experiment rules (edit the objective + files in scope)
#   autoresearch.sh          — benchmark script stub
#   autoresearch.checks.sh   — correctness checks stub
#   autoresearch.ideas.md    — ideas backlog (empty, ready for use)
#

AUTORESEARCH_ROOT="${AUTORESEARCH_ROOT:-autoresearch}"

NAME="${1:?Usage: scaffold-autoresearch.sh <name> \"<objective>\" [metric_name] [direction]}"
OBJECTIVE="${2:?Provide an objective as the second argument}"
METRIC="${3:-ui_score}"
DIRECTION="${4:-higher}"

DIR="$AUTORESEARCH_ROOT/$NAME"

if [ -d "$DIR" ]; then
  echo "❌ Directory already exists: $DIR"
  exit 1
fi

mkdir -p "$DIR"

# --- autoresearch.md ---
cat > "$DIR/autoresearch.md" << ENDMD
# Autoresearch — ${NAME}

## Objective

${OBJECTIVE}

## Metrics

- **Primary**: ${METRIC} (${DIRECTION} is better)
- **Secondary**: (add as needed)

## How to Run

\`./autoresearch.sh\` — outputs \`METRIC name=number\` lines.

## Files in Scope

<!-- List every file the agent may modify, with a brief note on what it does. -->

## Off Limits

<!-- What must NOT be touched. -->

## Constraints

- \`bun run typecheck\` must pass
- No new dependencies without approval
- Only modify files listed in "Files in Scope"

## What's Been Tried

<!-- Update this section as experiments accumulate. Note key wins, dead ends,
and architectural insights so the agent doesn't repeat failed approaches. -->
ENDMD

# --- autoresearch.sh ---
cat > "$DIR/autoresearch.sh" << 'ENDSH'
#!/bin/bash
set -euo pipefail
#
# Autoresearch benchmark script.
# Must output: METRIC name=number (one per line)
#

# TODO: Replace with your actual benchmark
echo "METRIC ui_score=5.0"
ENDSH
chmod +x "$DIR/autoresearch.sh"

# --- autoresearch.checks.sh ---
cat > "$DIR/autoresearch.checks.sh" << 'ENDCHECKS'
#!/bin/bash
set -euo pipefail
#
# Correctness checks — runs after every passing benchmark.
# Keep output minimal (only last 80 lines fed to agent on failure).
#

bun run typecheck 2>&1 | grep -i error || true
ENDCHECKS
chmod +x "$DIR/autoresearch.checks.sh"

# --- autoresearch.ideas.md ---
cat > "$DIR/autoresearch.ideas.md" << ENDIDEAS
# Autoresearch Ideas — ${NAME}

## Live Ideas

## Done / Stale
ENDIDEAS

echo "✅ Scaffolded: $DIR/"
echo "   Files created:"
ls -1 "$DIR/" | sed 's/^/     /'
echo ""
echo "   Next steps:"
echo "   1. Edit $DIR/autoresearch.md — fill in Files in Scope + Off Limits"
echo "   2. Edit $DIR/autoresearch.sh — wire up the actual benchmark"
echo "   3. Run: /autoresearch <your goal description>"
