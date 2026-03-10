---
id: S20
epic: E031
title: API endpoint surface rename
status: done
branch: epic/e031-ui-primitives-brand
---

# S20 — API endpoint surface rename

## What and why

Apply targeted endpoint renames in control API for clearer public naming and update dependent docs/skills so callers stay aligned (AC-21).

## Acceptance criteria

- [ ] AC-21: Route renames from brief are applied (`/view/agent/open`, `/view/reader/open`, `/view/companion/compact`, `/view/generative-art/open`).
- [ ] Existing docs/skills/callers referencing old routes are updated.
- [ ] `GET /help` reflects the new endpoint surface.
- [ ] AC-26: `bun run typecheck` passes.

## Files to change

- `src/services/control-api.ts` — route string updates
- `.agents/control-api.md` and relevant skill/docs references — endpoint updates

## Tasks

- [ ] T1: Rename API routes per brief mapping.
- [ ] T2: Update all in-repo caller references (docs + skills + scripts).
- [ ] T3: Verify `/help` advertises new paths.
- [ ] T4: Run `bun run typecheck`.
