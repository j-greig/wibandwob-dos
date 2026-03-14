# E033 Module Audit — Cleanup Shortlist

## TL;DR

This is the practical follow-on from `module-audit.md`.

It does not propose a grand rewrite.
It ranks the best cleanup seams by payoff, collision risk, and alignment with E033.

Current bias:
- prefer module-local simplification
- avoid shell/runtime seams already owned elsewhere
- reduce ambient redraws, giant files, direct core imports, and dishonest multi-instance state

## Ranking method

Each candidate is judged on:
- payoff to E033 goals
- implementation safety in a module-local lane
- risk of collision with active shell/runtime work
- whether the cleanup can improve more than one surface later

## Ranked shortlist

### 1. Make Tide Pool multi-instance state honest

Target:
- `microapps/wibwob-tidepool/index.ts`

Why it ranks first:
- manifest says `multiInstance: true`
- current mutable state lives at module scope
- fix is conceptually local and high-value
- strongly aligned with E033 lifecycle calmness

Likely cleanup slice:
- move engine, timer, speed, history, and highlight into `openTidePool(...)`
- make per-window cleanup obviously own per-window timers
- keep `describeState()` machine-readable

Why it matters:
- this is exactly the kind of lifecycle honesty E033 is about
- it reduces surprising shared state without touching shell seams

### 2. Calm TouchLab local redraw and nested-panel sprawl

Target:
- `microapps/touchlab-mvp/index.ts`

Why it ranks high:
- TouchLab is now a canonical composition-adjacent surface
- it already uses the shared composition path, so local polish now has leverage
- likely module-local if kept disciplined

Likely cleanup slice:
- reduce scattered `host.screen.render()` calls behind a local invalidation helper
- identify remaining truly shared composition helpers versus TouchLab-only chrome
- tighten role semantics around source/parameter/output

Why it matters:
- TouchLab is becoming a reference surface for terminal-native composition work
- reducing its local mess improves future author understanding

### 3. Split Patchbay Lab into named local benches

Target:
- `microapps/patchbay-lab/index.ts`

Why it ranks high:
- enormous integration harness
- broad coupling to terrain, world chat, primer preview, helper windows, animation
- strong chance of extracting meaning without touching shell/runtime code

Likely cleanup slice:
- define explicit local bench controllers: overview, terrain, chat, primer gallery, helpers
- reduce all-in-one-file cognitive load before any shared abstraction attempt
- keep it an integration harness, but make that identity explicit

Why it matters:
- currently powerful but mentally slippery
- good candidate for “make the code say what it already is”

### 4. Separate Poetry Clock transport concerns from presentation

Target:
- `microapps/wibwob-poetry-clock/index.ts`

Why it ranks high:
- combines UI, timers, auth reads, API calls, figlet shelling-out, and animation
- likely improvable with purely local extraction

Likely cleanup slice:
- isolate poem-fetch/auth logic from clock display logic
- centralise timer ownership
- preserve fallback behaviour while reducing conceptual sprawl

Why it matters:
- small product idea, surprisingly heavy implementation
- good example of E033’s “smaller honest surfaces” goal

### 5. Tighten Heartbeat as the minimal canonical animated microapp

Target:
- `microapps/heartbeat/index.ts`

Why it ranks high:
- very small and low-risk
- can become a cleaner reference module than Hello World for timer-driven surfaces
- likely no shell/runtime collision

Likely cleanup slice:
- use only public SDK imports
- make state payload slightly richer
- consider one calmer animation tick model

Why it matters:
- tiny modules teach habits
- this one could become the clean animation example

## Second-tier candidates

### TR-808 state ownership tidy

Target:
- `microapps/wibwob-tr808/index.ts`

Good candidate because engine/audio separation already exists.
Main issue is module-scope mutable runtime state and some local shadow types.
Useful, but slightly larger than Tide Pool.

### World Chatroom local rendering helpers

Target:
- `microapps/world-chatroom/index.ts`

Already fairly tidy.
Best improvement would be local helper extraction around transcript, input, and status.
Worth doing, but not as urgent as dishonest lifecycle state elsewhere.

### WibWobWorld local controller split

Target:
- `microapps/wibwobworld/index.ts`

Large payoff, but broader and easier to sprawl.
Good later candidate once smaller wins have landed.

## High-value but higher-risk candidates

### Zine decomposition pass

Target:
- `microapps/zine/index.ts`

Very valuable, but large.
It mixes file browser, canvas runtime, hot reload, edit flow, and writeback.
Should probably be split by local concern, but this is not the first “small honest slice”.

### §y² Chronicles decomposition pass

Target:
- `microapps/sy2-chronicles/index.ts`

Also very valuable, also very large.
This is almost a subsystem disguised as a module.
Best approached after smaller module-local wins prove the pattern.

## Cross-cutting cleanup seams from the audit

These showed up repeatedly across modules:

### A. Ambient redraw discipline

Common symptom:
- many scattered `host.screen.render()` calls in handlers, timers, and async callbacks

Likely direction:
- use local invalidation helpers inside modules first
- avoid jumping straight to shared runtime machinery while shell seams are hot

### B. Direct imports from `src/core/*`

Common symptom:
- modules bypass the public SDK and reach into core widgets, ui helpers, or layout code

Likely direction:
- either expand the SDK deliberately or relabel those modules as internal harnesses
- stop accidental teaching-by-example of private imports

### C. Module-scope mutable runtime state

Common symptom:
- engine, timer, selected item, active window, or service state stored outside one window instance

Likely direction:
- make multi-instance promises honest
- keep state inside `open...()` unless there is a very good reason not to

### D. Mixed product surface and tooling harness roles

Common symptom:
- some modules are really integration harnesses or SDK showrooms, but read like product apps

Likely direction:
- either split them or label them explicitly so authors do not mistake them for canonical patterns

## Suggested execution order when a lane is free

1. `microapps/wibwob-tidepool/index.ts`
2. `microapps/heartbeat/index.ts`
3. `microapps/touchlab-mvp/index.ts`
4. `microapps/wibwob-poetry-clock/index.ts`
5. `microapps/patchbay-lab/index.ts`
6. `microapps/world-chatroom/index.ts`
7. `microapps/wibwob-tr808/index.ts`
8. `microapps/wibwobworld/index.ts`
9. `microapps/zine/index.ts`
10. `microapps/sy2-chronicles/index.ts`

## Not a recommendation right now

This shortlist is not permission to start coding immediately.
It is a planning aid while active shell/runtime seams remain owned elsewhere.
