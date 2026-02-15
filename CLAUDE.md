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
                          │ Unix socket (/tmp/test_pattern_app.sock)
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

## Dependencies

- **Turbo Vision**: Git submodule at `vendor/tvision` (fork of magiblot/tvision, C++14 TUI framework)
- **ncurses/ncursesw**: Terminal backend
- **CMake 3.10+**: Build system
- **Python 3.x + FastAPI stack**: API server (`tools/api_server/`)
- **Node.js**: Claude SDK bridge (`app/llm/sdk_bridge/`)

## Dual Claude Instance Architecture

Two separate Claude instances interact with the system (see `app/README-CLAUDE-CONFIG.md`):
1. **External CLI** (Claude Code) — develops the codebase, builds, runs the app
2. **Embedded Chat** (inside TUI) — controls windows via MCP tools, accessed via Tools → Wib&Wob Chat (F12)

The API server on port 8089 bridges between the Python/MCP layer and the C++ app via IPC socket.

## Current Known Gaps

The main active architectural concern is **menu/API/MCP parity drift**: commands can be added to the C++ menu bar, the Python REST API, or the MCP tool surface independently, with no single registry enforcing consistency. The planned fix is a **unified command registry** in C++ where each command is defined once and menu items, IPC handlers, and MCP tools are auto-generated from it. See `workings/chatgpt-refactor-vision-planning-2026-01-15/` for the full refactor planning bundle (start with `overview.md` → `spec-state-log-vault-browser.md` → `pr-acceptance-and-quality-gates.md`).

## Agent Workflow

- **Planning canon first**: follow `/Users/james/Repos/wibandwob-dos/.planning/README.md` for terms, acceptance-criteria format, and issue-first workflow.
- **Issue-first**: create or reference a GitHub issue before starting work.
- **Manual issue/PR sync required**: issue state is not auto-updated by hooks or PR creation. Claude/Codex must explicitly:
  - move issue status in planning and GitHub as work starts/completes,
  - post progress evidence (commit SHAs + tests),
  - set `PR:` in planning briefs when a PR is opened,
  - close linked story/feature/epic issues once acceptance checks pass.
- **GitHub formatting reliability**: do not post long markdown in inline quoted CLI args. Use `gh ... --body-file` (file or heredoc stdin) for all issue/PR comments and `gh pr edit --body-file` for PR description updates, then verify line breaks by reading back body text.
- **Branch-per-issue**: branch from `main`, name as `<type>/<short-description>` (e.g. `feat/command-registry`, `fix/ipc-timeout`).
- **Use templates**: open issues from `.github/ISSUE_TEMPLATE/` and use `.github/pull_request_template.md`.
- **PR body must use the template**: always populate the PR body from `.github/pull_request_template.md`. Tick all Acceptance Criteria checkboxes before declaring the PR ready. Verify by reading back the PR body with `gh pr view`.
- **PR checklist**: see `workings/chatgpt-refactor-vision-planning-2026-01-15/pr-acceptance-and-quality-gates.md` for the full acceptance gate list. Key gates: command defined once in C++ registry, menu/MCP parity preserved, `get_state()` validates against schema, Python tests pass.
- **No force-push to main**.

## Scope Guardrails

- The memory/state substrate is **local-first only** — no retrieval pipelines, no RAG, no cloud sync.
- Planning docs in `workings/` are local working files, not shipped artifacts.
- The local-first research scope was explicitly closed as local-only (see `workings/chatgpt-refactor-vision-planning-2026-01-15/overview.md` notes).
