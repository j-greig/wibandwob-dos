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
- `retired` — keep on disk for archaeology only; do not use for current planning

## Execution Buckets

This is the agent-friendly triage layer. Not every doc should become an epic.

### Tier 1 — Core execution now

These define the substrate. Work here first.

- `BUILD-ORDER-FINAL.md`
  - sequencing canon for the rebuild
- `overview.md`
  - high-level parcel map P1-P7
- `002-architecture-plan-content-sizing-layout.md`
  - measurement, chrome, state, layout architecture
- `015-window-manager-reference-and-repair-plan.md`
  - current window-manager stabilization work
- `018-command-registry-and-tool-adapter-prd.md`
  - command registry and adapter substrate
- `020-target-architecture.md`
  - canonical end-state TS app structure and module ownership
- `spk-agent-window-enhancement.md`
  - native agent window direction
- `refactor-epoch-plan.md`
  - canonical refactor tracker

### Tier 2 — Core follow-on after substrate is boring

Important, but should build on a stable shell.

- `001-primer-dimensions-and-agent-sizing.md`
- `004-window-type-registry-and-factories.md`
- `006-command-registry-and-ipc-protocol.md`
- `007-terminal-emulator.md`
- `008-theme-system-and-desktop-rendering.md`
- `010-browser-and-text-rendering.md`
- `013-events-persistence-and-multi-instance.md`
- `019-context-sensitive-menu-bar-prd.md`

### Tier 3 — Secondary / optional spikes

Potentially valuable, but not on the critical path today.

- `003-pi-mono-chat-window-evaluation.md`
- `004-piclaw-sandbox-evaluation.md`
- `005-llm-integration-and-claude-sdk-bridge.md`
- `014-gaps-from-skill-crosscheck.md`
- `terminal-native-research.md`

### Tier 4 — Parking lot / defer

Do not treat these as active epics unless priorities change.

- `009-paint-canvas-system.md`
- `011-games-and-generative-art.md`
- `012-micropolis-integration.md`
- `016-terminal-kit-screenbuffer-animation-spike.md`

### Tier 5 — Historical / review docs

Use for validation and audit, not as the main execution plan.

- `chat-collapse-review.md`
- `content-measurement-review.md`
- `editor-save-review.md`
- `window-facade-review.md`
- `window-facade-phase1-review.md`
- `window-facade-full-review.md`
- `003-document-plan.md`
- `BUILD-ORDER.md`
- `INDEX.md` (deleted — superseded by this file)

## Retire From Active Working Set

These should remain on disk for context and archaeology, but they should stop
shaping day-to-day planning.

- `003-document-plan.md`
  - obsolete now that the real doc corpus exists
- `BUILD-ORDER.md`
  - replaced by `BUILD-ORDER-FINAL.md`
- `wibwob-chat-v2-plan.md`
  - superseded by the native agent/chat path
- `017-framework-direction-and-today-plan.md`
  - useful historical rationale, but `020-target-architecture.md` is now the canonical direction

Likely next retirement candidates after one more pass:

- `002-architecture-plan-content-sizing-layout.md`
  - much of its architectural intent is now absorbed into `020`
- `terminal-native-research.md`
  - still good background, but no longer execution-driving
- review docs for already-fixed slices
  - keep as evidence, not as current planning inputs

## How To Turn This Into Work

Agent-friendly rule:

- only Tier 1 docs become active epics by default
- Tier 2 docs become epics/features only after their dependency Tier 1 seams are stable
- Tier 3 docs should usually become spikes or short investigations, not epics
- Tier 4 docs stay parked unless the user explicitly reprioritizes them
- review docs should produce concrete fix tickets, not stand alone as epics

Recommended current epic buckets:

1. `Core Shell`
   - window manager
   - chrome/layout/geometry
   - theming
2. `Command Surface`
   - command registry
   - control API
   - context-sensitive menus
   - future MCP projection
3. `Agent Surface`
   - Wib&Wob Chat / Agent
   - tool adapters
   - state-aware desktop control
4. `Content Surfaces`
   - measurement
   - browser/text/file manager
   - window factories and restore semantics

If a doc does not clearly strengthen one of those four buckets, it is probably not a current epic.

## Current Execution Notes

- The TS TUI spike has moved well beyond a tiny MVP.
- Before much more feature or architecture work lands, split ongoing TS TUI work onto its own fresh spike branch.
- Treat that branch cut as the start of the next phase, not as a new feature.
- The next workspace-system cleanup should make app boot restore `default.json`
  (and later optionally a last-used-workspace pointer) before falling back to
  opening Scramble.

## Key Repo-Root Architecture Docs

These live outside the spike dir but directly drive spike work:

| File | Status |
|---|---|
| `docs/architecture/prd-window-facade-modularity.md` | `landed` — Phases 1-5 done. WindowFacade interface, 4 consumer collapses, chat collapse, DRY audit addendum. |
| `docs/development/spike-editor-save.md` | `landed` — Save, Save As, dirty indicator, context menu. All 7 steps done. |

## Spike Docs

| File | About | Status |
|---|---|---|
| `001-primer-dimensions-and-agent-sizing.md` | Primer measurement, recommended sizing, and agent-visible content dimensions from the older C++ path. | `reference` |
| `002-architecture-plan-content-sizing-layout.md` | TS architecture plan for parcels P1-P7: measurement, chrome, state, layout, and pre-open sizing. | `reference` |
| `003-document-plan.md` | Early estimate of the handover docs needed for the TS rebuild. | `retired` |
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
| `017-framework-direction-and-today-plan.md` | Historical framework-direction snapshot before the target architecture became canonical. | `retired` |
| `018-command-registry-and-tool-adapter-prd.md` | PRD for define-once commands projected into menu, palette, API, agent, and later MCP. Core registry path is proven; MCP/cleanup remain. | `partial` |
| `019-context-sensitive-menu-bar-prd.md` | PRD for macOS-style context-sensitive menus. Context model, enabled predicates, and context-menu alignment are refined; implementation remains partial. | `partial` |
| `020-target-architecture.md` | Canonical end-state architecture for the TS TUI app: source tree, subsystem boundaries, file responsibilities, startup workspace semantics, native appearance/theme rules, and ASCII animation support. | `active` |
| `BUILD-ORDER-FINAL.md` | Preferred sequencing for the broader TS rebuild. | `active` |
| `BUILD-ORDER.md` | Older build order document superseded by the final version. | `retired` |
| `INDEX.md` | Deleted. Superseded by this file (`000-docs-overview.md`). | `deleted` |
| `chat-collapse-review.md` | Review of chat collapse. Found identity + prompt regressions — both fixed (appType, stripped prompts). | `review` |
| `content-measurement-review.md` | Review of the content measurement unification. Found sizing regression — fixed (collapsed to single measurement field). | `review` |
| `editor-save-review.md` | Review of editor save. 4 bugs found, all fixed: dirty title leak, agent write bypass, non-atomic Save As, unresilient writes. | `review` |
| `overview.md` | High-level parcel map P1-P7 for the full TS rebuild. | `reference` |
| `refactor-epoch-plan.md` | Canonical tracker for the spike refactor/reorganization epochs. Epoch 1 done (2878->2050 lines). Epoch 2: WindowFacade landed, chat collapsed, command registry landed, content measurement unified. | `active` |
| `spk-agent-window-enhancement.md` | Plan and rationale for turning chat into a real agent window with TUI tools. Useful and partly landed, but still mixed with review corrections. | `partial` |
| `terminal-native-research.md` | Research note on terminal-native TypeScript TUI options and tradeoffs. | `reference` |
| `wibwob-chat-v2-plan.md` | Native Wib&Wob Chat v2 plan. Kept only as historical slice notes; superseded by the native agent/chat path. | `retired` |
| `window-facade-full-review.md` | Full review of Phases 1-5. Capture route fix applied. Remaining: async restore race, old method aliases. | `review` |
| `window-facade-phase1-review.md` | Review of the early WindowFacade phase and contract drift. | `review` |
| `window-facade-review.md` | Initial WindowFacade problem framing before the fuller migration work. | `review` |
