---
id: E015
title: Microapp Module System + Poetry Clock
status: in-progress
issue: ~
pr: ~
depends_on: []
---

# E015 — Microapp Module System + Poetry Clock

## TL;DR

A runtime module system that lets external packages register custom TUI window
types (microapps) into WibWob-DOS — appearing in menus, palette, agent tools,
workspace save/restore, and control API — without editing core source files.
Validated by shipping a Poetry Clock: a window that writes a new tiny poem
containing the current time every minute, inspired by Poem/1 by Matt Webb.

## Read First

- [scratch/rfc-microapp-modules.md](/Users/james/Repos/wibandwob-dos/scratch/rfc-microapp-modules.md) — full technical RFC
- [AGENTS.md architecture invariants](/Users/james/Repos/wibandwob-dos/AGENTS.md) — design canon
- [src/core/types.ts](/Users/james/Repos/wibandwob-dos/src/core/types.ts) — WindowKind, AppType, WindowRecord
- [src/core/snapshot-registry.ts](/Users/james/Repos/wibandwob-dos/src/core/snapshot-registry.ts) — snapshot save/restore
- [src/core/command-registry.ts](/Users/james/Repos/wibandwob-dos/src/core/command-registry.ts) — command catalog
- [modules-private/README.md](/Users/james/Repos/wibandwob-dos/modules-private/README.md) — existing module conventions

## Architecture Bucket

Infrastructure — module system is foundational, not a content surface.

## Objective

Make WibWob-DOS extensible by external modules. A module directory with a
manifest and entry point can register window types, commands, snapshot
handlers, and themes at runtime. Built-in types keep compile-time safety.
Dynamic types get runtime validation.

## Motivation

Adding a window type today requires editing seven core files. This is fine
for a small team iterating on core, hostile to external modules, community
contributions, or rapid prototyping of new window ideas. The module system
collapses that to: one directory, one manifest, one entry point.

The Poetry Clock validates the system with a real, useful, artistically
interesting microapp that exercises every hook: timer lifecycle, theme
awareness, workspace persistence, LLM integration, and agent visibility.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Window identity | `"microapp"` kind + `microappId` field | Follows type guard pattern from isEditorWindow/isFinderWindow |
| AppType extensibility | Widen to `string` | PersistableAppType stays narrow for built-in snapshot safety |
| Snapshot for dynamic types | Parallel `Map<string, SnapshotHandler>` | Built-in `satisfies Record` contract preserved |
| Command registration | `addDynamic()` on CommandRegistry | Dynamic commands appear in all existing projection surfaces |
| Namespace collisions | Fail-fast at load time | Silent wins cause invisible bugs |
| Module load order | Sort by directory name | Deterministic, visible |
| Poem generation | Claude Code SDK (TS v2) via subprocess worker | No API key required — uses authenticated Claude session |

## Features

### F01 — Module Discovery + Theme Loader (Phase 0)

Status: done

Module loader scans `modules/` and `modules-private/` for `module.json`
manifests at startup, routes by type. Theme modules are dynamically imported
and registered via `registerExternalTheme()`. Phosphor stub deleted, real
module loaded.

Files delivered:
- [x] `src/services/module-loader.ts` — manifest scanning + theme dispatch
- [x] `src/core/theme/resolver.ts` — `registerExternalTheme()`, stub deleted
- [x] `src/core/app-controller.ts` — `run()` async, `loadModules()` before workspace restore
- [x] `src/app.ts` — `await` on `run()`

AC-1: Theme modules discovered and registered at startup.
Test: `bun -e` script imports resolver, calls loadModules(), verifies
allVariants() includes "wibwob-phosphor" with real tokens.

AC-2: Theme cycle includes external themes.
Test: toggleTheme() cycles through all variants including phosphor.
Verified manually.

AC-3: Phosphor stub deleted; real module loads from modules-private.
Test: resolver.ts contains no stub. phosphor tokens differ from dark.

AC-4: Typecheck passes clean.
Test: `bun run typecheck` — no errors (pre-existing bun:test errors excluded).

### F02 — Microapp Host API + Registration

Status: in-progress

The core microapp infrastructure: MicroappHost interface, MicroappWindowHandle,
dynamic command registration, dynamic snapshot registration, and the type
system changes to support `"microapp"` as a WindowKind.

Split across two contributors:
- **wibwob2** (this session): `src/services/module-loader.ts` (microapp loading),
  proof-of-concept module
- **wibwob1**: `src/core/types.ts`, `src/core/command-registry.ts`,
  `src/core/snapshot-registry.ts`

Stories:

#### S01 — Type system changes (owner: wibwob1) — DONE (aeb76d2)
- [x] Add `"microapp"` to `WindowKind` union in `src/core/types.ts`
- [x] Add `microappId?: string` to `WindowRecord`
- [x] Add `MicroappWindowRecord` interface extending `WindowRecord`
- [x] Add `isMicroappWindow()` type guard
- [x] Typecheck passes

AC-S01: `"microapp"` is a valid WindowKind and `isMicroappWindow()` narrows correctly.
Test: `bun run typecheck` passes. Type guard returns true for a record with
`kind: "microapp"` and `microappId` set.

#### S02 — Dynamic command registration (owner: wibwob1) — DONE (aeb76d2)
- [x] Add `addDynamic(def: DynamicCommandDefinition)` to `CommandRegistry`
- [x] Dynamic commands appear in `list()`, `buildMenus()`, `buildPalette()`
- [x] Dynamic commands executable via `run()`

AC-S02: A dynamically registered command appears in all projection surfaces.
Test: Register a test command via `addDynamic()`. Verify it appears in
`list("agent")`, `list("api")`, and is runnable via `run()`.

#### S03 — Dynamic snapshot registration (owner: wibwob1) — DONE (aeb76d2)
- [x] Add `registerDynamicSnapshot()` to `src/core/snapshot-registry.ts`
- [x] `registryRestore()` checks dynamic handlers before warn-and-skip
- [x] `registrySerialize()` checks dynamic handlers for unknown appTypes

AC-S03: A dynamically registered snapshot handler saves and restores.
Test: Register a test handler. Create a window with matching appType.
Verify `registrySerialize()` calls the handler. Verify `registryRestore()`
calls the handler on a snapshot with that appType.

#### S04 — MicroappHost implementation (owner: wibwob2) — DONE
- [x] `MicroappHost` interface in `src/services/module-loader.ts`
- [x] `MicroappWindowHandle` wrapper over `WindowRecord`
- [x] `createWindow()` sets `kind: "microapp"` and `microappId`
- [x] `describeState()` host-enforced, injects `appType` from manifest
- [x] `registerCommand()` wraps `CommandRegistry.addDynamic()`
- [x] `registerSnapshot()` wraps `registerDynamicSnapshot()`
- [x] `runCommand()` wraps `CommandRegistry.run()` scoped to module namespace
- [x] Module loader calls `setup()` for `type: "microapp"` manifests

AC-S04: A microapp module in `modules/` is discovered, loaded, and its
window appears in menus, palette, and agent tools.
Test: Create a minimal test microapp. Start app. Verify command appears
in `GET /commands/list`. Execute via `POST /commands/run`. Verify window
opens with correct `appType` in `GET /state`.

### F03 — Poetry Clock Microapp

Status: in-progress

A microapp module that displays a new AI-generated poem containing the
current time every minute. Inspired by Poem/1 (Matt Webb / Acts Not Facts).

Lives in: `modules/wibwob-poetry-clock/`

#### S05 — Static poetry clock (no LLM) — DONE
- [x] `module.json` manifest with `type: "microapp"`
- [x] `index.ts` entry point with `setup(host)` default export
- [x] Window displays current time as formatted text
- [x] Timer ticks every 30 seconds, updates display
- [x] `cleanup()` clears interval on close
- [x] `onRestyle()` respects theme changes
- [x] `describeState()` reports time, mode, currentPoem
- [x] Pre-baked poem bank: 60 plain, 20 liminal, 20 scramble poems
- [x] Mode selector: [m] key or click to cycle plain/liminal/scramble
- [x] Workspace snapshot: saves and restores mode

AC-S05: Poetry clock opens, ticks, themes, cleans up, and reports state.
Test: Open via command. Verify `GET /state` shows appType
`wibwob.poetry-clock`. Wait 60s, verify content changed. Close window,
verify no leaked intervals. Change theme, verify clock restyles.

#### S06 — Live poem generation via Claude Code SDK
- [ ] Claude Code SDK (TS v2 preview) installed: `@anthropic-ai/claude-code`
- [ ] Subprocess worker pattern: spawn worker, send prompt via stdin, read poem from stdout
- [ ] Prompt template: time, mode (plain/liminal/scramble), voice (Wib/Wob)
- [ ] Fallback: if SDK unavailable or auth missing, use pre-baked bank
- [ ] Rate limiting: one call per minute max, cache result for that minute
- [ ] Generated poem replaces pre-baked content in display

AC-S06: Live poems generated every minute using Claude Code SDK.
Test: Open clock in live mode. Verify poem contains current time.
Verify poem changes each minute. Kill claude auth — verify fallback
to pre-baked bank with status indicator.

#### S07 — Workspace persistence
- [ ] `registerSnapshot()` saves mode and last poem
- [ ] Restore reopens clock in saved mode with last poem displayed
- [ ] If live mode, generates fresh poem on restore

AC-S07: Poetry clock round-trips through workspace save/restore.
Test: Open clock, set mode to liminal. Save workspace. Close clock.
Restore workspace. Verify clock reopens in liminal mode.

### F04 — Primitives Library (Phase 2)

Status: not-started

Optional building blocks extracted from existing window factories for
microapp authors. Ships after 2-3 real microapps reveal which patterns
actually repeat.

| Primitive | Extracted from | Purpose |
|-----------|---------------|---------|
| ScrollablePane | content-windows.ts viewer | scrollable text, vim keys |
| AnimatedCanvas | misc-windows.ts pattern window | frame-based animation |
| InputBar | text-windows.ts editor | single-line text input |
| StatusBar | monster-cam-window.ts | bottom row with key hints |
| ButtonRow | monster-cam-window.ts | row of clickable buttons |

- [ ] Extract primitives from existing windows
- [ ] Package as importable building blocks
- [ ] Document with examples
- [ ] Poetry clock refactored to use primitives as validation

AC-F04: At least 3 primitives extracted and used by the poetry clock.
Test: Poetry clock imports primitives instead of raw blessed. Typecheck
passes. Clock still works.

## Dependencies

- F01 (theme loader) — done, landed
- F02 S01-S03 (type system, command registry, snapshot registry) — owner: wibwob1
- F02 S04 (microapp host) — owner: wibwob2, depends on S01-S03
- F03 (poetry clock) — depends on F02
- F04 (primitives) — depends on F03 shipping + usage patterns emerging
- Claude Code SDK TS v2 preview: `@anthropic-ai/claude-code` — needed for F03 S06
  - Docs: https://platform.claude.com/docs/en/agent-sdk/typescript-v2-preview.md
  - No API key required — uses authenticated Claude session
  - Subprocess worker pattern to avoid recursive SDK invocation

## Open Questions

1. **Security boundary.** Microapp code runs in-process with full blessed/fs
   access. Acceptable for modules-private. Future public modules may need
   sandboxing.

2. **Dependencies.** Can a microapp use npm packages? Bun resolves from the
   module directory with its own node_modules. Needs testing.

3. **Versioning.** Manifest should declare `hostApiVersion` for forward
   compatibility when MicroappHost API changes.

4. **Poetry voice.** Should the prompt alternate Wib/Wob lines, or should
   each minute randomly pick a voice? Or both as a mode option?

5. **Poem format.** Couplet? Haiku? Free form? Should the prompt constrain
   the format or let the LLM decide? Poem/1 uses rhyming couplets — do we
   follow suit or go stranger?

## Estimated Effort

| Feature | Sessions | Notes |
|---------|----------|-------|
| F01 Theme loader | 1 | Done |
| F02 Microapp host | 2 | Split across wibwob1 + wibwob2 |
| F03 Poetry clock | 2 | S05 static ~1 session, S06 live ~1 session |
| F04 Primitives | 2 | Deferred until patterns emerge |
| **Total** | **~7** | F04 is stretch |
