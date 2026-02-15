---
name: ww-api-smoke
description: Smoke-test WibWob-DOS API endpoints and dump timestamped response files. Quick pass/fail for any endpoint, plus browser open->get_content auto-flow.
---

# ww-api-smoke

Run deterministic API smoke checks and save results for review.

## Use when
- You need a quick pass/fail check on one endpoint or a small flow.
- You want reproducible debug artifacts in files (raw + extracted output).
- You need browser API verification (`/browser/open`, `/browser/get_content`) without manual copying.

## Fast path

```bash
# From repo root:
.claude/skills/ww-api-smoke/scripts/smoke_api.sh \
  --base http://127.0.0.1:8089 \
  --open-url https://symbient.life \
  --format text
```

This will:
1. Check `/health`
2. Open browser window via `/browser/open`
3. Fetch content via `/browser/get_content`
4. Write a timestamped report file under `cache/api-smoke/`

## Generic endpoint mode

```bash
# From repo root:
.claude/skills/ww-api-smoke/scripts/smoke_api.sh \
  --base http://127.0.0.1:8089 \
  --endpoint /state \
  --method GET \
  --extract windows[0].id
```

## Flags
- `--base <url>` API base URL (default `http://127.0.0.1:8089`)
- `--open-url <url>` browser auto-flow URL (enables `/browser/open` step)
- `--window-mode <new|same>` browser open mode (default `new`)
- `--window-id <id>` reuse existing browser window id
- `--endpoint <path>` target endpoint (default `/browser/get_content`)
- `--method <GET|POST>` HTTP method for target endpoint (default `POST`)
- `--json <payload>` request JSON string for target endpoint
- `--format <text|markdown|links>` shorthand for `/browser/get_content` payload (default `text`)
- `--wait-ms <n>` delay after `/browser/open` before target call (default `600`)
- `--extract <path>` extract a field using dotted path syntax (e.g. `content`, `windows[0].id`)
- `--out <path>` output file path; default `cache/api-smoke/TEMP_API_SMOKE_<timestamp>.txt`
- `--raw` keep only raw output (skip extracted section)
- `--fail-on-invalid-json` fail if response body is not valid JSON

## Do not use when
- A single one-off `curl` is enough and no artifact file is needed.
- You are testing non-HTTP flows (C++ build, IPC socket protocol, direct TUI interaction).

## Output
Report contains:
- metadata (timestamp, endpoint, status, window_id)
- raw response body
- extracted field (if available)

## Guardrails
- Never assume API response JSON is valid; browser open can return malformed JSON if server escapes are wrong.
- Parse `window_id` with JSON first, regex fallback second.
- Always write raw body for forensic debugging.
- Prefer `/health` preflight before endpoint calls.
