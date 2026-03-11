---
id: S00B
epic: E031
title: Module ID normalisation (N02)
status: done
branch: epic/e031-ui-primitives-brand
---

# S00b — Module ID normalisation

## What and why

Normalise production module IDs to `wibwob.slug` across module manifests and call sites so module identity, workspace restore, and state reporting are consistent (AC-0b). Display titles remain unchanged.

## Acceptance criteria

- [x] AC-0b: Module IDs are renamed per the brief (`world-chatroom→wibwob.chatroom`, `wibwobworld→wibwob.world`, `patchbay.lab→wibwob.patchbay`, `touchlab.mvp→wibwob.touchlab`, `example.hello-world→wibwob.example.hello`, `wibwob.e026-demo→wibwob.example.e026`).
- [x] Module reload still works via command flow after ID changes.
- [x] `GET /state` shows the normalised IDs via state service.
- [x] AC-26: `bun run typecheck` passes.

## Files to change

- `modules/*/module.json` (target modules listed in brief) — update `id` fields
- `src/services/state-service.ts` and module-loading references (if needed) — ensure IDs flow through state correctly
- Docs/skills referencing old IDs (if any) — update references

## Tasks

- [x] T1: Update target `module.json` IDs to the new canonical `wibwob.slug` names.
- [x] T2: Update any code/docs references that still point at old IDs.
- [x] T3: Reload modules and verify commands still appear/execute.
- [x] T4: Verify `GET /state` returns new IDs.
- [x] T5: Run `bun run typecheck`.
