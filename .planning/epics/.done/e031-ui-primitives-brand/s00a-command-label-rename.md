---
id: S00A
epic: E031
title: Command label rename (N01)
status: done
branch: epic/e031-ui-primitives-brand
---

# S00a - Command label rename

## What and why

Apply the E031 naming convention to user-facing command labels in `src/core/command-catalog.ts` so menus and palette read like one intentional WibWob-DOS surface (AC-0a). This is a low-risk, high-visibility string-only pass and ships first in F00.

## Acceptance criteria

- [x] AC-0a: Rename table from E031 is fully applied in `command-catalog.ts` (including removal of the internal/debug "Open Backrooms TV (with args)" label).
- [x] Menu bar and command palette show the new labels exactly as defined in the brief.
- [x] AC-26: `bun run typecheck` passes after the rename pass.

## Files to change

- `src/core/command-catalog.ts` - update command labels and remove/retire debug-only label surface
- `src/core/app-controller.ts` (if needed) - verify any label-dependent wiring remains correct

## Tasks

- [x] T1: Apply all label renames from S00a rename table in the brief.
- [x] T2: Remove the internal/debug "Open Backrooms TV (with args)" command label surface.
- [x] T3: Smoke menu + palette labels for visual correctness.
- [x] T4: Run `bun run typecheck`.
