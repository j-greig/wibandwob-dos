# Spike: Unified Auth for Wib&Wob + Scramble

Status: not-started  
GitHub issue: —  
PR: —  

## Goal

One auth config. Both Wib&Wob Chat and Scramble Cat use it. No legacy paths.

## Current Mess

- Wib&Wob has 3 providers with complex fallback logic
- Scramble has its own completely separate `ANTHROPIC_API_KEY` curl path
- `claude_code_sdk` silently falls back to `claude_code` (CLI subprocess)
- Provider selection is config-file-first but also env-var-sniffing
- Nobody surfaces auth failures clearly

## New Design

### One global auth mode

Detected at startup. Stored in a singleton. Both consumers read from it.

```
1. If `claude` CLI is available and logged in → Claude Code Auth (SDK) ← DEFAULT
2. If ANTHROPIC_API_KEY is set → API Key mode (direct curl, fallback only)
3. Otherwise → No Auth (disabled, show message)
```

Claude Code Auth (SDK) is the default. It's free, it's what the user uses for Claude Code and Pi, and it gives MCP tools, sessions, streaming. API key mode exists only as a fallback for environments without Claude CLI.

### Both consumers use the same mode

| Mode | Wib&Wob | Scramble |
|------|---------|----------|
| Claude Code | `claude_code_sdk` provider (Agent SDK, full features) | `claude -p --model haiku "prompt"` (CLI subprocess) |
| API Key | `anthropic_api` provider (direct curl) | Direct curl (as today) |
| No Auth | Disabled, show message in chat | Disabled, show message |

### What gets deleted

- `claude_code` provider (old CLI subprocess for Wib&Wob) — replaced by `claude_code_sdk`
- `claude_code_sdk → claude_code` silent fallback — just fail clearly
- `anthropic_api_provider_broken.cpp` — dead code
- `WibWobEngine` multi-provider fallback cascade — replaced by single mode switch
- Scramble's independent `ANTHROPIC_API_KEY` probing — reads from shared AuthConfig
- `ApiConfig::anthropicApiKey()` runtime injection complexity

### What gets added

- `AuthConfig` singleton (~50 lines): detect mode, expose key/CLI path
- Scramble CLI mode: spawn `claude -p --model haiku "prompt"` when in Claude Code Auth mode
- Bridge: handle `auth_status` SDK event, surface `authentication_failed` errors
- Status line: `LLM ON` / `LLM OFF` / `LLM AUTH` (extend existing API indicator)

## Task Queue

```json
[
  {
    "id": "SPK-AUTH-01",
    "status": "todo",
    "title": "Create AuthConfig singleton",
    "steps": [
      "app/llm/base/auth_config.h + .cpp",
      "detectMode(): check claude CLI, then ANTHROPIC_API_KEY",
      "getApiKey(), getClaudePath(), getMode()",
      "Call once at app startup before any LLM init"
    ]
  },
  {
    "id": "SPK-AUTH-02",
    "status": "todo",
    "title": "Simplify WibWobEngine to use AuthConfig",
    "steps": [
      "Remove multi-provider fallback cascade",
      "Claude Code mode → claude_code_sdk only",
      "API Key mode → anthropic_api only",
      "No Auth → show error in chat, don't init provider",
      "Delete claude_code provider from CMakeLists"
    ]
  },
  {
    "id": "SPK-AUTH-03",
    "status": "todo",
    "title": "Make Scramble use AuthConfig",
    "steps": [
      "ScrambleHaikuClient reads AuthConfig instead of getenv",
      "Claude Code mode: spawn claude -p --model haiku",
      "API Key mode: direct curl (as today)",
      "No Auth: return cat quip, don't attempt LLM call",
      "Handle CLI stderr/exit code for auth failures"
    ]
  },
  {
    "id": "SPK-AUTH-04",
    "status": "todo",
    "title": "Surface auth errors in TUI",
    "steps": [
      "Bridge: handle auth_status SDK event → send ERROR to C++",
      "Bridge: call accountInfo() at session start, log auth source",
      "Chat window: show 'run claude /login' on auth failure",
      "Status line: LLM ON / LLM OFF / LLM AUTH indicator"
    ]
  },
  {
    "id": "SPK-AUTH-05",
    "status": "todo",
    "title": "Clean up dead code",
    "steps": [
      "Delete claude_code_provider.cpp/.h",
      "Delete anthropic_api_provider_broken.cpp",
      "Remove claude_code from llm_config.json",
      "Remove silent sdk→cli fallback in claude_code_sdk_provider",
      "Remove ApiConfig runtime key injection paths"
    ]
  }
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

## Post-Coding Refactor Sweeps

After implementation, do fresh-eyes passes to catch legacy crud:

### Sweep 1: Dead code removal
- grep for `anthropic_api_provider_broken`, `claude_code_provider`, `ApiConfig` — delete all references
- grep for `OPENROUTER_API_KEY` — remove if unused
- Check `llm_config.json` for stale provider entries
- Check CMakeLists.txt for files that no longer exist

### Sweep 2: Docs and README cleanup
- CLAUDE.md: remove any references to old provider names or multi-provider setup
- README.md: simplify auth section — just "run `claude /login`"
- Wib&Wob prompt: remove extradiegetic API key references
- `.env.example` or `.env` templates: simplify to just optional `ANTHROPIC_API_KEY`
- Remove debug fprintf lines added during provider development

### Sweep 3: Config file cleanup
- `llm_config.json`: should only have `claude_code_sdk` and `anthropic_api` (fallback)
- Remove `claude_code` provider config section entirely
- Remove any `apiKeyEnv` config fields that reference nonexistent env vars

### Sweep 4: Test parity
- Update contract tests if provider surface changed
- Verify `test_window_type_parity.py` and `test_surface_parity_matrix.py` still pass
- Add auth mode detection test (mock env vars, verify correct mode)

### Sweep 5: Codex final review
- Run Codex in read-only mode over the full diff
- Ask: "any remaining references to deleted providers, stale comments, or TODO/FIXME related to auth?"

## Notes from Codex Review

- Use `--model haiku` not `claude-haiku` for CLI mode
- Agent SDK `accountInfo()` can detect auth state proactively at session start
- Agent SDK `auth_status` event type exists but bridge currently ignores it
- Don't auto-downgrade to API key when both are present — Claude Code is richer
- Installed SDK: `@anthropic-ai/claude-agent-sdk@0.1.56`
