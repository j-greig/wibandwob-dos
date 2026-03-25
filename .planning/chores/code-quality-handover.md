# Handover — Code Quality Refactor

Branch: `claude/plan-refactor-code-quality-uLyOn` — pushed, 20 commits.

## What's done

18 refactor commits across 14 files. Highlights:
- `src/core/arg-helpers.ts` — `typedArg`/`trimmedArg`/`enumArg`/`clampedArg` replacing 75+ typeof guards
- `src/ui/index.ts` — `getSelectedIndex()` replacing 40+ cast patterns across 6 files
- `src/services/control-api.ts` — 674-line if-chain replaced with typed route table (69 lines, derived catalogue)
- `src/services/terrain-render.ts` — 18 named constants, glyph maps hoisted to module scope
- `src/services/chrome-browser-service.ts` — `navigate()` decomposed into 5 named pipeline stages
- `src/sdk/composition-helpers.ts` — `scrollbarConfig()` extracted (4× dedup), `t2` → `current`
- `src/windows/music-player-viz.ts` — viz modes extracted from music-player-window (1227 → 848 LOC)
- `src/core/command-catalog.ts` — IIFE extracted into named menu builders
- `src/services/wibwob-agent-session.ts` — `initialize()` split into named phases
- 3 API routes (focus/close/maximize) wired through command registry

All checks green: typecheck ✅, COAT ✅, integration tests (no new failures) ✅.

## What's next — execute the C4-C7 plan

**Plan location:** `scratch/plans/2026-03-25-coat-command-gaps.md`

Read that plan. It has phased steps with checkboxes. The short version:

1. **Add 2 new actions** to app-controller: `windowInput`, `agentMessage` (thin wrappers around `sendInput` that return `{ ok }` / `{ ok: false, error }`)
2. **Fix 2 existing actions**: `saveWorkspace` and `loadWorkspace` — return `RuntimeWorkspaceResult` instead of void
3. **Add 2 new commands** to command-catalog: `window.input`, `window.agent-message`
4. **Rewire 4 API routes** in control-api.ts from `post` handlers to `commandId` dispatch
5. **Update planning doc** — mark C5+C6 done, C4+C7 as "by design"
6. **Optional**: fix the editor.write description confusion (append vs replace)

**Do NOT touch C4 or C7** — they're correct architecture, not gaps. The plan explains why.

After that: branch is ready to PR into main. The planning doc `.planning/chores/code-quality-refactor.md` tracks everything.

## Context files to read first

```
cat .planning/chores/code-quality-refactor.md   # full task tracker
cat scratch/plans/2026-03-25-coat-command-gaps.md  # the plan to execute
cat .planning/spikes/control-api-refactor-options.md  # why route table, not Hono
```
