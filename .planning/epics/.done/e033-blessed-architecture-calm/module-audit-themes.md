# E033 Module Audit — Cross-Module Themes

## TL;DR

The audit did not reveal one giant fatal flaw.
It revealed the same four or five habits repeating in different costumes.

Most common themes:
- ambient redraws everywhere
- modules bypassing the public SDK
- module-scope mutable runtime state
- product modules doubling as test harnesses or mini-frameworks
- filesystem / process / network concerns sitting directly in view modules

This is good news.
It means E033 can win through repeated local discipline, not one heroic rewrite.

## Theme 1 — Ambient redraw discipline is still loose

Observed in:
- `modules/glitchbox/index.ts`
- `modules/e026-demo/index.ts`
- `modules/patchbay-lab/index.ts`
- `modules/sy2-chronicles/index.ts`
- `modules/touchlab-mvp/index.ts`
- `modules/wibwob-poetry-clock/index.ts`
- `modules/wibwob-tidepool/index.ts`
- `modules/world-chatroom/index.ts`
- `modules/zine/index.ts`
- and terminal too, though that seam is special-case fragile

Pattern:
- handlers mutate state, set content, then call `host.screen.render()` directly
- timers and async callbacks do the same
- redraw ownership is obvious in tiny modules, but noisy in larger ones

Why it matters for E033:
- E033 wants render as consequence of state change, not ambient ritual
- scattered redraw calls make behaviour harder to reason about and harder to test

Low-risk next move:
- prefer per-module invalidation helpers first
- do not jump to a new global render layer while shell seams are active

## Theme 2 — The public microapp SDK is still porous

Observed in:
- `modules/e026-demo/index.ts`
- `modules/heartbeat/index.ts`
- `modules/patchbay-lab/index.ts`
- `modules/sy2-chronicles/index.ts`
- `modules/zine/index.ts`

Pattern:
- modules import from `src/core/*` or ad hoc service files directly
- some of this is justified for internal harnesses
- some of it is accidental teaching-by-example

Why it matters for E033:
- module author ergonomics become muddy if canonical examples bypass the SDK
- internal and public surfaces blur together

Useful distinction:
- some modules are product apps
- some are internal harnesses or research surfaces
- the codebase should say which is which

Low-risk next move:
- either deliberately export more through `microapp-sdk.ts`
- or mark certain modules as internal/harness examples and stop treating them as public exemplars

## Theme 3 — Multi-instance honesty is inconsistent

Observed most clearly in:
- `modules/wibwob-tidepool/index.ts`
- also visible in weaker forms in `glitchbox` and `tr808`

Pattern:
- manifest says one thing about instance behaviour
- mutable state sometimes lives at module scope rather than window scope

Why it matters for E033:
- lifecycle ownership is one of the epic’s core themes
- module-local globals produce spooky action between windows or future tests

Low-risk next move:
- audit `multiInstance: true` modules first
- move mutable runtime state into window-open scope unless a shared singleton is truly intentional

## Theme 4 — Some modules are really subsystems in disguise

Observed in:
- `modules/patchbay-lab/index.ts`
- `modules/sy2-chronicles/index.ts`
- `modules/zine/index.ts`
- `modules/wibwobworld/index.ts`
- `modules/wibwob-poetry-clock/index.ts`

Pattern:
- one file owns product logic, content loading, editing or IO, animation, transport, and debugging
- the module still works, but becomes hard to mentally model

Why it matters for E033:
- calmer architecture is not only about the shell
- modules themselves need clearer ownership boundaries

Low-risk next move:
- split by local concern before extracting shared abstractions
- make the code declare its internal roles explicitly: viewer, editor, transport, capture, animation, etc.

## Theme 5 — View modules often own host-side IO directly

Observed in:
- `modules/hello-world/index.ts` via `spawnSync(figlet)`
- `modules/patchbay-lab/index.ts` via primer file reads
- `modules/wibwob-poetry-clock/index.ts` via auth-file reads, direct network calls, and figlet shelling-out
- `modules/wibwobworld/index.ts` via capture and export writes
- `modules/zine/index.ts` via file discovery, reads, writes, and watchers
- `modules/terminal/index.ts` via bridge process management

Pattern:
- modules often act as their own process/file/network coordinators

Why it matters for E033:
- some of this is unavoidable in a terminal-native system
- but when mixed with UI and lifecycle code, complexity spikes quickly

Low-risk next move:
- where possible, separate transport/io helpers from display logic inside the module first
- shared services only after the local seams are named clearly

## Theme 6 — Tiny modules teach habits, good or bad

Observed in:
- `modules/hello-world/index.ts`
- `modules/heartbeat/index.ts`
- `modules/e026-demo/index.ts`

Pattern:
- starter and demo modules are copied by future authors
- if they shell out synchronously, bypass the SDK, or rely on noisy cleanup patterns, those habits spread

Why it matters for E033:
- module docs and scaffolds are part of architecture, not decoration

Low-risk next move:
- keep starter surfaces small and honest
- align scaffold, docs, and the cleanest examples

## Theme 7 — State reporting exists, but quality varies a lot

Observed across most modules.

Pattern:
- many modules do provide `describeState()` and `captureText()`
- but some state payloads are rich and machine-readable, while others are mostly summary strings

Why it matters for E033:
- agent legibility and API parity depend on semantic state, not just visible content

Low-risk next move:
- when cleaning a module, improve state shape at the same time
- prefer explicit fields over clever summary prose

## Good news from the audit

Not everything is a warning.
Several positive patterns are already common:

- most modules do wire cleanup explicitly
- most modules do expose `describeState()`
- most modules do expose `captureText()`
- several modules already separate engine and renderer better than the shell once did
- the new TouchLab composition vocabulary shows that shared paths can emerge from one real adopter first

So the repo does not need a philosophy transplant.
It needs repeated local tightening.

## Best doc-only follow-ons from these themes

- convert the shortlist into future story seeds
- update module docs to distinguish public examples from internal harnesses
- define a tiny “module smell checklist” agents can use before opening a PR
- note which direct core imports are intentional and which are debt

## Suggested one-line smell checklist for future sessions

When auditing or editing a module, ask:
- is runtime state inside the window scope?
- does this module bypass the public SDK?
- are redraws scattered everywhere?
- is IO/process/network logic mixed directly into view code?
- is this really a product app, or actually a harness wearing a product hat?
