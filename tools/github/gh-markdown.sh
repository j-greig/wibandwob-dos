#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  tools/github/gh-markdown.sh [--dry-run] issue-comment <issue-number> [body-file|-]
  tools/github/gh-markdown.sh [--dry-run] pr-comment <pr-number> [body-file|-]
  tools/github/gh-markdown.sh [--dry-run] pr-body <pr-number> [body-file|-]

Notes:
  - Omit body-file or pass '-' to read markdown from stdin.
  - Always posts via --body-file to preserve line breaks.
USAGE
}

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
  shift
fi

ACTION="${1:-}"
TARGET="${2:-}"
SOURCE="${3:--}"

if [[ -z "$ACTION" || -z "$TARGET" ]]; then
  usage
  exit 2
fi

if [[ "$SOURCE" == "-" ]]; then
  BODY_FILE=$(mktemp)
  trap 'rm -f "$BODY_FILE"' EXIT
  cat > "$BODY_FILE"
else
  BODY_FILE="$SOURCE"
fi

if [[ ! -f "$BODY_FILE" ]]; then
  echo "Body file not found: $BODY_FILE" >&2
  exit 2
fi

case "$ACTION" in
  issue-comment)
    CMD=(gh issue comment "$TARGET" --body-file "$BODY_FILE")
    ;;
  pr-comment)
    CMD=(gh pr comment "$TARGET" --body-file "$BODY_FILE")
    ;;
  pr-body)
    CMD=(gh pr edit "$TARGET" --body-file "$BODY_FILE")
    ;;
  *)
    usage
    exit 2
    ;;
esac

if [[ "$DRY_RUN" -eq 1 ]]; then
  printf 'dry-run: %q ' "${CMD[@]}"
  printf '\n'
  echo "body-file: $BODY_FILE"
  exit 0
fi

"${CMD[@]}"
