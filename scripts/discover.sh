#!/usr/bin/env bash
# @name    discover
# @desc    Unified discovery — scripts, skills, and docs organized by lens
#
# Usage:
#   bash scripts/discover.sh              # full index
#   bash scripts/discover.sh shell        # shell-architect lens only
#   bash scripts/discover.sh microapp     # microapp-builder lens only
#   bash scripts/discover.sh ops          # ops lens only
#   bash scripts/discover.sh quality      # quality lens only
#   bash scripts/discover.sh creative     # creative lens only
#   bash scripts/discover.sh planner      # planner lens only
#   bash scripts/discover.sh --flat       # alphabetical, no lens grouping

set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/.." && pwd)"
FILTER="${1:-all}"

# ── Lens definitions ──────────────────────────────────────────────

# Script → lens mapping
declare_script_lens() {
  case "$1" in
    check-coat|check-themes|gen-primitives|check-describe-state)
      echo "shell" ;;
    scaffold-microapp|reload-microapp|watch-microapp)
      echo "microapp" ;;
    ensure-running|restart|attach|start-alt-instance|handover|list-scripts|discover)
      echo "ops" ;;
    cli-parity-check|runtime-parity-check|blocking-flow-check|live-api-test-suite|cli-batch-relayout|cli-text-loop|layout-sweep|overlap-check|ci-cli-test|cli-runtime-triage)
      echo "quality" ;;
    replay-scpt|wibwob-record|ghostty-shader)
      echo "creative" ;;
    minimap|screenshot-window|capture-tui-png)
      echo "shared" ;;
    *)
      echo "other" ;;
  esac
}

# Skill → lens mapping
declare_skill_lens() {
  case "$1" in
    ww-ops|ww-room-chat)
      echo "ops" ;;
    ww-primitives|chiptune|chiptune-studio|chiptune-cover|codex)
      echo "shell" ;;
    composable-engines|figlet-videographer|img-to-ascii|joan-stark-ascii-art|michel-gondry-music-video-director|vj-timeline|timeline-smoke|discord-tui-share|wibwobdos)
      echo "creative" ;;
    backroom-log-explorer|pi-session-log-explorer|session-archaeology)
      echo "creative" ;;
    tui-smoke-test|simplify|simplify-docs|simplify-planning)
      echo "quality" ;;
    planning-update)
      echo "planner" ;;
    qmd|youtube-transcript)
      echo "shared" ;;
    *)
      echo "other" ;;
  esac
}

# ── Gather scripts ────────────────────────────────────────────────

gather_scripts() {
  for f in "$DIR"/*.sh "$DIR"/*.ts; do
    [ -f "$f" ] || continue
    base="$(basename "$f")"
    name=$(grep -m1 "@name" "$f" 2>/dev/null | sed 's/.*@name *//' || echo "${base%.*}")
    desc=$(grep -m1 "@desc" "$f" 2>/dev/null | sed 's/.*@desc *//' || echo "")
    lens=$(declare_script_lens "$name")
    printf "%s|%s|script|%s\n" "$lens" "$name" "$desc"
  done
}

# ── Gather skills ─────────────────────────────────────────────────

gather_skills() {
  for skill_dir in "$ROOT"/.pi/skills/*/ "$ROOT"/.agents/skills/*/; do
    [ -d "$skill_dir" ] || continue
    skill_file="$skill_dir/SKILL.md"
    [ -f "$skill_file" ] || continue
    name=$(basename "$skill_dir")
    # Extract description from YAML frontmatter
    desc=$(sed -n '/^---$/,/^---$/p' "$skill_file" | grep -m1 "^description:" | sed 's/^description: *["]*//;s/["]*$//' | head -c 80)
    if [ -z "$desc" ]; then
      desc=$(sed -n '/^---$/,/^---$/p' "$skill_file" | sed -n '/^description:/,/^[a-z]/p' | sed '1d;/^[a-z]/d' | head -1 | sed 's/^ *//' | head -c 80)
    fi
    lens=$(declare_skill_lens "$name")
    printf "%s|%s|skill|%s\n" "$lens" "$name" "$desc"
  done
}

# ── Gather docs ───────────────────────────────────────────────────

gather_docs() {
  # .agents/ docs
  for f in "$ROOT"/.agents/*.md "$ROOT"/.agents/guides/*.md "$ROOT"/.agents/specs/*.md "$ROOT"/.agents/reflections/*.md; do
    [ -f "$f" ] || continue
    rel="${f#$ROOT/}"
    base="$(basename "$f" .md)"
    # Use first heading as description
    desc=$(grep -m1 "^# " "$f" | sed 's/^# //' | head -c 60)
    
    # Classify by path
    case "$rel" in
      .agents/guides/microapp*) lens="microapp" ;;
      .agents/guides/shell*)    lens="shell" ;;
      .agents/specs/*)          lens="shell" ;;
      .agents/reflections/*)    lens="meta" ;;
      .agents/integration-surface*) lens="shell" ;;
      *)                        lens="other" ;;
    esac
    printf "%s|%s|doc|%s\n" "$lens" "$rel" "$desc"
  done
  
  # docs/ public
  for f in "$ROOT"/docs/*.md; do
    [ -f "$f" ] || continue
    rel="${f#$ROOT/}"
    desc=$(grep -m1 "^# " "$f" | sed 's/^# //')
    case "$(basename "$f")" in
      building-custom-microapps*) lens="microapp" ;;
      ascii-composition*) lens="creative" ;;
      runtime-stats*) lens="shell" ;;
      README*) lens="shared" ;;
      *) lens="other" ;;
    esac
    printf "%s|%s|doc|%s\n" "$lens" "$rel" "$desc"
  done
}

# ── Output ────────────────────────────────────────────────────────

all_items=$(gather_scripts; gather_skills; gather_docs)

if [ "$FILTER" = "--flat" ]; then
  echo ""
  echo "All items (flat)"
  echo ""
  echo "$all_items" | sort -t'|' -k2 | while IFS='|' read -r lens name kind desc; do
    printf "  %-7s %-35s %s\n" "[$kind]" "$name" "$desc"
  done
  echo ""
  exit 0
fi

# Lens display
print_lens() {
  local lens_id="$1" title="$2" subtitle="$3"
  local items
  items=$(echo "$all_items" | grep "^${lens_id}|" || true)
  [ -z "$items" ] && return
  
  echo ""
  echo "── $title ──"
  echo "   $subtitle"
  echo ""
  
  # Scripts
  local scripts
  scripts=$(echo "$items" | grep '|script|' || true)
  if [ -n "$scripts" ]; then
    local slist=""
    while IFS='|' read -r _ name _ desc; do
      [ -n "$slist" ] && slist="$slist · "
      slist="$slist$name"
    done <<< "$scripts"
    echo "   scripts: $slist"
  fi
  
  # Skills
  local skills
  skills=$(echo "$items" | grep '|skill|' || true)
  if [ -n "$skills" ]; then
    local klist=""
    while IFS='|' read -r _ name _ desc; do
      [ -n "$klist" ] && klist="$klist · "
      klist="$klist$name"
    done <<< "$skills"
    echo "   skills:  $klist"
  fi
  
  # Docs
  local docs
  docs=$(echo "$items" | grep '|doc|' || true)
  if [ -n "$docs" ]; then
    echo "   docs:"
    echo "$docs" | while IFS='|' read -r _ name _ desc; do
      printf "     %-45s %s\n" "$name" "$desc"
    done
  fi
}

lenses="shell:SHELL-ARCHITECT:Host runtime + COAT integrity
microapp:MICROAPP-BUILDER:Build and migrate microapps
ops:OPS:Process lifecycle, health, screenshots
quality:QUALITY:Tests, parity, verification
creative:CREATIVE:Visual composition, art, music
planner:PLANNER:Planning docs, epics, what's next
shared:SHARED:Used across lenses"

echo ""
echo "WibWob-DOS — discover"
echo "Run: bash scripts/discover.sh [lens|--flat]"

echo "$lenses" | while IFS=':' read -r id title subtitle; do
  if [ "$FILTER" = "all" ] || [ "$FILTER" = "$id" ]; then
    print_lens "$id" "$title" "$subtitle"
  fi
done

echo ""
