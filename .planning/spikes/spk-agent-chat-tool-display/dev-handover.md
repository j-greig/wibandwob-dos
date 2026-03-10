---
spike: SPK-agent-chat-tool-display
branch: spike/agent-chat-tool-display
date: 2026-03-10
status: bandaid shipped, real fix pending
---

# Dev Handover — Agent Chat Tool Display

## Why are we doing this work?

1. WHY does the Wib&Wob agent chat become unusable during tool-heavy sessions?
   Because 30 tool-call lines fill the entire chat viewport and push the actual
   conversation (human prompts, Wib/Wob personality text) off-screen.

2. WHY do 30 tool lines appear at all?
   Because every tool call emits a `[tool]` status message and a `[done]`/`[fail]`
   status message, and `renderTranscript()` renders each one as a full line of text
   in the chat window. The agent routinely makes 10-50 tool calls per turn (opening
   windows, arranging layouts, querying state).

3. WHY can't the user scroll past them or collapse them?
   Because the entire transcript is one flat string set via `setContent()` on a
   single blessed box. There are no individual components, no expand/collapse
   toggle, no per-item interactivity. It's a wall of text.

4. WHY is it a single flat string?
   Because the original agent chat was built as a simple chat log — human says
   something, assistant replies, render both as text. Tool calls were an
   afterthought, bolted on as status messages in the same text stream.

5. WHY wasn't it built with components like vanilla pi?
   Because WibWob-DOS uses blessed (terminal widget library) not pi-tui. Pi's
   interactive mode has a proper `Container` with child `ToolExecutionComponent`
   instances — each tool call is a real object with collapsed/expanded state,
   per-tool rendering (diffs for edit, syntax highlighting for read, truncated
   output for bash), and the ability to render zero lines. We never ported that
   architecture. We inherited a simpler chat-log pattern.

6. WHY does this matter beyond aesthetics?
   Because the agent chat is the primary human-symbient interface. When tool
   noise drowns the conversation, the human loses context on what Wib & Wob
   are actually thinking and doing. It breaks the co-presence illusion — instead
   of a conversation partner, you get a log viewer.

## What exists now (bandaid)

Branch `spike/agent-chat-tool-display`, commit `506af00`.

A text-level fold in `renderTranscript()` in `src/windows/wibwob-agent-render.ts`:
- When 4+ consecutive `[done]` status lines appear between text messages
- Show first 2 lines, a summary ("… N more (command-names)"), and last 1 line
- `[fail]` lines always shown individually
- Tested: 10 figlet opens collapse from 10 lines to 4

This is string manipulation on the flat transcript. It works visually but does
not change the underlying architecture.

## What the real fix looks like

Replace the single `transcript` blessed box (one giant string) with a scrollable
parent holding CHILD BOXES — one per message block:

1. Each human message = one child box
2. Each assistant text turn = one child box
3. Each tool-call run = one COLLAPSIBLE child box
   - Collapsed: summary line ("✓ 10 commands run")
   - Expanded: full tool-by-tool detail
   - Failed tools always visible
4. Session/status messages = their own child box

### Reference implementation

Vanilla pi's approach lives in the vendor submodule and on GitHub:
- pi-mono repo: https://github.com/badlogic/pi-mono
- pi coding-agent: https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent
- pi TUI framework: https://github.com/badlogic/pi-mono/tree/main/packages/tui
- Local vendor copy: `vendor/pi-mono/` (submodule)

| File | What it does |
|------|-------------|
| `vendor/pi-mono/packages/coding-agent/src/modes/interactive/interactive-mode.ts` | Main orchestrator — `chatContainer` is a `Container`, each tool call becomes a `ToolExecutionComponent` child added via `chatContainer.addChild()` |
| `vendor/pi-mono/packages/coding-agent/src/modes/interactive/components/tool-execution.ts` | `ToolExecutionComponent` class — 500+ lines. Handles collapsed/expanded toggle, per-tool rendering (read/write/edit/bash/grep/find each have custom formats), streaming arg updates, image display, syntax highlighting |
| `vendor/pi-mono/packages/coding-agent/src/modes/interactive/components/assistant-message.ts` | `AssistantMessageComponent` — renders text + thinking blocks as child components |

Key patterns from pi we'd port:
- `pendingTools = new Map<string, ToolExecutionComponent>()` — track live tool calls by ID
- `tool_execution_start` event creates component, `tool_execution_end` finalises it
- `setExpanded(bool)` toggle on each component
- `hideComponent` flag — component renders zero lines when not needed
- `BASH_PREVIEW_LINES = 5` — bash output truncated to 5 lines when collapsed

### Blessed-specific considerations

Pi uses its own `pi-tui` renderer (not blessed). In blessed, the equivalent of
"child components in a scrollable container" is:

```typescript
const transcript = blessed.box({ scrollable: true, alwaysScroll: true });

// Each message block is a child box
const msgBox = blessed.box({
  parent: transcript,
  top: nextY,       // manual stacking
  left: 0,
  right: 0,
  height: computedHeight,
  tags: true,
  content: renderedText,
});
```

The tricky part: blessed doesn't have flexbox. You must manually compute `top`
for each child and update when content changes height. The `createStack` utility
in `src/core/panel-layout.ts` does this for microapp panels — it could be
reused or adapted.

Alternative: keep the single `setContent()` approach but make `renderTranscript`
smarter about what it includes. This is the bandaid path — cheaper, less correct.

## Key files to modify

| File | Current role | What changes |
|------|-------------|-------------|
| `src/windows/wibwob-agent-render.ts` | `renderTranscript()` serialises messages to one string | Becomes per-block renderer, or replaced by component factory |
| `src/windows/wibwob-agent-window.ts` | Creates single `transcript` box, subscribes to agent snapshot, calls `setContent()` | Manages child boxes, handles expand/collapse keybinds |
| `src/services/wibwob-agent-session.ts` | Emits `[tool]`/`[done]`/`[fail]` as flat status messages | May need richer event types (tool-start/tool-end with IDs) for component lifecycle |
| `src/core/types.ts` | `ChatMessageEntry` type | May need tool-specific message subtypes |

## Verification

1. Start alt instance: `CONTROL_API_PORT=8098 SCRATCH_DIR=scratch/alt bun run src/app.ts --dev`
2. Open agent: `curl -s -X POST http://127.0.0.1:8098/commands/run -H 'Content-Type: application/json' -d '{"id":"agent.open"}'`
3. Tell agent to open 15+ figlet windows
4. Screenshot: `WIBWOB_API=http://127.0.0.1:8098 ./scripts/screenshot-window.sh "Wib&Wob Agent"`
   Or: `tmux capture-pane -t ww:alt -p | head -25`
5. Conversation text (human prompt + Wib/Wob reply) must be visible, not buried under tool lines

## Spike ACs (from spike-brief.md)

- [x] AC-1: 10+ consecutive tool calls collapse to ≤3 visible lines (bandaid does this)
- [ ] AC-2: Human prompts and Wib/Wob replies remain fully visible and untruncated (works for new sessions; old resumed sessions still have legacy tool lines)
- [ ] AC-3: Current/active tool call still shows inline during streaming (untested — bandaid only folds after tool-done, streaming [tool] lines may still stack)
- [ ] AC-4: Failed tool calls always visible, never collapsed (coded but untested with real failures)
- [x] AC-5: Works with any tool, not just glitchbox commands (tested with figlet.open and primer.open)
