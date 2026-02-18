# WibWob-DOS

A symbient operating system: human and AI share one Turbo Vision desktop with equal command authority.

## Project Overview

WibWob-DOS is a C++14 Turbo Vision TUI app with a Python FastAPI/MCP bridge.
It supports rich windowed ASCII workflows, browser rendering, AI-operated commands, room orchestration, and multiplayer state sync experiments.

Core stack:
- C++14 + Turbo Vision (`app/`)
- Python FastAPI + MCP (`tools/api_server/`)
- Optional PartyKit multiplayer relay (`partykit/`, `tools/room/`)

## What Makes This Unusual

- It is not "AI assistant in a shell"; it is a coinhabited OS model.
- Command parity is enforced: menu, IPC/API, MCP, and chat command flows derive from one C++ registry.
- Browser content is rendered as text-native TUI output (markdown, figlet headings, ANSI image modes).
- Multi-instance and multiplayer paths are first-class architectural concerns.

## Quick Start

```bash
git clone --recursive https://github.com/j-greig/wibandwob-dos.git
cd wibandwob-dos

cmake . -B ./build -DCMAKE_BUILD_TYPE=Release
cmake --build ./build

./build/app/test_pattern
```

Run API bridge:
```bash
./start_api_server.sh
curl http://127.0.0.1:8089/health
```

## Architecture

```text
Human input (kbd/mouse)          AI input (MCP/REST)
            |                              |
            +--------------+---------------+
                           v
                 C++ Turbo Vision App
               (state authority + views)
                           |
                       Unix socket IPC
                           |
                           v
                 Python FastAPI/MCP bridge
            (REST, MCP tools, websocket broadcast)
                           |
                    Optional room/multiplayer
             (orchestrator + PartyKit relay bridge)
```

## Key Commands

Build and run:
```bash
cmake . -B ./build -DCMAKE_BUILD_TYPE=Release
cmake --build ./build
./build/app/test_pattern
```

API smoke:
```bash
curl http://127.0.0.1:8089/health
curl http://127.0.0.1:8089/state
```

Contract tests:
```bash
uv run --with pytest --with fastapi pytest tests/contract -q
```

Multi-instance example:
```bash
WIBWOB_INSTANCE=1 ./build/app/test_pattern
WIBWOB_INSTANCE=2 ./build/app/test_pattern
```

## Contributing

- Follow planning canon in `.planning/README.md`.
- Use issue-first workflow and keep `.planning/epics/` synced with GitHub issue state.
- Keep command changes registry-first (single source in C++).
- Add/maintain AC → Test traceability for all feature and story briefs.
- Preserve parity across menu, API, and MCP surfaces when adding commands.
