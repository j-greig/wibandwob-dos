# Journal v3 — Markdown, Sort, Sessions

## Objective

Extend the Symbient Journal with markdown body rendering, sort/date controls,
and a pi session log viewer mode. All features COAT-compliant and SDK-aware.

## Primary Metric

`journal_score = feature_score (0–40) + ui_score (0–60)`

Higher is better.

### Feature score (40 pts max)

| Version | Points | Features |
|---------|--------|----------|
| F1 — Markdown Body | 10 | renderMarkdown in preview pane, renderMarkdown in read mode, heading styles, code blocks, horizontal rules, bullet lists |
| F2 — Sort & Date | 10 | sort toggle key (s), cycle updatedAt/createdAt/title, sort indicator in status bar, date group headers in list, index mapping for headers |
| F3 — Session Viewer | 14 | detect ~/.pi, session list view, session detail view, mode toggle key, session message rendering, role-colored blocks, tool call summaries |
| F4 — Integration | 6 | journal.sessions command, journal.session.read command, describeState includes view mode, Core Apps menu (done) |

### UI + UX score (60 pts max)

| Axis | Max | What it measures |
|------|-----|-----------------|
| MD_RENDER | 10 | Headings visually distinct, code blocks bordered, lists indented, rules visible, body text legible |
| LIST_UX | 10 | Date headers scannable, sort state clear, no dead zones, index mapping correct (selection skips headers) |
| SESSION_UX | 10 | Session list readable (date, id, preview), detail view clear (user/assistant blocks), tool calls summarised not dumped |
| COHERENCE | 10 | Consistent across journal mode and session mode, same chrome, same key patterns |
| LAYOUT | 10 | Two-pane works in both modes, responsive breakpoints maintained, no overflow |
| POLISH | 10 | Theme tokens throughout, no hardcoded colors, mode indicator clear, transitions smooth |

## How to Run

```bash
bash autoresearch.sh
```

## Scoring Discipline

- Score against rubric, not expectations
- Feature checks are binary (grep + API verification)
- UI axes: 0-3 bad, 4-6 competent, 7-8 good, 9-10 excellent
- Don't inflate scores to hit targets
- Don't overfit to benchmarks or cheat

## Files in Scope

- `microapps/journal/microapp.json`
- `microapps/journal/index.ts`
- `scratch/journal-v2/entries/*.json`

## Off Limits

- `src/` — shell internals (except reading SDK exports)
- Other `microapps/` directories
- Theme files, SDK source

## Constraints

- `bun run typecheck` must pass
- No new npm dependencies
- All imports from `../../src/services/microapp-sdk.js`
- Use `host.theme()` tokens only
- `scripts/restart.sh` required for TS changes (not microapps.reload)
- Session viewer only appears if `~/.pi` exists
- Session JSONL files can be large — lazy load, don't slurp all content upfront

## Iteration Order

1. Markdown body rendering (preview pane + read mode)
2. Sort toggle + status bar indicator
3. Date group headers with index mapping
4. Pi session list view
5. Pi session detail view
6. Session API commands + describeState
