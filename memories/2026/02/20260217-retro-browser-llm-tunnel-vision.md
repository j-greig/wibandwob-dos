---
type: retro
status: complete
tags: [retro, infrastructure, browser, llm, debugging, process]
tldr: "Retro: tunnel-visioned on API key plumbing, missed 3 env-level root causes, user had to flag failure TWICE before proper diagnosis"
---

# Session Retro — Browser LLM Tunnel Vision

**Date:** 2026-02-17
**Session:** spike/xterm-pty-validation — making chat work in browser via ttyd

---

## What Got Stuck

### 1. Didn't test the actual runtime path before writing code
**Friction:** Built entire API key dialog + provider wiring (7 files, 141 lines) without once checking if the config file would even load in ttyd context. A 30-second `cat /tmp/wibwob_ttyd_debug.log` after the first failure would have revealed all three root causes immediately.

**Root cause in my process:** Jumped from "what does the code say" to "what code should I write" without an intermediate "what will actually happen at runtime in THIS environment." I read the provider code, understood the interfaces, designed a clean solution — but never simulated the ttyd execution context mentally.

**Specific miss:** `wibwob_engine.cpp:228` uses relative path `app/llm/config/llm_config.json`. When I read that line, I should have asked: "What's CWD when ttyd spawns this?" I didn't.

### 2. User said "wobbling... no reply after 15 seconds" TWICE
First time: I checked debug log (empty — provider hadn't loaded yet), verified binary strings, declared "all verified" and asked user to test. That was wrong — I should have simulated the failure or at minimum tested with a dummy key via IPC.

Second time: I checked the log, saw the real errors, diagnosed correctly. But it took the user escalating to "do you need to think with fresh eyes at higher level?" to trigger proper root cause analysis.

**Why didn't I self-fix on first report?** I was in "build mode" not "debug mode." I treated the user's failure report as "needs more testing" rather than "my code is wrong." The log was empty because the engine loads lazily — I should have known that and triggered the engine load myself (e.g. by opening a chat window via IPC).

### 3. Three root causes, all environment-level, none code-level
| RC | What | Should have caught when |
|----|-------|------------------------|
| CWD wrong | Config path is relative, ttyd CWD isn't repo root | Reading `loadConfiguration()` — the hardcoded relative path is an obvious env assumption |
| isAvailable() gate | Provider rejects itself before key can be injected | Designing `setApiKey()` — the init→check→set order is backwards by construction |
| Provider cascade masks failure | Falls through to `claude_code` CLI silently | First test run — should have grepped log for which provider actually activated |

All three are **integration issues**, not logic bugs. The code is correct in isolation. It fails at the boundary between "code running in dev terminal" and "code running in ttyd PTY."

---

## What Went Well

- Recovered the dead session's findings efficiently (JSONL mining)
- Dev log structure is solid, diagnostic writeup is clear
- The API key dialog code itself is fine — clean TV pattern, correct TUI idiom
- Identified the right long-term architecture (anthropic_api + session-scoped key)

---

## Skills Used vs Should Have Used

| Used | Should have used |
|------|-----------------|
| /mem — captured spike findings | /auk — asked good clarifying questions |
| /chrome — tried but extension disconnected | **Should have used:** quick IPC smoke test BEFORE building the dialog |
| Manual grep/read of code | **Should have used:** the existing `ww-build-test` or `ww-api-smoke` skills to verify the runtime path |

---

## Proposed Fixes

### Fix 1: Add "test what you built" rule to CLAUDE.md (high impact, low effort)
Add to project CLAUDE.md under a new "## Runtime Testing" section:

```markdown
## Runtime Testing
- After modifying LLM provider code, ALWAYS check `/tmp/wibwob_ttyd_debug.log`
  (or stderr redirect) for actual provider init messages
- After modifying any code that runs in ttyd: verify CWD assumptions —
  all config paths must resolve from wherever ttyd spawns the process
- When user reports "it doesn't work": check logs FIRST, theorise SECOND
```

### Fix 2: Add CWD awareness note to CLAUDE.md architecture section (low effort)
Add to the "Key Entry Points" or "Build Commands" section:

```markdown
## ttyd / Browser Mode
The app may run from any CWD when launched via ttyd. All file paths in C++
(config, prompt files, scripts) must either be absolute or resolve relative
to the binary location. Current known relative paths that break:
- `app/llm/config/llm_config.json` (in wibwob_engine.cpp)
- `app/llm/sdk_bridge/claude_sdk_bridge.js` (in llm_config.json)
- `wibandwob.prompt.md` (in wibwob_view.cpp)
```

### Fix 3: Pre-flight check hook or skill for browser mode (medium effort)
A skill or hook that before declaring "browser mode works" verifies:
1. Config file loads (check log for "Config file load result: SUCCESS")
2. Correct provider activates (check log for "Successfully initialized provider: X")
3. No MODULE_NOT_FOUND errors
4. API key reaches the right provider

Could be a simple bash script: `scripts/check_browser_mode.sh` that greps the debug log for known-good and known-bad patterns.

### Fix 4: Fix the "diagnose before coding" pattern (process)
When user reports runtime failure:
1. **Read logs** — always, immediately, before theorising
2. **Reproduce** — try to trigger the same failure path via IPC/curl
3. **Then fix** — only write code after root cause is identified
4. **Then test** — verify the fix in the actual runtime context

Add to auto-memory so it persists across sessions.

---

## Prompt Hygiene

No DRY violations — the new rules proposed above don't duplicate existing CLAUDE.md content. The runtime testing section is genuinely missing.

---

## Action Items

1. [ ] Fix the 3 root causes (CWD, isAvailable gate, setApiKey order) — code changes
2. [ ] Add Runtime Testing section to CLAUDE.md — doc change
3. [ ] Add ttyd CWD warning to CLAUDE.md — doc change
4. [ ] Save "diagnose before coding" pattern to auto-memory — memory update
5. [ ] Consider `check_browser_mode.sh` pre-flight script — future
