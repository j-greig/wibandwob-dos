#!/usr/bin/env bash
set -euo pipefail

PROMPT=""
TAG="review"
OUT_FILE=""
NO_FILE=false

usage() {
  cat <<USAGE
Usage: run_claude_review.sh --prompt <text> [--tag <slug>] [--out <path>] [--no-file]
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --prompt) PROMPT="$2"; shift 2 ;;
    --tag) TAG="$2"; shift 2 ;;
    --out) OUT_FILE="$2"; shift 2 ;;
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

if [[ "$NO_FILE" == true ]]; then
  claude -p "$PROMPT"
  exit 0
fi

if [[ -z "$OUT_FILE" ]]; then
  mkdir -p "$(pwd)/cache/claude-cli-reviews"
  stamp="$(date +%Y%m%d_%H%M%S)"
  OUT_FILE="$(pwd)/cache/claude-cli-reviews/CLAUDE_REVIEW_${TAG}_${stamp}.txt"
fi

claude -p "$PROMPT" > "$OUT_FILE" 2>&1
printf '%s\n' "$OUT_FILE"
