---
id: S24
epic: E031
title: File manager shared key dispatch
status: not-started
branch: epic/e031-ui-primitives-brand
---

# S24 — File manager key dispatch helper

## What and why

Extract duplicated mode-key routing in list/icon views into one dispatcher to guarantee command parity across modes (AC-29).

## Acceptance criteria

- [ ] AC-29: Shared `dispatchFileManagerKey(mode, key)` (or equivalent) replaces duplicated key branch blocks.
- [ ] Keys `v`, `/`, `s`, `backspace`, `tab` behave identically in both modes.
- [ ] Future key additions require one change path.
- [ ] AC-26: `bun run typecheck` passes.

## Files to change

- `src/windows/content-windows.ts`

## Tasks

- [ ] T1: Extract duplicated key-branch logic into a shared dispatch function.
- [ ] T2: Route both list-view and icon-view handlers through dispatcher.
- [ ] T3: Smoke key behavior in both modes for parity.
- [ ] T4: Run `bun run typecheck`.
