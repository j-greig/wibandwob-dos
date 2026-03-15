# Journal v2 — Autoresearch Brief

## Objective

Rebuild the Symbient Journal as a proper entry-based journal app with list,
read, edit, and create modes. Two-pane layout at wide breakpoints.

## Primary Metric

`journal_score = feature_score (0–60) + ui_score (0–40)`

Higher is better.

### Feature score (60 pts max)

| Version | Points | Features |
|---------|--------|----------|
| MVP — List + Read | 10 | entry list, detail view, create entry, nav, persistence |
| v1 — Edit + Delete | 12 | edit entry, delete, metadata display, search, keyboard shortcuts |
| v2 — Rich List | 12 | two-pane layout, responsive, sort, stats, relative timestamps |
| v3 — Agent Integration | 10 | create/read/update/list/delete commands (direct:true), describeState |
| v4 — Polish | 8 | tags, kind icons, figlet, word wrap, markdown-lite rendering |
| v5 — Power Features | 8 | export, import from v1, linked entries, templates, workspace persist |

### UI + UX score (40 pts max)

| Axis | Max | What it measures |
|------|-----|-----------------|
| LAYOUT | 6 | Two-pane balance, responsive breakpoints, no dead zones |
| READABILITY | 6 | Entry list scannable, body text legible, clear hierarchy |
| AESTHETIC | 5 | Theme coherence, visual interest, deliberate design |
| COHERENCE | 5 | Consistent across all modes (list/read/edit/new) |
| CHARACTER | 5 | Personality, WibWob-ness, not generic |
| USABILITY | 6 | Keyboard flow, mode transitions, input feels natural, mouse support |
| AGENT_XP | 7 | CRUD commands return structured data, describeState useful, fully operable without TUI |

## How to Run

```bash
bash autoresearch.sh
```

## Scoring Discipline

- Score UI against rubric, not expectations
- 4 = competent default, below 3 = bad, above 6 = genuinely good
- Feature checks are binary
- Don't inflate scores to hit targets

## Files in Scope

- `microapps/journal/microapp.json`
- `microapps/journal/index.ts` (rewrite)
- `scratch/journal-v2/entries/*.json` (entry storage)
- `scratch/journal-v2/index.json` (entry index)

## Off Limits

- `src/` — shell internals
- Other `microapps/` directories
- Theme files, SDK source

## Constraints

- `bun run typecheck` must pass
- No new npm dependencies
- All imports from `../../src/services/microapp-sdk.js`
- Use `host.theme()` tokens only
- Old v1 `scratch/journal.jsonl` data must still exist (v1 import feature reads it)
- `scripts/restart.sh` required for TS changes (not microapps.reload)

## Iteration Order

1. MVP: entry list + detail view + create
2. Edit + delete + search
3. Two-pane responsive layout
4. Agent CRUD commands
5. Visual polish (figlet, icons, tags, markdown rendering)
6. Power features (export, import, templates, workspace)
