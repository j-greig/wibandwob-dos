#!/usr/bin/env bash
# planning.sh — Epic status from YAML frontmatter in .planning/epics/
#
# Commands:
#   status    Show epic status table (default)
#   sync      Update .planning/epics/STATUS.md from frontmatter
#   detail    Show full frontmatter for one epic (e.g. planning.sh detail E003)
#
# Fast: parses frontmatter with awk, no agents or network calls needed.
set -euo pipefail

EPICS_DIR=".planning/epics"
STATUS_FILE="$EPICS_DIR/EPIC_STATUS.md"

# Find repo root (walk up from cwd)
find_root() {
    local dir="$PWD"
    while [[ "$dir" != "/" ]]; do
        [[ -d "$dir/$EPICS_DIR" ]] && echo "$dir" && return 0
        dir=$(dirname "$dir")
    done
    echo "ERROR: Cannot find $EPICS_DIR from $PWD" >&2
    exit 1
}

ROOT=$(find_root)
EPICS_PATH="$ROOT/$EPICS_DIR"

# Parse YAML frontmatter from a file. Outputs key=value lines.
# Only reads between first --- and second ---.
parse_frontmatter() {
    local file="$1"
    awk '
        /^---$/ { if (in_fm) exit; in_fm=1; next }
        in_fm && /^[a-z_]+:/ {
            key = $0; sub(/:.*/, "", key)
            val = $0; sub(/^[^:]+:[[:space:]]*/, "", val)
            print key "=" val
        }
    ' "$file"
}

# Get a single frontmatter field
get_field() {
    local file="$1" field="$2"
    parse_frontmatter "$file" | grep "^${field}=" | head -1 | sed "s/^${field}=//"
}

# Collect all epic data as tab-separated lines
collect_epics() {
    for dir in "$EPICS_PATH"/e[0-9]*/; do
        [[ -d "$dir" ]] || continue
        local dirname
        dirname=$(basename "$dir")
        local brief="$dir/${dirname%%-*}-epic-brief.md"

        # Extract epic ID prefix for brief filename (e001 -> e001-epic-brief.md)
        local prefix="${dirname%%-*}"
        brief="$dir/${prefix}-epic-brief.md"

        if [[ ! -f "$brief" ]]; then
            echo "${dirname}	?	?	?	?	?"
            continue
        fi

        local id title status issue pr depends
        id=$(get_field "$brief" "id")
        title=$(get_field "$brief" "title")
        status=$(get_field "$brief" "status")
        issue=$(get_field "$brief" "issue")
        pr=$(get_field "$brief" "pr")
        depends=$(get_field "$brief" "depends_on")

        echo "${dirname}	${id:-?}	${title:-?}	${status:-?}	${issue:-~}	${pr:-~}"
    done
}

# Status symbols
status_icon() {
    case "$1" in
        done)         echo "[x]" ;;
        in-progress)  echo "[~]" ;;
        blocked)      echo "[!]" ;;
        not-started)  echo "[ ]" ;;
        dropped)      echo "[-]" ;;
        *)            echo "[?]" ;;
    esac
}

cmd_status() {
    local data
    data=$(collect_epics)

    if [[ -z "$data" ]]; then
        echo "No epics found in $EPICS_PATH"
        exit 0
    fi

    # Count
    local total done_count active_count
    total=$(echo "$data" | wc -l | tr -d ' ')
    done_count=$(echo "$data" | awk -F'\t' '$4=="done"' | wc -l | tr -d ' ')
    active_count=$(echo "$data" | awk -F'\t' '$4=="in-progress"' | wc -l | tr -d ' ')

    echo "Epic Status (${done_count}/${total} done)"
    echo ""

    # Table output
    while IFS=$'\t' read -r dirname id title status issue pr; do
        local icon
        icon=$(status_icon "$status")
        local issue_ref=""
        [[ "$issue" != "~" && "$issue" != "?" ]] && issue_ref=" #${issue}"
        local pr_ref=""
        [[ "$pr" != "~" && "$pr" != "?" ]] && pr_ref=" PR#${pr}"

        printf "  %s %s: %s  %s%s%s\n" "$icon" "$id" "$title" "$status" "$issue_ref" "$pr_ref"
    done <<< "$data"

    echo ""
}

cmd_sync() {
    local data
    data=$(collect_epics)

    # Build STATUS.md content
    local content
    content="# Epic Status Register

> Machine-parseable index. One line per epic: \`<dir> — <status>\`.
> Valid statuses: \`not-started\`, \`in-progress\`, \`blocked\`, \`done\`, \`dropped\`.
> Canonical detail lives in each epic's frontmatter and GitHub issue.

"
    while IFS=$'\t' read -r dirname id title status issue pr; do
        content+="${dirname} — ${status}"$'\n'
    done <<< "$data"

    echo "$content" > "$ROOT/$STATUS_FILE"
    echo "Synced $STATUS_FILE from frontmatter"

    # Show result
    cmd_status
}

cmd_detail() {
    local target="${1:-}"
    if [[ -z "$target" ]]; then
        echo "Usage: planning.sh detail <epic-id>" >&2
        echo "  e.g. planning.sh detail E003" >&2
        exit 1
    fi

    # Normalise: E003 -> e003, e003 -> e003
    target=$(echo "$target" | tr '[:upper:]' '[:lower:]')

    for dir in "$EPICS_PATH"/e[0-9]*/; do
        local dirname
        dirname=$(basename "$dir")
        local prefix="${dirname%%-*}"

        if [[ "$prefix" == "$target" ]]; then
            local brief="$dir/${prefix}-epic-brief.md"
            if [[ ! -f "$brief" ]]; then
                echo "No brief found: $brief" >&2
                exit 1
            fi
            echo "--- $dirname ---"
            parse_frontmatter "$brief" | while IFS='=' read -r key val; do
                printf "  %-12s %s\n" "$key:" "$val"
            done
            return 0
        fi
    done

    echo "Epic not found: $target" >&2
    exit 1
}

# --- Dispatch ---

COMMAND="${1:-status}"
shift || true

case "$COMMAND" in
    status)  cmd_status "$@" ;;
    sync)    cmd_sync "$@" ;;
    detail)  cmd_detail "$@" ;;
    help|*)
        echo "planning.sh — Epic status from frontmatter"
        echo ""
        echo "Commands:"
        echo "  status    Show epic status table (default)"
        echo "  sync      Update STATUS.md from epic frontmatter"
        echo "  detail    Show frontmatter for one epic (e.g. detail E003)"
        ;;
esac
