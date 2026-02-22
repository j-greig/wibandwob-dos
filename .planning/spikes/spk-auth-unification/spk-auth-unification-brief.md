# Spike: Unified Auth for Wib&Wob + Scramble

Status: done  
GitHub issue: —  
PR: —  

## Goal

One auth config. Both Wib&Wob Chat and Scramble Cat use it. No legacy paths.
Additionally: make all LLM calls non-blocking so the TUI never freezes.

## Outcome

All 5 tasks completed plus two bonus non-blocking fixes:

| Commit | Description |
|--------|-------------|
| `bb4bbe6` | spike(llm): unified AuthConfig singleton for all LLM consumers |
| `5200faf` | fix(llm): address Codex review findings for auth unification |
| `cfeee82` | chore(llm): final Codex sweep cleanup |
| `d00113e` | feat(llm): proper auth probe, LLM AUTH/KEY/OFF labels, Help > LLM Status dialog |
| `9dd1fd7` | fix(llm): make Scramble LLM calls non-blocking with async popen+poll |
| (pending) | fix(llm): SDK session startup + streaming callback thread safety |

### Non-blocking fixes (bonus)

1. **Scramble async**: `popen` + `fcntl(O_NONBLOCK)` + `poll()` from idle loop — no more TUI freeze on Scramble chat.
2. **SDK session startup**: `startStreamingSession()` no longer blocks 5-15s. Sends `START_SESSION`, returns immediately; `poll()` detects `SESSION_STARTED` and sends queued query.
3. **SDK streaming callback**: `processStreamingThread` no longer calls `activeStreamCallback` directly. Enqueues `StreamChunk`s into `streamQueue`; `poll()` delivers them on the main thread. Eliminates use-after-free race when window is destroyed mid-stream.

## New Design

### One global auth mode

Detected at startup (including `claude auth status` probe). Stored in `AuthConfig` singleton.

```
1. If `claude` CLI is available AND logged in → Claude Code Auth (SDK) ← DEFAULT
2. If ANTHROPIC_API_KEY is set → API Key mode (direct curl, fallback only)
3. Otherwise → No Auth (disabled, show message)
```

### Both consumers use the same mode

| Mode | Wib&Wob | Scramble |
|------|---------|----------|
| Claude Code | `claude_code_sdk` provider (Agent SDK, full features) | `claude -p --model haiku "prompt"` (async CLI subprocess) |
| API Key | `anthropic_api` provider (direct curl) | Direct curl (async) |
| No Auth | Disabled, show message in chat | Disabled, show message |

### TUI status indicators

- Status bar: `LLM AUTH` (green) / `LLM KEY` (amber) / `LLM OFF` (red)
- Help > LLM Status: full diagnostics dialog (`AuthConfig::statusSummary()`)

## Task Queue

```json
[
  { "id": "SPK-AUTH-01", "status": "done", "title": "Create AuthConfig singleton" },
  { "id": "SPK-AUTH-02", "status": "done", "title": "Simplify WibWobEngine to use AuthConfig" },
  { "id": "SPK-AUTH-03", "status": "done", "title": "Make Scramble use AuthConfig" },
  { "id": "SPK-AUTH-04", "status": "done", "title": "Surface auth errors in TUI" },
  { "id": "SPK-AUTH-05", "status": "done", "title": "Clean up dead code" }
]
```

## Acceptance Criteria

- AC-1: `claude /login` only (no API key) → both Wib&Wob and Scramble work  
  Test: unset ANTHROPIC_API_KEY, verify both respond

- AC-2: `ANTHROPIC_API_KEY` only (no claude login) → both work  
  Test: remove claude auth, set key, verify both respond

- AC-3: No auth → both show clear error, no crashes  
  Test: unset everything, verify error messages in both chat windows

- AC-4: Status line shows LLM auth state  
  Test: visual check each mode

## Files Changed

- **New**: `app/llm/base/auth_config.h`, `app/llm/base/auth_config.cpp`
- **Modified**: `app/wibwob_engine.cpp/.h`, `app/wibwob_view.cpp`, `app/scramble_engine.cpp/.h`, `app/test_pattern_app.cpp`, `app/llm/providers/claude_code_sdk_provider.cpp/.h`, `app/llm/providers/anthropic_api_provider.cpp`, `app/llm/base/llm_config.cpp`, `app/llm/config/llm_config.json`, `app/CMakeLists.txt`, `CLAUDE.md`, `README.md`
- **Deleted**: `app/llm/providers/claude_code_provider.cpp/.h`, `app/llm/providers/anthropic_api_provider_broken.cpp`, `README-CLAUDE-CONFIG.md`
- **Diff stats**: ~+1200 / −1800 lines (net reduction of ~600 lines)

## Known remaining items

- `probeClaudeAuth()` runs synchronously at startup (~1s). Acceptable since it's pre-TUI.
- `AuthConfig::detect()` is not re-callable at runtime (if user runs `claude /login` while app is running). Could add `redetect()` in future.
