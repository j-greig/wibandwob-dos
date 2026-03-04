# Agent Feature Matrix: pi CLI vs WibWob-DOS TUI Agent

> Generated 2026-03-04. Based on commits 82b23a6 (refactor) and 21bec01 (error surfacing).

## Root Cause

The native WibWob agent is built directly on low-level `Agent` from `pi-agent-core`,
not `AgentSession` from `pi-coding-agent`, so it misses most standard pi CLI
orchestration features (compaction, retry, model/tool lifecycle, usage accounting,
extension runtime).

## Feature Comparison

| # | Dimension | pi CLI agent | WibWob TUI agent | Gap | Difficulty |
|---|-----------|-------------|------------------|-----|------------|
| 1 | Session management | Tree-structured JSONL, fork/switch/branch summaries, context rebuild | Linear JSONL append, /new /resume, no fork/tree | No branching/topology | Hard |
| 2 | Model selection | Runtime set/cycle + thinking clamp | Chosen once at init, /model is read-only | No in-session switching | Moderate |
| 3 | Tool system | Registry + active-tool switching, extension tools | Fixed set at init (TUI + jailed + bridge + music), /tools listing only | No hot-swap/activation | Moderate |
| 4 | Streaming/errors | Full event surface (text, thinking, tool updates), auto-retry | text_delta + tool start/end, abort, API errors now surfaced on turn_end | Missing thinking stream, tool partials, retry | Moderate |
| 5 | Context management | Token-aware compaction, thresholds, /compact | Desktop summary injection only, no token counting/truncation | No context-window governance | Hard |
| 6 | Slash commands | /model /scoped-models /fork /tree /compact /resume /reload etc. | /help /session /new /resume /reload /stop /model /tools /clear | Limited surface | Moderate |
| 7 | Input handling | Multiline, autocomplete, external editor, history, queue | Basic draft buffer + backspace + enter + tab | No completion/history/editor | Moderate |
| 8 | Rendering | Markdown + syntax highlighting + themed + toggle thinking/tool | Plain-text transcript, tool collapsing, Wib/Wob kaomoji, themed | No markdown/highlight (intentional) | Moderate |
| 9 | Session control | Rich steer/follow-up/new/switch, no peer socket | list/send/get session tools + session-control server | TUI stronger for peer bridge | — |
| 10 | Extension/skill | First-class extension runtime + skill loading | No extension runtime, static prompt fragments | Major extensibility gap | Architectural |
| 11 | Thinking mode | Thinking levels + cycling + thinking block UI | Initial thinkingLevel only, no user control or rendering | No interactive reasoning controls | Moderate |
| 12 | Cost/usage | Token/cost totals in session stats | Message count/status/model only | No usage accounting | Moderate |

## Fix Options

### Option A: Adopt AgentSession as backend
- Fastest parity on sessions, compaction, retry, models, tools, usage, extensions
- Needs adapter to preserve WibWob transcript style and local TUI tools
- Risk: coupling WibWob UX to pi interactive assumptions

### Option B: Incremental parity on current WibWobAgentSession
- Preserves current architecture and custom UX
- Re-implements many solved concerns (compaction, retry, model lifecycle, stats)
- Risk: long tail drift from standard pi

### Option C: Hybrid — keep UI, wrap AgentSession facade
- Isolates feature engine from rendering
- Keeps WibWob-specific look/commands while inheriting core behaviours
- Risk: dual state if not strictly single-source

## Priority Gaps (recommended order)

1. Context management (compaction/truncation) — users hit 200k wall silently
2. Error surfacing — DONE (21bec01)
3. Model switching (/model set)
4. Thinking stream rendering
5. Cost/usage tracking
6. Input history + multiline
7. Extension/skill runtime (architectural)
