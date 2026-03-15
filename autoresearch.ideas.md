# Autoresearch Ideas — Journal v3

## v2 COMPLETE — 100/100 ✅
Preserved in git history. All 60 feature pts + 40 UI pts.

## v3 IN PROGRESS

### F1 — Markdown Body Rendering
- SDK has `renderMarkdown(text, width, opts)` — returns ANSI string[]
- `PLAIN_HEADING_CONFIG` for non-figlet headings in body
- Replace `wrapText()` in preview pane + read mode
- Gotcha: ANSI vs blessed tags conflict — test both paths
- Study: `src/services/markdown-service.ts`, Document Reader usage

### F2 — Sort & Date
- `s` key cycles sort: updatedAt → createdAt → title
- Sort indicator in status bar: `↓updated` / `↓created` / `↓title`
- Date group headers: "Today", "Yesterday", "12 Mar", "3 Mar"
- Index mapping: `indexMap[visualIdx] → entryIdx | -1` for headers
- Selection skips headers (intercept up/down)
- Study: file manager list in `src/windows/browser-windows.ts:1599`

### F3 — Pi Session Log Viewer
- Second mode: `S` (shift-s) in list mode toggles journal↔sessions
- Only if `~/.pi` exists
- Session dir: `~/.pi/agent/sessions/--{encoded-cwd}--/`
- Derive from `process.cwd()` with same encoding pi uses
- JSONL format: `type: session|message|model_change|thinking_level_change`
- Messages: `{ message: { role, content: [{type, text}] } }`
- List view: date, session id prefix, message count, first user msg
- Detail view: scrollable conversation, role-colored blocks
- Tool calls: show name only, collapse result to one-line summary
- Lazy load: count lines + first msg for list, full parse on open

### F4 — Integration
- `journal.sessions` command (list sessions)
- `journal.session.read` command (read specific session)
- `describeState` includes `viewMode: "journal" | "sessions"`

## DEFERRED
- Entry templates, tag autocomplete
- Markdown rendering in edit mode preview
- Session search/filter
- Cross-reference: link journal entries to sessions that created them

## KILLER FEATURE — Auto-journal from agent sessions
The journal has session logs (read-only) and entries (structured). Bridge them:
when a pi session ends, auto-create a journal entry summarizing what the agent
did — decisions, files changed, blockers, outcomes — with a `sessionId` backlink
to the raw log. The journal becomes institutional memory that grows automatically.
Implementation: watch `~/.pi/agent/sessions/` for new JSONL files, parse on close,
use LLM to summarize into a structured entry (title, body, tags, kind=discovery).
Could also trigger on `describeState` or a `journal.auto-capture` command.
This is the bridge between passive logs and active knowledge.
