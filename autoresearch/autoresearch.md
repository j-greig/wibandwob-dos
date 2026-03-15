# Autoresearch: Journal JRN/LOG Toggle UI

## Objective

Polish the journal window's **JRN/LOG toggle** and **LOG session browser view**.
The toggle and basic mode switching already work. Now iterate on visual quality,
interaction feel, and information density.

## Metrics

- **Primary**: `ui_quality` (0–100, higher is better) — composite heuristic across
  toggle visibility, mode switching, JRN rendering, LOG rendering, theme, state reporting
- **Secondary**: `jrn_has_toggle`, `log_has_role_glyphs`, `log_has_tool_calls`

## How to Run

```bash
cd autoresearch && ./autoresearch.sh
```

Requires the app running in tmux session `journal`. Outputs `METRIC name=number` lines.

## Files in Scope

| File | Purpose |
|------|---------|
| `microapps/journal/index.ts` | Journal microapp — all UI code |

## Off Limits

- `src/` — no shell internals
- Other microapps
- Session JSONL files (read-only)

## Constraints

- `bun run typecheck` must pass
- Must work at narrow (<120 col) and wide (≥120 col) breakpoints
- Keyboard shortcuts must work (S toggle, m model filter, j/k nav)
- Must respect theme changes
- No new dependencies

## What's Been Tried

### Baseline (commits f3d87482 → f90eb164)
- Added toggleBox as blessed.box with blessed tags — invisible on dark themes (muted color lost against bg)
- Replaced with SDK createButton — **broke all keyboard shortcuts** because buttons set focusable:true
- Fixed: plain blessed.box with focusable:false, mouse:true, click handlers refocus listBox
- Added model extraction from session JSONL (model_change events)
- Added m key to cycle model filter in LOG view
- Current state: toggle works, both views render, keyboard works

### Known issues to improve
- Toggle contrast could be stronger on some themes
- LOG view conversation preview is raw text dump — could be more structured
- Session list only shows 2 sessions (this worktree has few) — test with more
- No visual feedback on mode switch (instant jump, no transition cue)
- Command bar hints could show S key more prominently
