# Journal Microapp Planning Search Report

## Summary

Searched `.planning/` directory recursively for mentions of 'journal', 'diary', 'agent diary', 'session log', 'project log', and 'toggle' related to the Journal microapp. Found **1 dedicated spike**, **multiple epic mentions**, and **architectural specs** regarding Journal's role in workspace persistence and session capture.

---

## Key Files Found

### 1. **JOURNAL V4 SPIKE** (PRIMARY SPEC)
- **Path:** `.planning/spikes/spk-journal-v4-auto-journal/spike.md`
- **Status:** SPIKE — capturing ideas before branching
- **Lines:** ~148 lines
- **Priority:** High — active roadmap item

### 2. Instance Lifecycle Epic (E039)
- **Path:** `.planning/epics/e039-instance-lifecycle/e039-brief.md`
- **Status:** Done
- **Relevant:** Journal's role in workspace persistence and state management

### 3. Write Feature (E039-F05)
- **Path:** `.planning/epics/e039-instance-lifecycle/e039-f05-write.md`
- **Status:** Done
- **Relevant:** Journal write commands and CLI surface

### 4. State of Codebase Report
- **Path:** `.planning/state-of-the-codebase-2026-03-15.md`
- **Status:** Current analysis
- **Journal Status:** 1427 lines, **BLOATED** (marked with ❌ for captureText and writeInput)

### 5. Autoresearch Audit
- **Path:** `.planning/spikes/spk-autoresearch-audit/spike-brief.md`
- **Mentions:** journal, journal-v2, wiretext as creative category items

---

## Core Specifications Found

### FEATURE 1: Auto-Journal from Agent Sessions

**What It Does:**
When a pi agent session ends (or on demand), automatically create a structured journal entry summarizing what the agent did.

**Entry Fields:**
- **Title**: Derived from first user message or task
- **Body**: LLM-summarised decisions, files changed, blockers, outcomes
- **Tags**: Auto-extracted from file paths, tools used, topics
- **Kind**: `discovery` or new `session-summary` kind
- **Metadata**: `sessionId` backlink to raw JSONL log
- **Peer**: `agent`

**Example JSON Structure:**
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

**Storage Location:** `scratch/journal-v2/entries/*.json`

#### Implementation Approaches

| Approach | Trigger | Pros | Cons |
|----------|---------|------|------|
| Watch `~/.pi/agent/sessions/` | File close/new file | Fully automatic | Needs fs watcher, noisy |
| `journal.auto-capture` command | Manual/API | Explicit, controllable | Not automatic |
| Post-session hook | Pi SDK callback | Clean integration | Depends on pi internals |
| Periodic scan | Timer | Simple | Delayed, may miss sessions |

**Recommended:** Start with `journal.auto-capture` command that scans for new sessions since last capture. Add watch mode later.

---

### FEATURE 2: Journal / Log Toggle in UI

**Current State:** v3 added a session viewer (S key toggle), but the two modes are disconnected.

**v4 Goal:** Bridge them with a visible toggle button in the chrome.

**UI Placement:** Top-right of journal window — `JRN / LOG` buttons

#### Journal View (current default)
- Structured entries with CRUD
- Two-pane: list + preview
- Date headers, sort, search, tags
- Edit mode, create new entries

#### Log View (raw session browser)
- Raw pi agent session JSONL files
- Two-pane: session list + conversation preview
- Read-only — no editing
- Role-colored messages, tool call summaries
- Date headers by session date

#### Toggle UI Design

```
┌─ Journal ──────────────────────────────────────────────────┐
│  JRN / LOG                                    ← top-right │
│  ^^^^^^^^                                                  │
│  Two buttons: JRN (active/highlighted) and LOG (muted)     │
│  Click or keyboard shortcut (S) to switch                  │
│  Active button uses accent color, inactive uses muted      │
└────────────────────────────────────────────────────────────┘
```

**Design Options:**
- Option A: Text buttons — `[JRN]  LOG` / `JRN  [LOG]` (brackets show active)
- Option B: Highlighted text — `JRN · LOG` with accent on active, muted on inactive
- Option C: Tab-style — `┌JRN┐ LOG` (tab underline on active)

**Recommended:** Option B — minimal, consistent with existing aesthetic.

**Current Implementation:** S key toggles between `viewMode: "journal"` and `viewMode: "sessions"`. v4 makes it **visible in the chrome**.

---

### Relationship Between Features

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

**Cross-linking:** Auto-captured entries link back to source session via `meta.sessionId`. In JRN view, auto-captured entries show a `⚡` icon. Clicking the backlink (or pressing a key) jumps to LOG view filtered to that session.

---

## Journal in Workspace Persistence (E039)

**File:** `.planning/epics/e039-instance-lifecycle/e039-f05-write.md`

### Journal Write Capability

Journal is one of **4 apps already writable** via existing commands:

| App | Write? | Operation | Existing command |
|-----|--------|-----------|------------------|
| journal | ✅ | Create entry | `journal.create --body X` ✅ |
| chatroom | ✅ | Send message | `chatroom.send --message X` ✅ |
| workspace-beacon | ✅ | Set note | `beacon.set-note --note X` ✅ |
| wibwobworld | ✅ | Send chat | `world.chat --message X` ✅ |

**CLI Fallback Convention:** The CLI tries commands in order for the resolved appType:
1. `<appType>.write` (canonical)
2. `<appType>.send` (chatroom, world)
3. `<appType>.create` (journal)

This means journal works without adding a `write` command — the CLI finds the existing `journal.create` equivalent.

### Journal State Persistence Issue

**Path:** `.planning/epics/e039-instance-lifecycle/e039-brief.md`

Journal entry state is noted as a **known issue** in workspace persistence:
> Workspace files can grow large if microapp state is verbose (journal payload is ~3KB alone)

**Implication:** Each journal window saves its full entry database to workspace snapshots, which bloats workspace files over time.

---

## Journal Quality Assessment

**Source:** `.planning/state-of-the-codebase-2026-03-15.md`

| Metric | Status | Notes |
|--------|--------|-------|
| Lines of Code | 1427 | **BLOATED** — needs refactor |
| describeState() | ✅ | Implemented |
| captureText() | ❌ | Missing |
| writeInput() | ❌ | Missing |
| Overall Quality | **Bloated** | Larger than hero apps (notepad: 130, figlet: 400, runtime-inspector: 425) |

**Context:** Among all microapps (34 total), journal is one of the few flagged as oversized.

---

## Dependencies & Prerequisites

From spike.md **Dependencies** section:

- ✅ `renderMarkdown` from SDK (done)
- ✅ `readSession` / `listSessions` helpers (done in v3)
- ⚠️ LLM access for auto-summarisation (via pi agent tools or direct API)
- ✅ Entry storage (done — `scratch/journal-v2/entries/*.json`)

---

## Out of Scope (v4)

- Session search/filter
- Cross-session analytics (time spent, tools used frequency)
- Multi-repo session aggregation
- Real-time streaming of active sessions
- Edit/annotate raw session logs

---

## Planning Context: Autoresearch Audit

**Source:** `.planning/spikes/spk-autoresearch-audit/spike-brief.md`

Journal appears in **Creative category** with:
- **journal** (active/unknown baseline)
- **journal-v2** (iteration)
- **wiretext** (related creative item)

**Finding:** These are in the creative category (alongside shader-music), suggesting they were treated as exploratory work, possibly predate or bypass the autoresearch loop.

---

## Related Planning Items

### Epic: E039 Instance Lifecycle (Done)
- **Focus:** Clean birth, clean death, resurrection after crash
- **Journal Role:** Workspace state persistence, snapshot capture
- **Key Concerns:** 
  - Journal payload grows to ~3KB per window
  - Snapshot registry used for restore

### Epic: E001 Codified Context Infrastructure (Active)
- **Files:** `.planning/epics/e001-codified-context-infrastructure/`
- **Source:** 645 Claude Code session logs analyzed for confusion patterns
- **Relevance:** Session log archaeology and agent experience with tools

### Spike: SPK-Autoresearch-Audit
- **Status:** Analysis complete
- **Finding:** Creative category (journal, shader-music, etc.) shows exploratory work pattern

---

## Spec Completeness Checklist

### Fully Specified
- [x] Feature 1: Auto-Journal from Agent Sessions (title, body, tags, metadata)
- [x] Feature 2: Journal/Log Toggle UI (placement, button styles, design options)
- [x] Entry JSON schema
- [x] Implementation approaches (4 options with pros/cons)
- [x] Recommended starting path (journal.auto-capture command)
- [x] Cross-linking strategy (⚡ icon, backlinks)
- [x] Write capability via journal.create command
- [x] Storage location

### Partially Specified
- [~] LLM integration for summarization (dependencies noted, implementation not detailed)
- [~] Entry kind logic ("discovery" vs new "session-summary")

### Not Specified
- Session search/filter (explicitly out of scope)
- Real-time session capture (deferred)

---

## Next Steps / Action Items

1. **Branch Preparation:** Create feature branch `feat/journal-v4-auto-journal` when ready to implement
2. **V4 Implementation Phases:**
   - Phase 1: `journal.auto-capture` command (scan `~/.pi/agent/sessions/`)
   - Phase 2: LLM summarization integration
   - Phase 3: UI toggle (JRN / LOG buttons in chrome)
   - Phase 4: Cross-linking and entry filtering
3. **Quality Review:** Address 1427-line bloat after v4 lands
4. **Code Refactoring:** Implement captureText and writeInput once auto-journal feature stabilizes

---

## File Tree of Discovered Documents

```
.planning/
├── spikes/
│   ├── spk-journal-v4-auto-journal/
│   │   └── spike.md                     ← PRIMARY SPEC
│   ├── spk-autoresearch-audit/
│   │   └── spike-brief.md               ← journal category mention
│   └── ... (other spikes)
├── epics/
│   ├── e039-instance-lifecycle/
│   │   ├── e039-brief.md                ← workspace persistence context
│   │   └── e039-f05-write.md            ← journal.create command spec
│   ├── e001-codified-context-infrastructure/
│   │   └── ... (session log analysis)
│   └── ... (other epics)
├── state-of-the-codebase-2026-03-15.md  ← quality assessment (bloated)
└── ... (other planning docs)
```

---

## Conclusion

The Journal microapp has a **well-defined v4 roadmap** captured in the dedicated spike document. The specification covers two major features:

1. **Auto-Journal from Agent Sessions** — automatic entry creation from pi agent session logs
2. **Journal/Log Toggle** — UI-visible button to switch between structured entries and raw session viewing

Both features are detailed with implementation guidance, entry schemas, UI mockups, and dependencies. The microapp is flagged as **BLOATED** (1427 lines) and needs post-v4 refactoring. Integration points with workspace persistence (E039) and command registry (CLI) are well-defined.

The spike is ready for branching and implementation when prioritized.
