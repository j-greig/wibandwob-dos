---
id: S01
epic: E031
title: Sidebar primitive (createSidebarPanel)
status: done
branch: epic/e031-ui-primitives-brand
---

# S01 — createSidebarPanel in ui-parts.ts

## What and why

Create a shared sidebar primitive for fixed/percent sidebars with overflow protection so every consumer uses one width/layout path (AC-2, AC-3). Export through SDK for module use.

## Acceptance criteria

- [ ] AC-2: `createSidebarPanel` is implemented in `ui-parts.ts` with the interface from the brief and exported via SDK.
- [ ] AC-3: Width resolution supports fixed and percent+min/max, including overflow guard against `mainMinWidth`.
- [ ] `toggle`, `setOpen`, `isOpen`, `layout`, `sidebarWidth`, and `mainWidth` behave per spec.
- [ ] AC-26: `bun run typecheck` passes.

## Files to change

- `src/core/ui-parts.ts` — add `SidebarPanelOptions` + `createSidebarPanel` implementation
- `src/microapp-sdk.ts` — export the new primitive

## Tasks

- [ ] T1: Implement sidebar width resolution (`fixed` and `percent` with clamp).
- [ ] T2: Add overflow guard logic (`resolved + divider + mainMinWidth <= total`).
- [ ] T3: Implement open/close/toggle/layout APIs and divider handling.
- [ ] T4: Export via `microapp-sdk.ts` and run `bun run typecheck`.
