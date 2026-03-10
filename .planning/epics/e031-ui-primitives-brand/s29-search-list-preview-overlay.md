---
id: S29
epic: E031
title: Search/list/preview overlay helper
status: not-started
branch: epic/e031-ui-primitives-brand
---

# S29 — createSearchListPreviewOverlay helper

## What and why

Unify duplicated split-browser overlay internals in `overlay-manager.ts` with a shared private helper used by both browser prompt variants (AC-34).

## Acceptance criteria

- [ ] AC-34: Private `createSearchListPreviewOverlay()` helper exists and is used by `openBrowserPrompt` and `openFileBrowserPrompt`.
- [ ] Duplicated focus/jump/search/list keypress internals are centralized.
- [ ] Behavior of both public prompts is unchanged.
- [ ] AC-26: `bun run typecheck` passes.

## Files to change

- `src/core/overlay-manager.ts`

## Tasks

- [ ] T1: Extract common modal/search/list/preview shell into private helper.
- [ ] T2: Rewire both public prompt APIs to use shared helper.
- [ ] T3: Smoke both prompt types for behavior parity.
- [ ] T4: Run `bun run typecheck`.
