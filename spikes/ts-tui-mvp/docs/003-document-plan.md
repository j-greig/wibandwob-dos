# 003 — Document Plan

Estimated handover docs needed for the TS rebuild.
Each doc is a self-contained capsule covering one major subsystem.

## Existing

| Doc | Covers |
|-----|--------|
| overview.md | Feature parcel map (P1-P7), critique, TS rebuild gaps |
| 001 | Primer measurement, gallery_list, primer_info, state hook |
| 002 | Architecture plan for P1-P7 (measurement, chrome, layout) |
| 003 | This document plan |

## Needed: 10 more docs (004-013)

### 004 — Window Type Registry & Factory Pattern
The C++ app has 33 registered window types. The TS spike has 17 kinds
in a god class. This doc covers:
- Full window type inventory with spawn signatures
- Which types are simple (stateless render) vs complex (interactive)
- The WindowRecord / WindowSnapshot serialization contract
- Factory decomposition strategy (registry map vs monolith)
- Window lifecycle: create, focus, resize, close, serialize, restore
- Chrome modes per type (standard, frameless, figlet, minimal)

### 005 — LLM Integration & Claude SDK Bridge
The in-app AI system. Covers:
- Auth flow (Claude Code SDK → claude CLI → API key fallback)
- SDK bridge architecture (Node.js child process, JSON-RPC over stdio)
- MCP tool registration (mcp_tools.js, Zod schemas, type coercion)
- Tool executor (C++ side dispatches to command_registry)
- Wib & Wob chat: two-persona prompting, voice markers, TTS hooks
- Scramble the cat: independent Claude session, engine commands
- Model config (llm_config.json, provider factory, defaults)
- Streaming: how LLM deltas reach the TUI (sdk_bridge → IPC → view)

### 006 — Command Registry & IPC Protocol
The 96-command surface that agents talk to. Covers:
- Command registration pattern (name, description, has_params)
- IPC wire format (Unix domain socket, line-delimited key:value)
- Command dispatch (string matching in command_registry.cpp)
- API server translation layer (FastAPI → IPC → response parsing)
- MCP tool bridge (mcp_tools.js wraps commands as Claude tools)
- Argument conventions (string-only values, base64 for content)
- Error handling and response formats

### 007 — Terminal Emulator
PTY management and the tvterm integration. Covers:
- tvterm-core architecture (VT parser, PTY, screen buffer)
- Terminal view: PTY spawn, read/write, resize propagation
- terminal_write / terminal_read IPC commands
- Multi-terminal support (window_id targeting, z-order default)
- Shell environment inheritance
- The Backrooms TV subprocess model (forkpty, process groups)

### 008 — Theme System & Desktop Rendering
Visual identity. Covers:
- Theme modes (light, dark) and variants (monochrome, warm, etc.)
- TColorAttr / TColorRGB usage patterns
- Desktop background: patterns, textures, fill characters, colours
- Status bar and menu bar chrome
- Gallery mode (hide chrome for exhibition)
- Desktop presets
- How themes propagate to window interiors

### 009 — Paint Canvas System
The drawable surface. Covers:
- Cell model (fg, bg, character per cell)
- Paint tools: cell, text, line, rect, clear, stamp_figlet
- Export (text), save/load (.wwp format)
- paint_read for agent inspection
- Coordinate system and colour palette (CGA 16-colour)

### 010 — Browser & Text Rendering
Web content in a TUI. Covers:
- Browser pipeline: fetch → readability → markdown → render
- Image handling (chafa conversion to character art)
- Navigation (back, forward, refresh, clip, find)
- Gallery mode (image grid browsing)
- Summarise and extract_links AI tools
- Browser AI tools (ask questions about page content)
- Render modes and width clamping

### 011 — Games & Generative Art Views
The fun stuff. Covers:
- Simple render loop pattern (timer tick → compute → drawView)
- Game state machines (quadra/tetris, snake, rogue)
- Generative art: orbit, torus, cube, life, blocks, mycelium, verse
- Monster ecosystem: monster_cam, monster_verse, monster_portal
- Deep signal, contour map, generative lab
- Score view, animated gradient
- Common patterns: changeBounds override, colour cycling, ASCII rendering

### 012 — Micropolis (SimCity) Integration
The city builder. Covers:
- Engine architecture (ported C code, placement-new with memset)
- ASCII tile rendering from bitmap tileset
- Tool palette and zone logic
- The SIGBUS fix and memory model
- Determinism considerations

### 013 — Event System, Persistence & Multi-Instance
Infrastructure. Covers:
- Turbo Vision event model (evCommand, evBroadcast, evKeyboard, evMouse)
- IPC socket lifecycle (create, probe, cleanup)
- Multi-instance support (WIBWOB_INSTANCE, socket naming)
- Auto-discovery (API finds socket without env var)
- Screenshot system (.txt export, frame capture)
- Workspace save/load (window snapshots)
- Debug logging

## Total: 13 docs + overview

| # | Topic | Est. size | Priority |
|---|-------|-----------|----------|
| overview | Parcel map | done | — |
| 001 | Primer measurement | done | — |
| 002 | Architecture plan | done | — |
| 003 | This plan | done | — |
| 004 | Window types & factories | large | P0 — structural foundation |
| 005 | LLM & Claude SDK bridge | large | P0 — core differentiator |
| 006 | Command registry & IPC | medium | P0 — agent surface |
| 007 | Terminal emulator | medium | P1 — essential feature |
| 008 | Themes & desktop | medium | P1 — visual identity |
| 009 | Paint canvas | small | P2 — feature parity |
| 010 | Browser & text | medium | P2 — feature parity |
| 011 | Games & generative art | large | P3 — port last |
| 012 | Micropolis | small | P3 — port last |
| 013 | Events, persistence, infra | medium | P1 — needed early |

## Grouping for the TS agent

Hand these to the TS agent in priority waves:

**Wave 1** (structural): 004, 005, 006, 013
The agent needs the window system, LLM bridge, command surface,
and infrastructure before building any features.

**Wave 2** (core features): 002, 007, 008, 009
Sizing/layout architecture, terminal, themes, paint.
These are the features that make it feel like WibWob-DOS.

**Wave 3** (content & parity): 010, 011, 012
Browser, games, generative art, Micropolis.
Port once the foundation is solid.

001 and overview.md are reference docs — available always, not
assigned to a wave.
