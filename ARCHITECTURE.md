---
title: WibWob-DOS — Architecture
description: COAT pattern, four seams, state flow, SDK boundary, shell invariants.
audience: agents
---

# WibWob-DOS — Architecture

## COAT — Command Once, Adapt Thin

WibWob-DOS is a **shared terminal desktop** where a human and agents have equal
control of the same runtime. That equality determines every architectural decision.

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

Live surface: `wibwob health` · `wibwob -i <label> commands`


> Confused by a decision here? The *why* lives in `PHILOSOPHY.md`. Unfamiliar term? `LEXICON.md` (human-facing).

---

## Runtime note

blessed isn't designed for composition — `src/ui/` exists as a layer above it.
Microapps never touch blessed directly — they code against the SDK Handle interface.

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

Every window must expose `describeState()`. Never teach an agent to scrape UI
text — add the property to window metadata instead.

---

## The four subsystems

**Shell** (`src/core/`) — runtime composition root. Owns the four seams.

**Design system** (`src/ui/`) — terminal component library. Not for microapp
authors directly — accessed through the SDK.

**SDK** (`src/sdk/`, surface at `src/services/microapp-sdk.ts`) — the **only**
import path for microapp authors. Stable surface, mutable implementation.
See `PHILOSOPHY.md §SDK stability contract`.

**Services** (`src/services/`) — capabilities the shell and microapps share:
state aggregation, HTTP control surface, agent tools, native agent session.

---

## The microapp contract

A microapp is `setup(host)` + `microapp.json`. Host owns rendering, layout,
focus, diagnostics. Microapp owns logic.

For how to build one: use the `microapp-creator` skill.

**Four required hooks** — missing any is the most common failure mode:
```typescript
win.describeState(() => ({ summary: "..." }))  // agents read this
win.captureText(() => "content text")           // wibwob read <id>
win.onCleanup(() => { /* stop timers */ })
win.onRestyle(() => { /* re-apply host.theme() */ })
```

**Import rule:** only `import from "../../src/services/microapp-sdk.js"`.
Importing from `src/core/` or `src/services/` directly is a COAT violation.

SDK export surface: `grep -E '@(public|beta|internal)' src/services/microapp-sdk.ts`
**→ [SDK-MICROAPP-DEV.md](SDK-MICROAPP-DEV.md)** — full microapp development guide

---

## Shell invariants

**1. One concept, one owner.** Extend the home; don't create parallel helpers.

**2. Services own logic, windows own wiring.** Services: discover, measure, persist,
transform. Windows: render, bind keys/mouse, manage focus/cleanup, expose state.

**3. User-visible = API-visible.** Every window/command/state that matters needs
a typed representation in desktop state and a path in `control-api.ts`.

**4. Every themed widget must be restyleable.** Any node created with a theme colour
must be reachable from `onRestyle()`. Verify by switching theme with the window open.

**5. Reorg passes do not add product surface.** Extract and consolidate first.

**6. WindowFacade is the only window seam.** Never access `window-manager.ts`
from outside `src/core/`.

**7. All filesystem I/O through `safe-fs.ts`.** Never raw `fs.*` in `src/`.

**8. Command catalog is the single source of truth.** Add to `command-catalog.ts`
first; `command-registry.ts` is execution only.

**→ [src/core/primitives.ts](src/core/primitives.ts)** — generated barrel of all shared core exports

**9–14.** Microapps import only from `microapp-sdk.ts` · `describeState()` is not
optional · host owns complexity · component contract: return `{node, destroy()}` ·
geometry flows one direction · no inline blessed style literals.

---

## What's intentionally not here

No React · no ORM · no MCP · no sandboxing · no remote orchestration · no plugin
marketplace. Bun + blessed + plain HTTP + plain JSON. The terminal medium is the
constraint and the material.
