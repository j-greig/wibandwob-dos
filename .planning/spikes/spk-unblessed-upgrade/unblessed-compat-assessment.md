---
title: unblessed compatibility assessment
spike: spk-unblessed-upgrade
date: 2026-03-10
status: notes
---

# unblessed compatibility assessment

Purpose: capture the narrow technical question explored during the unblessed sidetrack.

Question: if WibWob-DOS does not adopt unblessed as its canonical runtime, does the vendored library still contain anything operationally useful — either as a drop-in compatibility option or as a source of ideas worth porting back into the current Blessed codebase?

Primary external references:

- GitHub: https://github.com/vdeantoni/unblessed
- Intro docs: https://unblessed.dev/docs/getting-started/introduction
- Migration docs: https://unblessed.dev/docs/getting-started/migration-from-blessed

## Scope checked

This pass compared the broad claims around unblessed against the specific patterns WibWob-DOS uses heavily:

- `blessed.Widgets.*` type usage across `src/`
- direct `screen.render()` usage and the existing `render-monitor` seam
- `screen.program.hideCursor()` / `showCursor()` usage in the custom cursor path
- string-first grid and ASCII rendering rather than low-level internal Blessed buffers
- module and microapp architecture, especially the public authoring surface in `src/services/microapp-sdk.ts`
- Bun runtime compatibility at the level unblessed appears to require

Representative repo files/surfaces considered during this check:

- `src/core/app-controller.ts`
- `src/core/window-manager.ts`
- `src/core/editor-coordinator.ts`
- `src/core/render-monitor.ts`
- `src/services/module-loader.ts`
- `src/services/microapp-sdk.ts`
- `src/core/grid-canvas.ts`
- `modules/`
- `modules-private/`

## Findings

### 1. Compatibility claims look plausible for this repo

The main blessed patterns used by WibWob-DOS are conventional enough that the `@unblessed/blessed` compatibility layer appears likely to support them cleanly. The repo relies heavily on the classic Blessed factory style, widget namespace types, event handlers, explicit `setContent()` calls, and direct `screen.render()` commits. Nothing in the current code scan suggested a uniquely exotic Blessed dependency that would obviously block a drop-in experiment.

This is evidence for “migration may be feasible”, not evidence for “migration should become canon”.

### 2. Type compatibility is potentially useful even without migration

The strongest conceptual value is the stricter TypeScript posture. WibWob-DOS already wants more explicit state ownership, cleaner window contracts, and less hidden widget state. unblessed’s TS-first stance reinforces that direction. Even without adopting the runtime, we should continue tightening our own local model types, widget contracts, and state/reporting seams.

### 3. Cursor and low-level program usage do not look like blockers

The repo’s direct `screen.program` usage appears narrow: cursor hide/show for the custom cursor path. That suggests unblessed does not unlock a major new capability here. It mainly confirms that this part of the app is unlikely to be the migration blocker.

### 4. Render policy is the more important lesson than runtime swap

The repo’s deeper issue is not whether `screen.render()` exists in unblessed. It is that WibWob-DOS currently lets many layers decide independently when to commit a render. That weakens ownership and makes future performance work harder.

The real takeaway is architectural: introduce a clearer render/invalidation seam in our own code. That lesson is more valuable than the compatibility layer itself.

### 5. Cell-aware text handling is worth stealing conceptually

The repo has real Unicode and width-measurement pressure, especially in ASCII-adjacent art, ANSI-rich text, and private primers. If unblessed has stronger cell-aware or truncation-aware internals, that is useful as a design prompt. WibWob-DOS should treat text-to-cells behaviour as a first-class engine concern rather than just a per-window string problem.

This aligns with the existing planning follow-on around Unicode/cell-aware rendering.

### 6. Testing posture is worth stealing outright

The app needs better visual and behavioural regression evidence. If unblessed’s ecosystem is pushing harder on modern testing and visual verification, that is a good model to borrow. This repo needs stronger smoke coverage for themes, layout shifts, ANSI-heavy surfaces, overlapping windows, and live-updating windows — especially if long-term goals include very dense, animation-heavy, high-resolution desktop scenes.

### 7. Modularity remains a core first-impression feature

The shared and private modules are not secondary. They are demo surfaces for first-time testers and the public proof that WibWob-DOS is extensible. Any idea from unblessed that sharpens subsystem ownership, module host clarity, or authoring ergonomics is more relevant here than flashier features like React integration.

## Recommendation

Do not adopt unblessed as the canonical runtime on the basis of this assessment alone.

Do keep it as:

- a plausible future drop-in experiment if runtime momentum becomes trustworthy
- a source of ideas around strict typing, render/runtime seams, text-cell correctness, and testing discipline

## Steal now

- stricter local TypeScript contracts
- clearer render scheduling / invalidation ownership
- cell-aware text and truncation thinking
- stronger visual regression habits
- cleaner module-host boundaries

## Ignore for now

- React integration
- browser portability
- wholesale layout rewrite around flexbox
- full runtime migration as an architectural priority

## Why this matters to the main spike

The unblessed sidetrack sharpened the core conclusion of the main spike: WibWob-DOS does not currently need a new TUI runtime nearly as much as it needs calmer internal grammar inside the existing one.
