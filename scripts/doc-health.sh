#!/usr/bin/env bash
# doc-health.sh — measures documentation system integrity
#
# Uses only the system's own self-describing properties as instruments:
#   @watches/@output/@run headers on gen scripts
#   <!-- AUTO-GENERATED / Watched / Regenerate / Parent --> on outputs
#   <progressive-disclosure><output> tags in CAPS files
#
# Axes (10 pts each = 80 pts mechanical):
#   1. Staleness          — doc-sync --check
#   2. Script headers     — all gen-* have @watches/@output/@run
#   3. Back-links         — all outputs have all 4 <!-- --> header lines
#   4. Forward-links      — all outputs have <!-- Parent: -->
#   5. PD integrity       — every <output> path in CAPS files exists on disk
#   6. @watches precision — no watch glob resolves to 20+ files
#   7. Loop circularity   — full loop: script→output→back-link→parent CAPS→output
#   8. Orphan detection   — no generated files whose generator no longer exists
#
# + delta score (0-20 from delta-judge.sh if available)
#
# Usage:
#   bash scripts/doc-health.sh          # full report
#   bash scripts/doc-health.sh --score  # print mechanical score only

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

SCORE=0
ISSUES=()
MAX=80

pass() { SCORE=$((SCORE + 10)); echo "  ✓ $1"; }
fail() { ISSUES+=("$1"); echo "  ✗ $1"; }

echo "doc-health — $(date +%Y-%m-%d)"
echo ""

# ── Axis 1: Staleness ────────────────────────────────────────────────────────
echo "1. Staleness"
if bash scripts/doc-sync.sh --check > /dev/null 2>&1; then
  pass "all outputs current"
else
  fail "stale outputs — run: bash scripts/doc-sync.sh"
fi

# ── Axis 2: Script headers ───────────────────────────────────────────────────
echo "2. Script headers (@watches/@output/@run)"
missing_headers=0
for script in scripts/gen-*.ts scripts/gen-*.py; do
  [[ -f "$script" ]] || continue
  for tag in @watches @output @run; do
    grep -qE "^(//|#) $tag" "$script" || { fail "$script missing $tag"; missing_headers=$((missing_headers+1)); }
  done
done
[[ $missing_headers -eq 0 ]] && pass "all gen scripts have required headers"

# ── Axis 3: Back-links ───────────────────────────────────────────────────────
echo "3. Back-links (AUTO-GENERATED / Watched / Regenerate)"
missing_backlinks=0
for script in scripts/gen-*.ts scripts/gen-*.py; do
  [[ -f "$script" ]] || continue
  output=$(grep -E "^(//|#) @output" "$script" | sed 's|.*@output ||' | tr -d ' ')
  [[ -z "$output" || ! -f "$output" ]] && continue
  for marker in "AUTO-GENERATED" "Watched:" "Regenerate:"; do
    grep -q "$marker" "$output" || { fail "$output missing <!-- $marker -->"; missing_backlinks=$((missing_backlinks+1)); }
  done
done
[[ $missing_backlinks -eq 0 ]] && pass "all outputs have back-link headers"

# ── Axis 4: Forward-links (Parent) ───────────────────────────────────────────
echo "4. Forward-links (<!-- Parent: -->)"
missing_parents=0
for script in scripts/gen-*.ts scripts/gen-*.py; do
  [[ -f "$script" ]] || continue
  output=$(grep -E "^(//|#) @output" "$script" | sed 's|.*@output ||' | tr -d ' ')
  [[ -z "$output" || ! -f "$output" ]] && continue
  grep -q "Parent:" "$output" || { fail "$output missing <!-- Parent: -->"; missing_parents=$((missing_parents+1)); }
done
[[ $missing_parents -eq 0 ]] && pass "all outputs have parent forward-links"

# ── Axis 5: Progressive-disclosure integrity ─────────────────────────────────
echo "5. Progressive-disclosure integrity"
missing_outputs=0
for caps in AGENTS.md ARCHITECTURE.md SDK.md PHILOSOPHY.md; do
  [[ -f "$caps" ]] || continue
  while IFS= read -r line; do
    path=$(echo "$line" | sed 's|.*<output>||;s|</output>.*||' | grep -oE '\`[^`]+\`' | head -1 | tr -d '`' | awk '{print $1}')
    [[ -z "$path" || "$path" == *"..."* || "$path" == *"bun"* || "$path" == *"python"* ]] && continue
    [[ -f "$path" ]] || { fail "$caps: <output> path not found: $path"; missing_outputs=$((missing_outputs+1)); }
  done < <(grep '<output>' "$caps" 2>/dev/null || true)
done
[[ $missing_outputs -eq 0 ]] && pass "all <output> paths exist on disk"

# ── Axis 6: @watches precision (file count) ──────────────────────────────────
echo "6. @watches precision"
broad=0
WATCH_THRESHOLD=20
for script in scripts/gen-*.ts scripts/gen-*.py; do
  [[ -f "$script" ]] || continue
  while IFS= read -r watch; do
    watch=$(echo "$watch" | tr -d ' ')
    [[ -z "$watch" ]] && continue
    count=$(git ls-files "$watch" 2>/dev/null | wc -l | tr -d ' ')
    # Skip patterns ending in a specific filename — those are precise even if many match
    [[ "$watch" == *"/"*"."* ]] && continue
    if [[ "$count" -ge $WATCH_THRESHOLD ]]; then
      fail "$script @watches '$watch' matches $count files — too broad (threshold: $WATCH_THRESHOLD)"
      broad=$((broad+1))
    fi
  done < <(grep -E "^(//|#) @watches" "$script" | sed 's|.*@watches ||' | tr ' ' '\n')
done
[[ $broad -eq 0 ]] && pass "@watches paths each resolve to <$WATCH_THRESHOLD files"

# ── Axis 7: Loop circularity ─────────────────────────────────────────────────
echo "7. Loop circularity (script→output→back-link→parent CAPS→output)"
open_loops=0
for script in scripts/gen-*.ts scripts/gen-*.py; do
  [[ -f "$script" ]] || continue
  script_base=$(basename "$script")
  output=$(grep -E "^(//|#) @output" "$script" | sed 's|.*@output ||' | tr -d ' ')
  [[ -z "$output" || ! -f "$output" ]] && continue

  # Link 1: output back-links to THIS script
  if ! grep -q "AUTO-GENERATED by $script" "$output" 2>/dev/null; then
    fail "broken loop: $output back-link doesn't reference $script"
    open_loops=$((open_loops+1)); continue
  fi

  # Link 2: output has a Parent CAPS file
  parent_line=$(grep "Parent:" "$output" 2>/dev/null | head -1 || true)
  [[ -z "$parent_line" ]] && { fail "broken loop: $output has no Parent header"; open_loops=$((open_loops+1)); continue; }
  caps_file=$(echo "$parent_line" | grep -oE '[A-Z]+\.md' | head -1)
  [[ -z "$caps_file" || ! -f "$caps_file" ]] && { fail "broken loop: $output Parent CAPS '$caps_file' not found"; open_loops=$((open_loops+1)); continue; }

  # Link 3: parent CAPS has a <output> tag referencing this output
  if ! grep -q "$output" "$caps_file" 2>/dev/null; then
    fail "broken loop: $caps_file has no <output> referencing $output"
    open_loops=$((open_loops+1)); continue
  fi
done
[[ $open_loops -eq 0 ]] && pass "all loops are closed"

# ── Axis 8: Orphan detection ─────────────────────────────────────────────────
echo "8. Orphan detection"
orphans=0
while IFS= read -r artifact; do
  [[ -f "$artifact" ]] || continue
  generator=$(grep -oE "AUTO-GENERATED by scripts/[^ :-]+" "$artifact" 2>/dev/null | sed 's/AUTO-GENERATED by //' | head -1 || true)
  [[ -z "$generator" ]] && continue
  [[ -f "$generator" ]] || {
    fail "orphan: $artifact claims generator '$generator' which no longer exists"
    orphans=$((orphans+1))
  }
done < <(git ls-files '*.md' '*.ts' 2>/dev/null | xargs grep -l "AUTO-GENERATED by" 2>/dev/null || true)
[[ $orphans -eq 0 ]] && pass "no orphaned generated files"

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "Mechanical score: $SCORE / $MAX"

if [[ -f scripts/delta-judge.sh ]]; then
  echo ""
  echo "Running delta judge..."
  DELTA=$(bash scripts/delta-judge.sh 2>/dev/null || echo "0")
  TOTAL=$((SCORE + DELTA))
  echo "Delta score:      $DELTA / 20"
  echo "Total:            $TOTAL / $((MAX + 20))"
fi

if [[ ${#ISSUES[@]} -gt 0 ]]; then
  echo ""
  echo "Open loops / issues:"
  for i in "${ISSUES[@]}"; do echo "  · $i"; done
fi

[[ "$*" == "--score" ]] && echo "$SCORE" && exit 0 || exit 0
