# Autoresearch: Journal JRN/LOG Toggle UI

## Objective

Make the journal window's two view modes — **Journal** (structured entries) and
**Log** (raw pi session browser) — first-class with a visible toggle in the chrome,
then iterate on rendering quality, interaction feel, and visual polish.

Currently the `S` key silently switches `viewMode` between `"journal"` and `"sessions"`.
Users don't know the mode exists. v4 adds a visible `JRN · LOG` indicator in the
top-right of the window, with accent color on the active mode and muted on the inactive.

### What each view does

**JRN view** (current default):
- Structured entries with CRUD (create, read, edit, delete)
- Two-pane: list + preview at wide breakpoints
- Date group headers, sort (updated/created/title), search, tags
- Kind icons, peer glyphs, time-ago labels

**LOG view** (session browser):
- Raw pi agent session JSONL files from `~/.pi/agent/sessions/`
- Two-pane: session list + conversation preview
- Read-only — no editing
- Role-colored messages (human = accent, agent = muted), tool call summaries
- Date headers by session date

### The toggle

Top-right of the journal window body (not chrome title — inside the content area):
`JRN · LOG` with the active mode in accent color and the inactive in muted.
Keyboard: `S` to switch. Mouse: click the label to toggle.

Design: **Option B** — `JRN · LOG` with accent highlight on active, muted on inactive.
Minimal, consistent with existing aesthetic.

### Backlinks

Auto-captured entries (future Feature 1) will link back to their source session via
`meta.sessionId`. In JRN view, auto-captured entries show a `⚡` icon. Pressing a key
jumps to LOG view filtered to that session. (Backlink wiring is in scope; auto-capture
pipeline is NOT — that's a separate spike.)

## Metrics

- **Primary**: `ui_quality` (0–100, higher is better) — composite heuristic:
  - Toggle visibility (15 pts): indicator renders in correct position, readable
  - Mode switching (20 pts): S key and click both work, state updates correctly
  - JRN view rendering (20 pts): list items, date headers, two-pane preview all render
  - LOG view rendering (20 pts): session list, conversation preview, role colors
  - Theme compliance (15 pts): uses `host.theme()` colors, responds to restyle
  - State reporting (10 pts): `describeState()` reports correct viewMode
- **Secondary**: `render_time_ms`, `memory_delta_kb`

## How to Run

```bash
cd autoresearch && ./autoresearch.sh
```

Outputs `METRIC name=number` lines. Runs the app, opens journal, exercises both
modes via the control API, scores the results.

## Agent Setup

This loop relies on the **ops subagent** (`.pi/agents/ops.md`) for verification:

- `wibwob restart` after code changes
- `wibwob cmd wibwob.journal.open` to open the journal
- `wibwob state | jq '.windows[]'` to verify window state
- `wibwob read <id>` to capture rendered text for scoring
- `wibwob map` for spatial overview
- `bun run typecheck` for type safety

## Files in Scope

| File | Purpose |
|------|---------|
| `microapps/journal/index.ts` | Journal microapp — all UI code lives here |
| `microapps/journal/microapp.json` | Microapp manifest |

## Off Limits

- `src/` — no shell internals changes
- Session JSONL files — read-only
- Other microapps
- Auto-capture / summarisation pipeline (separate spike)

## Constraints

- `bun run typecheck` must pass
- Must work at both narrow (<120 col) and wide (≥120 col) breakpoints
- Toggle must be keyboard-accessible (S key) and mouse-clickable
- Must respect theme changes (onRestyle callback)
- `describeState()` must report the active viewMode
- No new dependencies

## What's Been Tried

_Nothing yet — baseline run pending._
