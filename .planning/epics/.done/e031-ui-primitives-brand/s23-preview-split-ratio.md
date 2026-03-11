---
id: S23
epic: E031
title: Preview split ratio constant
status: not-started
branch: epic/e031-ui-primitives-brand
---

# S23 — PREVIEW_SPLIT_RATIO constant

## What and why

Replace repeated 34%/36% preview split magic numbers with a single named constant to prevent drift and simplify tuning (AC-28).

## Acceptance criteria

- [ ] AC-28: `PREVIEW_SPLIT_RATIO` constant is introduced in `content-windows.ts`.
- [ ] 10 inline ratio literals are replaced with the constant.
- [ ] File manager preview layout remains unchanged.
- [ ] AC-26: `bun run typecheck` passes.

## Files to change

- `src/windows/content-windows.ts`

## Tasks

- [ ] T1: Add `PREVIEW_SPLIT_RATIO` constant near file-level layout constants.
- [ ] T2: Replace inline split literals with constant usage.
- [ ] T3: Smoke file manager preview pane sizing.
- [ ] T4: Run `bun run typecheck`.
