
# Agent Master Plan — COAT-Centric Agent Architecture

## The one thing I'd change about how you're thinking

You're thinking about agents as **department managers** — a script agent, a
planning agent, a testing agent. Departments own territory. That's the opposite
of COAT.

COAT says: **one semantic surface, thin adapters.** Agents should work the same
way. Not "the script agent owns scripts" but "any agent can run scripts because
scripts are discoverable through the same surface as everything else."

The shift: **agents aren't departments. They're lenses.**

A lens sees the whole system but focuses on one concern. A "quality lens" runs
typecheck + check-coat + smoke tests. A "creative lens" opens windows and
composes art. They both use the same commands, same API, same scripts. They
don't own anything — they focus on something.

This means you don't need 10 agents with 10 territories. You need 6 lenses
that any agent can put on when needed. The pi subagent system already supports
this — a subagent is just a system prompt (a lens) + the same tools.

## The agents (as lenses, not departments)

### 0. `shell-architect` (includes COAT guardian)
**Focus:** The host runtime AND its architectural integrity. src/core,
src/services, src/windows, TypeScript architecture, blessed TUI, COAT
enforcement, import boundaries, command surface parity, tier classification.
The beating heart + the immune system.
**What it sees:** Type safety, module boundaries, dependency graph, god-files,
dead code, abstraction leaks, COAT violations, manifest completeness, command
parity across surfaces
**Tools:** `bun run typecheck`, `bun run check-coat`, grep, read (deep code
review), git blame/log
**When invoked:** Any change to `src/core/*`, `src/services/*`, `src/windows/*`,
"review the architecture", "is this safe", "why does X work this way",
"refactor Y", "check COAT", before any PR
**Key files:**
- `src/core/app-controller.ts` — composition root (2300+ lines, the god-file)
- `src/core/window-manager.ts` — window lifecycle, focus, z-order
- `src/core/window-facade.ts` — 11-method window interface
- `src/core/window-chrome.ts` — chrome sizing math
- `src/core/command-catalog.ts` — command source of truth
- `src/core/command-registry.ts` — execution + dispatch
- `src/core/editor-coordinator.ts` — editor lifecycle
- `src/core/snapshot-registry.ts` — workspace restore handlers
- `src/core/microapp-registry.ts` — tier classification
- `src/core/types.ts` — WindowRecord, WindowKind, AppType unions
- `src/services/control-api.ts` — HTTP surface
- `src/services/state-service.ts` — live desktop state
- `src/services/microapp-loader.ts` — microapp discovery + host creation
- `src/services/microapp-sdk.ts` — SDK export surface
- `src/services/workspace-service.ts` — save/restore
- `.agents/shell-dev/invariants.md` — the rules
- `.agents/shell-dev/specs/` — subsystem specs
**Guards:**
- Type soundness (zero `any` leaks across module boundaries)
- One owner per concept (no parallel helpers, no duplicated state)
- Services own logic; windows own rendering
- Content measurement is content-only; chrome math in window-chrome.ts
- Every meaningful window has describeState()
- No direct WindowManager access from microapps (SDK only)
- app-controller.ts should shrink, not grow (every migration removes methods)
**Red flags this lens catches:**
- New imports from `src/core/` in microapps (COAT violation)
- New private methods in app-controller (should be commands or microapps)
- WindowRecord mutations outside window-manager
- Blessed widget creation outside src/windows/ or microapps/
- State service fields that don't match API output
- Snapshot handlers that reference deleted functions

### 1. `microapp-builder`
**Focus:** Build and migrate microapps
**What it sees:** The scaffold→implement→manifest→verify cycle
**Tools:** `scaffold-microapp.sh`, `reload-microapp.sh`, `watch-microapp.ts`,
SDK reference, microapp-dev docs
**When invoked:** "Build a microapp", "migrate X to microapp"
**Key files:** `microapps/*/`, `.agents/microapp-dev/`, `src/services/microapp-sdk.ts`

### 3. `ops`
**Focus:** Keep the app running, healthy, debuggable
**What it sees:** Process lifecycle, tmux, logs, API health, screenshots
**Tools:** `ensure-running.sh`, `restart.sh`, `minimap.sh`, `screenshot-window.sh`,
`overlap-check.sh`, `list-scripts.sh`, log tailing
**When invoked:** "Start the app", "take a screenshot", "what's on screen",
"something broke"
**Key files:** `scripts/`, `logs/tui-app/`, `.agents/skills/ww-ops/`

### 4. `quality`
**Focus:** Verify everything works — types, tests, parity, visual correctness
**What it sees:** Typecheck output, API responses, state parity, smoke results
**Tools:** `bun run typecheck`, `check-coat`, `check-themes`, `check-describe-state`,
`runtime-parity-check.sh`, `ci-cli-test.sh`, `live-api-test-suite.sh`
**When invoked:** After code changes, before commits, "verify this works"
**Key files:** `src/tests/`, `scripts/check-*.ts`, `scripts/*-check.sh`

### 5. `creative`
**Focus:** Visual composition, art, music, VJ timelines, primers
**What it sees:** Windows as canvases, themes as palettes, figlets as typography,
primers as art, chiptune as score
**Tools:** API commands for opening/arranging windows, chiptune-studio skill,
vj-timeline skill, img-to-ascii skill, figlet-videographer skill
**When invoked:** "Make something beautiful", "compose a show", "design a layout"
**Key files:** `microapps/`, `.pi/skills/chiptune-*`, `.pi/skills/vj-timeline/`

### 6. `planner`
**Focus:** What to build next, what's done, what's blocked
**What it sees:** .planning/ briefs, EPIC_STATUS.md, todos, devlog, parking lot
**Tools:** `bun run planning:status`, `bun run planning:sync`, todo CRUD,
git log, devlog reading
**When invoked:** "What should we do next", "close out this epic", "update planning"
**Key files:** `.planning/`, `AGENTS.md` parking lot, `.pi/todos/`,
`.agents/shell-dev/agentic-devlog.md`

## What they DON'T do

- They don't own files. Any agent can edit any file.
- They don't have separate command surfaces. All use the same API.
- They don't run concurrently on conflicting work. The human orchestrates.
- They don't replace the human's judgment. They focus attention.

## Agent → Script mapping (23 scripts, 6 lenses)

```
shell-architect (3):  check-coat, check-themes, gen-primitives
microapp-builder (3): scaffold-microapp, reload-microapp, watch-microapp
ops (5):              ensure-running, restart, attach, start-alt-instance, handover
quality (6):          cli-parity-check, runtime-parity-check, blocking-flow-check,
                      smoke-api, layout-sweep, overlap-check
creative (3):         replay-scpt, wibwob-record, ghostty-shader
shared/inspect (3):   minimap, screenshot-window, capture-tui-png
meta (1):             list-scripts
```

Every lens has ≤6 scripts. No script without a home. Shared inspection tools
(minimap, screenshot, capture) are used by quality + creative.

## Script housekeeping rules

1. **Every script has `@name` and `@desc`** in the first 3 lines after shebang
2. **`bash scripts/list-scripts.sh`** is the discovery surface — if it's not
   listed there, it doesn't exist
3. **Scripts are API clients** where possible (COAT-aligned) — they call
   `/commands/run`, `/state`, `/health`. Not host internals.
4. **Infrastructure scripts** (ensure-running, restart) live below COAT — they
   manage the host process so COAT seams can exist
5. **New scripts get a review question:** "Is this a script or a command?"
   If it could be a command in the catalog, make it a command. Scripts are for
   things outside the runtime (process management, CI, capture, export).
6. **Dead script test:** 0 references + not in list-scripts = kill it.
   Run periodically: `grep -rl "scriptname" src/ AGENTS.md .agents/ .pi/`
7. **Max 35 scripts.** If we hit 35, audit before adding. Consolidate.

## The one amazing thing to add to the app

**Agent-composable desktop.**

Right now the AI agent (Wib&Wob Chat) can open windows and run commands. But
it can't *think visually*. It can't say "I need three surfaces arranged like
this to solve this problem" and have them appear, linked, reactive.

The amazing addition: **`desktop.compose`** — a single command that takes a
declarative layout spec and creates a multi-window workspace in one shot:

```json
{
  "id": "desktop.compose",
  "args": {
    "layout": "grid-2x2",
    "windows": [
      { "cmd": "microapp.wibwob.figlet.open", "args": {"text": "STATUS"} },
      { "cmd": "microapp.wibwob.runtime-inspector.open" },
      { "cmd": "microapp.wibwob.contour.open" },
      { "cmd": "microapp.wibwob.terminal.open" }
    ]
  }
}
```

One command. Four windows. Tiled. The agent just described what it wants to
see, and the desktop arranged it. The COAT way: one command, all surfaces
(TUI menu, API, CLI, agent) can invoke it.

This turns WibWob-DOS from "a desktop the agent can poke at" into "a visual
workspace the agent thinks with." The windows become the agent's scratchpad,
its dashboard, its instrument panel. The human sees exactly what the agent
is looking at.

That's the vision in AGENTS.md — "proactive, autonomous AI/agent has equal
control of OS with a human." This is the command that makes it real.

### Why this is the one thing

- It's COAT-native (one command, four seams)
- It's immediately useful (agent opens a workspace for any task)
- It's composable (layouts can be saved as workspace templates)
- It's visual (the human sees the agent's intent)
- It's small to build (batch /commands/run + /windows/batch already exist)
- It's the bridge between "agent uses the app" and "agent thinks with the app"
