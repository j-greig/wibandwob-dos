#!/usr/bin/env bash
set -euo pipefail

PROMPT=""
TAG="review"
OUT_FILE=""
NO_FILE=false
MODEL=""
EFFORT=""
SANDBOX="read-only"
WORKDIR=""
JSON_OUTPUT=false
SKIP_GIT=false
CONFIRM_DANGER=false

usage() {
  cat <<USAGE
Usage: codex_review.sh --prompt <text> [options]

  --prompt <text>       Review prompt (required)
  --tag <slug>          Output filename tag (default: review)
  --out <path>          Explicit output file path
  --no-file             Stream to stdout, skip file output
  --model <name>        Codex model (default: uses ~/.codex/config.toml)
  --effort <level>      Reasoning effort: low|medium|high|xhigh
  --sandbox <mode>      Sandbox: read-only|workspace-write|danger-full-access (default: read-only)
  --confirm-danger      Required when using --sandbox danger-full-access
  --workdir <path>      Working directory for codex (-C flag)
  --json                Output JSON Lines format
  --skip-git            Skip git repo check
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
    --prompt)         require_arg "$@"; PROMPT="$2"; shift 2 ;;
    --tag)            require_arg "$@"; TAG="$2"; shift 2 ;;
    --out)            require_arg "$@"; OUT_FILE="$2"; shift 2 ;;
    --no-file)        NO_FILE=true; shift ;;
    --model)          require_arg "$@"; MODEL="$2"; shift 2 ;;
    --effort)         require_arg "$@"; EFFORT="$2"; shift 2 ;;
    --sandbox)        require_arg "$@"; SANDBOX="$2"; shift 2 ;;
    --confirm-danger) CONFIRM_DANGER=true; shift ;;
    --workdir)        require_arg "$@"; WORKDIR="$2"; shift 2 ;;
    --json)           JSON_OUTPUT=true; shift ;;
    --skip-git)       SKIP_GIT=true; shift ;;
    -h|--help)        usage; exit 0 ;;
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

# Gate: danger-full-access requires explicit confirmation flag
if [[ "$SANDBOX" == "danger-full-access" && "$CONFIRM_DANGER" != true ]]; then
  echo "Error: --sandbox danger-full-access requires --confirm-danger flag" >&2
  echo "This mode grants codex full system access. Only use in isolated CI environments." >&2
  exit 2
fi

# Preflight: check codex CLI exists
if ! command -v codex &>/dev/null; then
  echo "Error: codex CLI not found in PATH" >&2
  exit 1
fi

# Build codex exec args
args=(exec --sandbox "$SANDBOX" --ephemeral)
[[ -n "$MODEL" ]] && args+=(-m "$MODEL")
[[ -n "$EFFORT" ]] && args+=(-c "model_reasoning_effort=\"$EFFORT\"")
[[ -n "$WORKDIR" ]] && args+=(-C "$WORKDIR")
[[ "$JSON_OUTPUT" == true ]] && args+=(--json)
[[ "$SKIP_GIT" == true ]] && args+=(--skip-git-repo-check)
args+=("$PROMPT")

if [[ "$NO_FILE" == true ]]; then
  # In no-file mode, let stderr through so errors are visible
  codex "${args[@]}"
  exit 0
fi

if [[ -z "$OUT_FILE" ]]; then
  mkdir -p "$(pwd)/cache/codex-reviews"
  stamp="$(date +%Y%m%d_%H%M%S)"
  OUT_FILE="$(pwd)/cache/codex-reviews/CODEX_REVIEW_${TAG}_${stamp}.txt"
else
  # Ensure parent directory exists for explicit --out paths
  mkdir -p "$(dirname "$OUT_FILE")"
fi

# Capture both stdout and stderr to file (stderr has thinking tokens + errors)
codex "${args[@]}" > "$OUT_FILE" 2>&1
printf '%s\n' "$OUT_FILE"
