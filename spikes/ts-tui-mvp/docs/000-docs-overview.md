# TS TUI Spike Docs Overview

Canonical inventory of `/spikes/ts-tui-mvp/docs`.

Keep this file updated when:
- a new doc is added
- a doc becomes stale, superseded, landed, or reference-only
- a planning doc changes phase/status materially

Status vocabulary:
- `active` — still driving current work
- `landed` — plan mostly implemented
- `partial` — some work landed, follow-ons remain
- `draft` — design/proposal, not yet proven
- `reference` — background or handover material
- `review` — audit/findings doc
- `stale` — useful history, but no longer canonical

| File | About | Status |
|---|---|---|
| `001-primer-dimensions-and-agent-sizing.md` | Primer measurement, recommended sizing, and agent-visible content dimensions from the older C++ path. | `reference` |
| `002-architecture-plan-content-sizing-layout.md` | TS architecture plan for parcels P1-P7: measurement, chrome, state, layout, and pre-open sizing. | `reference` |
| `003-document-plan.md` | Early estimate of the handover docs needed for the TS rebuild. | `stale` |
| `003-pi-mono-chat-window-evaluation.md` | Evaluates pi-mono as a native chat engine versus nested TUI-in-TUI rendering. | `reference` |
| `004-piclaw-sandbox-evaluation.md` | Notes on piclaw as sandbox/runtime architecture inspiration for Pi sessions. | `reference` |
| `004-window-type-registry-and-factories.md` | Full C++ window inventory and factory decomposition strategy for the TS rebuild. | `reference` |
| `005-llm-integration-and-claude-sdk-bridge.md` | C++/Python LLM, auth, SDK, and streaming handover for TS rebuild planning. | `reference` |
| `006-command-registry-and-ipc-protocol.md` | C++ command registry, IPC protocol, Python bridge, and MCP exposure handover. | `reference` |
| `007-terminal-emulator.md` | tvterm/libvterm architecture, PTY management, and terminal rebuild notes. | `reference` |
| `008-theme-system-and-desktop-rendering.md` | Theme roles, desktop rendering, chrome, and gallery-mode notes from the C++ app. | `reference` |
| `009-paint-canvas-system.md` | Paint canvas cell model, layers, tools, and rebuild notes. | `reference` |
| `010-browser-and-text-rendering.md` | Browser pipeline, text rendering, extraction, and TS rebuild notes. | `reference` |
| `011-games-and-generative-art.md` | Inventory and notes for games and generative art surfaces in the rebuild. | `reference` |
| `012-micropolis-integration.md` | Micropolis integration handover and constraints for the TS rebuild. | `reference` |
| `013-events-persistence-and-multi-instance.md` | Events, persistence, multi-instance behavior, and rebuild notes. | `reference` |
| `014-gaps-from-skill-crosscheck.md` | Gap analysis from skill cross-checking against the spike and rebuild plan. | `reference` |
| `015-window-manager-reference-and-repair-plan.md` | External references and repair plan for the blessed window manager. | `active` |
| `016-terminal-kit-screenbuffer-animation-spike.md` | Plan for a contained terminal-kit ScreenBuffer animation/compositing experiment. | `draft` |
| `017-framework-direction-and-today-plan.md` | Current framework direction: blessed shell, terminal-kit subsystem spike, Terminal.Gui as design teacher. | `active` |
| `018-command-registry-and-tool-adapter-prd.md` | PRD for define-once commands projected into menu, palette, API, agent, and later MCP. | `partial` |
| `019-context-sensitive-menu-bar-prd.md` | Draft plan for macOS-style focus-sensitive menus and per-window menu contributions. | `draft` |
| `BUILD-ORDER-FINAL.md` | Preferred sequencing for the broader TS rebuild. | `active` |
| `BUILD-ORDER.md` | Older build order document superseded by the final version. | `stale` |
| `INDEX.md` | Older doc index with now-stale status notes and priorities. | `stale` |
| `chat-collapse-review.md` | Review of the chat collapse refactor and its contract gaps. | `review` |
| `content-measurement-review.md` | Review of the content measurement refactor and remaining mismatches. | `review` |
| `editor-save-review.md` | Review of editor save behavior against the spike save plan. | `review` |
| `overview.md` | High-level parcel map P1-P7 for the full TS rebuild. | `reference` |
| `refactor-epoch-plan.md` | Canonical tracker for the spike refactor/reorganization epochs. | `active` |
| `spk-agent-window-enhancement.md` | Plan and rationale for turning chat into a real agent window with TUI tools. | `active` |
| `terminal-native-research.md` | Research note on terminal-native TypeScript TUI options and tradeoffs. | `reference` |
| `wibwob-chat-v2-plan.md` | Canonical plan for the native Wib&Wob Chat v2 slice. | `landed` |
| `window-facade-full-review.md` | Full review of the WindowFacade migration and remaining contract issues. | `review` |
| `window-facade-phase1-review.md` | Review of the early WindowFacade phase and contract drift. | `review` |
| `window-facade-review.md` | Initial WindowFacade problem framing before the fuller migration work. | `review` |
