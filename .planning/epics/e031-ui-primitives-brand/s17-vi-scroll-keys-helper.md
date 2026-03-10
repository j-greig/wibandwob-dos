---
id: S17
epic: E031
title: Vi scroll keys helper
status: not-started
branch: epic/e031-ui-primitives-brand
---

# S17 — Vi scroll key bindings helper

## What and why

Extract repeated custom scroll key wiring (`j/k/g/G/d/u`) into a shared helper and migrate non-list scroll boxes to it (AC-18).

## Acceptance criteria

- [ ] AC-18: Shared `bindScrollKeys` helper exists and is used by targeted custom scrollable boxes.
- [ ] Duplicated per-window vi key registration blocks are removed.
- [ ] Scroll behavior parity is preserved.
- [ ] AC-26: `bun run typecheck` passes.

## Files to change

- Helper location in core UI utilities (per implementation choice)
- Window files currently hand-wiring vi scroll keys (per P08 audit)

## Tasks

- [ ] T1: Implement `bindScrollKeys(widget, box)` helper with existing key map.
- [ ] T2: Migrate repeated key-binding blocks to helper calls.
- [ ] T3: Smoke scroll interactions on migrated windows.
- [ ] T4: Run `bun run typecheck`.
