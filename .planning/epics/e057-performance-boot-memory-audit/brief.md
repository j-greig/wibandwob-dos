---
id: e057
title: Performance, Boot, and Memory Audit
status: not-started
branch: epic/e057-performance-boot-memory-audit
created: 2026-03-27
---

# E057 — Performance, Boot, and Memory Audit

This epic captures a static audit of `/src` in `wibwob-dos` with one goal:
make the app boot faster, hold less memory, and become easier to reason about
as the feature surface grows.

This is not a profiler trace. It is a code-informed ranking based on startup
shape, import topology, long-lived allocations, and obvious retention paths.

## Audit context

- Repository audited: `wibwob-dos`
- Scope: `src/` with supporting boot/runtime files in the same repo
- Date: 2026-03-27
- Constraint: findings should be precise enough that another agent with zero
  context from the original conversation can continue directly

## Source size reality check

The likely bottleneck is not raw app source size.

- `src`: `1.9M`
- `vendor`: `418M`
- `node_modules`: `779M`

Implication: the biggest wins are likely to come from startup discipline,
import strategy, optional subsystem activation, and bounded runtime state
rather than shaving bytes off application source files.

## Ranked findings

### F01 — The composition root is too eager at boot

This is the highest-leverage startup issue.

`src/core/app-controller.ts` statically imports a very large slice of the app at
module load time, including services, window factories, runtime adapters, and
feature-specific modules:

- `src/core/app-controller.ts:8-177`

The host window registration layer does the same for most concrete window
implementations:

- `src/core/host-window-registrations.ts:7-35`
- `src/core/host-window-registrations.ts:54-210`

Why this matters:

1. All these modules are parsed and linked before first render.
2. Heavy but rarely used windows become part of startup cost even if never opened.
3. The app pays boot cost for browser, music, terrain, backrooms, file manager,
   and other verticals immediately.

Most likely improvement:

- Replace top-level window imports in `host-window-registrations.ts` with lazy
  factory imports using `await import(...)` inside each registered window
  factory.
- Keep the registry metadata cheap and delay module evaluation until first use.

Expected result:

- Lower cold boot latency
- Lower initial RSS
- Cleaner separation between shell boot and feature hydration

### F02 — Microapp loading is eager and does duplicate discovery work

Current boot behavior:

- `loadMicroapps()` calls `loadThemes()` and `loadRuntimeMicroapps()`
- both paths call `discoverMicroapps()`

References:

- `src/services/microapp-loader.ts:360-394`
- `src/services/microapp-loader.ts:502-509`
- `src/services/microapp-loader.ts:515-539`
- `src/services/microapp-loader.ts:553-557`

Runtime microapps are also imported eagerly:

- `src/services/microapp-loader.ts:442-491`
- `src/core/app-controller.ts:531-537`

Why this matters:

1. Boot scans the microapp tree more than once.
2. Enabled microapps are imported before the user asks for them.
3. Startup grows with every new microapp even when usage is sparse.

Most likely improvement:

- Discover once, cache manifest metadata for the process lifetime.
- Register commands and menus from manifest data first.
- Import a runtime microapp module only on first command execution or first
  window open.

Expected result:

- Faster boot
- Less module churn at startup
- A more scalable microapp system

### F03 — Optional subsystems are started too early

The constructor for `TsTuiMvpApp` eagerly creates multiple services and performs
work before first render:

- `src/core/app-controller.ts:214-229`
- `src/core/app-controller.ts:394-424`
- `src/core/app-controller.ts:486-529`

Notable examples:

- `capabilityService.probe()` at `src/core/app-controller.ts:401`
- `ScrambleBrain` constructed at `src/core/app-controller.ts:232`
- `ControlApiService` and `StateService` built in the constructor at
  `src/core/app-controller.ts:486-517`
- Scramble session socket started in the constructor at
  `src/core/app-controller.ts:519-528`
- Control API and MCP server started in `run()` regardless of whether the user
  needs them:
  - `src/core/app-controller.ts:559-570`

Why this matters:

1. First render competes with network, socket, and automation setup.
2. The shell cannot become interactive until optional machinery is wired.
3. The app lacks a clean “boot core first, hydrate extras later” shape.

Most likely improvement:

- Split startup into phases:
  1. shell and screen
  2. local window/menu runtime
  3. automation and network services
- Make agent, MCP, browser integration, and world chat activation lazy or at
  least post-render.

Expected result:

- Faster perceived startup
- Lower first-interaction latency
- Better lifecycle boundaries

### F04 — There are obvious unbounded memory-retention paths

This is the highest-priority memory finding.

#### Scramble history is unbounded

- `src/services/scramble-brain.ts:40-47`
- `src/services/scramble-brain.ts:255-264`

That history is also copied into runtime inspection snapshots:

- `src/core/app-controller.ts:453-467`

#### World chat channel history is unbounded

- `src/services/world-chat-service.ts:139-145`
- `src/services/world-chat-service.ts:296-349`

#### WibWob agent session transcript and tool runs are unbounded

- `src/services/wibwob-agent-session.ts:705-708`
- `src/services/wibwob-agent-session.ts:813-1048`

Why this matters:

1. Long-lived sessions accumulate memory linearly with use.
2. Inspection/state surfaces amplify the cost by copying large arrays.
3. External tooling that polls snapshots can repeatedly serialize oversized
   payloads.

Most likely improvement:

- Introduce ring buffers for:
  - Scramble history
  - world chat messages per channel
  - agent transcript messages
  - agent tool runs
- Separate “live detailed transcript” from “inspection snapshot summary”.
- Expose capped summaries in `/state` and `/runtime/inspection`, and add
  explicit endpoints for full history if still needed.

Suggested acceptance shape:

- Scramble history capped to N entries
- world chat messages capped per channel
- agent transcript/tool run arrays capped or compacted
- inspection snapshot omits or truncates bulky arrays by default

### F05 — Sync I/O remains on startup and interactive paths

Examples:

- `git rev-parse HEAD` runs synchronously at boot:
  - `src/app.ts:91-98`
- Ghostty shader activation uses sync process spawning:
  - `src/app.ts:112-127`
- Markdown picker recursively scans the repo synchronously on demand:
  - `src/core/app-controller.ts:183-199`
  - `src/core/app-controller.ts:1284-1301`
- Scramble log writes are synchronous:
  - `src/services/scramble-brain.ts:258-261`
- World chat log writes are synchronous:
  - `src/services/world-chat-service.ts:125-136`

Why this matters:

1. Some startup work blocks before the app is visible.
2. Some interaction paths can stall on filesystem traversal or append writes.
3. Sync operations are not necessarily fatal, but the aggregate effect makes the
   app feel heavier.

Most likely improvement:

- Move nonessential sync startup tasks to post-render.
- Cache expensive repo scans such as markdown file discovery.
- Batch or debounce append-heavy logs if they become hot.

### F06 — Content and file discovery services lean on repeated synchronous scans

`ContentService` performs repeated `readdirSync` and `statSync` walks across
primer roots:

- `src/services/content-service.ts:10-77`
- `src/services/content-service.ts:130-143`
- `src/services/content-service.ts:146-200`

`BackroomsService` also repeatedly scans directories:

- `src/services/backrooms-service.ts:39-45`
- `src/services/backrooms-service.ts:66-83`
- `src/services/backrooms-service.ts:106-109`

Why this matters:

1. Repeated scans grow with content volume.
2. These are good candidates for process-level caching and invalidation hooks.
3. The app already has enough runtime state that it should treat filesystem
   discovery as data, not recompute it everywhere.

Most likely improvement:

- Add cached content indexes with explicit invalidation on reload.
- Reuse one content catalog across primer browser, gallery, picker, and metadata
  lookups.

### F07 — Runtime snapshots copy too much data too often

The runtime inspection service materializes a large snapshot, including copied
desktop state, runtime stats, Scramble details, full Scramble history, and rate
limit state:

- `src/core/app-controller.ts:434-470`

The agent snapshot path also copies message and tool arrays:

- `src/services/wibwob-agent-session.ts:690-708`

Why this matters:

1. Snapshot callers pay allocation cost repeatedly.
2. Control API and automation flows may poll these endpoints frequently.
3. Copying large arrays hides memory pressure until throughput degrades.

Most likely improvement:

- Create lightweight default snapshots.
- Gate heavy detail behind explicit query params or dedicated endpoints.
- Add summary-only inspection shapes for routine polling.

### F08 — Architecture still centralizes too much lifecycle in `app-controller.ts`

`TsTuiMvpApp` is still responsible for startup, service composition, menu wiring,
window coordination, runtime inspection, control API, workspace restore, and
agent session orchestration:

- `src/core/app-controller.ts:201-249`
- `src/core/app-controller.ts:531-584`

Global singletons also exist for world chat, capability probing, and shared
audio:

- `src/services/world-chat-service.ts:353`
- `src/services/capability-service.ts:163`
- `src/services/audio-player-controller.ts:508`

Why this matters:

1. Lifecycle ownership is blurred.
2. Test seams are weaker than they should be.
3. Perf and memory work becomes harder because boundaries are not explicit.

Most likely improvement:

- Move toward lifecycle-managed modules with explicit `init()`, `start()`,
  `snapshot()`, and `dispose()`.
- Split the app into shell runtime, feature runtime, and automation runtime.

## Recommended implementation order

### Slice 1 — Fastest boot win

Lazy-load host windows.

Primary files:

- `src/core/host-window-registrations.ts`
- `src/core/app-controller.ts`

Rationale:

- High impact
- Low conceptual risk
- Clear before/after behavior

### Slice 2 — Biggest memory win

Cap histories and shrink snapshots.

Primary files:

- `src/services/scramble-brain.ts`
- `src/services/world-chat-service.ts`
- `src/services/wibwob-agent-session.ts`
- `src/core/app-controller.ts`

Rationale:

- Fixes the strongest unbounded-retention paths
- Reduces both live memory and snapshot serialization cost

### Slice 3 — Microapp boot discipline

Discover once, import runtime microapps on demand.

Primary files:

- `src/services/microapp-loader.ts`
- `src/core/app-controller.ts`
- `src/core/command-registry.ts`

Rationale:

- Scales better as the microapp ecosystem grows
- Attacks startup cost without reducing capability

### Slice 4 — Startup phasing

Delay or stage optional subsystems until after first render.

Primary files:

- `src/app.ts`
- `src/core/app-controller.ts`
- `src/services/control-api.ts`

Rationale:

- Improves perceived boot time
- Makes lifecycle shape more coherent

### Slice 5 — Caching and sync-I/O cleanup

Primary files:

- `src/services/content-service.ts`
- `src/services/backrooms-service.ts`
- `src/core/app-controller.ts`
- `src/services/scramble-brain.ts`
- `src/services/world-chat-service.ts`

## Non-goals for the first pass

- Premature migration away from Blessed
- Replacing Bun runtime primitives just for fashion
- Deep speculative optimization without before/after measurement

## Measurement plan

This audit should graduate into measured work, not remain opinion.

Minimum instrumentation to add before larger refactors:

1. boot timing checkpoints around:
   - app constructor start
   - first render
   - microapp load done
   - control API ready
   - MCP ready
2. process memory snapshots after:
   - first render
   - default workspace restore
   - opening agent/chat/browser windows
3. bounded-history counters exposed in runtime inspection

## Concrete next-agent brief

If another agent picks this up, do the work in this order:

1. Measure boot and memory before changing architecture.
2. Implement lazy host-window loading.
3. Add ring buffers and truncated snapshot shapes.
4. Re-measure.
5. Only then decide whether startup phasing and microapp lazy import are still
   necessary or should be the next slice.

## Open questions

- Should `/runtime/inspection` become summary-first and move transcript history
  to dedicated endpoints?
- Should world chat and Scramble keep full logs only on disk and retain just a
  bounded in-memory window?
- Should feature modules register themselves declaratively so the shell can boot
  without importing them?

## Acceptance criteria

AC-1: Another agent can read only this brief and identify the top-ranked startup
and memory problems with exact source locations.

AC-2: The brief names a concrete implementation order, not just a bag of ideas.

AC-3: The brief includes enough file and line references to support direct
follow-up coding without redoing the initial audit from scratch.
