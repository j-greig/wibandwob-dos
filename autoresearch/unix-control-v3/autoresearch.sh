#!/usr/bin/env bash
# E042 Solid Foundations — Architecture fitness scorer
# Uses a subagent to compare actual codebase against target architecture
# Outputs: architecture_score (0-100, higher is better)
set -uo pipefail

REPO="$(cd "$(dirname "$0")" && pwd)"
TARGET="$REPO/autoresearch/solid-foundations/target-architecture.md"

# Quick deterministic pre-checks (fast, no LLM needed)
# These feed the scorer but also give us hard numbers

# God object line counts
ac_lines=$(wc -l < "$REPO/src/core/app-controller.ts" 2>/dev/null || echo 9999)
ui_lines=$(wc -l < "$REPO/src/core/ui-parts.ts" 2>/dev/null || echo 9999)
bw_lines=$(wc -l < "$REPO/src/windows/browser-windows.ts" 2>/dev/null || echo 9999)
was_lines=$(wc -l < "$REPO/src/services/wibwob-agent-session.ts" 2>/dev/null || echo 9999)

# Files over thresholds
over_1000=$(find "$REPO/src" -name '*.ts' -not -path '*/types/*' -not -path '*/tests/*' | xargs wc -l 2>/dev/null | awk '$1 > 1000 && !/total/' | wc -l | tr -d ' ')
over_500=$(find "$REPO/src" -name '*.ts' -not -path '*/types/*' -not -path '*/tests/*' | xargs wc -l 2>/dev/null | awk '$1 > 500 && !/total/' | wc -l | tr -d ' ')

# as any count
any_count=$(grep -r "as any" "$REPO/src" --include='*.ts' -l 2>/dev/null | xargs grep -c "as any" 2>/dev/null | awk -F: '{s+=$2} END {print s}')

# Layer violations (core importing from services/windows, excluding app-controller)
core_svc_violations=$(grep -r "from ['\"]\.\.\/services\/" "$REPO/src/core" --include='*.ts' -l 2>/dev/null | grep -v app-controller | wc -l | tr -d ' ')
core_win_violations=$(grep -r "from ['\"]\.\.\/windows\/" "$REPO/src/core" --include='*.ts' -l 2>/dev/null | grep -v app-controller | wc -l | tr -d ' ')
core_mod_violations=$(grep -r "from ['\"]\.\.\/\.\.\/modules\/" "$REPO/src/core" --include='*.ts' -l 2>/dev/null | wc -l | tr -d ' ')

# Target files that exist (check key extractions from target architecture)
target_files_exist=0
for f in \
  src/core/action-bridge.ts \
  src/core/window-openers.ts \
  src/core/ui-layout.ts \
  src/core/ui-chrome.ts \
  src/core/ui-tabs.ts \
  src/core/ui-scroll-viewport.ts \
  src/core/ui-sidebar.ts \
  src/core/ui-selectable-list.ts \
  src/core/ui-draft-input.ts \
  src/core/overlays/browser-prompt.ts \
  src/core/overlays/file-browser-prompt.ts \
  src/core/overlays/list-picker.ts \
  src/windows/file-manager-window.ts \
  src/windows/document-reader-window.ts \
  src/services/agent/tool-registry.ts \
  src/services/html-to-markdown.ts \
  src/core/ansi-palette.ts \
  src/tests/helpers.ts; do
  [ -f "$REPO/$f" ] && target_files_exist=$((target_files_exist + 1))
done
total_target_files=18

# Deduplication check
html_to_md_copies=$(grep -rl "htmlToMarkdown\|html_to_markdown\|htmltomarkdown" "$REPO/src/services" --include='*.ts' 2>/dev/null | wc -l | tr -d ' ')

# Output all metrics
echo "god_ac_lines=$ac_lines"
echo "god_ui_lines=$ui_lines"  
echo "god_bw_lines=$bw_lines"
echo "god_was_lines=$was_lines"
echo "over_1000=$over_1000"
echo "over_500=$over_500"
echo "any_count=$any_count"
echo "core_svc_violations=$core_svc_violations"
echo "core_win_violations=$core_win_violations"
echo "core_mod_violations=$core_mod_violations"
echo "target_files_exist=$target_files_exist"
echo "total_target_files=$total_target_files"
echo "html_to_md_copies=$html_to_md_copies"

# Compute composite score (deterministic, fast)
# God objects: target is ac=600, ui=200, bw=0(split), was=400
# Score = how close to target, 0-100 per object, averaged
god_score=$(python3 -c "
import math
def shrink_score(current, original, target):
    if current <= target: return 100
    progress = (original - current) / (original - target) * 100
    return max(0, min(100, progress))

ac = shrink_score($ac_lines, 2244, 600)
ui = shrink_score($ui_lines, 2395, 200)
bw = shrink_score($bw_lines, 2082, 0)
was = shrink_score($was_lines, 1063, 400)
print(f'{(ac + ui + bw + was) / 4:.1f}')
")

# Layer discipline: start at baseline for current state (~10 violations)
# Each violation removed is worth points, scaled so 0 violations = 100
layer_violations=$((core_svc_violations + core_win_violations + core_mod_violations))
layer_score=$(python3 -c "print(max(0, min(100, 100 - $layer_violations * 8)))")

# File health: penalise files over 1000 heavily, 500-999 moderately
# over_500 includes over_1000, so subtract to avoid double-counting
mid_files=$((over_500 - over_1000))
file_health=$(python3 -c "print(max(0, 100 - $over_1000 * 8 - $mid_files * 2))")

# Target file existence: simple percentage
target_score=$(python3 -c "print(round($target_files_exist / $total_target_files * 100, 1))")

# Dedup: target is 1 copy of htmlToMarkdown (or 0 if extracted to shared file)
dedup_score=$(python3 -c "print(100 if $html_to_md_copies <= 1 else max(0, 100 - ($html_to_md_copies - 1) * 50))")

# Type safety: target <20 non-blessed casts, but we count all for simplicity
# ~40 are blessed gaps (permanent), so effective floor is ~40
type_score=$(python3 -c "
count = $any_count
blessed_floor = 40  # permanent blessed type gaps
effective = max(0, count - blessed_floor)
# 0 effective = 100, 115 effective (current) ≈ 10
if effective <= 0: score = 100
elif effective <= 20: score = 90 - effective * 1
else: score = max(5, 70 - effective * 0.5)
print(f'{score:.1f}')
")

# Weighted total
total=$(python3 -c "
god = $god_score * 0.30
layer = $layer_score * 0.25
health = $file_health * 0.20
target = $target_score * 0.10
dedup = $dedup_score * 0.10
types = $type_score * 0.05
total = god + layer + health + target + dedup + types
print(f'{total:.1f}')
")

echo "---"
echo "god_score=$god_score"
echo "layer_score=$layer_score"
echo "file_health=$file_health"
echo "target_score=$target_score"
echo "dedup_score=$dedup_score"  
echo "type_score=$type_score"
echo "architecture_score=$total"
