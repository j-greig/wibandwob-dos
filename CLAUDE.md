# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Session start rules — read before touching any code

1. **Branch before you code.** Never commit feature or fix work directly to `main`.
   - **Epics**: must have a GitHub issue. Create one if missing.
   - **Features/fixes**: create a GitHub issue before starting.
   - **Spikes** (`.planning/` doc-only investigations): no GitHub issue needed — branch + planning doc is enough.
   ```bash
   gh issue create --title "..." --body "..."   # epics + features
   git checkout -b feat/your-slug               # always branch
   git checkout -b spike/your-slug              # spikes: branch only, no issue required
   ```

2. **Screenshot before you commit.** For any visual feature (gallery, layout, windows):
   take a screenshot, read it, confirm it looks right — *then* commit.
   ```bash
   ./scripts/snap.sh <label>          # snap + save to logs/screenshots/
   cat logs/screenshots/tui_*.txt     # read latest
   ```

3. **Always close windows before a new layout run.**
   ```bash
   curl -s -X POST http://127.0.0.1:8089/windows/close_all
   ```

4. **Always use `--reload` when starting the API server** so edits hot-reload without a restart.
   See the "Quick start" section below for the authoritative startup recipe. The headless/tmux section only adds environment-specific notes.

## ⚡ Quick start — copy-paste to get a working stack

### First time / fresh clone (run once)

```bash
# Pull all submodules (tvision, MicropolisCore, tvterm, etc.)
git submodule update --init --recursive

# Configure CMake build dir (only needed once, or after CMakeLists changes)
cmake . -B ./build -DCMAKE_BUILD_TYPE=Release
```

### Every session

```bash
# 1. Build
cmake --build ./build --target wwdos

# 2. Start TUI (socket: /tmp/wwdos.sock)
./build/app/wwdos 2>/tmp/wibwob_debug.log &
until [ -S /tmp/wwdos.sock ]; do sleep 0.5; done && echo "TUI ready"

# 3. Start API (connects to same socket automatically)
./start_api_server.sh

# 4. Verify
curl http://127.0.0.1:8089/health   # → {"ok":true}
```

**Multi-instance** (rare): set `WIBWOB_INSTANCE=N` on both TUI and API → socket becomes `/tmp/wibwob_N.sock`.

## Project Overview

WibWob-DOS is a symbient operating system — a C++14 TUI application built on Turbo Vision where a human and AI agent share equal control of a text-native dual interface. It is not a tool or assistant; it's a coinhabitant with its own identity, agency, and aesthetic.

## Build Commands

```bash
# Build (from project root)
cmake . -B ./build -DCMAKE_BUILD_TYPE=Release
cmake --build ./build

# Run main app
./build/app/wwdos

# Run with debug logging
./build/app/wwdos 2> /tmp/wibwob_debug.log

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

# TUI screenshot — trigger capture, read latest text dump
curl -s -X POST http://127.0.0.1:8089/screenshot
cat "$(ls -t logs/screenshots/tui_*.txt | head -1)"
```

> Full operational cheat sheet: `.claude/skills/ww-ops/SKILL.md`.

**Contract parity tests** (no running TUI needed — parses source only):

```bash
# Window type parity (C++ registry vs Python enum/schema)
tools/api_server/venv/bin/pytest tests/contract/test_window_type_parity.py -v

# Timer cleanup (every setTimer has matching killTimer in destructor)
tools/api_server/venv/bin/pytest tests/contract/test_timer_cleanup_parity.py -v

# Full CI suite (11 tests, ~0.8s)
tools/api_server/venv/bin/pytest tests/contract/ -v --tb=short \
  -k "window_type_parity or parity_drift or capabilities_schema or no_hardcoded or timer_cleanup"
```

**Smoke parade** (visual integration test, requires running TUI + API):

```bash
python3 tools/smoke_parade.py --delay 1.5          # full run, 29 windows + 15 commands
python3 tools/smoke_parade.py --delay 1.0 --start 28  # jump to step 28
# Results: logs/smoke_parade/<timestamp>/parade.json + per-step .txt screenshots
```

**Post-implementation parity audit**: use `/ww-audit` skill to verify a window type has registry slug, props save/restore, and correct screen position.

**C++ build & edit rules**: load `.pi/skills/wibwobdos/SKILL.md` before editing C++ files. Covers mandatory build-after-edit, tvision Z-order gotchas (frame insertion, `insertBefore` semantics), and frameless right-click coverage rule.

**Known crashers** (skip in automated tests):
- `micropolis_ascii`: SIGBUS in Micropolis::clearMap() during init. 100% reproducible.
- `room_chat`: blink timer UAF partially fixed. Timer cleanup added but rapid close still risky.

**close_all preserves session windows**: TWibWobWindow, TWibWobTerminalWindow, and TScrambleWindow survive close_all. Agents can safely call close_all without losing their own chat or terminal.

Primary automated regression coverage for multiplayer/IPC lives in `tests/room/` (Python, 160 tests). Run for all boundary/contract changes:

```bash
uv run --with pytest pytest tests/room/ -q
```

## Running the Live TUI in Claude Code (headless/tmux)

Use the **Quick start** section above as the authoritative startup recipe (TUI + API + socket alignment). This section only adds headless/tmux-specific steps and a minimal verification loop.

### Headless/tmux addendum

```bash
# Run TUI in tmux, attach once to lock canvas size, then detach
tmux new-session -d -s wibwob "./build/app/wwdos 2>/tmp/wibwob_debug.log"
tmux attach -t wibwob   # Ctrl-B D to detach

# Run API in background tmux
tmux new-session -d -s wibwob-api "./start_api_server.sh"
```

### Minimal verification loop

```bash
curl -sf http://127.0.0.1:8089/health
curl -sf http://127.0.0.1:8089/state | python3 -m json.tool
curl -sf -X POST http://127.0.0.1:8089/screenshot
cat "$(ls -t logs/screenshots/tui_*.txt | head -1)"
```

> Full API reference and curl recipes: see `.pi/skills/wibwobdos/SKILL.md` (authoritative ops manual) and `tools/api_server/README.md`.

### CRITICAL: Never kill the TUI process

**NEVER use `pkill`, `kill -9`, or `tmux kill-session` on a running wwdos process.**

wwdos enables terminal mouse tracking. If you kill it without letting it clean up,
raw mouse escape codes flood the terminal and make it unusable. The human then has
to quit their terminal entirely and restart.

Rules:
- To test a new binary, ASK the human to quit the app (Ctrl-Q or Alt-X) and relaunch.
- Only restart the API server (uvicorn) — that is stateless and safe to kill/restart.
- If you absolutely must stop wwdos programmatically, send `kill -TERM` (not `-9`) and
  wait for it to exit cleanly. But prefer asking the human.
- If the terminal gets mouse garbage, the human can type `reset` to fix it.

### Gotchas

- **SDK bridge npm install**: if the Wib&Wob chat window silently times out, run `cd app/llm/sdk_bridge && npm install`. The `node_modules/` dir is gitignored and must be installed on each fresh clone.
- **API hot-reload**: always start uvicorn with `--reload` (see above). Python edits take effect automatically — no restart needed.
- **tmux terminal size**: do NOT pass `-x`/`-y` to `tmux new-session`. Let the session inherit your real terminal dimensions on first attach. Hardcoding a size larger than your terminal causes gallery placements to appear off-screen. After `tmux attach -t wibwob && Ctrl-B D`, the canvas locks to your viewport.
- **Socket path**: default `/tmp/wwdos.sock`. Multi-instance: `WIBWOB_INSTANCE=N` → `/tmp/wibwob_N.sock`.
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
              │  wwdos_app.cpp (~2600 LOC) │
              │  ├─ Window management             │
              │  ├─ Generative art engines (8+)   │
              │  ├─ WibWobEngine (LLM dispatch)   │
              │  ├─ Chat interface (wibwob_view)  │
              │  └─ IPC socket listener           │
              └───────────┬──────────────────────┘
                          │ Unix socket (/tmp/wwdos.sock)
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

- **`app/wwdos_app.cpp`** — Main TUI app: desktop, menus, window management, chat integration
- **`app/wibwob_engine.h/cpp`** — LLM provider lifecycle, tool execution, system prompts
- **`app/wibwob_view.h/cpp`** — Chat interface: TWibWobWindow (MessageView + InputView), streaming support
- **`app/api_ipc.h/cpp`** — Unix socket listener, JSON command/response protocol
- **`tools/api_server/main.py`** — FastAPI REST + WebSocket + MCP server (port 8089)

### Command Registry (`app/command_registry.h/cpp`)

**One list, many callers.** All TUI commands are defined once in `get_command_capabilities()`. Menu items, IPC socket, REST API, MCP tools, and Scramble's slash commands all read from the same registry. To add a new command: add to the capabilities vector + dispatch in `exec_registry_command()` + stub in test files. Never wire a command in multiple places separately.

### Window Z-Order (`raise_window`, `lower_window`, `focus_window`)

Z-order is the Turbo Vision child linked list. `0` = frontmost. Works on ANY window type (figlet, primer, chat, terminal, paint, generative art, games — anything with a window ID).

| Command | Effect |
|---|---|
| `raise_window` (id) | Bring to front + focus. Uses `w->select()` |
| `lower_window` (id) | Send to back (above desktop background). Uses `w->putInFrontOf(background)` |
| `focus_window` (id) | Same as raise — raises AND focuses |

`/state` reports real `z` (0=front, incrementing) and `focused` (bool) per window. Previously these were hardcoded to `0`/`false`.

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

### Primer Window Chrome

Primer windows (`TFrameAnimationWindow`) have three **independent** display flags — mix freely:

| `frameless` | `shadowless` | result |
|---|---|---|
| false | false | normal framed window with drop shadow (default) |
| true  | false | ghost frame (invisible border) + shadow still visible |
| false | true  | normal frame, no drop shadow |
| true  | true  | fully chromeless — no border, no shadow (pure art/gallery mode) |

`show_title=true` — shows primer filename (without `.txt`) in the top border.
No-op on frameless windows: `TGhostFrame` has no title bar to render into.

**API usage** (`/gallery/arrange` or direct `/menu/command open_primer`):
```bash
# ghost frame only
curl -X POST .../gallery/arrange -d '{"frameless":true,"shadowless":false,...}'

# fully chromeless
curl -X POST .../gallery/arrange -d '{"frameless":true,"shadowless":true,...}'

# titled framed window
curl -X POST .../gallery/arrange -d '{"show_title":true,...}'
```

**C++ location**: `TFrameAnimationWindow` constructor in `app/wwdos_app.cpp`.
`frameless` → chooses `TGhostFrame` vs `TFrame` via `TWindowInit`.
`shadowless` → clears `sfShadow` state flag post-construction.
`title` kv arg → passed as `aTitle` to `TWindow`; visible only when framed.

### FIGlet Typography System

**Core files**: `app/figlet_utils.h/.cpp`, `app/figlet_text_view.h/.cpp`
**Font catalogue**: `modules/wibwob-figlet-fonts/fonts.json` — 148 fonts with metadata
**Skill**: `.pi/skills/figlet-videographer/SKILL.md`

**Font height index** — every font has a fixed character height (lines per row of rendered text). The catalogue stores this in `font_metadata`:

```cpp
int h = figlet::fontHeight("banner");   // → 7
int h = figlet::fontHeight("isometric1"); // → 11
```

Common font heights: mini=4, small=5, standard=6, big=8, banner=7, banner3-D=8, block=8, doom=8, gothic=9, larry3d=9, isometric1=11, 3-d=8.

**Wrap detection** — if figlet output has more lines than `fontHeight()`, the text wrapped into multiple rows. The auto-sizer uses this: `if (total_lines > font_height) lines = font_height` to cap window height to one row.

**Auto-sizing** — `api_spawn_figlet_text()` renders at unlimited width, measures max line width and line count, then sizes the window to fit: `width = maxW + 6` (borders + padding), `height = lines + 3`.

**Window management via API**:
- `open_figlet_text` — open auto-sized window (text, font args)
- `move_window` / `resize_window` — position by ID (id, x, y / id, w, h)
- `figlet_set_text` / `figlet_set_font` / `figlet_set_color` — mutate in-place
- `window_shadow` — toggle shadow (id, on=true/false)
- `preview_figlet` — render without opening a window (returns text)
- `list_figlet_fonts` — returns all 148 font names

**Concrete poetry** — the figlet-videographer skill composes spatial word arrangements on the desktop canvas. See `.pi/skills/figlet-videographer/examples/` for timeline JSON format and playback script.

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
| `WIBWOB_INSTANCE` | Multi-instance only. Set to `N` on both TUI and API → socket `/tmp/wibwob_N.sock`. Unset = `/tmp/wwdos.sock` |
| `WIBWOB_REPO_ROOT` | Repo root for API server (set automatically by `start_api_server.sh`). Prevents cross-checkout path mismatch when API server and TUI run from different repo copies |

Launch multiple instances: `./tools/scripts/launch_tmux.sh [N]` (tmux + monitor sidebar).

## Dependencies

### Build
- **Turbo Vision**: Git submodule at `vendor/tvision` (fork of magiblot/tvision, C++14 TUI framework)
- **tvterm**: Git submodule at `vendor/tvterm` (fork of magiblot/tvterm at `j-greig/tvterm`, branch `feature/text-selection`). Adds mouse-driven text selection + copy-to-clipboard (pbcopy/xclip/xsel) and openpty/vfork multithread safety + forced black terminal bg. Upstream PR: magiblot/tvterm#9 (pending merge). Built as `tvterm-core` static lib (see root CMakeLists.txt) to avoid duplicate tvision target.
- **ncurses/ncursesw**: Terminal backend
- **CMake 3.10+**: Build system

### Runtime
- **Python 3.x + FastAPI stack**: API server (`tools/api_server/`), auto-creates venv via `start_api_server.sh`
- **Node.js**: Claude SDK bridge (`app/llm/sdk_bridge/`) — **must `npm install` before first use**:
  ```bash
  cd app/llm/sdk_bridge && npm install
  ```
  Without this, the Wib&Wob chat window silently times out. Verify with:
  ```bash
  node app/llm/sdk_bridge/smoke_test.js
  ```

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
- **Issue-first**: epics and features require a GitHub issue before starting. Spikes (`.planning/` investigations, no code changes) only need a branch — no issue required.
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
