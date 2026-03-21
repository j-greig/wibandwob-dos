#!/usr/bin/env bash
# doc-health.sh — measures documentation system integrity
#
# Axes (10 pts each = 80 pts mechanical):
#   1. Staleness          — doc-sync --check
#   2. Script headers     — all gen-* have @watches/@output/@run
#   3. Back-links         — outputs have all 4 <!-- --> header lines
#   4. Forward-links      — outputs have <!-- Parent: -->
#   5. PD integrity       — every <output> path in CAPS files exists on disk
#   6. @watches precision — no watch glob resolves to 20+ files
#   7. Loop circularity   — full loop: script→output→back-link→parent CAPS→output
#   8. Orphan detection   — no generated files whose generator no longer exists
#
# + functional count checks (informational, no score impact)
# + delta score via delta-judge.sh if available
#
# Usage:
#   bash scripts/doc-health.sh          # human-readable
#   bash scripts/doc-health.sh --json   # JSON for callers/autoresearch
#   bash scripts/doc-health.sh --score  # integer score only

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

MODE="${1:-}"
SCORE=0
MAX=80
TMP=$(mktemp)
trap "rm -f $TMP" EXIT

log_issue()  { echo "ISSUE:$1" >> "$TMP"; [[ "$MODE" != "--json" ]] && echo "  ✗ $1"; }
log_pass()   { echo "PASS:$2"  >> "$TMP"; [[ "$MODE" != "--json" ]] && echo "  ✓ $2"; }
log_func()   { echo "FUNC:$1"  >> "$TMP"; }
add_score()  { SCORE=$((SCORE + 10)); }

section() { [[ "$MODE" != "--json" && "$MODE" != "--score" ]] && echo "$1" || true; }

section "doc-health — $(date +%Y-%m-%d)"
section ""

# ── Axis 1: Staleness ────────────────────────────────────────────────────────
section "1. Staleness"
if bash scripts/doc-sync.sh --check > /dev/null 2>&1; then
  add_score; log_pass 1 "all outputs current"
else
  log_issue "stale outputs — run: bash scripts/doc-sync.sh"
fi

# ── Axis 2: Script headers ───────────────────────────────────────────────────
section "2. Script headers"
missing=0
for script in scripts/gen-*.ts scripts/gen-*.py; do
  [[ -f "$script" ]] || continue
  for tag in @watches @output @run; do
    grep -qE "^(//|#) $tag" "$script" || { log_issue "$script missing $tag"; missing=$((missing+1)); }
  done
done
[[ $missing -eq 0 ]] && add_score && log_pass 2 "all gen scripts have required headers"

# ── Axis 3: Back-links ───────────────────────────────────────────────────────
section "3. Back-links"
missing=0
for script in scripts/gen-*.ts scripts/gen-*.py; do
  [[ -f "$script" ]] || continue
  output=$(grep -E "^(//|#) @output" "$script" | sed 's|.*@output ||' | tr -d ' ')
  [[ -z "$output" || ! -f "$output" ]] && continue
  for marker in "AUTO-GENERATED" "Watched:" "Regenerate:" "Parent:"; do
    grep -q "$marker" "$output" || { log_issue "$output missing <!-- $marker -->"; missing=$((missing+1)); }
  done
done
[[ $missing -eq 0 ]] && add_score && log_pass 3 "all outputs have back-link headers"

# ── Axis 4: Forward-links ────────────────────────────────────────────────────
section "4. Forward-links"
missing=0
for script in scripts/gen-*.ts scripts/gen-*.py; do
  [[ -f "$script" ]] || continue
  output=$(grep -E "^(//|#) @output" "$script" | sed 's|.*@output ||' | tr -d ' ')
  [[ -z "$output" || ! -f "$output" ]] && continue
  grep -q "Parent:" "$output" || { log_issue "$output missing <!-- Parent: -->"; missing=$((missing+1)); }
done
[[ $missing -eq 0 ]] && add_score && log_pass 4 "all outputs have parent forward-links"

# ── Axis 5: PD integrity ─────────────────────────────────────────────────────
section "5. Progressive-disclosure integrity"
missing=0
for caps in AGENTS.md ARCHITECTURE.md PHILOSOPHY.md GOTCHAS.md; do
  [[ -f "$caps" ]] || continue
  while IFS= read -r line; do
    path=$(echo "$line" | sed 's|.*<output>||;s|</output>.*||' | grep -oE '`[^`]+`' | head -1 | tr -d '`' | awk '{print $1}')
    [[ -z "$path" || "$path" == *"..."* || "$path" == *"bun"* || "$path" == *"python"* ]] && continue
    [[ -f "$path" ]] || { log_issue "$caps <output> path not found: $path"; missing=$((missing+1)); }
  done < <(grep '<output>' "$caps" 2>/dev/null || true)
done
[[ $missing -eq 0 ]] && add_score && log_pass 5 "all <output> paths exist on disk"

# ── Axis 6: @watches precision ───────────────────────────────────────────────
section "6. @watches precision"
broad=0
for script in scripts/gen-*.ts scripts/gen-*.py; do
  [[ -f "$script" ]] || continue
  while IFS= read -r watch; do
    watch=$(echo "$watch" | tr -d ' ')
    [[ -z "$watch" || "$watch" == *"/"*"."* ]] && continue
    count=$(git ls-files "$watch" 2>/dev/null | wc -l | tr -d ' ')
    [[ "$count" -ge 20 ]] && { log_issue "$script @watches '$watch' matches $count files"; broad=$((broad+1)); }
  done < <(grep -E "^(//|#) @watches" "$script" | sed 's|.*@watches ||' | tr ' ' '\n')
done
[[ $broad -eq 0 ]] && add_score && log_pass 6 "@watches paths sufficiently precise"

# ── Axis 7: Loop circularity ─────────────────────────────────────────────────
section "7. Loop circularity"
open=0
for script in scripts/gen-*.ts scripts/gen-*.py; do
  [[ -f "$script" ]] || continue
  output=$(grep -E "^(//|#) @output" "$script" | sed 's|.*@output ||' | tr -d ' ')
  [[ -z "$output" || ! -f "$output" ]] && continue
  if ! grep -q "AUTO-GENERATED by $script" "$output" 2>/dev/null; then
    log_issue "broken loop: $output back-link doesn't reference $script"; open=$((open+1)); continue
  fi
  parent=$(grep "Parent:" "$output" 2>/dev/null | grep -oE '[A-Z]+\.md' | head -1 || true)
  [[ -z "$parent" || ! -f "$parent" ]] && { log_issue "broken loop: $output Parent CAPS '$parent' not found"; open=$((open+1)); continue; }
  grep -q "$output" "$parent" 2>/dev/null || { log_issue "broken loop: $parent has no <output> referencing $output"; open=$((open+1)); }
done
[[ $open -eq 0 ]] && add_score && log_pass 7 "all loops closed"

# ── Axis 8: Orphan detection ─────────────────────────────────────────────────
section "8. Orphan detection"
orphans=0
while IFS= read -r artifact; do
  [[ -f "$artifact" ]] || continue
  generator=$(head -5 "$artifact" | grep -oE "AUTO-GENERATED by scripts/[^ ]+" | sed 's/AUTO-GENERATED by //' | sed 's/[[:space:]].*//' | head -1 || true)
  [[ -z "$generator" ]] && continue
  [[ -f "$generator" ]] || { log_issue "orphan: $artifact generator '$generator' no longer exists"; orphans=$((orphans+1)); }
done < <(git ls-files '*.md' '*.ts' 2>/dev/null | while IFS= read -r f; do
  head -3 "$f" 2>/dev/null | grep -q 'AUTO-GENERATED by' && echo "$f"; done)
[[ $orphans -eq 0 ]] && add_score && log_pass 8 "no orphaned generated files"

# ── Functional counts (informational) ────────────────────────────────────────
if [[ -f COAT.md && -f src/services/control-api.ts ]]; then
  src_eps=$(grep -c '"path":' src/services/control-api.ts 2>/dev/null || echo 0)
  doc_eps=$(grep -oE 'Endpoints: [0-9]+' COAT.md | grep -oE '[0-9]+' | head -1 || echo 0)
  src_eps=$(echo "$src_eps" | tr -d ' \n')
  doc_eps=$(echo "$doc_eps" | tr -d ' \n')
  [[ -n "$doc_eps" && -n "$src_eps" && "$doc_eps" -lt "$src_eps" ]] && \
    log_func "COAT.md reports $doc_eps endpoints but source has ~$src_eps"
fi
if [[ -f .pi/skills/skills.md ]]; then
  src_skills=$(find .pi/skills -name 'SKILL.md' ! -path '*/.trash/*' 2>/dev/null | wc -l | tr -d ' \n')
  doc_skills=$(grep -c '^## ' .pi/skills/skills.md 2>/dev/null | tr -d ' \n' || echo 0)
  [[ -n "$doc_skills" && -n "$src_skills" && "$doc_skills" -lt "$src_skills" ]] && \
    log_func "skills.md has $doc_skills sections but source has $src_skills skills"
fi

# ── Output ────────────────────────────────────────────────────────────────────
if [[ "$MODE" == "--score" ]]; then
  echo "$SCORE"
elif [[ "$MODE" == "--json" ]]; then
  python3 - "$TMP" "$SCORE" "$MAX" << 'PYEOF'
import json, sys
tmp, score, max_score = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
issues, func = [], []
with open(tmp) as f:
  for line in f:
    line = line.rstrip()
    if line.startswith("ISSUE:"): issues.append(line[6:])
    elif line.startswith("FUNC:"): func.append(line[5:])
print(json.dumps({"score": score, "max": max_score, "issues": issues, "functional": func}))
PYEOF
else
  echo ""
  echo "Mechanical score: $SCORE / $MAX"
  FUNC_LINES=$(grep "^FUNC:" "$TMP" | sed 's/^FUNC://' || true)
  [[ -n "$FUNC_LINES" ]] && echo "Functional notes:" && echo "$FUNC_LINES" | while IFS= read -r n; do echo "  · $n"; done
  if [[ -f scripts/delta-judge.sh ]]; then
    DELTA=$(bash scripts/delta-judge.sh 2>/dev/null || echo "0")
    echo "Delta score: $DELTA / 20 (LLM judge)"
  fi
fi
