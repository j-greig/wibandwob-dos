# WibWob-DOS — Architecture

> Philosophy and design filters: `PHILOSOPHY.md` · Vocabulary: `LEXICON.md`

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

<prog-disclosure>
Every HTTP endpoint and CLI command currently registered, grouped by domain —
the exhaustive proof that every surface hits the same registry. If something
is missing from this list, it is not COAT-compliant.
</prog-disclosure>

---

## Why Bun + blessed

**Bun** — single-process, fast startup, native TypeScript, built-in HTTP server.
No compilation step in development. The bottleneck is always terminal rendering.

**blessed** — handles raw input, mouse events, box model, screen diffing. Not
designed for composition, which is why `src/ui/` exists as a layer above it.
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

## The four subsystem families

### Shell (`src/core/`)
Runtime composition root. Owns the four seams.

- `app-controller.ts` — startup, window creation, workspace restore (~2050 lines, known god file)
- `command-catalog.ts` — source of truth for every user-visible command; extend here first
- `command-registry.ts` — execution layer; builds menus, runs commands by id
- `window-facade.ts` — 11-method interface; single seam for all consumers
- `window-manager.ts` — z-order, focus, drag, resize, tile
- `safe-fs.ts` — all filesystem I/O; never raw `fs.*` elsewhere in `src/`

### Design system (`src/ui/`)
Terminal component library. Not for microapp authors directly — accessed through the SDK.

### SDK (`src/sdk/`, surface at `src/services/microapp-sdk.ts`)
The **only** import path for microapp authors. Stable surface, mutable implementation.
See `PHILOSOPHY.md §SDK stability contract`.

### Services (`src/services/`)
- `state-service.ts` — canonical live desktop state
- `control-api.ts` — local HTTP surface (port 8099)
- `agent-tools.ts` — `tui_list_commands` / `tui_run_command`; wrap WindowFacade
- `wibwob-agent-session.ts` — native Wib&Wob agent; model selection, tool wiring

---

## The agent integration model

Three entry points — all equivalent, all COAT-compliant:

```
wibwob CLI          →  POST /commands/run  →  command-registry.ts
HTTP API            →  POST /commands/run  →  command-registry.ts
tui_* agent tools   →  tui_run_command     →  command-registry.ts
```

**Prefer `wibwob` CLI over raw `curl`** — handles socket discovery, JSON formatting, errors.

```bash
wibwob -i <label> health                   # gate check
wibwob -i <label> state                    # full desktop + window metadata
wibwob -i <label> cmd <command.id>         # run a command
wibwob -i <label> read <windowId>          # captureText() output
```

---

## The microapp model

A microapp is `setup(host)` + `microapp.json`. Host owns rendering, layout, focus,
diagnostics. Microapp owns logic.

**Scaffold:**
```bash
bash scripts/scaffold-microapp.sh microapps/<name> wibwob.<id> "<Title>" <menuOrder>
```

**Register** in `src/core/microapp-registry.ts` → `REGISTRY`. The microapp
won't appear until you do this.

**Four required hooks** — missing any of these is the most common failure mode:
```typescript
win.describeState(() => ({ summary: "..." }))  // agents read this — never skip
win.captureText(() => "content text")           // wibwob read <id> — never skip
win.onCleanup(() => { /* stop timers */ })
win.onRestyle(() => { /* re-apply host.theme() */ })
```

**Import rule:** only ever `import from "../../src/services/microapp-sdk.js"`.
Importing from `src/core/` or `src/services/` directly is a COAT violation.

**Pitfalls that always bite:**

| Mistake | Fix |
|---------|-----|
| Timer without `onCleanup` | `clearInterval` in cleanup |
| Cache `host.theme()` result | Call fresh inside `onRestyle` |
| Parent widget to `host.screen` | Parent to `win.body` |
| Use full id in `runCommand` | Omit prefix — `"open"` not `"wibwob.app.open"` |
| Inline blessed style literals | Use `host.theme()` tokens |

<prog-disclosure>
Every export from microapp-sdk.ts with stability tier (@public / @beta / @internal),
its call signature, and a one-line description — the full component directory for
picking the right primitive without opening source.
</prog-disclosure>

Seven reference examples ordered by complexity: `demo-hello-world` →
`demo-wibwob-tidepool` → `demo-wibwob-poetry-clock` → `demo-e026-demo` →
`command-lab` → `runtime-inspector`

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

**9–14.** Microapps import only from `microapp-sdk.ts` · `describeState()` is not
optional · host owns complexity · component contract: return `{node, destroy()}` ·
geometry flows one direction · no inline blessed style literals.

---

## Shell ops quick-ref

```bash
# Dual-instance isolation
WIBWOB_INSTANCE_LABEL=main WIBWOB_DATA_DIR=~/.wibwob-main bun run dev:world
WIBWOB_INSTANCE_LABEL=zuk  WIBWOB_DATA_DIR=~/.wibwob-zuk  CONTROL_API_PORT=8098 bun run dev:world

# World Chat / IRC
WIBWOB_CHAT_TRANSPORT=irc WIBWOB_CHAT_IRC_HOST=127.0.0.1 WIBWOB_CHAT_IRC_PORT=6667 bun run dev:world
# Dev IRC server: bun run dev-irc-server  (port 6667, local only)
```

---

## Key files

| File | Role |
|------|------|
| `src/app.ts` | Bootstrap — normalise env, start app-controller |
| `src/core/app-controller.ts` | Composition root |
| `src/core/command-catalog.ts` | All command metadata — extend here first |
| `src/core/window-facade.ts` | The window seam — 11 methods |
| `src/core/safe-fs.ts` | All filesystem I/O |
| `src/core/theme/resolver.ts` | Runtime theme state + token registration |
| `src/services/microapp-sdk.ts` | SDK entry point — only microapp import |
| `src/services/state-service.ts` | Canonical live state aggregator |
| `src/services/control-api.ts` | HTTP control surface |
| `src/cli/wibwob.ts` | CLI — preferred over curl |
| `microapps/` | All microapp implementations |

---

## What's intentionally not here

No React · no ORM · no MCP · no sandboxing · no remote orchestration · no plugin
marketplace. Bun + blessed + plain HTTP + plain JSON. The terminal medium is the
constraint and the material.
