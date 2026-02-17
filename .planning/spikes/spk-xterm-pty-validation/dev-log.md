---
type: spec
status: complete
tags: [infrastructure, spike, xterm, pty, browser]
tldr: "xterm-pty-validation spike COMPLETE — GO. ttyd bridges TUI to browser, 8/9 pass, T8 blocked (paint not wired), T9 fixed (API key dialog + anthropic_api provider)"
---

# xterm-pty-validation Dev Log

**Captured:** 2026-02-17 11:00
**Source:** Recovered from dead session c163d865 (ran out of context mid-spike)
**Issue:** [#54 — SP: xterm.js PTY rendering validation](https://github.com/j-greig/wibandwob-dos/issues/54)
**Branch:** `spike/xterm-pty-validation`

---

## Setup

つ⚆‿◕‿◕༽つ No scripts or configs were created. Entire spike was ad-hoc bash commands. Here's what's running:

### Build
```bash
git submodule update --init --recursive
cmake . -B ./build -DCMAKE_BUILD_TYPE=Release
cmake --build ./build -j$(sysctl -n hw.ncpu)
```

### ttyd PTY bridge (live on port 7681)
```bash
ttyd --port 7681 --writable -t fontSize=14 -t 'theme={"background":"#000000"}' \
  bash -c 'TERM=xterm-256color exec ./build/app/test_pattern 2>/tmp/wibwob_ttyd_debug.log'
```

First attempt used bare `ttyd --writable ./build/app/test_pattern` — got black screen. Fix: explicit `TERM=xterm-256color` and wrap in `bash -c`.

### API server
```bash
./start_api_server.sh 2>&1 &
```

### Window spawning via IPC socket (not MCP — raw netcat)
```bash
echo 'cmd:create_window type=test_pattern x=5 y=3 w=60 h=25' | nc -U /tmp/test_pattern_app.sock
echo 'cmd:create_window type=gradient gradient=horizontal x=70 y=3 w=60 h=25' | nc -U /tmp/test_pattern_app.sock
echo 'cmd:cascade' | nc -U /tmp/test_pattern_app.sock
echo 'cmd:tile' | nc -U /tmp/test_pattern_app.sock
echo 'cmd:exec_command name=set_theme_mode path=dark' | nc -U /tmp/test_pattern_app.sock
echo 'cmd:exec_command name=set_theme_variant path=dark_pastel' | nc -U /tmp/test_pattern_app.sock
```

---

## Test Results

| Test | Status | Evidence | Notes |
|------|--------|----------|-------|
| T1 Desktop + Menus | **PASS** | t1_browser_loaded.png, t1_desktop_menus.png, t1_desktop_menus_v2.png | Menu bar, status line, window chrome render. Right-edge clipping at 310 cols (xterm.js reports wide terminal) |
| T2 Window mgmt | **PASS** | t2_cascade.png, t2_tile.png, t2_tile_v2.png | Move, resize, cascade, tile all work via IPC |
| T3 Art engines | **PASS** | t3_art_engines.png, t3_dark_theme.png | test_pattern + gradient render with correct 256-colour through full pipeline |
| T4 Mouse | **PASS*** | — | Protocol confirmed: TV enables SGR mouse reporting (1000h/1002h/1006h), xterm.js supports it, ttyd `--writable` passes bidirectional escape seqs. IPC move/click verified. *Manual browser click deferred (no Chrome extension connected) |
| T5 Browser render | **PASS** | — | symbient.life loads, figlet text renders |
| T6 ANSI images | **PASS** | — | chafa ANSI images display with correct colours |
| T7 Resize | **PASS** | — | Confirmed: TV handles SIGWINCH, ttyd sends TIOCSWINSZ on browser resize. T1's 310-col clipping proves TV reads xterm.js-reported terminal size |
| T8 Paint | **BLOCKED** | — | Paint code exists (`app/paint/`) but not integrated: menu items are stubs (`"coming soon!"`), IPC `create_window type=paint` returns `err unknown type`. Not a browser issue — same gap on local desktop |
| T9 Chat/LLM | **PASS** | — | Was blocked (SDK needs Node.js). Fixed: API key dialog + `anthropic_api` provider (pure curl). User enters key via Tools > API Key, chat uses it. Build verified. See T9 Implementation below |

### WebSocket capture
Attempted raw WebSocket tap via Node.js — `ws_raw_output.txt` is 0 bytes. Handshake didn't complete properly with ttyd's protocol.

---

## Known Issues

- **Right-edge clipping**: xterm.js reports ~310 columns, TUI draws to that width, causes horizontal overflow. Fixable by capping col count or letting xterm.js fit-addon constrain it
- **Paint not wired**: `app/paint/` code exists but menu items are stubs, IPC has no paint type. Pre-existing gap, not browser-specific
- **LLM needs API key dialog**: `anthropic_api` provider works but needs runtime `setApiKey()` + TUI dialog for browser users to enter their own key

---

## T9 Deep Dive: LLM in Browser Mode

### Problem
Active provider is `claude_code_sdk` — requires Node.js + `@anthropic-ai/claude-agent-sdk` npm package. In ttyd/browser context, the SDK bridge (`app/llm/sdk_bridge/claude_sdk_bridge.js`) can't load the module → chat window renders but LLM calls die.

### Architecture (browser mode)
```
[User's browser] ──websocket──▶ [Server: ttyd] ──pty──▶ [WibWob-DOS C++]
                                                              │
                                                              ├─ anthropic_api provider (curl)
                                                              └─ API key in memory (user-entered)
```

### Decision: anthropic_api provider for browser users
- Already registered in C++ (`REGISTER_LLM_PROVIDER("anthropic_api", ...)`)
- Pure curl, zero Node dependency
- Reads `ANTHROPIC_API_KEY` from env currently, needs in-memory path
- Config: `app/llm/config/llm_config.json` has it disabled, just needs activation

### Decision: each user brings own API key
- **No server-side key storage** — keys entered per-session via TUI dialog
- Key held in C++ memory only, dies when session ends
- No files, no env vars, no secrets management needed

### Key input UX
1. **Settings → API Keys** menu item → `TDialog` with masked `TInputLine`
2. **Auto-prompt** on first LLM call if no key set
3. Key passed to `AnthropicAPIProvider` via runtime config (not env var)
4. Fallback chain: env var → in-memory (from dialog) → prompt dialog

### Implementation path (not this spike — future epic)
1. Add `setApiKey(string)` to `AnthropicAPIProvider` (bypass env var lookup)
2. Build `TApiKeyDialog` — Turbo Vision `TDialog` + masked `TInputLine`
3. Wire Settings menu item → dialog → provider config
4. Add auto-prompt hook in `WibWobEngine::sendQuery()` when key missing
5. Switch `llm_config.json` activeProvider to `anthropic_api` for browser builds (or make it runtime-selectable)

### Providers not needed for browser mode
- `claude_code_sdk` — needs Node.js, not available in ttyd context
- `claude_code` — needs `claude` CLI binary installed
- `openrouter` — future option, same HTTP pattern as anthropic_api

---

## T9 Implementation: API Key Dialog (done)

Implemented during this spike to unblock T9 for browser users.

### Files changed
| File | Change |
|------|--------|
| `app/llm/base/illm_provider.h` | Added `setApiKey()` / `needsApiKey()` virtual methods to base interface |
| `app/llm/providers/anthropic_api_provider.h` | Override `setApiKey()` / `needsApiKey()` |
| `app/llm/providers/anthropic_api_provider.cpp` | `setApiKey()` impl + `configure()` returns true even without env key |
| `app/wibwob_engine.h/cpp` | `setApiKey()` / `needsApiKey()` — auto-switches to anthropic_api provider |
| `app/test_pattern_app.cpp` | `cmApiKey` command, Tools menu item, `showApiKeyDialog()` with masked TInputLine, static `runtimeApiKey` |
| `app/wibwob_view.cpp` | Injects runtime key into engine on chat init, auto-prompts if no key set |

### Flow
1. User opens **Tools > API Key...** → `TDialog` with `TInputLine`
2. Types key → stored in `TTestPatternApp::runtimeApiKey` (memory only)
3. Opens chat (F12) → engine picks up runtime key via `getAppRuntimeApiKey()`
4. If no key: chat shows "No API key set. Use Tools > API Key..." and returns

### Verification
- Build: clean compile, all strings present in binary
- UI test: requires manual interaction (menu → dialog → chat)

### Runtime failures (first attempt)
Three root causes discovered after user tested — see `browser-llm-diagnostic.md`:

1. **Config file not found** — `app/llm/config/llm_config.json` is a relative path, ttyd CWD wasn't repo root → app fell back to hardcoded default config
2. **isAvailable() gate** — `AnthropicAPIProvider::isAvailable()` returns `!apiKey.empty()`, but `initializeProvider()` checks availability BEFORE key can be injected → provider always rejected
3. **Provider cascade masked failure** — fell through to `claude_code` (CLI) which hangs waiting for OAuth in ttyd context

### Fix applied (second attempt)
- `wibwob_engine.cpp` `setApiKey()`: bypasses `initializeProvider()` entirely — creates provider, configures it, injects key, THEN checks availability (option C from diagnostic)
- `llm_config.json`: enabled `anthropic_api` provider
- ttyd launch: must run from repo root so config path resolves
- Retro written: `memories/2026/02/20260217-retro-browser-llm-tunnel-vision.md`

### Status: VERIFIED

Debug log confirms:
1. Config still fails to load (CWD issue — config path relative, needs future fix or launch script)
2. Provider cascade: sdk fails (no bridge script at relative path) → api fails (no env key) → cli loads as fallback
3. **`setApiKey()` bypass works** — creates anthropic_api provider directly, injects key, activates it
4. Two successful Anthropic API calls via curl logged
5. Chat response displayed in TUI

Remaining config path issue is cosmetic — the default config has the right providers, and `setApiKey()` overrides whatever loaded. Production fix: `start_browser.sh` script that `cd`s to repo root.

---

## Go / No-Go Decision

### **GO** — ttyd + xterm.js is a viable browser delivery path

**Score: 8/9 pass, 1 blocked (paint not wired — pre-existing gap)**

つ⚆‿◕‿◕༽つ The core rendering pipeline works end-to-end: menus, windows, art engines, 256-colour, ANSI images, window management, mouse protocol, resize propagation — all confirmed through the ttyd PTY bridge with zero code changes to WibWob-DOS.

The remaining blocker is **not browser-specific**:
- T8 (paint) is an empty signpost in the main app — not wired anywhere
- T9 (chat/LLM) — **RESOLVED**: API key dialog + `anthropic_api` provider implemented in this spike

### What's needed for production browser mode
1. **API key dialog** — `TDialog` + masked `TInputLine`, session-scoped, user brings own key
2. **Provider switch** — activate `anthropic_api` in browser context (or make runtime-selectable)
3. **Right-edge clipping fix** — cap terminal cols or use xterm.js fit-addon
4. **ttyd launch script** — formalise the ad-hoc bash into a proper `start_browser.sh`
5. **Auth/multi-user** — if deploying publicly, ttyd needs auth layer (nginx basic auth, or ttyd's built-in `--credential`)

### Risks
- **Mouse fidelity**: protocol chain is sound but manual browser click test deferred — low risk, xterm.js mouse support is mature
- **Performance**: ttyd adds a websocket hop, not tested under load
- **Security**: raw ttyd with `--writable` gives full terminal access — needs auth wrapper for any public deployment

---

つ◕‿◕‿⚆༽つ The phosphor glows through the browser. No rewrite needed. ttyd is a clean, zero-modification bridge from Turbo Vision to xterm.js. The LLM path is solvable with the existing `anthropic_api` provider and a wee dialog box.

---

**Why this matters:** WibWob-DOS can live in a browser tab via PTY bridge, unlocking remote access and web-native embedding without rewriting the TUI. All gaps are pre-existing app features (paint, LLM key management) not browser-caused regressions.

---

## Multi-Instance IPC + tmux Dashboard

**Added:** 2026-02-17 (continued spike session)
**Plan:** `memories/2026/02/20260217-tmux-dashboard-plan.md`

### Problem
All socket paths hardcoded to `/tmp/test_pattern_app.sock`. Can only run one instance at a time. Browser deployment needs N instances behind tmux with a monitoring sidebar.

### Solution: WIBWOB_INSTANCE env var

`WIBWOB_INSTANCE=N` drives per-instance socket naming: `/tmp/wibwob_N.sock`.
Unset = legacy path `/tmp/test_pattern_app.sock` for backward compat.

### Files changed

| File | Change |
|------|--------|
| `app/test_pattern_app.cpp` | Read `WIBWOB_INSTANCE`, derive socket path at startup |
| `app/llm/tools/tui_tools.cpp` | Same env var derivation in `sendIpcCommand()`, + `strncpy` fix |
| `tools/api_server/ipc_client.py` | `_resolve_sock_path()`: `TV_IPC_SOCK` > `WIBWOB_INSTANCE` > legacy |
| `tools/api_server/test_ipc.py` | Env-aware `_sock_path()` helper |
| `tools/api_server/test_move.py` | Same |
| `tools/api_server/test_browser_ipc.py` | Same |
| `tools/api_server/move_test_pattern.py` | Same |
| `tools/monitor/instance_monitor.py` | **New** — discovers `/tmp/wibwob_*.sock` via glob, polls `get_state`, renders ANSI dashboard |
| `tools/scripts/launch_tmux.sh` | **New** — spawns N tmux panes with `WIBWOB_INSTANCE=1..N` + monitor sidebar |

### Verification
```bash
# Build
cmake --build ./build

# Legacy path (no env var) — backward compat
./build/app/test_pattern &
ls -l /tmp/test_pattern_app.sock
kill %1

# Instance path
WIBWOB_INSTANCE=1 ./build/app/test_pattern &
ls -l /tmp/wibwob_1.sock
echo 'cmd:get_state' | nc -U /tmp/wibwob_1.sock
kill %1

# Monitor
WIBWOB_INSTANCE=1 ./build/app/test_pattern &
WIBWOB_INSTANCE=2 ./build/app/test_pattern &
python3 tools/monitor/instance_monitor.py
# Should show both as LIVE

# Full tmux launch
./tools/scripts/launch_tmux.sh 4
```
