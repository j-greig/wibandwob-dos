#!/usr/bin/env bash
# devlog-triage.sh — cross-reference devlog ideas with git commits
# Usage:
#   scripts/devlog-triage.sh W13             # triage W13
#   scripts/devlog-triage.sh W13 --out file  # write to file
#
# Reads [id:WXX-NNN][status:...] tags from .pi/reflections/YYYY-WXX.md
# Cross-references git log for "Addresses WXX-NNN" in commit messages
# Outputs a markdown triage table

set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REFLECTIONS_DIR="$REPO_ROOT/.pi/reflections"

WEEK="${1:-}"
OUT=""
shift 2>/dev/null || true
while [[ $# -gt 0 ]]; do
    case "$1" in --out) OUT="$2"; shift 2 ;; *) shift ;; esac
done

[[ -z "$WEEK" ]] && WEEK="W$(date +%V)"
YEAR=$(date +%Y)

FILE="$REFLECTIONS_DIR/${YEAR}-${WEEK}.md"
if [[ ! -f "$FILE" ]]; then
    echo "❌ No reflection file found for ${YEAR}-${WEEK}" >&2; exit 1
fi
echo "📖 Reading $FILE..." >&2

# Extract tagged entries into flat files (bash 3 compatible — no associative arrays)
TMP=$(mktemp -d)
trap "rm -rf $TMP" EXIT

open_count=0; shipped_count=0; killed_count=0

# Scan only lines under "#### → Ideas" or "#### → Quick notes" sections
# (falls back to scanning everything for older unstructured files)
in_ideas=0
has_sections=0
grep -q "^#### → " "$FILE" && has_sections=1

while IFS= read -r line; do
    # Track whether we're inside an ideas section
    if echo "$line" | grep -qE '^#### → '; then
        in_ideas=1; continue
    elif echo "$line" | grep -qE '^#{1,4} '; then
        in_ideas=0
    fi
    # For structured files, only tag inside → sections; for legacy files, scan all
    [[ $has_sections -eq 1 && $in_ideas -eq 0 ]] && continue

    if echo "$line" | grep -qE '\[id:(W[0-9]+-[0-9]+)\]\[status:([^]]+)\]'; then
        id=$(echo "$line"     | grep -oE '\[id:(W[0-9]+-[0-9]+)\]' | grep -oE 'W[0-9]+-[0-9]+')
        status=$(echo "$line"  | grep -oE '\[status:[^]]+\]'        | sed 's/\[status://;s/\]//')
        desc=$(echo "$line"   | sed 's/ `\{0,1\}\[id:[^]]*\]\[status:[^]]*\]`\{0,1\}//g; s/^[[:space:]]*-[[:space:]]*//' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        echo "$status" > "$TMP/$id.status"
        echo "$desc"   > "$TMP/$id.desc"
    fi
done < "$FILE"

ids=$(ls "$TMP"/*.status 2>/dev/null | xargs -I{} basename {} .status | sort || true)

if [[ -z "$ids" ]]; then
    echo "ℹ️  No tagged ideas found in $FILE"
    echo "   Add tags like \`[id:${WEEK}-001][status:open]\` to entries to enable auto-triage."
    exit 0
fi

# Cross-reference git log
echo "🔍 Scanning git log for 'Addresses ${WEEK}-'..." >&2
GIT_LOG=$(git -C "$REPO_ROOT" log --all --pretty="%h %s %b" 2>/dev/null || true)

for id in $ids; do
    [[ ! -f "$TMP/$id.status" ]] && continue
    if echo "$GIT_LOG" | grep -qi "Addresses ${id}"; then
        cur=$(cat "$TMP/$id.status")
        if [[ "$cur" == "open" ]]; then
            commit=$(echo "$GIT_LOG" | grep -i "Addresses ${id}" | head -1 | awk '{print $1}')
            echo "shipped:${commit}" > "$TMP/$id.status"
        fi
    fi
done

# Build table
build_output() {
    echo "# Devlog triage — ${YEAR}-${WEEK}"
    echo ""
    echo "Generated: $(date '+%Y-%m-%d %H:%M')"
    echo ""
    echo "| ID | Status | Description |"
    echo "|----|--------|-------------|"

    for id in $ids; do
        status=$(cat "$TMP/$id.status")
        desc=$(cat "$TMP/$id.desc")
        case "$status" in
            open)       mark="❌ open";        open_count=$(( open_count + 1 ))      ;;
            shipped:*)  mark="✅ ${status}";   shipped_count=$(( shipped_count + 1 )) ;;
            killed)     mark="🪦 killed";      killed_count=$(( killed_count + 1 ))  ;;
            *)          mark="? ${status}"                                             ;;
        esac
        echo "| \`${id}\` | ${mark} | ${desc} |"
    done

    total=$(echo "$ids" | wc -w | tr -d ' ')
    echo ""
    echo "**${total} total — ${shipped_count} shipped · ${open_count} open · ${killed_count} killed**"

    if [[ $open_count -gt 0 ]]; then
        echo ""
        echo "## Top open items"
        echo ""
        count=0
        for id in $ids; do
            [[ "$(cat "$TMP/$id.status")" != "open" ]] && continue
            count=$(( count + 1 ))
            echo "${count}. \`${id}\` — $(cat "$TMP/$id.desc")"
            [[ $count -ge 5 ]] && break
        done
    fi
}

build_output > "${TMP}/result.md" || true

if [[ -n "$OUT" ]]; then
    cp "${TMP}/result.md" "$OUT"
    echo "" >&2
    echo "📄 Written to $OUT" >&2
fi

cat "${TMP}/result.md"
