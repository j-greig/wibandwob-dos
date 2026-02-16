#!/usr/bin/env bash
set -euo pipefail

PROMPT=""
TAG="review"
OUT_FILE=""
NO_FILE=false

usage() {
  cat <<USAGE
Usage: run_claude_review.sh --prompt <text> [--tag <slug>] [--out <path>] [--no-file]

  Run claude -p as a reviewer. For codex reviews, use codex-review skill instead.
USAGE
}

# Helper: require a value argument after a flag
require_arg() {
  if [[ $# -lt 2 || "$2" == --* ]]; then
    echo "Error: $1 requires a value" >&2
    usage
    exit 2
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --prompt)  require_arg "$@"; PROMPT="$2"; shift 2 ;;
    --tag)     require_arg "$@"; TAG="$2"; shift 2 ;;
    --out)     require_arg "$@"; OUT_FILE="$2"; shift 2 ;;
    --no-file) NO_FILE=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage; exit 2 ;;
  esac
done

if [[ -z "$PROMPT" ]]; then
  echo "--prompt is required" >&2
  usage
  exit 2
fi

# Sanitize tag: allow only alphanumeric, dash, underscore, dot
if [[ ! "$TAG" =~ ^[A-Za-z0-9._-]+$ ]]; then
  echo "Error: --tag must match [A-Za-z0-9._-]+ (got: $TAG)" >&2
  exit 2
fi

# Preflight: check claude CLI exists
if ! command -v claude &>/dev/null; then
  echo "Error: claude CLI not found in PATH" >&2
  exit 1
fi

if [[ "$NO_FILE" == true ]]; then
  claude -p "$PROMPT"
  exit 0
fi

if [[ -z "$OUT_FILE" ]]; then
  mkdir -p "$(pwd)/cache/claude-cli-reviews"
  stamp="$(date +%Y%m%d_%H%M%S)"
  OUT_FILE="$(pwd)/cache/claude-cli-reviews/CLAUDE_REVIEW_${TAG}_${stamp}.txt"
else
  # Ensure parent directory exists for explicit --out paths
  mkdir -p "$(dirname "$OUT_FILE")"
fi

claude -p "$PROMPT" > "$OUT_FILE" 2>&1
printf '%s\n' "$OUT_FILE"
