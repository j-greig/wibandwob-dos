# Spike: Unified Auth System for LLM Providers

Status: not-started  
GitHub issue: —  
PR: —  

## Goal

Establish a single, clear global auth strategy for all LLM consumers in WibWob-DOS:
- Wib&Wob Chat (WibWobEngine → providers)
- Scramble Cat Chat (ScrambleHaikuClient)
- Claude Code SDK bridge (claude_sdk_bridge.js)

The user should configure auth ONCE and all three consumers should just work.

## Current State (audit findings)

### Three separate auth paths — no shared logic

| Consumer | Auth Method | Where Configured | Notes |
|----------|-----------|------------------|-------|
| Wib&Wob (anthropic_api provider) | `ANTHROPIC_API_KEY` env var | `anthropic_api_provider.cpp:247` reads env, sends via `x-api-key` header to Messages API | Direct curl to `api.anthropic.com` |
| Wib&Wob (claude_code provider) | Claude CLI installed + `claude /login` | `claude_code_provider.cpp` spawns `claude -p` subprocess | Inherits CLI auth, no API key needed |
| Wib&Wob (claude_code_sdk provider) | Claude Agent SDK (uses `claude /login` OAuth session) | `claude_sdk_bridge.js` calls `sdk.query()` | SDK handles auth internally via Claude Code's credential store |
| Scramble Cat | `ANTHROPIC_API_KEY` env var ONLY | `scramble_engine.cpp:30` reads `getenv("ANTHROPIC_API_KEY")` | Direct curl to Messages API. No fallback. Silent failure if no key. |

### Provider selection logic (WibWobEngine)

```
wibwob_engine.cpp:257-272:
1. If ANTHROPIC_API_KEY set AND anthropic_api configured → use anthropic_api
2. Else if claude_code configured → use claude_code (CLI subprocess)
3. Else fall through to claude_code_sdk (Agent SDK)
```

### Key problems

1. **Scramble has NO Claude Code auth path** — only works with raw API key. If user authenticates via `claude /login` (the recommended path), Scramble is dead.

2. **No unified "which auth do we have?" check** — each consumer probes independently. No central registry.

3. **claude_code vs claude_code_sdk confusion** — `claude_code` spawns `claude -p` (CLI), `claude_code_sdk` uses the Agent SDK via Node bridge. Both rely on `claude /login` but are separate codepaths.

4. **API key env var is only ANTHROPIC_API_KEY** — no support for project-scoped keys or key files.

5. **Fallback cascade is implicit** — WibWobEngine has a fallback sequence but it's buried in initialization logic with fprintf debugging.

6. **SDK auth status not surfaced** — Agent SDK reports `auth_status` events and `needs-auth` states but the bridge doesn't surface these to the TUI.

## Proposed Auth Modes

### Mode 1: No Auth
- No API key, no Claude login
- Scramble: disabled (show message)
- Wib&Wob: disabled (show message)
- Status indicator: `LLM OFF`

### Mode 2: Claude Code Auth (RECOMMENDED DEFAULT)
- User has run `claude /login` (OAuth session stored by Claude CLI)
- Scramble: needs code change — route through Agent SDK or Claude CLI for Haiku calls
- Wib&Wob: uses `claude_code_sdk` provider (Agent SDK handles auth)
- Status indicator: `LLM ON (Claude)`

### Mode 3: API Key
- `ANTHROPIC_API_KEY` env var set
- Scramble: works as-is (direct curl)
- Wib&Wob: uses `anthropic_api` provider (direct curl)
- Status indicator: `LLM ON (API Key)`

### Default precedence
```
1. If ANTHROPIC_API_KEY is set → Mode 3 (API Key)
2. If `claude` CLI is available and logged in → Mode 2 (Claude Code Auth)
3. Otherwise → Mode 1 (No Auth)
```

## Technical Changes Required

### A. Central Auth Registry (C++)

New singleton `AuthConfig` in `app/llm/base/`:
```cpp
class AuthConfig {
public:
    enum class Mode { None, ClaudeCode, ApiKey };
    
    static AuthConfig& instance();
    Mode detectMode();           // probe env + claude CLI
    std::string getApiKey();     // for Mode::ApiKey
    bool isClaudeAvailable();    // for Mode::ClaudeCode
    std::string statusLabel();   // "LLM OFF" / "LLM ON (Claude)" / etc.
};
```

### B. Scramble → Agent SDK for Claude Code Auth

Current: `ScrambleHaikuClient` calls Haiku directly via curl + API key.
Change: When in Mode 2 (Claude Code Auth), Scramble needs to route Haiku calls through the Agent SDK or the Claude CLI.

Options:
1. **Route Scramble through the Node SDK bridge** — add a simple query endpoint that Scramble posts to (IPC → Node → SDK → Haiku). Cleanest but adds Node dependency for Scramble.
2. **Spawn `claude -p` for Scramble** — use `claude -p --model claude-haiku "prompt"` subprocess. Simple. Uses Claude Code's auth. No API key needed.
3. **Share API key between providers** — if API key is available, pass it to Scramble. If not, fall back to option 1 or 2.

Recommended: **Option 2** (spawn `claude -p --model claude-haiku`) as primary for Mode 2. Keep direct curl for Mode 3. This aligns Scramble with the same auth Wib&Wob uses.

### C. Wib&Wob Provider Simplification

Current: Three providers with complex fallback logic.
Change: `AuthConfig::detectMode()` drives provider selection cleanly:
```
Mode::ApiKey     → anthropic_api provider
Mode::ClaudeCode → claude_code_sdk provider (Agent SDK)
Mode::None       → no provider, show message
```

Deprecate `claude_code` provider (old CLI subprocess) in favour of `claude_code_sdk` (Agent SDK). The old provider spawns `claude -p` per-query with no session/MCP support.

### D. Agent SDK Auth Events

The Agent SDK emits `auth_status` events with `needs-auth` state. The bridge should:
1. Surface auth failures to C++ as a structured error
2. C++ shows "Run `claude /login` to authenticate" in the chat window
3. Status bar shows `LLM AUTH` in yellow when auth needed

### E. Status Line Update

Extend the existing `API ON/IDLE/OFF` indicator to include LLM auth state:
```
API ON | LLM ON (Claude)
API ON | LLM OFF
API ON | LLM AUTH NEEDED
```

## IMPORTANT: Use Agent SDK, NOT old Claude Code SDK

The `@anthropic-ai/claude-code-sdk` package is now `@anthropic-ai/claude-agent-sdk`. Key differences:
- Package name changed
- `query()` function signature may differ
- Auth handling may have new patterns
- Check migration guide: https://docs.claude.com/en/docs/claude-code/sdk/migration-guide

Before coding, verify:
1. Which SDK version is installed: `npm ls @anthropic-ai/claude-agent-sdk`
2. Read the SDK's `sdk.d.ts` for current auth types
3. Check `ApiKeySource`, `AccountInfo.tokenSource`, `auth_status` event types
4. Do NOT reference old `@anthropic-ai/claude-code-sdk` patterns

## Task Queue

```json
[
  {
    "id": "SPK-AUTH-01",
    "status": "todo",
    "title": "Audit current auth flows in detail",
    "steps": [
      "Trace Scramble auth: env var → curl → API call",
      "Trace WibWob anthropic_api auth: env var → provider → curl",
      "Trace WibWob claude_code_sdk auth: SDK bridge → query() → auth",
      "Trace WibWob claude_code auth: CLI subprocess → claude -p",
      "Document all auth failure modes and user-visible effects",
      "Check Agent SDK auth_status event handling in bridge"
    ]
  },
  {
    "id": "SPK-AUTH-02",
    "status": "todo",
    "title": "Design and implement AuthConfig singleton",
    "steps": [
      "Create app/llm/base/auth_config.h and .cpp",
      "Implement detectMode() — probe ANTHROPIC_API_KEY, then claude CLI",
      "Implement getApiKey(), isClaudeAvailable()",
      "Unit test (command_registry_test style)",
      "Wire into WibWobEngine initialization"
    ]
  },
  {
    "id": "SPK-AUTH-03",
    "status": "todo",
    "title": "Make Scramble work with Claude Code auth",
    "steps": [
      "Add claude -p --model claude-haiku subprocess mode to ScrambleHaikuClient",
      "Check AuthConfig::detectMode() to choose curl vs claude subprocess",
      "Test: no API key + claude /login → Scramble responds",
      "Test: API key set → Scramble uses direct curl (unchanged)",
      "Test: no auth → Scramble shows disabled message"
    ]
  },
  {
    "id": "SPK-AUTH-04",
    "status": "todo",
    "title": "Simplify WibWob provider selection",
    "steps": [
      "Use AuthConfig to drive provider selection in WibWobEngine::initialize()",
      "Remove implicit fallback cascade — make it explicit via mode",
      "Deprecate claude_code provider (old CLI subprocess)",
      "Test: API key → anthropic_api provider",
      "Test: Claude login → claude_code_sdk provider",
      "Test: no auth → graceful disabled state"
    ]
  },
  {
    "id": "SPK-AUTH-05",
    "status": "todo",
    "title": "Surface Agent SDK auth status in TUI",
    "steps": [
      "Bridge: parse auth_status events, forward to C++",
      "C++: handle auth failure → show 'run claude /login' in chat",
      "Status line: add LLM auth state indicator",
      "Test: revoke auth → status shows LLM AUTH NEEDED",
      "Test: re-auth → status recovers to LLM ON"
    ]
  },
  {
    "id": "SPK-AUTH-06",
    "status": "todo",
    "title": "Documentation and .env template",
    "steps": [
      "Update CLAUDE.md with auth modes table",
      "Create .env.example with ANTHROPIC_API_KEY placeholder and comments",
      "Update Wib&Wob prompt: remove extradiegetic API key references",
      "Document claude /login as recommended auth path"
    ]
  }
]
```

## Acceptance Criteria

- AC-1: With only `claude /login` (no API key), both Wib&Wob Chat AND Scramble Chat work.  
  Test: unset ANTHROPIC_API_KEY, run `claude /login`, start app, verify both chat windows respond.

- AC-2: With only `ANTHROPIC_API_KEY` (no claude login), both work.  
  Test: set ANTHROPIC_API_KEY, ensure no claude login, start app, verify both respond.

- AC-3: With no auth, both show a clear disabled/error message — no silent failures.  
  Test: unset ANTHROPIC_API_KEY, ensure no claude login, start app, verify error messages.

- AC-4: Status line shows current LLM auth state.  
  Test: visual check for each auth mode.

- AC-5: Agent SDK auth failures surface as user-visible messages, not silent drops.  
  Test: revoke auth mid-session, verify error appears in chat.

## Files to Examine

- `app/llm/providers/anthropic_api_provider.cpp` — direct API key auth
- `app/llm/providers/claude_code_provider.cpp` — CLI subprocess auth
- `app/llm/providers/claude_code_sdk_provider.cpp` — Agent SDK auth
- `app/llm/sdk_bridge/claude_sdk_bridge.js` — Node bridge, SDK query
- `app/wibwob_engine.cpp` — provider selection logic
- `app/scramble_engine.cpp` — Scramble's independent auth
- `app/llm/base/llm_config.cpp` — provider config loading
- `app/llm/sdk_bridge/node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts` — SDK types
- `app/llm/sdk_bridge/node_modules/@anthropic-ai/claude-agent-sdk/README.md` — migration notes
