# Codex Review — spk-auth-unification

Reviewed: 2026-02-21  
SDK version: `@anthropic-ai/claude-agent-sdk@0.1.56`

## 1. Audit Findings Accuracy

### Correct
- Scramble is API-key-only today (`ANTHROPIC_API_KEY` env var, direct curl)
- "SDK auth status not surfaced" is accurate — bridge has no `auth_status` handler
- `claude_code` vs `claude_code_sdk` confusion is real

### Inaccurate / Incomplete
- **Scramble is NOT a silent failure** — it returns `"... (no api key)"` visible message (`scramble_engine.cpp:261`)
- **`anthropic_api` provider supports configurable `apiKeyEnv`** and runtime key injection (`setApiKey()`), not just `ANTHROPIC_API_KEY`
- **Provider selection pseudocode is wrong** — actual logic is config-first (`activeProvider` from `llm_config.json`), not env-var-first. Auto-selection only fires when `activeProvider` is empty
- **`claude_code_sdk` silently falls back to `claude_code`** — this fallback path was missed entirely
- **`anthropic_api_provider_broken.cpp`** has a different auth path but is NOT built (not in CMakeLists.txt)

## 2. Missed Auth Paths

- `.env` loading is part of auth resolution (`llm_config.cpp:45`)
- Runtime API key injection exists for both WibWob (`WibWobEngine::setApiKey`) and Scramble (`ScrambleHaikuClient::setApiKey`)
- `claude_code_sdk → claude_code` fallback is an auth/failure path not documented
- Agent SDK auth source is not just "claude /login OAuth" — SDK exposes `apiKeySource` types: `user | project | org | temporary`
- `openrouter` auth path exists in config (`OPENROUTER_API_KEY`) though not in reviewed providers

## 3. Mode 1/2/3 Hierarchy

- **Mode categories are reasonable**
- **Default precedence is wrong**: proposing `API key > Claude login` would downgrade Wib&Wob in mixed setups (loses MCP tools, sessions, streaming)
- Current repo defaults to `claude_code_sdk` (`activeProvider: "claude_code_sdk"` in `llm_config.json`)
- **Better approach**: separate credential detection from transport/provider selection
  - Detect: api_key available? claude_auth available? both? none?
  - Choose provider per consumer (Wib&Wob prefers SDK, Scramble prefers direct API or CLI)
- Add explicit override (config/UI/env) because "both present" is common

## 4. Scramble via `claude -p --model claude-haiku`

- **Workable pattern** — `claude` is installed, supports `-p` and `--model`
- **Risk**: `claude-haiku` alias not evidenced in CLI help. Use `--model haiku` or full model ID instead
- Scramble expects plain text; CLI `-p` mode defaults to text output — fine
- **Must add**: error handling for auth failures, nonzero exit, stderr capture
- Recommendation: test with `claude -p --model haiku`, capture stderr+exit code

## 5. Agent SDK Auth Events to Leverage

### Events / Messages
- `auth_status` stream message with `isAuthenticating`, `output`, `error` (`sdk.d.ts:470`)
- `assistant.error` can be `authentication_failed` (`sdk.d.ts:353`)
- `system/init` includes `apiKeySource`, `permissionMode`, model, CLI version (`sdk.d.ts:401`)

### Query Methods
- `accountInfo()` → `tokenSource` / `apiKeySource` (`sdk.d.ts:501`)
- `mcpServerStatus()` → `needs-auth` per MCP server (`sdk.d.ts:500`)
- `supportedModels()` → validate Haiku model alias before use (`sdk.d.ts:499`)

### Options Worth Adding
- `settingSources` — deterministic config/auth source loading (`sdk.d.ts:624`)
- `env` — explicitly pass/clear env keys when enforcing a mode (`sdk.d.ts:578`)
- `pathToClaudeCodeExecutable` — explicit CLI path (`sdk.d.ts:598`)
- `forkSession` with `resume` — safe resume after auth churn (`sdk.d.ts:589`)

## Bottom Line

The spike is **directionally good** but needs corrections:

1. Fix provider selection description (config-first, not env-var-first)
2. Document the `claude_code_sdk → claude_code` fallback path
3. Separate credential detection from provider selection
4. Don't auto-downgrade to `anthropic_api` when API key is present — SDK path is richer
5. Surface `auth_status` and `authentication_failed` from Agent SDK
6. Use `--model haiku` not `claude-haiku` for Scramble CLI mode
7. Add `accountInfo()` call at session start to detect auth state proactively
