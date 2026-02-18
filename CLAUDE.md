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
```

No C++ unit test framework is configured. C++ testing is manual via UI interaction or API calls.

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

Symbient cat. Three window states: hidden / smol (28×14, cat + bubble) / tall (full height, message history + input). Slash commands typed in Scramble's input check the command registry first — `/cascade`, `/screenshot`, `/scramble_pet` etc all execute. Commands not in registry fall through to `ScrambleEngine` for `/help`, `/who`, `/cmds`, or Haiku chat. API key for Haiku set via Tools > API Key or `ANTHROPIC_API_KEY` env var.

### LLM Provider System (`app/llm/`)

Abstract provider interface (`ILLMProvider`) with factory dispatch. Active provider configured in `app/llm/config/llm_config.json`. Available providers:
- **`claude_code_sdk`** (active) — Node.js bridge with streaming, uses `app/llm/sdk_bridge/claude_sdk_bridge.js`
- **`claude_code`** — CLI wrapper via `claude -p` command
- **`anthropic_api`** — Direct HTTP (disabled)

Note: `llm_config.json` may reference providers not yet registered in C++. Only providers with `REGISTER_LLM_PROVIDER()` in `app/llm/providers/` are actually available.

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

## Current Known Gaps

Menu/API/MCP parity drift was resolved by E001 (command registry). The unified `CommandRegistry` in C++ is now the single source for commands — menu items, IPC handlers, and MCP tools derive from it. Parity is enforced by automated drift tests. See `.planning/epics/e001-command-parity-refactor/` for the full epic record.

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

2. **Context limit protocol** — when context remaining drops below ~13%:
   a. Launch Codex round-N with a detailed prompt referencing the last 2 log files and listing exact findings to look for
   b. Run `/compact` to preserve session state to `logs/memory/compact-<date>.md`
   c. The next session reads the Codex log and continues the loop

3. **Per-round cycle**: read log → write `CODEX-ANALYSIS-ROUNDn-REVIEW.md` → implement findings → add/run tests → commit → launch next round

4. **Stop when**: Codex reports no new Critical/High findings. Document "confirmed safe" list in final review.

## Scope Guardrails

- The memory/state substrate is **local-first only** — no retrieval pipelines, no RAG, no cloud sync.
- Planning docs in `workings/` are local working files, not shipped artifacts.
- The local-first research scope was explicitly closed as local-only (see `workings/chatgpt-refactor-vision-planning-2026-01-15/overview.md` notes).
