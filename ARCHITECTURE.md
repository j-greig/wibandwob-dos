# WibWob-DOS — Architecture

> Philosophy and north star: `PHILOSOPHY.md`
> Full file inventory: `.agents/guides/shell/architecture.md`
> Full invariants: `.agents/guides/shell/invariants.md`

---

## The core idea

WibWob-DOS is a **shared terminal desktop** where a human and agents have equal
control of the same runtime. That equality is not a feature — it is the constraint
that determines every architectural decision.

The consequence is **COAT — Command Once, Adapt Thin**:

> The runtime is a shared semantic core. TUI, CLI, HTTP API, agent tools, and
> microapps are all thin adapters over that core. No adapter owns semantics.

The COAT test: *"Would this work without the TUI, using only the API?"*
If no — it isn't done.

Four seams connect every adapter to the core:

| Seam | Owner | What it provides |
|------|-------|-----------------|
| **Command** | `command-catalog.ts` + `command-registry.ts` | Every user-visible action, defined once |
| **Inspection** | `state-service.ts` + `control-api.ts` | Live desktop state readable by anything |
| **Window** | `window-facade.ts` + `window-manager.ts` | 11-method interface; all consumers identical |
| **Workspace** | `workspace-service.ts` | Named layout persistence |

---

## Why Bun + blessed

**Bun** — single-process, fast startup, native TypeScript, built-in HTTP server.
No compilation step in development. No framework overhead. The bottleneck is always
terminal rendering, not runtime startup.

**blessed** — battle-tested terminal UI library. Handles raw input, mouse events,
box model, and screen diffing. The tradeoff: it is not designed for composition,
which is why `src/ui/` exists as a layer above it. Microapps never touch blessed
directly — they code against the SDK Handle interface.

The choice is intentional constraint. A web framework would obscure the terminal
medium. blessed makes the medium explicit.

---

## How state flows

```
User action / agent API call
        │
        ▼
command-registry.ts   ← runs command by id
        │
        ▼
window factory / microapp setup()
        │
        ▼
blessed widget + lifecycle hooks
        │
        ▼
describeState()       ← window exposes semantic metadata
        │
        ▼
state-service.ts      ← aggregates all window states
        │
        ▼
GET /state            ← control-api.ts exposes live state
        │
        ▼
wibwob CLI / agent tools / external callers
```

Every window that matters must expose `describeState()`. If an agent needs a
property, add it to the window metadata — never teach the agent to scrape UI text.

---

## The four subsystem families

### Shell (`src/core/`)
Runtime composition root. Owns the four seams.

- `app-controller.ts` — startup, window creation, workspace restore, high-level command flow
- `command-catalog.ts` — source of truth for every user-visible command (id, group, menu placement, surfaces)
- `command-registry.ts` — execution layer; builds menus, runs commands by id, lists for API/agents
- `window-facade.ts` — 11-method interface for all window operations; single seam for all consumers
- `window-manager.ts` — z-order, focus, drag, resize, tile; implements WindowFacade
- `safe-fs.ts` — all filesystem I/O; never raw `fs.*` calls elsewhere in `src/`

### Design system (`src/ui/`)
Terminal component library. Layouts, molecules, organisms, data, feedback, forms, patterns.
**Not for microapp authors directly** — accessed through the SDK Handle API.
Full reference: `docs/design-system.md`

### SDK (`src/sdk/`, surface at `src/services/microapp-sdk.ts`)
The **only** import path for microapp authors. Stable surface, mutable implementation.
See `PHILOSOPHY.md §SDK stability contract` for the boundary diagram.

- `microapp-host.ts` — host/window/chat contract
- `composition-helpers.ts` — createStatusBar, createTextViewer, createListPanel, createSplitView, createButtonBar
- `runtime-helpers.ts` + `runtime-client.ts` — reusable SDK utilities

### Services (`src/services/`)
Capabilities the shell and microapps share.

- `state-service.ts` — canonical live desktop state; all windows report through `describeState()`
- `control-api.ts` — local HTTP surface (default port 8099); see `.agents/guides/shell/control-api.md`
- `agent-tools.ts` — `tui_list_commands` / `tui_run_command`; all tools wrap WindowFacade
- `wibwob-agent-session.ts` — native Wib&Wob agent; model selection, tool wiring, desktop state injection

---

## The agent integration model

Three entry points — all equivalent, all COAT-compliant:

```
wibwob CLI          →  POST /commands/run  →  command-registry.ts
HTTP API            →  POST /commands/run  →  command-registry.ts
tui_* agent tools   →  tui_run_command     →  command-registry.ts
```

**Prefer `wibwob` CLI over raw `curl`** — it handles socket discovery, JSON
formatting, and error handling. `curl` is for one-off debugging only.

For any window, agents can:
- `GET /state` — full desktop + all window metadata
- `GET /screenshot/text?id=N` — semantic text capture (`captureText()` if available)
- `POST /windows/batch` — move, resize, close in one call

The agent can always find the canonical instance:
```bash
bun run src/cli/wibwob.ts instances   # lists all running instances with labels
bun run src/cli/wibwob.ts -i <label> health
```

---

## The microapp model

A microapp is a self-contained application running inside the host. It has one
entry point (`setup(host)`), a manifest (`microapp.json`), and full lifecycle hooks.
The host owns rendering, layout, focus, and diagnostics. The microapp owns logic.

```
microapp/
  index.ts          ← setup(host): register commands, create windows
  microapp.json     ← id, name, menu placement, multiInstance, persist flags
```

Lifecycle: `setup → createWindow → describeState / captureText / onRestyle / onCleanup`

Seven reference microapps ordered by complexity: `hello-world → notepad →
runtime-inspector → figlet-banner → layout-stress-test → data-dashboard → file-manager`

Full guide: `.agents/guides/microapp/quick-start.md`

---

## Key files (short map)

| File | Role |
|------|------|
| `src/app.ts` | Bootstrap only — normalise env, start app-controller |
| `src/core/app-controller.ts` | Composition root (~2050 lines — known god file) |
| `src/core/command-catalog.ts` | All command metadata — extend here first |
| `src/core/window-facade.ts` | The window seam — 11 methods, all consumers use this |
| `src/core/safe-fs.ts` | All filesystem I/O — never bypass this |
| `src/core/theme/resolver.ts` | Runtime theme state + token registration |
| `src/services/microapp-sdk.ts` | SDK entry point — the only microapp import |
| `src/services/state-service.ts` | Canonical live state aggregator |
| `src/services/control-api.ts` | HTTP control surface |
| `src/services/agent-tools.ts` | TUI tools for the native agent |
| `src/ui/layout.ts` | Stack, Row, Grid — layout engine |
| `src/cli/wibwob.ts` | The CLI — preferred over curl for all API calls |
| `microapps/` | All microapp implementations |
| `src/windows/` | Host-managed windows (not yet migrated to microapp pattern) |
| `.agents/reference/integration-surface.md` | Auto-generated: 23 endpoints, 85 commands |

---

## Five design rules (distilled from invariants)

Full list of 14: `.agents/guides/shell/invariants.md`

**1. One concept, one owner.**
If a concept has a home, extend that home. Do not create parallel helpers for
the same concern because it is locally convenient.

**2. Services own logic, windows own wiring.**
Services discover, measure, persist, resolve, transform. Windows render, bind
keys/mouse, manage focus/cleanup, expose state. Never swap these.

**3. User-visible = API-visible.**
If a window, command, mode, or state matters to a user, it must have a typed
representation in desktop state and a control path in `control-api.ts`.
`describeState()` and the API must evolve together.

**4. Every themed widget must be restyleable.**
Any blessed node created with a theme colour must be reachable from `onRestyle()`.
Unregistered nodes keep the colour of whatever theme was active on open.
Verify by switching theme with the window open.

**5. Reorg passes do not add product surface.**
When the goal is cleanup, do not add new window types or UI entry points unless
explicitly asked. Extract, consolidate, normalise first.

---

## What's intentionally not here

- **No React / web framework** — the terminal medium is the constraint and the material
- **No ORM or database** — `safe-fs.ts` + JSON; filesystem is the persistence layer
- **No MCP protocol** — plain HTTP + plain text; lighter on tokens, easier to debug
- **No sandboxing** — microapps are trusted; sandboxing is future work, after the runtime is solid
- **No remote orchestration** — local-first; multi-instance is supported, remote attach is not yet
- **No plugin marketplace** — intentionally small and opinionated; not an infinite plugin system

---

## Progressive disclosure map

| Starting point | Read next |
|---------------|-----------|
| New to the codebase | This file → `PHILOSOPHY.md` → `.agents/guides/shell/invariants.md` |
| Building a microapp | `.agents/guides/microapp/quick-start.md` → `sdk-reference.md` |
| Shell / host work | `.agents/guides/shell/invariants.md` → `control-api.md` |
| Running / restarting | `.pi/skills/ww-ops/SKILL.md` |
| Live API surface | `.agents/reference/integration-surface.md` (auto-generated) |
| Full file inventory | `.agents/guides/shell/architecture.md` |
| World chat / IRC | `.agents/guides/shell/architecture.md §World Chat` |
| Dual-instance setup | `.agents/guides/shell/architecture.md §Dual-instance` |
