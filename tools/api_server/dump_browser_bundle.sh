#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  tools/api_server/dump_browser_bundle.sh <url> [options]

Options:
  --api-base <url>          API base URL (default: http://127.0.0.1:8089)
  --reader <name>           readability|trafilatura|raw (default: trafilatura)
  --width <n>               Render width cells (default: 100)
  --modes <csv>             Image modes CSV (default: key-inline,all-inline)
  --out-root <path>         Dump root dir (default: logs/browser/dumps)
  --no-state                Skip /state snapshot
  --probe-markdown-edge     Probe URL with 'Accept: text/markdown'
  --help                    Show this help

Examples:
  tools/api_server/dump_browser_bundle.sh https://symbient.life
  tools/api_server/dump_browser_bundle.sh https://blog.cloudflare.com/markdown-for-agents/ --probe-markdown-edge
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

if [[ $# -lt 1 ]]; then
  usage
  exit 1
fi

URL="$1"
shift

API_BASE="http://127.0.0.1:8089"
READER="trafilatura"
WIDTH="100"
MODES_CSV="key-inline,all-inline"
OUT_ROOT="logs/browser/dumps"
INCLUDE_STATE=1
PROBE_MARKDOWN_EDGE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --api-base)
      API_BASE="$2"; shift 2 ;;
    --reader)
      READER="$2"; shift 2 ;;
    --width)
      WIDTH="$2"; shift 2 ;;
    --modes)
      MODES_CSV="$2"; shift 2 ;;
    --out-root)
      OUT_ROOT="$2"; shift 2 ;;
    --no-state)
      INCLUDE_STATE=0; shift ;;
    --probe-markdown-edge)
      PROBE_MARKDOWN_EDGE=1; shift ;;
    --help|-h)
      usage; exit 0 ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1 ;;
  esac
done

for cmd in curl jq; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd" >&2
    exit 1
  fi
done

TS="$(date +%Y%m%d_%H%M%S)"
OUT_DIR="$OUT_ROOT/$TS"
mkdir -p "$OUT_DIR"

curl -sf "$API_BASE/health" > "$OUT_DIR/health.json"

IFS=',' read -r -a MODES <<< "$MODES_CSV"

dump_mode() {
  local mode="$1"
  local slug="${mode//-/_}"
  local raw="$OUT_DIR/browser_fetch_ext.${slug}.raw.json"
  local bundle="$OUT_DIR/browser_fetch_ext.${slug}.bundle.json"

  local payload
  payload="$(jq -nc \
    --arg url "$URL" \
    --arg reader "$READER" \
    --arg fmt "tui_bundle" \
    --arg images "$mode" \
    --argjson width "$WIDTH" \
    '{url:$url, reader:$reader, format:$fmt, images:$images, width:$width}')"

  curl -sf -X POST "$API_BASE/browser/fetch_ext" \
    -H 'Content-Type: application/json' \
    -d "$payload" > "$raw"

  jq '.bundle // .' "$raw" > "$bundle"
  jq -r '.tui_text // ""' "$bundle" > "$OUT_DIR/browser_fetch_ext.${slug}.tui_text.txt"
  jq -r '.markdown // ""' "$bundle" > "$OUT_DIR/browser_fetch_ext.${slug}.markdown.txt"
  jq '.links // []' "$bundle" > "$OUT_DIR/browser_fetch_ext.${slug}.links.json"
  jq '[.assets[]? | {id, alt, source_url, status, render_meta, render_error}]' "$bundle" > "$OUT_DIR/browser_fetch_ext.${slug}.assets.summary.json"
}

for mode in "${MODES[@]}"; do
  mode="$(echo "$mode" | xargs)"
  [[ -z "$mode" ]] && continue
  dump_mode "$mode"
done

if [[ "$INCLUDE_STATE" -eq 1 ]]; then
  curl -sf "$API_BASE/state" > "$OUT_DIR/state.raw.json"
  jq . "$OUT_DIR/state.raw.json" > "$OUT_DIR/state.pretty.json"
fi

if [[ "$PROBE_MARKDOWN_EDGE" -eq 1 ]]; then
  curl -sS -D "$OUT_DIR/edge_markdown.headers.txt" \
    -H 'Accept: text/markdown' \
    "$URL" > "$OUT_DIR/edge_markdown.body.md"
fi

README="$OUT_DIR/README.txt"
{
  echo "dump_dir: $OUT_DIR"
  echo "generated_at: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "source_url: $URL"
  echo "api_base: $API_BASE"
  echo "reader: $READER"
  echo "width: $WIDTH"
  echo

  for mode in "${MODES[@]}"; do
    mode="$(echo "$mode" | xargs)"
    [[ -z "$mode" ]] && continue
    slug="${mode//-/_}"
    bundle="$OUT_DIR/browser_fetch_ext.${slug}.bundle.json"
    echo "[$mode]"
    echo "title: $(jq -r '.title // ""' "$bundle")"
    echo "text_chars: $(jq -r '(.tui_text // "") | length' "$bundle")"
    echo "markdown_chars: $(jq -r '(.markdown // "") | length' "$bundle")"
    echo "assets_total: $(jq -r '(.assets // []) | length' "$bundle")"
    echo "assets_ready: $(jq -r '[.assets[]? | select(.status=="ready")] | length' "$bundle")"
    echo "assets_failed: $(jq -r '[.assets[]? | select(.status=="failed")] | length' "$bundle")"
    echo "assets_deferred: $(jq -r '[.assets[]? | select(.status=="deferred")] | length' "$bundle")"
    echo "assets_skipped: $(jq -r '[.assets[]? | select(.status=="skipped")] | length' "$bundle")"
    echo
  done

  if [[ -f "$OUT_DIR/state.raw.json" ]]; then
    echo "[state]"
    echo "pattern_mode: $(jq -r '.pattern_mode // ""' "$OUT_DIR/state.raw.json")"
    echo "window_count: $(jq -r '(.windows // []) | length' "$OUT_DIR/state.raw.json")"
    echo "focused_window: $(jq -r '([.windows[]? | select(.focused==true)][0].title // "none")' "$OUT_DIR/state.raw.json")"
    echo
  fi

  if [[ "$PROBE_MARKDOWN_EDGE" -eq 1 ]]; then
    echo "[edge_markdown_probe]"
    echo "accept_header: text/markdown"
    if grep -qi '^x-markdown-tokens:' "$OUT_DIR/edge_markdown.headers.txt"; then
      grep -i '^x-markdown-tokens:' "$OUT_DIR/edge_markdown.headers.txt" | sed 's/^/x-markdown-tokens: /'
    else
      echo "x-markdown-tokens: (header missing)"
    fi
    ctype="$(grep -i '^content-type:' "$OUT_DIR/edge_markdown.headers.txt" | head -n1 | sed 's/^content-type:[[:space:]]*//I')"
    [[ -n "$ctype" ]] && echo "content-type: $ctype"
    echo
  fi

  echo "[files]"
  ls -1 "$OUT_DIR" | sed 's/^/- /'
} > "$README"

echo "$OUT_DIR"
echo "Wrote: $README"
