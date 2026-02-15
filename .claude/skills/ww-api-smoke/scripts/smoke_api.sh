#!/usr/bin/env bash
set -euo pipefail

BASE_URL="http://127.0.0.1:8089"
OPEN_URL=""
WINDOW_MODE="new"
WINDOW_ID=""
ENDPOINT="/browser/get_content"
METHOD="POST"
JSON_PAYLOAD=""
FORMAT="text"
WAIT_MS=600
EXTRACT_PATH=""
OUT_FILE=""
RAW_ONLY=false
FAIL_ON_INVALID_JSON=false

usage() {
  cat <<USAGE
Usage: smoke_api.sh [options]

Options:
  --base <url>                 API base URL (default: http://127.0.0.1:8089)
  --open-url <url>             Browser auto-flow URL (calls /browser/open)
  --window-mode <new|same>     Browser open mode (default: new)
  --window-id <id>             Existing browser window id
  --endpoint <path>            Endpoint path (default: /browser/get_content)
  --method <GET|POST>          HTTP method for endpoint (default: POST)
  --json <payload>             JSON payload for endpoint
  --format <text|markdown|links>  Shorthand for /browser/get_content format (default: text)
  --wait-ms <n>                Delay after /browser/open (default: 600)
  --extract <path>             Extract dotted path (e.g. content, windows[0].id)
  --out <path>                 Output report path
  --raw                         Keep raw output only (skip extracted section)
  --fail-on-invalid-json       Fail if any response JSON is invalid
  -h, --help                   Show this help
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base) BASE_URL="$2"; shift 2 ;;
    --open-url) OPEN_URL="$2"; shift 2 ;;
    --window-mode) WINDOW_MODE="$2"; shift 2 ;;
    --window-id) WINDOW_ID="$2"; shift 2 ;;
    --endpoint) ENDPOINT="$2"; shift 2 ;;
    --method) METHOD="$2"; shift 2 ;;
    --json) JSON_PAYLOAD="$2"; shift 2 ;;
    --format) FORMAT="$2"; shift 2 ;;
    --wait-ms) WAIT_MS="$2"; shift 2 ;;
    --extract) EXTRACT_PATH="$2"; shift 2 ;;
    --out) OUT_FILE="$2"; shift 2 ;;
    --raw) RAW_ONLY=true; shift ;;
    --fail-on-invalid-json) FAIL_ON_INVALID_JSON=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage; exit 2 ;;
  esac
done

if [[ -z "$OUT_FILE" ]]; then
  mkdir -p "$(pwd)/cache/api-smoke"
  OUT_FILE="$(pwd)/cache/api-smoke/TEMP_API_SMOKE_$(date +%Y%m%d_%H%M%S).txt"
fi

call_endpoint() {
  local method="$1"
  local url="$2"
  local payload="${3:-}"
  local tmp
  tmp="$(mktemp)"
  if [[ "$method" == "GET" ]]; then
    HTTP_STATUS="$(curl -sS -o "$tmp" -w "%{http_code}" -X GET "$url")"
  elif [[ -n "$payload" ]]; then
    HTTP_STATUS="$(curl -sS -o "$tmp" -w "%{http_code}" -X "$method" "$url" -H 'Content-Type: application/json' -d "$payload")"
  else
    HTTP_STATUS="$(curl -sS -o "$tmp" -w "%{http_code}" -X "$method" "$url")"
  fi
  BODY="$(cat "$tmp")"
  rm -f "$tmp"
}

json_build() {
  python3 - <<'PY' "$@"
import json, sys
pairs = sys.argv[1:]
if len(pairs) % 2 != 0:
    raise SystemExit("json_build requires key/value pairs")
obj = {}
for i in range(0, len(pairs), 2):
    obj[pairs[i]] = pairs[i+1]
print(json.dumps(obj, ensure_ascii=False))
PY
}

json_is_valid() {
  local body="$1"
  python3 - <<'PY' "$body"
import json,sys
try:
    json.loads(sys.argv[1])
    print("ok")
except Exception:
    print("bad")
PY
}

extract_json_path() {
  local body="$1"
  local path="$2"
  python3 - <<'PY' "$body" "$path"
import json, re, sys

def tokens(path: str):
    out=[]
    i=0
    while i < len(path):
        if path[i]=='.':
            i+=1
            continue
        if path[i]=='[':
            j=path.find(']', i)
            if j==-1:
                raise ValueError('bad path')
            out.append(int(path[i+1:j]))
            i=j+1
            continue
        j=i
        while j < len(path) and path[j] not in '.[':
            j+=1
        out.append(path[i:j])
        i=j
    return out

body=sys.argv[1]
path=sys.argv[2]
obj=json.loads(body)
cur=obj
for t in tokens(path):
    if isinstance(t, int):
        cur=cur[t]
    else:
        cur=cur[t]
if isinstance(cur, (dict, list)):
    print(json.dumps(cur, ensure_ascii=False, indent=2))
else:
    print(cur)
PY
}

extract_window_id_fallback() {
  local body="$1"
  printf '%s' "$body" | sed -n 's/.*"window_id":"\([^"]*\)".*/\1/p'
}

# 1) Health preflight
call_endpoint GET "$BASE_URL/health"
HEALTH_STATUS="$HTTP_STATUS"
HEALTH_BODY="$BODY"
if [[ "$HEALTH_STATUS" != "200" ]]; then
  echo "health check failed: $HEALTH_STATUS" >&2
  exit 1
fi

OPEN_STATUS=""
OPEN_BODY=""

# 2) Optional browser open flow
if [[ -n "$OPEN_URL" ]]; then
  OPEN_PAYLOAD="$(json_build url "$OPEN_URL" mode "$WINDOW_MODE")"
  call_endpoint POST "$BASE_URL/browser/open" "$OPEN_PAYLOAD"
  OPEN_STATUS="$HTTP_STATUS"
  OPEN_BODY="$BODY"

  if [[ "$FAIL_ON_INVALID_JSON" == true ]]; then
    [[ "$(json_is_valid "$OPEN_BODY")" == "ok" ]] || {
      echo "invalid JSON from /browser/open" >&2
      exit 1
    }
  fi

  if [[ -z "$WINDOW_ID" ]]; then
    if [[ "$(json_is_valid "$OPEN_BODY")" == "ok" ]]; then
      WINDOW_ID="$(extract_json_path "$OPEN_BODY" "window_id" 2>/dev/null || true)"
    fi
    if [[ -z "$WINDOW_ID" ]]; then
      WINDOW_ID="$(extract_window_id_fallback "$OPEN_BODY")"
    fi
  fi

  if [[ "$WAIT_MS" -gt 0 ]]; then
    sleep_sec="$(awk "BEGIN { printf \"%.3f\", (${WAIT_MS}+0)/1000 }")"
    sleep "$sleep_sec"
  fi
fi

# 3) Target endpoint call
if [[ -z "$JSON_PAYLOAD" && "$ENDPOINT" == "/browser/get_content" ]]; then
  if [[ -z "$WINDOW_ID" ]]; then
    echo "window_id is required for /browser/get_content" >&2
    exit 1
  fi
  JSON_PAYLOAD="$(json_build window_id "$WINDOW_ID" format "$FORMAT")"
fi

TARGET_URL="$BASE_URL$ENDPOINT"
call_endpoint "$METHOD" "$TARGET_URL" "$JSON_PAYLOAD"
TARGET_STATUS="$HTTP_STATUS"
TARGET_BODY="$BODY"

if [[ "$FAIL_ON_INVALID_JSON" == true ]]; then
  [[ "$(json_is_valid "$TARGET_BODY")" == "ok" ]] || {
    echo "invalid JSON from target endpoint" >&2
    exit 1
  }
fi

# 4) Extracted value
EXTRACTED=""
if [[ "$RAW_ONLY" == false ]]; then
  if [[ -n "$EXTRACT_PATH" ]]; then
    if [[ "$(json_is_valid "$TARGET_BODY")" == "ok" ]]; then
      EXTRACTED="$(extract_json_path "$TARGET_BODY" "$EXTRACT_PATH" 2>/dev/null || true)"
    fi
  elif [[ "$ENDPOINT" == "/browser/get_content" ]]; then
    if [[ "$(json_is_valid "$TARGET_BODY")" == "ok" ]]; then
      EXTRACTED="$(extract_json_path "$TARGET_BODY" "content" 2>/dev/null || true)"
    fi
  fi
fi

# 5) Write report
{
  echo "# API Smoke Report"
  echo "timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "base_url: $BASE_URL"
  echo "endpoint: $ENDPOINT"
  echo "method: $METHOD"
  echo "target_status: $TARGET_STATUS"
  if [[ -n "$WINDOW_ID" ]]; then echo "window_id: $WINDOW_ID"; fi
  if [[ -n "$OPEN_URL" ]]; then
    echo "open_url: $OPEN_URL"
    echo "open_status: $OPEN_STATUS"
  fi
  echo
  echo "## health_raw"
  echo "$HEALTH_BODY"
  if [[ -n "$OPEN_BODY" ]]; then
    echo
    echo "## browser_open_raw"
    echo "$OPEN_BODY"
  fi
  echo
  echo "## target_raw"
  echo "$TARGET_BODY"
  if [[ "$RAW_ONLY" == false ]]; then
    echo
    echo "## extracted"
    echo "$EXTRACTED"
  fi
} > "$OUT_FILE"

if [[ "$TARGET_STATUS" != "200" ]]; then
  echo "target endpoint returned $TARGET_STATUS (see $OUT_FILE)" >&2
  exit 1
fi

echo "$OUT_FILE"
