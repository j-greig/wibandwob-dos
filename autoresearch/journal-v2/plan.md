# Journal v2 — Proper Journal App

## What's Wrong with v1

v1 is a **chat log**, not a journal. You type one line, it appends forever.
Real journal apps have:
- Entries you create, open, read, edit, delete
- An entry list view and an entry detail/edit view
- Multi-line entry bodies (not single-line input)
- Titles, timestamps, metadata per entry
- Browse and search across entries
- Entry lifecycle (draft → published, archive, delete)

## Core Concept

Two-pane journal: **entry list** (left/top) and **entry editor** (right/bottom).
Think Obsidian sidebar + editor, Bear notes, or Apple Notes — but terminal-native.

## Modes

1. **LIST mode** — browse entries, search, filter by tag/kind/peer
2. **READ mode** — view a single entry full-screen (rendered, not editable)
3. **EDIT mode** — write or edit an entry (multi-line textarea)
4. **NEW mode** — create a fresh entry with title + body + metadata

## Data Model

```typescript
interface JournalEntry {
  id: string;           // uuid or incremental
  title: string;        // short summary / first line
  body: string;         // multi-line markdown content
  peer: "human" | "agent" | "system";
  kind?: "note" | "observation" | "decision" | "discovery" | "question";
  tags?: string[];
  actor?: string;
  createdAt: string;    // ISO timestamp
  updatedAt: string;    // ISO timestamp
  archived?: boolean;
  referenceId?: string; // link to another entry
}
```

Storage: one `.json` file per entry in `scratch/journal-v2/entries/` (not jsonl).
Index: `scratch/journal-v2/index.json` for fast list loading.

## Feature Versions

### MVP — List + Read (10 pts)
- [ ] Entry list view with title, date, preview
- [ ] Entry detail/read view (full body rendered)
- [ ] Create new entry (title + body via multi-line editor)
- [ ] Navigation: Enter to open, Esc to go back to list
- [ ] Persistence: entries saved as individual JSON files

### v1 — Edit + Delete (12 pts)
- [ ] Edit existing entry (re-open in edit mode)
- [ ] Delete entry (with confirmation)
- [ ] Entry metadata display (created, updated, kind, tags)
- [ ] Search/filter in list (by title text, tag, kind)
- [ ] Keyboard shortcuts: n=new, e=edit, d=delete, /=search

### v2 — Rich List (12 pts)
- [ ] Two-pane layout: list left, preview right (at wide breakpoints)
- [ ] Single-pane with detail push at narrow breakpoints
- [ ] Sort by created/updated/title
- [ ] Entry count + stats in status bar
- [ ] Relative timestamps (today, yesterday, 3 days ago)

### v3 — Agent Integration (10 pts)
- [ ] journal.create command (title + body + metadata, returns entry id)
- [ ] journal.read command (by id, returns full entry)
- [ ] journal.update command (update title/body/tags/kind)
- [ ] journal.list command (returns entry summaries, filterable)
- [ ] journal.delete command
- [ ] Rich describeState (selected entry, list position, mode)

### v4 — Polish (8 pts)
- [ ] Tags rendered with accent color
- [ ] Kind icons in list view
- [ ] Figlet header (responsive)
- [ ] Word wrap in body rendering
- [ ] Markdown-lite rendering (bold, headers, lists, code blocks)

### v5 — Power Features (8 pts)
- [ ] Export single entry or all as markdown
- [ ] Import from v1 journal (convert chat entries → journal entries)
- [ ] Linked entries (references between entries)
- [ ] Entry templates (pre-filled kind/tags for common patterns)
- [ ] Workspace persistence (registerSnapshot: selected entry, scroll pos, mode)

## UI Layout

### Wide (≥120 cols) — Two Pane
```
┌─ Journal ──────────────────────────────────────────────────┐
│  JRNL (figlet)                                             │
│  symbient logbook // ...                                   │
│ ┌─ Entries ─────────┐ ┌─ Entry ──────────────────────────┐ │
│ │ ★ first entry    │ │ ## First Entry                   │ │
│ │   second entry    │ │                                  │ │
│ │ ◊ third entry    │ │ Body text here, multi-line,      │ │
│ │                   │ │ with markdown rendering...       │ │
│ │                   │ │                                  │ │
│ │                   │ │ #tag1 #tag2                      │ │
│ └───────────────────┘ └──────────────────────────────────┘ │
│ [LIST] 3 entries  n new  e edit  d del  / search  Tab pane │
└────────────────────────────────────────────────────────────┘
```

### Narrow (<120 cols) — Single Pane (push/pop)
```
┌─ Journal ────────────────────────┐
│  JRNL                            │
│ ┌─ Entries ─────────────────────┐│
│ │ ★ first entry     2h ago     ││
│ │   second entry     1d ago     ││
│ │ ◊ third entry     3d ago     ││
│ └───────────────────────────────┘│
│ [LIST] n new  Enter open  / srch │
└──────────────────────────────────┘
```

## Key Interactions

| Mode | Key | Action |
|------|-----|--------|
| LIST | j/k, ↑/↓ | Navigate entries |
| LIST | Enter | Open selected entry (→ READ) |
| LIST | n | New entry (→ EDIT) |
| LIST | e | Edit selected (→ EDIT) |
| LIST | d | Delete selected (confirm) |
| LIST | / | Search filter |
| LIST | Tab | Switch to preview pane (wide only) |
| READ | Esc, q | Back to list |
| READ | e | Edit this entry (→ EDIT) |
| EDIT | Ctrl-S | Save entry |
| EDIT | Esc | Cancel / back to READ or LIST |
| ALL | Ctrl-N | New entry shortcut |

## What Carries Forward from v1
- Figlet header
- Peer distinction (▸ human, ▹ agent, · system)
- Kind icons (◊ ░ ★ ■ ?)
- Theme token usage
- Status bar with context-aware hints
- Mood indicator concept
- Tag system
- describeState pattern

## What's New
- Multi-line entry bodies
- Entry list as selectable navigable list
- Two-pane responsive layout
- Entry CRUD (create/read/update/delete)
- Individual file storage per entry
- Edit mode with save/cancel
- Proper entry lifecycle
