# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WibWob-DOS is a symbient operating system — a C++14 TUI application built on Turbo Vision where a human and AI agent share equal control of a text-native dual interface. It is not a tool or assistant; it's a coinhabitant with its own identity, agency, and aesthetic.

## Build Commands

```bash
# Build (from project root)
cmake . -B ./build -DCMAKE_BUILD_TYPE=Release
cmake --build ./build

# Run main app
./build/app/test_pattern

# Run with debug logging
./build/app/test_pattern 2> /tmp/wibwob_debug.log

# Start API server (auto-creates venv, installs deps)
./start_api_server.sh

# Test API health
curl http://127.0.0.1:8089/health
```

Other executables: `simple_tui`, `frame_file_player`, `paint_tui`, `ansi_viewer`, `tv_ascii_view`, `ascii_dump` — all built to `./build/app/`.

## Verification

```bash
# IPC integration tests (require running TUI app)
uv run tools/api_server/test_ipc.py    # Test socket connection + get_state
uv run tools/api_server/test_move.py   # Test rapid window movement

# API server smoke test (requires running API server)
curl http://127.0.0.1:8089/health
curl http://127.0.0.1:8089/state

# TUI screenshot — use /screenshot skill for full pipeline
# Quick manual: trigger capture, read latest text dump
curl -s -X POST http://127.0.0.1:8089/screenshot
cat "$(ls -t logs/screenshots/tui_*.txt | head -1)"
```

**Agent visual inspection**: use `/screenshot` skill (`.claude/skills/screenshot/`) which handles capture, state JSON, diff, window crop, and auto-recovery. See SKILL.md there for all modes.

No C++ unit test framework is configured. C++ testing is manual via UI interaction or API calls.

Primary automated regression coverage for multiplayer/IPC lives in `tests/room/` (Python, 160 tests). Run for all boundary/contract changes:

```bash
uv run --with pytest pytest tests/room/ -q
```

## Running the Live TUI in Claude Code (headless/tmux)

When running inside Claude Code on the web (or any headless environment), use this exact sequence to start the TUI app, API server, and verify via screenshots. All commands assume the project is already built (`cmake --build ./build`).

### 1. Start TUI in tmux

```bash
# Kill any stale sessions, then launch with a fixed terminal size
tmux kill-server 2>/dev/null
tmux new-session -d -s wibwob -x 120 -y 40 ./build/app/test_pattern

# Verify it's running (should show menu bar + desktop)
tmux capture-pane -t wibwob -p | head -5
```

### 2. Start API server

Wait for the IPC socket to appear, then start the FastAPI server with all deps:

```bash
# Confirm socket exists
ls /tmp/test_pattern_app.sock

# Start API server (uv resolves all deps from requirements.txt)
WIBWOB_REPO_ROOT=$(pwd) uv run \
  --with-requirements tools/api_server/requirements.txt \
  python3 -m uvicorn tools.api_server.main:app \
  --host 127.0.0.1 --port 8089 &

# Wait for startup then health check (~5-8s for dependency install on first run)
sleep 8 && curl -sf http://127.0.0.1:8089/health
# Expected: {"ok":true}
```

### 3. Interact and screenshot

```bash
# Get state (windows, canvas size, theme)
curl -sf http://127.0.0.1:8089/state | python3 -m json.tool

# Take a screenshot (text dump)
curl -sf -X POST http://127.0.0.1:8089/screenshot
cat "$(ls -t logs/screenshots/tui_*.txt | head -1)"

# Open windows via command registry
curl -sf -X POST http://127.0.0.1:8089/menu/command \
  -H 'Content-Type: application/json' \
  -d '{"command":"open_terminal"}'

# Type into a terminal window
curl -sf -X POST http://127.0.0.1:8089/menu/command \
  -H 'Content-Type: application/json' \
  -d '{"command":"terminal_write","args":{"text":"ls\n"}}'
```

### Gotchas

- **uv bytecache**: if you edit Python files (e.g. `models.py`) while the API server is running, you must restart uvicorn. The `uv run` environment caches bytecode. Kill with `pkill -f uvicorn`, wait 2s, relaunch.
- **tmux terminal size**: always pass `-x` and `-y` to `tmux new-session`. Without them, the TUI gets a 0x0 canvas and nothing renders.
- **Socket path**: the default socket is `/tmp/test_pattern_app.sock`. If using multi-instance, set `WIBWOB_INSTANCE=N` for `/tmp/wibwob_N.sock`.
- **First run dependency install**: `uv run --with-requirements` downloads packages on first invocation (~3-8s). Subsequent runs use cache.
- **`/menu/command` vs `/windows`**: use `/menu/command` for the command registry (C++ dispatch, works for all commands). The `/windows` endpoint validates against the Python `WindowType` enum which may lag behind C++ if the server was started before code changes.

## Architecture

```
Human / AI Agent
       │
       ├── Keyboard/Mouse ──┐
       │                     │
       └── MCP/REST API ─────┤
                              │
              ┌───────────────▼──────────────────┐
              │  C++ TUI App (Turbo Vision)      │
              │  test_pattern_app.cpp (~2600 LOC) │
              │  ├─ Window management             │
              │  ├─ Generative art engines (8+)   │
              │  ├─ WibWobEngine (LLM dispatch)   │
              │  ├─ Chat interface (wibwob_view)  │
              │  └─ IPC socket listener           │
              └───────────┬──────────────────────┘
                          │ Unix socket (/tmp/wibwob_N.sock or legacy /tmp/test_pattern_app.sock)
              ┌───────────▼──────────────────────┐
              │  FastAPI Server (Python)          │
              │  tools/api_server/main.py         │
              │  ├─ 20+ REST endpoints            │
              │  ├─ WebSocket broadcast (/ws)     │
              │  └─ MCP tool endpoints (/mcp)     │
              └───────────┬──────────────────────┘
                          │
              ┌───────────▼──────────────────────┐
              │  Claude SDK Bridge (Node.js)      │
              │  app/llm/sdk_bridge/              │
              └──────────────────────────────────┘
```

### Key Entry Points

- **`app/test_pattern_app.cpp`** — Main TUI app: desktop, menus, window management, chat integration
- **`app/wibwob_engine.h/cpp`** — LLM provider lifecycle, tool execution, system prompts
- **`app/wibwob_view.h/cpp`** — Chat interface: TWibWobWindow (MessageView + InputView), streaming support
- **`app/api_ipc.h/cpp`** — Unix socket listener, JSON command/response protocol
- **`tools/api_server/main.py`** — FastAPI REST + WebSocket + MCP server (port 8089)

### Command Registry (`app/command_registry.h/cpp`)

**One list, many callers.** All TUI commands are defined once in `get_command_capabilities()`. Menu items, IPC socket, REST API, MCP tools, and Scramble's slash commands all read from the same registry. To add a new command: add to the capabilities vector + dispatch in `exec_registry_command()` + stub in test files. Never wire a command in multiple places separately.

### Scramble (`app/scramble_view.h/cpp`, `app/scramble_engine.h/cpp`)

Symbient cat. Three window states: hidden / smol (28×14, cat + bubble) / tall (full height, message history + input). Slash commands typed in Scramble's input check the command registry first — `/cascade`, `/screenshot`, `/scramble_pet` etc all execute. Commands not in registry fall through to `ScrambleEngine` for `/help`, `/who`, `/cmds`, or Haiku chat. Auth is shared with Wib&Wob via `AuthConfig` — Claude Code mode uses `claude -p --model haiku`, API Key mode uses direct curl. Fallback: `ANTHROPIC_API_KEY` env var or Tools > API Key at runtime.

### LLM Auth & Provider System (`app/llm/`)

**Auth** is unified via `AuthConfig` singleton (`app/llm/base/auth_config.h`), detected once at startup:
1. **Claude Code** (default) — `claude` CLI logged in → SDK provider + CLI subprocess for Scramble
2. **API Key** — `ANTHROPIC_API_KEY` set → direct HTTP provider + curl for Scramble
3. **No Auth** — disabled, clear error messages in both chat windows

Status line shows: `LLM ON` (Claude Code) / `LLM KEY` (API Key) / `LLM OFF` (No Auth).

**Providers** use abstract `ILLMProvider` with factory dispatch. Config in `app/llm/config/llm_config.json`:
- **`claude_code_sdk`** — Node.js bridge with streaming, uses `app/llm/sdk_bridge/claude_sdk_bridge.js`
- **`anthropic_api`** — Direct HTTP fallback (curl-based, async)

### View System

All views are TView subclasses — resizable, movable, stackable:
- **Generative art engines** (8+): Verse, Mycelium, Monster Portal/Verse/Cam, Orbit, Torus, Cube, Game of Life
- **Animated views**: Blocks, Gradient, ASCII, Score, Frame Player
- **Utility**: Text editor, ANSI viewer, ASCII image, grid, transparent text, token tracker
- **Paint**: Full pixel-level drawing system (`app/paint/`)

### Turbo Vision ANSI Rendering Rule

When implementing image/terminal-rich rendering in Turbo Vision views:

1. Do **not** write raw ANSI escape streams (`\x1b[...`) directly to `TDrawBuffer` text.
2. Parse ANSI into a cell model first: `cell = glyph + fg + bg`.
3. Render cells with Turbo Vision-native draw operations (attributes/colors per cell).
4. Treat visible ESC/CSI sequences in UI as a correctness bug.

Use this kickoff prompt for any ANSI/image rendering task:

`Before coding, design the render path from first principles for Turbo Vision: source bytes -> ANSI stream -> parsed cell grid (glyph, fg, bg) -> native TV draw calls. Do not render raw ANSI text. Show parser/renderer boundaries, cache keys, failure modes, and a test that fails if ESC sequences appear in UI output.`

### Module System

Content packs in `modules/` (public, shipped) and `modules-private/` (user content, gitignored). Each module has a `module.json` manifest. Types: content, prompt, view, tool. See `modules/README.md`.

### WibWobCity (Micropolis ASCII city-builder)

An in-engine city-builder built on the open-source Micropolis (SimCity) engine.
**Full gameplay reference — controls, glyphs, code map, tests:** `docs/wibwobcity-gameplay.md`

Key files:
- `app/micropolis_ascii_view.h/.cpp` — `TMicropolisAsciiView`: cursor, camera, tool select, HUD, draw
- `app/micropolis/micropolis_bridge.h/.cpp` — thin C++ wrapper over Micropolis engine: tick, apply_tool, snapshot, glyphs
- `app/micropolis/compat/emscripten.h` — shim allowing native build of MicropolisCore
- `vendor/MicropolisCore/` — upstream engine (git submodule)
- `.pi/skills/micropolis-engine/SKILL.md` — engine archaeology: tile ranges, zone tier formulae, tool API

Opened via `open_micropolis_ascii` command. Guardrail: no raw ANSI bytes in any `TDrawBuffer` write — `micropolis_no_ansi` test must stay green.

## Key Configuration Files

| File | Purpose |
|------|---------|
| `CMakeLists.txt` + `app/CMakeLists.txt` | CMake build (C++14, 7 executables) |
| `app/llm/config/llm_config.json` | Active LLM provider and settings |
| `app/README-CLAUDE-CONFIG.md` | Dual Claude instance setup, MCP config |
| `tools/api_server/requirements.txt` | Python deps (FastAPI, uvicorn, pydantic, fastapi-mcp) |
| `.gitmodules` | tvision submodule at `vendor/tvision` |

### Multi-Instance Environment Variables

| Variable | Effect |
|----------|--------|
| `WIBWOB_INSTANCE` | Instance ID (e.g. `1`, `2`). Drives socket path `/tmp/wibwob_N.sock`. Unset = legacy `/tmp/test_pattern_app.sock` |
| `TV_IPC_SOCK` | Explicit socket path override (Python only, takes priority over `WIBWOB_INSTANCE`) |
| `WIBWOB_REPO_ROOT` | Repo root for API server (set automatically by `start_api_server.sh`). Prevents cross-checkout path mismatch when API server and TUI run from different repo copies |

Launch multiple instances: `./tools/scripts/launch_tmux.sh [N]` (tmux + monitor sidebar).

## Dependencies

### Build
- **Turbo Vision**: Git submodule at `vendor/tvision` (fork of magiblot/tvision, C++14 TUI framework)
- **ncurses/ncursesw**: Terminal backend
- **CMake 3.10+**: Build system

### Runtime
- **Python 3.x + FastAPI stack**: API server (`tools/api_server/`), auto-creates venv via `start_api_server.sh`
- **Node.js**: Claude SDK bridge (`app/llm/sdk_bridge/`)

### System tools (macOS: `brew install`)
- **chafa**: ANSI image rendering for browser view (`brew install chafa`) — required for `images:all-inline`/`key-inline`/`gallery` modes
- **curl**: Used by TUI browser to call API server (pre-installed on macOS/Linux)

## Dual Claude Instance Architecture

Two separate Claude instances interact with the system (see `app/README-CLAUDE-CONFIG.md`):
1. **External CLI** (Claude Code) — develops the codebase, builds, runs the app
2. **Embedded Chat** (inside TUI) — controls windows via MCP tools, accessed via Tools → Wib&Wob Chat (F12)

The API server on port 8089 bridges between the Python/MCP layer and the C++ app via IPC socket.

## Parity Enforcement

> Canon terms: **Registry**, **Parity**, **Capability** — see `.planning/README.md` for formal definitions.

The C++ command registry (`app/command_registry.cpp`) and window type registry (`app/window_type_registry.cpp`) are the single sources of truth. Python enums, schemas, and MCP tool builders must stay in sync.

**Automated enforcement** (run these tests before merging):
```bash
uv run --with pytest pytest tests/contract/test_window_type_parity.py tests/contract/test_surface_parity_matrix.py tests/contract/test_node_mcp_parity.py -v
```

These tests auto-derive from C++ source — no hardcoded mapping tables. They will fail immediately if a new C++ type or command is added without updating the Python side.

### Adding a new window type
1. Add entry to `k_specs[]` in `app/window_type_registry.cpp` (type slug, spawn fn, match fn)
2. Add value to `WindowType` enum in `tools/api_server/models.py`
3. If spawnable: add to `WindowCreate` Literal in `tools/api_server/schemas.py`
4. Run: `pytest tests/contract/test_window_type_parity.py`

### Adding a new command
1. Add to `get_command_capabilities()` in `app/command_registry.cpp`
2. Add dispatch in `exec_registry_command()` in same file
3. Add MCP tool builder in `_command_tool_builders()` in `tools/api_server/mcp_tools.py`
4. Add matching tool in `app/llm/sdk_bridge/mcp_tools.js` (Node MCP for embedded agent)
5. Run: `pytest tests/contract/test_surface_parity_matrix.py tests/contract/test_node_mcp_parity.py`

### Node MCP bridge (embedded Wib&Wob agent)
The embedded agent uses `app/llm/sdk_bridge/mcp_tools.js` for TUI control tools.
- Window types use `z.string()` (not `z.enum`) — validated by C++ registry, not JS
- Tool whitelist in `claude_sdk_bridge.js` is auto-derived from `mcpServer.tools` (no hardcoding)
- System prompt is augmented at session start with live capabilities from `GET /capabilities`
- Parity test: `pytest tests/contract/test_node_mcp_parity.py`

### Capabilities endpoint
`GET /capabilities` now queries C++ via IPC (`get_window_types` and `get_capabilities` commands) so window types and commands are auto-derived from the running binary — Python never maintains its own authoritative list.

## Agent Workflow

- **Planning canon first**: follow `.planning/README.md` for terms, acceptance-criteria format, and issue-first workflow.
- **Epic status**: `.planning/epics/EPIC_STATUS.md` is the quick-read register. Run `.claude/scripts/planning.sh status` for live table from frontmatter. Each epic brief has YAML frontmatter (`id`, `title`, `status`, `issue`, `pr`, `depends_on`). A PostToolUse hook auto-syncs EPIC_STATUS.md whenever a brief is edited.
- **Issue-first**: create or reference a GitHub issue before starting work.
- **Manual issue/PR sync required**: issue state is not auto-updated by hooks or PR creation. Claude/Codex must explicitly:
  - move issue status in planning and GitHub as work starts/completes,
  - update frontmatter `status:` and `pr:` fields in epic briefs (hook syncs EPIC_STATUS.md automatically),
  - post progress evidence (commit SHAs + tests),
  - close linked story/feature/epic issues once acceptance checks pass.
- **GitHub formatting reliability**: do not post long markdown in inline quoted CLI args. Use `gh ... --body-file` (file or heredoc stdin) for all issue/PR comments and `gh pr edit --body-file` for PR description updates, then verify line breaks by reading back body text.
- **Branch-per-issue**: branch from `main`, name as `<type>/<short-description>` (e.g. `feat/command-registry`, `fix/ipc-timeout`).
- **Use templates**: open issues from `.github/ISSUE_TEMPLATE/` and use `.github/pull_request_template.md`.
- **PR body must use the template**: always populate the PR body from `.github/pull_request_template.md`. Tick all Acceptance Criteria checkboxes before declaring the PR ready. Verify by reading back the PR body with `gh pr view`.
- **PR checklist**: see `workings/chatgpt-refactor-vision-planning-2026-01-15/pr-acceptance-and-quality-gates.md` for the full acceptance gate list. Key gates: command defined once in C++ registry, menu/MCP parity preserved, `get_state()` validates against schema, Python tests pass.
- **No force-push to main**.
- **No emoji in commit messages** — not in title, not in description. Plain text only.

### Codex review loop (hardening tasks)

When implementing a multi-round hardening task (bug fixing, IPC robustness, etc.):

1. **After committing a batch of fixes**, immediately launch Codex round-N review in background:
   ```bash
   codex exec -C /Users/james/Repos/wibandwob-dos "<detailed prompt>" \
     2>&1 | tee /Users/james/Repos/wibandwob-dos/codex-review-roundN-$(date +%Y%m%d-%H%M%S).log &
   ```

2. **Always include a devnote preamble** in every Codex prompt that lists the last 5-10 CODEX-ANALYSIS-ROUNDn-REVIEW.md files. Codex has no persistent memory across calls, so it must be told what happened in previous rounds. Example:
   ```
   Read CODEX-ANALYSIS-ROUND7-REVIEW.md, CODEX-ANALYSIS-ROUND6-REVIEW.md,
   CODEX-ANALYSIS-ROUND5-REVIEW.md to understand all previous findings and
   fixes. Then do a fresh verification pass...
   ```
   The analysis markdowns are compact (~30-50 lines) and give Codex the full context it needs without requiring it to re-read raw logs.

3. **Context limit protocol** — when context remaining drops below ~13%:
   a. Launch Codex round-N with a detailed prompt referencing the last 2 log files AND recent CODEX-ANALYSIS markdowns for context
   b. Run `/compact` to preserve session state to `logs/memory/compact-<date>.md`
   c. The next session reads the Codex log and continues the loop

4. **Per-round cycle**: read log → write `CODEX-ANALYSIS-ROUNDn-REVIEW.md` → implement findings → add/run tests → commit → launch next round

5. **Stop when**: Codex reports no new Critical/High findings. Document "confirmed safe" list in final review.

## Scope Guardrails

- The memory/state substrate is **local-first only** — no retrieval pipelines, no RAG, no cloud sync.
- Planning docs in `workings/` are local working files, not shipped artifacts.
- The local-first research scope was explicitly closed as local-only (see `workings/chatgpt-refactor-vision-planning-2026-01-15/overview.md` notes).
