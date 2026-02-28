# BUILD ORDER

## Scope reviewed

Reviewed the current TS spike and these handover docs:

- `overview.md`
- `001-primer-dimensions-and-agent-sizing.md`
- `002-architecture-plan-content-sizing-layout.md`
- `003-document-plan.md`
- `004-window-type-registry-and-factories.md`
- `005-llm-integration-and-claude-sdk-bridge.md`
- `006-command-registry-and-ipc-protocol.md`
- `007-terminal-emulator.md`
- `008-theme-system-and-desktop-rendering.md`
- `009-paint-canvas-system.md`
- `010-browser-and-text-rendering.md`
- `011-games-and-generative-art.md`
- `012-micropolis-integration.md`
- `013-events-persistence-and-multi-instance.md`
- `014-gaps-from-skill-crosscheck.md`

This plan is based on the actual source, not the doc priority labels. Some docs are already stale relative to the spike.

## Root cause

The core problem is not just that `src/core/app-controller.ts` is large. The real issue is that the app still lacks the two seams that all later work depends on:

1. A canonical window type module/registry boundary.
2. A canonical command/event boundary.

Today, `app-controller.ts` still owns window creation, menu wiring, workspace restore, workspace snapshot payloads, state description, and API handlers in one place. That means every new feature adds:

- another inline factory
- another `describeState()` shape
- another restore/serialize branch
- another menu/palette entry
- another controller-owned dependency

The current foundations are good and should be kept:

- `src/services/content-measurement.ts`
- `src/core/window-chrome.ts`
- `src/core/desktop-geometry.ts`
- `src/services/state-service.ts`
- `src/services/control-api.ts`
- `src/core/window-manager.ts`

But they are not yet the architecture. They are utilities sitting under a monolith.

There is also a second important finding: the terminal work is split between an old legacy transcript terminal and a newer buffered terminal path. The newer path already exists in `src/services/pty-session.ts`, `src/services/terminal-buffer.ts`, and `src/services/terminal-renderer.ts`, but `openTerminalWindow()` still routes to the legacy path. That makes 007 partly seeded, but not actually adopted.

## Fix options

### Option 1: Incremental extraction around the current spike

Recommended.

Do this:

- lock the core contracts first
- extract a registry and typed window module interface
- move a few pilot window types first
- only then build commands, themes, and larger features on top

Tradeoffs:

- lowest rewrite risk
- keeps visible progress every step
- lets you preserve working drag/resize/focus/workspace behavior
- requires discipline to avoid adding "just one more factory" to `app-controller.ts`

### Option 2: Full architectural rewrite before feature work

Do this:

- redesign app shell, registry, commands, events, and rendering stack up front
- then re-port windows into the new shell

Tradeoffs:

- cleanest architecture on paper
- highest stall risk
- longest time before visible proof
- easy to overdesign the spike

### Option 3: Continue feature work inside the current controller

Not recommended.

Tradeoffs:

- fastest for one more feature
- worst long-term outcome
- guarantees more restore/state/API duplication
- makes 004, 006, and 013 harder every week

## Strict order

Reference docs, not implementation steps:

- `overview.md`
- `001-primer-dimensions-and-agent-sizing.md`
- `014-gaps-from-skill-crosscheck.md`

Do not treat `003-document-plan.md` as the source of truth for sequencing. Its wave order is too early on LLM/agent work and too late on architectural contract work for the current spike.

Implement in this order:

1. `002-architecture-plan-content-sizing-layout.md`
2. `004-window-type-registry-and-factories.md`
3. `013-events-persistence-and-multi-instance.md`
4. `006-command-registry-and-ipc-protocol.md`
5. `008-theme-system-and-desktop-rendering.md`
6. `010-browser-and-text-rendering.md`
7. `007-terminal-emulator.md`
8. `009-paint-canvas-system.md`
9. `005-llm-integration-and-claude-sdk-bridge.md`
10. `011-games-and-generative-art.md`
11. `012-micropolis-integration.md`

## Why this order

### 1. `002` first

This is the contract lock step. The spike already has content measurement, chrome sizing, and geometry, but those APIs are still too narrow and partially controller-owned. Before touching factories, commands, or features, lock:

- `ContentMetadata`
- window chrome modes
- desktop geometry ownership
- resize/reflow contracts
- layout primitive interfaces

If you skip this, every extracted factory will invent its own state, measurement, and resize semantics.

Visible proof:

- primer and figlet windows size through one path
- state reports canonical content dimensions
- one layout primitive works against the current windows

### 2. `004` second

This is the real keystone. Nothing else should land on top of the god class.

Build the registry and module shape before writing the next window factory. Then extract only a pilot set first:

- one simple viewer
- one animated window
- one process-backed terminal window

If you do 005, 006, 007, 009, or 010 before 004, those docs will harden the wrong seam and push more logic into `app-controller.ts`.

Visible proof:

- window spawn by registry slug
- workspace restore via module restore hook, not controller `switch`
- command palette/menu generated from registry metadata for pilot types

### 3. `013` third

Once windows have a registry contract, stabilize lifecycle and persistence:

- typed app event bus
- atomic workspace writes
- screenshot/export surface
- instance identity and port strategy

This step gives you the harness you need for the rest of the migration.

Visible proof:

- save/load workspace round-trip on registry-backed windows
- screenshot/state export for regression checks
- two instances can coexist predictably

### 4. `006` fourth

After window lifecycle and persistence are real, freeze the command surface:

- typed `CommandRegistry`
- `/commands`
- `/menu/command`
- `/events`

Doing 006 before 013 makes the API depend on unstable internal state shapes and missing event semantics. Doing 006 before 004 makes commands call controller internals instead of real modules/services.

Visible proof:

- one universal execute endpoint
- command manifest from registry
- core window/state/workspace commands callable without controller branching

### 5. `008` fifth

Theme tokens should arrive before the majority of extracted window modules, otherwise hardcoded blessed styles get copied into each new module.

Visible proof:

- menu bar, status line, desktop background, and active/inactive window chrome all driven by theme tokens
- theme change affects existing pilot windows without touching window code

### 6. `010` sixth

This should precede the full terminal upgrade because it forces the key shared rendering decisions:

- scrollable view base
- styled text line model
- shared ANSI parsing boundary
- editor document model decision

If you do 007 first, you risk choosing a terminal cell/render path that disagrees with browser/ANSI/text rendering. `010` is where the shared text pipeline gets real.

Visible proof:

- browser/text/ANSI viewer use one shared styled text renderer
- editor has a chosen model and a clear contract for selection/clipboard/undo deferral

### 7. `007` seventh

Only now upgrade terminals fully. The spike already contains a partial buffered terminal implementation, so the right move is to adopt and harden that seam, not start over with another transcript widget.

Build on:

- `src/services/pty-session.ts`
- `src/services/terminal-buffer.ts`
- `src/services/terminal-renderer.ts`

Then decide whether to stop at the current cell-grid parser or move to `xterm.js` headless.

Visible proof:

- shell works in buffered mode
- resize propagates
- scrollback works
- state exposes cols/rows/cursor/scrollback

### 8. `009` eighth

Paint is the first strong proof that the new architecture can support:

- a pure domain model
- a dedicated renderer
- command-driven mutation
- workspace persistence
- agent-readable state

It is a better first "rich app" than Micropolis or full LLM work because it is self-contained and heavily testable.

Visible proof:

- create canvas
- draw
- export
- save/load
- read back state by command

### 9. `005` ninth

LLM integration is important, but not foundation-first. It depends on having a stable:

- command manifest
- state surface
- event lifecycle
- terminal/chat window module pattern

If you do 005 too early, you bake prompts and tools against an unstable desktop model and will spend time reworking tool contracts.

Visible proof:

- `tui_list_commands` and `tui_menu_command` against the real command registry
- Wib/Wob streaming window with disposal guards
- capability injection from live `/commands` and `/state`

### 10. `011` tenth

Only after the above do games and generative art pay off. By then you should already have:

- animated view base
- cell buffer
- palette system
- resize contract
- screenshot regression harness

Port in the order the doc already recommends: simplest timer views first, then games, then richer generative views.

### 11. `012` last

Micropolis remains last because it is a separate engine integration problem, likely WASM-backed, and gives the least leverage for the rest of the spike.

## Step-by-step: must build vs defer

| Step | Must build now | Can defer |
|---|---|---|
| `002` | `ContentMetadata`, resize/reflow contract, layout primitive types, canonical chrome/geometry ownership | advanced gallery algorithms, full aspect ratio catalog |
| `004` | `WindowTypeModule`, `WindowTypeRegistry`, registry-backed spawn/serialize/restore for pilot types | full extraction of every window type |
| `013` | typed event bus, atomic workspace writes, screenshot/state export, instance id/port strategy | tmux launcher parity, full structured logger rollout |
| `006` | typed `CommandRegistry`, `/commands`, `/menu/command`, core window/workspace/state commands, event stream | full 96-command parity, compatibility wrapper for every legacy endpoint |
| `008` | theme token system, resolver, desktop preset model, tokenized chrome | mascot, gallery exhibition mode, every exotic preset |
| `010` | shared styled text renderer, scrollable base, one ANSI parser, editor model decision, browser pipeline seam | full browser AI tools, gallery image mode, perfect clipboard parity |
| `007` | buffered PTY path adoption, resize, scrollback, cleanup, terminal state metadata | full VT parity, alt-screen/TUI perfection, terminal API parity for every edge case |
| `009` | pure paint model, renderer, `.wwp` codec, `paint_read`, core paint commands | ANSI export polish, all interactive paint tools |
| `005` | auth cascade, one shared LLM client seam, two meta-tools pattern, streaming/disposal safety | TTS, full Scramble personality polish, room chat extras |
| `011` | `AnimatedView`, `CellBuffer`, `Palette`, first 3-4 easy ports | monster cam, contour map, generative lab |
| `012` | decide WASM vs defer, wrap engine behind one bridge if proceeding | broad tool palette parity, binary save compatibility work |

## Critical warnings

### If you do not lock the window module contract before more features, you will regret it later

Every new window otherwise adds one more restore case, one more snapshot format, and one more menu/controller branch.

### If you do not decide the editor/document model during `010`, you will rework it repeatedly

Browser/text/editor/ANSI views all want different pieces of the same rendering stack. Pick the common text model once.

### If you do not choose the terminal seam during `007`, you will build parallel terminal systems

That has already started. The repo currently has both:

- a legacy transcript terminal path
- a buffered terminal path with cell parsing/rendering

Kill one. Keep the buffered path.

### If you expose agent tools before `006` and `013` are stable, you will freeze the wrong contracts

The command list, state shape, and event model need to stabilize before LLM prompts depend on them.

### If you do not centralize snapshot payloads in window modules, workspaces will keep rotting

`serializeWindowSnapshot()` and `restoreWindowSnapshot()` are the main hidden coupling points today.

### If you do not move styles behind tokens before bulk extraction, every extracted module will hardcode blessed colours

That creates a second migration later.

### If you do not add screenshot/state regression capture by step 3, later feature work becomes hard to verify

This spike needs text and JSON truth, not just manual eyeballing.

## What to keep vs refactor vs replace

### Keep

- `src/services/content-measurement.ts`
- `src/core/window-chrome.ts`
- `src/core/desktop-geometry.ts`
- `src/services/state-service.ts`
- `src/services/content-service.ts`
- `src/services/workspace-service.ts` as the persistence owner, but extend it
- `src/services/control-api.ts` as an HTTP adapter shape
- `src/core/window-manager.ts` for drag/resize/focus/z-order mechanics
- `src/services/pty-session.ts`
- `src/services/terminal-buffer.ts`
- `src/services/terminal-renderer.ts`

### Refactor heavily

- `src/core/app-controller.ts` into a thin orchestrator
- `src/core/types.ts` so window runtime shape is module-backed, not flat bag-of-optionals
- `describeState()` into a structured metadata contract
- workspace save/load so window modules own payload serialization
- menu and palette definitions so they come from command/registry metadata where possible

### Replace

- the legacy transcript PTY window as the primary terminal implementation
- synthetic `chat-service.ts` once real LLM integration lands
- controller-owned restore `switch` and snapshot payload `switch`
- hardcoded style literals as the ownership model for theme/chrome

### Keep only as temporary compatibility

- current `/state` and small REST surface
- current window kinds that collapse multiple real app types into one bucket
- old menu action arrays that duplicate command registry entries

## Current codebase-specific notes

These matter for sequencing because the docs do not fully reflect the current spike:

- `002` is stale about content measurement and chrome. The spike already has both.
- `007` is partly implemented already, but the newer buffered terminal path is not the default path yet.
- `006` can be implemented without IPC. The current `ControlApiService` already proves the in-process handler model.
- `013` should happen earlier than `003` suggests because the spike already has workspace/state services worth stabilizing now.
- `005` should happen later than `003` suggests because the spike does not yet have a stable command/state contract for agents.

## Risks

- No local test suite currently covers the spike surface. `bun run typecheck` passes, but there are no spike-owned unit or integration tests in `src/`.
- Window snapshot compatibility will break during 004 unless you version snapshot payloads or keep temporary restore shims.
- Theme extraction can create a half-migrated state where old windows ignore tokens.
- Terminal work can fork again if both transcript and buffered implementations remain alive.
- Browser/editor/ANSI work can fork again if they do not share the same styled text base.
- LLM integration can silently depend on private prompt files or model IDs unless those are normalized up front.

## Tests to add

### Unit tests

- content measurement: comments, frames, Unicode width, figlet output
- chrome sizing: each chrome mode maps content size correctly
- theme resolver: token lookup and preset application
- terminal buffer: SGR, cursor motion, erase, resize, scrollback, OSC stripping
- ANSI parser: browser and ANSI view share the same parse result contract
- paint model: line/rect/text/compositing and `.wwp` round-trip
- command registry: schema validation and manifest generation

### Integration tests

- registry-backed spawn/serialize/restore for three pilot window types
- workspace save/load round-trip with focus, bounds, and payload state
- `/state`, `/commands`, `/menu/command`, and `/events` contract tests
- two-instance startup with distinct ports and state files
- buffered terminal PTY spawn, write, resize, exit, and cleanup

### Regression capture

- plain-text screenshot export for smoke layouts
- JSON state snapshot export for diff-based verification
- one curated workspace fixture used as a migration canary across steps

### Manual smoke checks after each major step

- open/focus/drag/resize/close a pilot extracted window
- save and reload workspace
- run `pwd` or `echo ok` in the terminal window
- open a primer and confirm measured sizing still works
- call one command through the API and verify state reflects it

## Recommended implementation slice plan

If the goal is fastest safe progress, use these slices:

1. Lock `002` contracts and extend current types/state without extracting everything.
2. Implement `004` registry plus 3 pilot window modules: primer viewer, pattern/orbit, buffered terminal.
3. Implement `013` screenshot/state/workspace hardening on those pilot modules.
4. Implement `006` typed commands for state/window/workspace/terminal basics.
5. Tokenize chrome and desktop via `008`.
6. Build shared text stack from `010`.
7. Finish `007` by making buffered terminal the only terminal path.
8. Add paint via `009`.
9. Add real agent/LLM surfaces via `005`.
10. Port games/art via `011`.
11. Decide whether Micropolis is worth the WASM cost via `012`.

That order bakes the architecture in early, keeps each step testable and visible, and avoids discovering at step 10 that step 3 needed a different foundation.

---

## Review comments (pi-agent, post-codex)

Codex's ordering and analysis is strong. I agree with the core sequence
(002 → 004 → 013 → 006 → 008 → 010 → 007 → 009 → 005 → 011 → 012)
and particularly with the reasoning for why 005 (LLM) must come late.
These are the places I'd push back, add emphasis, or flag risks:

### 1. Tests must exist from step 1, not step 3

Codex puts screenshot/regression capture at step 3 (013). That's too late.
Steps 1 and 2 are the highest-risk refactors (locking contracts, extracting
the registry from a 2561-line god class). You need:
- Unit tests for content-measurement.ts from day one (step 1)
- A workspace round-trip test as soon as the first pilot module exists (step 2)
- Screenshot text export before step 3, even if it's just blessed.screenshot()

If you refactor the god class without tests, you'll ship regressions you
only find 4 steps later.

### 2. WindowRecord bag-of-optionals is a bigger trap than flagged

Codex mentions refactoring types.ts but buries it in a table. This needs
to be a BLOCKING prerequisite for step 2. The current WindowRecord has:
```
editor?: EditorState
terminal?: TerminalState
chat?: ChatState
writeInput?: (input: string) => void
```
Every new window type adds another optional. When you extract to modules,
each module should own its own state type. The shared WindowRecord should
have `state: TState` (generic) or just `describeState(): WindowStateDetails`.
If you start extracting factories while keeping the flat bag, you get the
worst of both worlds — modules AND a growing shared interface.

### 3. overlay-manager.ts (648 lines) is coupled to the controller

Codex doesn't mention this file. It owns all menus, command palette, and
context menus — 648 lines of UI that dispatches back into app-controller.
During step 2 (004), this needs to be decoupled:
- Menu definitions should come from the command/window registry
- Context menus should be window-module-owned
- Command palette should query the CommandRegistry (step 4)

If you extract window factories but leave overlay-manager reaching into
the controller for every menu action, you've moved the furniture but not
fixed the plumbing.

### 4. The dual terminal paths warning deserves a harder line

Codex correctly identifies this but says "kill one" at step 7. I'd say:
deprecate the legacy transcript path at step 2 (when you extract the
terminal pilot module). If both paths survive to step 7, five steps of
new code will have accumulated on one or both, making the kill harder.
Mark the legacy path as `@deprecated` in step 2, remove in step 7.

### 5. Theme tokens (step 5/008) might need to come before step 4 (006)

Codex puts themes at step 5, after commands. But the command registry
(step 4) will add API endpoints that return window state — and that state
includes visual properties. If theme tokens don't exist yet, the state
shape will reference raw blessed colours instead of semantic tokens.

Counter-argument: you can add theme tokens to state later without breaking
the command contract, since state is read-only. So codex's order works,
but be aware that early API consumers will see raw style objects until
step 5 lands.

### 6. Missing: content-service.ts needs enrichment at step 1

Codex lists content-service.ts as "keep" but doesn't note that it
currently returns flat string arrays for gallery lists. Step 1 (002)
should enrich it to return `EnrichedPrimer[]` with measurement data —
the same shape the C++ `gallery_list` command returns. This is the
foundation for pre-open sizing (P7) and if it's deferred, the gallery
and primer browser windows won't size correctly during step 2.

### 7. Risk: blessed library limitations

None of the docs or codex's analysis addresses the elephant: blessed is
unmaintained (last publish 2017) and has known rendering bugs. The spike
currently works around these, but steps 6 (text rendering) and 7 (terminal)
will push blessed hard. The team should have a fallback plan:
- neo-blessed (maintained fork)?
- ink (React-based, different paradigm)?
- raw ANSI with a custom widget system?

This doesn't change the ordering, but it's a risk that could invalidate
steps 6-7 if blessed can't handle the rendering requirements.

### 8. Concrete deliverable per step (missing from codex)

Each step should produce a named, reviewable artifact:
- Step 1: `tests/core/content-measurement.test.ts` + locked interfaces
- Step 2: `src/windows/primer-viewer.ts` as the reference module
- Step 3: `tools/screenshot.ts` + `tests/integration/workspace-roundtrip.test.ts`
- Step 4: `src/core/command-registry.ts` + `/commands` endpoint
- Step 5: `src/core/theme.ts` + one preset
- Step 6: `src/core/styled-text.ts` + `src/core/scrollable-view.ts`
- Step 7: legacy terminal deleted, buffered terminal is only path
- Step 8: `src/windows/paint.ts` with full command coverage
- Step 9: `src/services/llm-client.ts` + meta-tools working
- Step 10: `src/windows/game-of-life.ts` as reference animated view
- Step 11: WASM bridge or explicit "not doing this for MVP" decision

### Summary of disagreements

| Topic | Codex says | I say | Resolution |
|-------|-----------|-------|------------|
| Test timing | Step 3 | Step 1 | Step 1. Non-negotiable. |
| WindowRecord refactor | Table mention | Blocking prereq for step 2 | Hard gate. |
| overlay-manager.ts | Not mentioned | Must decouple in step 2 | Add to step 2 scope. |
| Legacy terminal kill | Step 7 | Deprecate step 2, remove step 7 | Deprecate early. |
| Theme before commands | Step 5 (after 006) | Arguably before 006 | Keep codex order, note risk. |
| content-service enrichment | Not mentioned | Must happen step 1 | Add to step 1 scope. |
| blessed risk | Not mentioned | Flag it | Note, don't change order. |
| Named artifacts | Not specified | One per step | Add to each step. |

## Meta-review: codex response to pi-agent comments

Root cause of the disagreement: the review mixes real architectural concerns with several stale or incorrect factual claims about the current spike. The biggest misses are ownership boundaries and current data shape. Menus, popup/context menus, and the command palette live in `src/core/app-controller.ts`, not `src/core/overlay-manager.ts`, and `src/services/content-service.ts` already returns structured entries with measurement metadata.

### 1. Tests must exist from step 1, not step 3

Verdict: PARTIALLY AGREE.

Evidence:
- The risk argument is real. `src/core/app-controller.ts` is currently 2808 lines, not 2561, and still owns top-level menus, popup menus, terminal creation, workspace restore, and the command palette (`src/core/app-controller.ts:134-198`, `src/core/app-controller.ts:307-426`, `src/core/app-controller.ts:440-726`, `src/core/app-controller.ts:1950-1982`, `src/core/app-controller.ts:2520-2648`).
- The spike still has no checked-in test files under this repo slice and no `test` script in `package.json`.

What pi-agent missed or got wrong:
- The current file size is 2808 lines, not 2561.
- "Screenshot export must exist before step 3" is planning advice, not something the source proves.

### 2. WindowRecord bag-of-optionals is a bigger trap than flagged

Verdict: AGREE.

Evidence:
- `WindowRecord` is a shared mutable bag with multiple optional feature-specific fields: `titleBar?`, `editor?`, `filePath?`, `terminal?`, `chat?`, `writeInput?`, `cleanup?`, `refresh?`, `describeState?`, and `openContextMenu?` in `src/core/types.ts:140-157`.
- Terminal state is already split by mode inside another optional bag: `mode: "legacy" | "xterm-bridge"` plus optional `viewport?`, `transcript?`, `input?`, and `scrollViewport?` in `src/core/types.ts:64-70`.

What pi-agent missed or got wrong:
- The review listed only four optionals. The actual shared bag is larger.
- `describeState()` already exists and is the seam most snapshot/state code uses, so the practical refactor target is likely a discriminated/module-owned state boundary around that, not necessarily a single generic `state: TState`.

### 3. overlay-manager.ts (648 lines) is coupled to the controller

Verdict: DISAGREE.

Evidence:
- `src/core/overlay-manager.ts` is exactly 648 lines.
- But the file does not own menus, the command palette, or context menus. Its public surface is prompt/overlay UI only: `flash()` (`src/core/overlay-manager.ts:41`), `openValuePrompt()` (`src/core/overlay-manager.ts:51`), `openPathPrompt()` (`src/core/overlay-manager.ts:108`), `openListPrompt()` (`src/core/overlay-manager.ts:195`), `openBrowserPrompt()` (`src/core/overlay-manager.ts:214`), and `openFileBrowserPrompt()` (`src/core/overlay-manager.ts:403`).
- Menu definitions live in `src/core/app-controller.ts:134-198`.
- Menu rendering lives in `src/core/app-controller.ts:286-340`.
- Popup/context menus live in `src/core/app-controller.ts:369-426`.
- The command palette window lives in `src/core/app-controller.ts:1950-1982`.
- The only explicit dependency from `OverlayManager` back out is a `restoreWindowFocus` callback passed at construction (`src/core/overlay-manager.ts:18-19`, `src/core/app-controller.ts:106`).

What pi-agent missed or got wrong:
- The size claim is correct; the ownership claim is not.
- `OverlayManager` is still worth slimming down, but it is not "the place that owns all menus" and it does not dispatch back into `app-controller` for every action. The controller passes callbacks into it.

### 4. The dual terminal paths warning deserves a harder line

Verdict: PARTIALLY AGREE.

Evidence:
- Two terminal implementations are live right now.
- `openTerminalWindow()` routes to the legacy transcript PTY path via `openPtyWindow()` in `src/core/app-controller.ts:440-451` and `src/core/app-controller.ts:621-726`.
- `openXTermShellWindow()` routes to the buffered path via `openBufferedTerminalWindow()` in `src/core/app-controller.ts:453-461` and `src/core/app-controller.ts:484-619`.
- The mode split is codified in types as `mode: "legacy" | "xterm-bridge"` in `src/core/types.ts:64-70`.
- Both entry points are still exposed in the UI (`src/core/app-controller.ts:147-148`, `src/core/app-controller.ts:2754-2755`).

What pi-agent missed or got wrong:
- Pi chat also uses the legacy PTY path via `openPtyWindow()` (`src/core/app-controller.ts:472-480`), so this is not just "Terminal vs XTerm Shell."
- Early deprecation is a reasonable recommendation, but the exact step number is still sequencing judgment, not a source fact.

### 5. Theme tokens (step 5/008) might need to come before step 4 (006)

Verdict: DISAGREE with the rationale, PARTIALLY AGREE with the general caution.

Evidence:
- Current serialized window state is semantic, not raw widget style state.
- `WindowStateDetails` is an open semantic bag in `src/core/types.ts:89-94`.
- Snapshot payloads store semantic fields like `selectedIndex`, `searchValue`, `inputText`, `font`, `theme`, `primers`, `turns`, `model`, `mode`, `appType`, and `tick` in `src/core/app-controller.ts:2651-2723`.
- I do not see exported `fg`, `bg`, `border`, or raw blessed `style` objects in state payloads.

What pi-agent missed or got wrong:
- The specific claim that command/API state will expose raw blessed colours is not supported by the current code.
- Theme work is still useful, but the main reason is consistency and future rendering seams, not because the current `/state` contract is already leaking raw style objects.

### 6. Missing: content-service.ts needs enrichment at step 1

Verdict: DISAGREE.

Evidence:
- `collectPrimerEntries()` already returns `BrowserEntry[]`, not strings, in `src/services/content-service.ts:10-19`.
- `collectGalleryEntries()` already returns `BrowserEntry[]`, not strings, in `src/services/content-service.ts:53-75`.
- `buildGalleryTabs()` carries `BrowserEntry[]` through into `GalleryTab.entries` in `src/services/content-service.ts:78-92`.
- `createBrowserEntry()` attaches `metadata` in `src/services/content-service.ts:171-177`.
- `readPrimerMetadata()` already measures each file and records `contentWidth`, `contentHeight`, `recommendedWidth`, `recommendedHeight`, `animated`, and `frameCount` in `src/services/content-service.ts:180-190`.

What pi-agent missed or got wrong:
- The "flat string arrays" claim is false.
- The real gap is not missing enrichment. The real gap is that some controller paths still re-read and re-measure on open instead of consistently consuming the enriched service shape, e.g. `openPrimerWindow()` re-measures with `measurePrimerContent()` in `src/core/app-controller.ts:2005-2018`.

### 7. Risk: blessed library limitations

Verdict: PARTIALLY AGREE.

Evidence:
- The dependency is stale in this repo: `blessed@^0.1.81` in `package.json:15`.
- Current npm metadata for `blessed` shows `0.1.81` and says it was published "10 years ago", which means the package is clearly stale, but that points closer to 2016 than 2017: <https://www.npmjs.com/package/blessed>.

What pi-agent missed or got wrong:
- The exact "last publish 2017" claim does not match the current npm metadata.
- The source here does not prove a fallback library is required. It proves only that the dependency is old and therefore worth tracking as a risk.

### 8. Concrete deliverable per step

Verdict: PARTIALLY AGREE.

Evidence:
- The principle is sound: this spike still lacks named implementation seams for registry extraction and tests.
- But the specific filenames are proposals, not facts from the current source. For example, the command palette is currently implemented directly in `src/core/app-controller.ts:1950-1982`, and there is no current `src/core/command-registry.ts` or `src/windows/` module tree.

What pi-agent missed or got wrong:
- This is useful planning discipline, but it is not a correction to the current code analysis.
- Some proposed artifact names may be right, but the source does not force those exact paths.

### Direct checks

- `overlay-manager.ts` is really 648 lines: yes. The coupling claim is overstated. The file is large, but its API is prompt/overlay UI and a focus-restoration callback, not menus/context menus/command palette ownership (`src/core/overlay-manager.ts:15-19`, `src/core/overlay-manager.ts:41`, `src/core/overlay-manager.ts:51`, `src/core/overlay-manager.ts:108`, `src/core/overlay-manager.ts:195`, `src/core/overlay-manager.ts:214`, `src/core/overlay-manager.ts:403`).
- `content-service.ts` really returns flat strings: no. It returns `BrowserEntry[]` and `GalleryTab[]` with per-entry `metadata` (`src/services/content-service.ts:10-19`, `src/services/content-service.ts:53-92`, `src/services/content-service.ts:171-190`).
- `blessed` was really last published in 2017: not supported. Current npm metadata says `0.1.81` was published "10 years ago", which is stale but not the same as a verified 2017 publish date: <https://www.npmjs.com/package/blessed>.
- There are really two terminal implementations: yes. Legacy transcript PTY and buffered `xterm-bridge` both exist and are both wired into the UI (`src/core/types.ts:64-70`, `src/core/app-controller.ts:440-461`, `src/core/app-controller.ts:484-726`, `src/core/app-controller.ts:147-148`, `src/core/app-controller.ts:2754-2755`).
- `WindowRecord` really has the listed optional fields: yes, and more. The review omitted `titleBar?`, `filePath?`, `cleanup?`, `refresh?`, `describeState?`, and `openContextMenu?` (`src/core/types.ts:140-157`).
