# Journal v4 Spike — Agent Auto-Journal & Dual View

## Status: IN-PROGRESS — autoresearch loop on Feature 2 (JRN/LOG toggle)

**Branch:** `spike/spk-journal-v4-auto-journal`
**Worktree:** `~/Repos/wibandwob-dos-journal-v4`
**Autoresearch:** `autoresearch/` — iterating on toggle UI quality

---

## Core Concept

The Symbient Journal already has two data sources:
1. **Structured entries** — human/agent-authored journal entries (CRUD, tags, kinds)
2. **Raw session logs** — pi agent JSONL files in `~/.pi/agent/sessions/`

v3 added a session viewer (S toggle), but the two modes are disconnected.
v4 bridges them: the agent auto-creates journal entries from its own sessions,
and the UI makes the two views first-class with a visible toggle.

---

## Feature 1: Auto-Journal from Agent Sessions

When a pi agent session ends (or on demand), automatically create a structured
journal entry summarising what the agent did:

- **Title**: derived from the first user message or task
- **Body**: LLM-summarised decisions, files changed, blockers, outcomes
- **Tags**: auto-extracted from file paths, tools used, topics
- **Kind**: `discovery` or new `session-summary` kind
- **Metadata**: `sessionId` backlink to the raw JSONL log
- **Peer**: `agent`

### Implementation paths

| Approach | Trigger | Pros | Cons |
|----------|---------|------|------|
| Watch `~/.pi/agent/sessions/` | File close/new file | Fully automatic | Needs fs watcher, noisy |
| `journal.auto-capture` command | Manual/API | Explicit, controllable | Not automatic |
| Post-session hook | Pi SDK callback | Clean integration | Depends on pi internals |
| Periodic scan | Timer | Simple | Delayed, may miss sessions |

**Recommended**: Start with `journal.auto-capture` command that scans for new
sessions since last capture. Add watch mode later.

### Entry shape

```json
{
  "id": "...",
  "title": "Refactored window chrome sizing",
  "body": "## Summary\n\nFixed chrome math...\n\n## Files Changed\n- src/core/window-chrome.ts\n...",
  "kind": "discovery",
  "peer": "agent",
  "tags": ["session", "auto-captured", "window-chrome"],
  "meta": {
    "sessionId": "abc123",
    "sessionFile": "2026-03-15T10-28-32.jsonl",
    "capturedAt": "2026-03-15T11:00:00Z"
  }
}
```

---

## Feature 2: Journal / Log Toggle in UI

Top-right of the journal window: two visible buttons or a toggle indicator
that switches between **Journal view** and **Log view**.

### Journal View (current default)
- Structured entries with CRUD
- Two-pane: list + preview
- Date headers, sort, search, tags
- Edit mode, create new entries

### Log View (raw session browser)
- Raw pi agent session JSONL files
- Two-pane: session list + conversation preview
- Read-only — no editing
- Role-colored messages, tool call summaries
- Date headers by session date

### Toggle UI

```
┌─ Journal ──────────────────────────────────────────────────┐
│  JRN / LOG                                    ← top-right │
│  ^^^^^^^^                                                  │
│  Two buttons: JRN (active/highlighted) and LOG (muted)     │
│  Click or keyboard shortcut (S) to switch                  │
│  Active button uses accent color, inactive uses muted      │
└────────────────────────────────────────────────────────────┘
```

Currently this is the `S` key toggle between `viewMode: "journal"` and
`viewMode: "sessions"`. v4 makes it visible in the chrome.

### Design options

| Option | Description |
|--------|-------------|
| A: Text buttons | `[JRN]  LOG` / `JRN  [LOG]` — brackets show active |
| B: Highlighted text | `JRN · LOG` with accent on active, muted on inactive |
| C: Tab-style | `┌JRN┐ LOG` — tab underline on active |

**Recommended**: Option B — minimal, consistent with existing aesthetic.

---

## Relationship between features

```
┌──────────────┐     auto-capture      ┌──────────────┐
│  Raw Session │ ──────────────────▶   │   Journal    │
│  JSONL Logs  │     (summarise)       │   Entries    │
└──────┬───────┘                       └──────┬───────┘
       │                                      │
       │  LOG view                   JRN view │
       │                                      │
       └──────────┐    ┌──────────────────────┘
                  ▼    ▼
            ┌─────────────┐
            │  Journal UI │
            │  JRN / LOG  │
            └─────────────┘
```

Auto-captured entries link back to their source session via `meta.sessionId`.
In JRN view, auto-captured entries show a `⚡` icon. Clicking the backlink
(or pressing a key) jumps to the LOG view filtered to that session.

---

## Out of Scope (for now)

- Session search/filter
- Cross-session analytics (time spent, tools used frequency)
- Multi-repo session aggregation
- Real-time streaming of active sessions
- Edit/annotate raw session logs

---

## Dependencies

- `renderMarkdown` from SDK (done)
- `readSession` / `listSessions` helpers (done in v3)
- LLM access for auto-summarisation (via pi agent tools or direct API)
- Entry storage (done — `scratch/journal-v2/entries/*.json`)
