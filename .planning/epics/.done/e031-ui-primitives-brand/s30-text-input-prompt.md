---
id: S30
epic: E031
title: Shared text-input prompt helper
status: not-started
branch: epic/e031-ui-primitives-brand
---

# S30 — openTextInputPrompt helper

## What and why

Deduplicate `openValuePrompt` and `openPathPrompt` lifecycle code via a shared private `openTextInputPrompt` helper in overlay manager (AC-35).

## Acceptance criteria

- [ ] AC-35: Private `openTextInputPrompt({ onSubmit, completion? })` helper exists.
- [ ] `openValuePrompt` and `openPathPrompt` reuse shared lifecycle logic.
- [ ] Completion-specific behavior remains intact for path prompt.
- [ ] AC-26: `bun run typecheck` passes.

## Files to change

- `src/core/overlay-manager.ts`

## Tasks

- [ ] T1: Extract shared modal/input/button-bar lifecycle into helper.
- [ ] T2: Refactor value/path prompt methods to delegate to helper.
- [ ] T3: Smoke both prompt flows (with and without completion).
- [ ] T4: Run `bun run typecheck`.
