# Symbient Journal — Autoresearch Plan

## Objective

Iterate through the Journal feature plan (MVP → v5) using the autoresearch loop.
Each experiment implements one feature slice, verifies it works, and scores progress.

## Primary Metric

**`journal_score`** (0–100, higher is better)

Composite of feature checks across all planned versions. Each check is worth
points proportional to its version tier (earlier = more foundational weight).

## Scoring Breakdown

### MVP features (already landed — 15 pts baseline)
| Check | Points | Description |
|-------|--------|-------------|
| microapp.json exists & valid | 2 | Manifest with correct id, menu, entry |
| index.ts exports default setup | 2 | Entry point loads |
| .jsonl persistence | 3 | Entries append to scratch/journal.jsonl |
| Human input line | 3 | Input box submits entries |
| describeState + captureText | 3 | Lifecycle hooks present |
| System entries | 2 | System peer entries logged |

### v1 — Agent parity (20 pts)
| Check | Points | Description |
|-------|--------|-------------|
| `journal.append` command exists | 5 | direct:true command registered |
| Agent entries tagged `[A]` | 5 | peer:"agent" renders distinctly |
| Peer visual distinction | 5 | Different styling per peer type |
| Auto-scroll on new entry | 3 | Log scrolls to bottom |
| describeState has lastEntry + count | 2 | Structured metadata |

### v2 — Rich rendering & navigation (20 pts)
| Check | Points | Description |
|-------|--------|-------------|
| Day dividers | 4 | Visual separator between days |
| Peer prefix icons | 3 | [H] [A] [S] or equivalent |
| Keyboard nav (j/k, g/G) | 4 | Scroll through entries |
| Search/filter | 5 | Filter by peer or text |
| Relative timestamps | 2 | "2m ago" style |
| Word-wrap | 2 | Entries wrap to window width |

### v3 — Persistence & workspace (15 pts)
| Check | Points | Description |
|-------|--------|-------------|
| persist: true in manifest | 3 | Survives workspace save/restore |
| registerSnapshot | 4 | Scroll position + filter restored |
| Multiple journals | 4 | Switch between named journal files |
| Export as markdown | 4 | Command to export .md |

### v4 — Provenance & metadata (15 pts)
| Check | Points | Description |
|-------|--------|-------------|
| Entry types (observation/decision/etc) | 4 | Structured entry kinds |
| Tags/labels on entries | 3 | Freeform tagging |
| Actor metadata field | 3 | Seeds peer-provenance model |
| Collapsible day groups | 3 | Grouped rendering |
| Status bar with stats | 2 | Entry count, peer breakdown |

### v5 — Composition & ambient (15 pts)
| Check | Points | Description |
|-------|--------|-------------|
| describeState exposes latest + stats | 3 | Patchbay-ready output |
| Ambient mode (compact window) | 4 | Small sticky last-3 view |
| Summarize command | 4 | Agent summarizes journal |
| Linked entries | 4 | Reference other entries by id |

## Checks Gate

Before scoring, the following must pass:
1. `bun run typecheck` — no new errors from journal code
2. Microapp loads without stderr errors after `microapps.reload`
3. Window opens and renders via API

## Iteration Strategy

Each experiment = one feature slice from the plan above.
Work version-by-version, top-to-bottom.
Don't skip ahead — each version builds on the previous.

MVP is already landed (baseline ~15 pts). Start from v1 features.

## Suggested iteration order

1. Add `journal.append` direct command (v1)
2. Add peer visual distinction with color (v1)  
3. Add auto-scroll + structured describeState (v1)
4. Add day dividers between entries (v2)
5. Add keyboard navigation j/k/g/G (v2)
6. Add search/filter by peer or text (v2)
7. Add relative timestamps (v2)
8. Add word-wrap (v2)
9. Add persist:true + registerSnapshot (v3)
10. Add multiple journal support (v3)
11. Add markdown export command (v3)
12. Add entry types (v4)
13. Add tags (v4)
14. Add actor metadata (v4)
15. Add collapsible groups + status bar (v4)
16. Add ambient mode (v5)
17. Add summarize command (v5)
18. Add linked entries (v5)

## File inventory

- `microapps/journal/microapp.json` — manifest
- `microapps/journal/index.ts` — entry point (will grow, may split)
- `scratch/journal.jsonl` — default journal data file
- `autoresearch/journal/plan.md` — this file
- `autoresearch/journal/score.sh` — scoring script
