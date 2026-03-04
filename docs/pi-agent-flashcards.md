# Pi Agent Architecture — Flash Cards

> Quick reference cards for understanding how the pi agent stack works.
> Read these when you forget how the layers fit together.

---

## Card 1: The Three Layers

```
┌─────────────────────────────────┐
│  pi-coding-agent                │  ← AgentSession, tools, compaction,
│  (the "pi" CLI you run)        │    extensions, skills, slash commands
├─────────────────────────────────┤
│  pi-agent-core                  │  ← Agent, AgentEvent, agent-loop,
│  (the engine)                   │    streaming, tool execution
├─────────────────────────────────┤
│  pi-ai                          │  ← Model, Message, streamSimple,
│  (LLM transport)                │    provider abstraction
└─────────────────────────────────┘
```

**pi-ai** talks to LLMs. **pi-agent-core** runs the loop. **pi-coding-agent** adds
session management, compaction, tools, extensions, and the interactive CLI.

WibWob TUI uses pi-agent-core directly (the middle layer) and skips pi-coding-agent.
That is why it lacks compaction, model switching, retry, cost tracking, and extensions.

---

## Card 2: Agent (pi-agent-core)

The raw engine. Owns the prompt-stream-tool loop.

```typescript
const agent = new Agent({
  initialState: { systemPrompt, model, tools, thinkingLevel },
  transformContext?,   // inject/prune context before each LLM call
  convertToLlm?,      // convert AgentMessage[] → Message[] for the API
  getApiKey?,          // resolve API key per provider
});

agent.prompt("hello");          // start a turn
agent.steer(message);           // interrupt mid-tool-execution
agent.followUp(message);        // queue for after current turn
agent.abort();                  // cancel streaming
agent.subscribe(fn);            // get AgentEvent stream
```

Key: Agent is STATEFUL. `agent.state.messages` grows forever.
No compaction. No truncation. No cost tracking. That is AgentSession's job.

---

## Card 3: AgentEvent Lifecycle

One user prompt triggers this event sequence:

```
agent_start
  turn_start
    message_start          ← assistant message begins
    message_update         ← text_delta (streamed tokens)
    message_update         ← text_delta
    message_end            ← assistant message complete
    tool_execution_start   ← if assistant called a tool
    tool_execution_update  ← partial results (optional)
    tool_execution_end     ← tool result ready
  turn_end                 ← one LLM call done (may loop for more tools)
  turn_start               ← next turn if tools triggered follow-up
    ...
agent_end                  ← all turns complete, agent idle
```

Error path: `turn_end.message.errorMessage` has the API error.
WibWob was NOT checking this — fixed in commit 21bec01.

---

## Card 4: AgentSession (pi-coding-agent)

The orchestration layer on top of Agent. This is what `pi` CLI uses.

```typescript
const session = new AgentSession({
  agent,               // raw Agent from pi-agent-core
  sessionManager,      // JSONL persistence, branching, tree navigation
  settingsManager,     // model prefs, thinking level, auto-compact
  modelRegistry,       // available models + API key resolution
  resourceLoader,      // skills, prompts, themes, context files
  customTools?,        // SDK-registered tools
});
```

What it adds over raw Agent:
- **Compaction**: auto + manual context summarisation when approaching token limit
- **Auto-retry**: retryable errors (429, 500) with backoff
- **Model cycling**: switch models mid-session, clamp thinking levels
- **Session tree**: fork, navigate, branch summaries
- **Extension runtime**: load/run extensions, register commands/tools
- **Skill loading**: inject skill content into prompts
- **Prompt templates**: file-based prompt expansion
- **Cost tracking**: token/cost aggregation per session
- **Bash execution**: managed bash with context recording

---

## Card 5: Tool Registration

**pi-agent-core** tools (AgentTool):
```typescript
interface AgentTool<TParams, TDetails> {
  name: string;
  label: string;           // human-readable display name
  description: string;
  parameters: TSchema;     // TypeBox schema
  execute: (toolCallId, params, signal?, onUpdate?) => Promise<AgentToolResult<TDetails>>;
}
```

**pi-coding-agent** adds a tool REGISTRY:
```typescript
session.setActiveToolsByName(["read", "edit", "bash"]);  // enable/disable at runtime
session.getAllTools();                                      // list all registered tools
```

**WibWob** builds tools manually and passes them at init:
```typescript
const tools = [
  ...createTuiTools(ctx),           // tui_get_state, tui_move_window, etc.
  ...createJailedCodingTools(root), // read, write, edit, bash, grep, find, ls
  ...createPiSessionTools(fn),      // list_sessions, send_to_session
  ...createMusicTools(fn),          // play_music, list_music
];
```
Fixed at init. No hot-swap. No activation toggle.

---

## Card 6: Context Management / Compaction

**The problem**: LLMs have token limits (200k for Sonnet). Agent.state.messages
grows forever. Eventually the API rejects with "prompt is too long".

**AgentSession's solution**:
```
1. Track token usage via ContextUsage
2. When approaching threshold → auto_compaction_start event
3. Summarise old messages into a compact form
4. Replace history with summary + recent messages
5. Continue conversation with smaller context
```

Also handles context OVERFLOW (error already happened):
- Detects "prompt is too long" error
- Runs emergency compaction
- Retries the failed prompt

**WibWob has NONE of this.** Context grows until 200k, then every message
silently fails. Fixed error surfacing (21bec01) but no compaction yet.

---

## Card 7: Session Persistence

**SessionManager** (pi-coding-agent):
```
~/.pi/agent/sessions/<project-path>/
  2026-03-04T19-25-56.jsonl     ← append-only message log
```

Each line is a JSON entry: message, branch point, summary, metadata.

**Tree structure**: Sessions can fork. Each fork creates a new session file
with a pointer to the parent. `navigateTree()` moves between branches.

**WibWob**: Uses SessionManager for JSONL logging but only linear append.
No fork. No tree. No branch summaries. Resume loads all messages and replays.

---

## Card 8: Streaming & Error Handling

**Happy path**: `message_update` events carry `text_delta` with streamed tokens.
UI appends deltas to build the response.

**Error path** (three layers of defence in AgentSession):
```
1. Retryable error (429, 500, timeout)
   → auto_retry_start event
   → exponential backoff
   → retry up to N times
   → auto_retry_end event

2. Context overflow ("prompt is too long")
   → auto_compaction_start event
   → summarise + truncate
   → retry original prompt
   → auto_compaction_end event

3. Fatal error (auth, invalid request, etc.)
   → error surfaces to UI
```

**WibWob**: Only has layer 3 (and that was broken until 21bec01).
No retry. No compaction. Error → show message → done.

---

## Card 9: Model & Thinking

**AgentSession**:
```typescript
session.setModel(model);                // switch model mid-session
session.cycleModel("forward");          // next model in list
session.setThinkingLevel("high");       // set reasoning depth
session.cycleThinkingLevel();           // toggle thinking
session.getAvailableThinkingLevels();   // what current model supports
```

Thinking levels: off | minimal | low | medium | high | xhigh
(xhigh = OpenAI Codex models only)

**WibWob**: Model and thinking level set once at init via `resolveModel()`.
/model command is read-only. No switching. No cycling. No thinking control.

---

## Card 10: Extensions & Skills

**Extensions** (pi-coding-agent):
```typescript
// .pi/extensions/my-ext.ts
export default function(pi) {
  pi.registerCommand("/foo", async (args) => { ... });
  pi.registerTool("my_tool", { ... });
  pi.on("turn_end", (event) => { ... });
}
```
Extensions can register commands, tools, event hooks, UI components.
Loaded by ExtensionRunner, managed by AgentSession.

**Skills** (.pi/skills/):
Markdown files with instructions injected into system prompt.
Loaded by ResourceLoader, expanded by AgentSession.prompt().

**WibWob**: Loads system prompt from disk files (including APPEND_SYSTEM.md).
No extension runtime. No skill commands. No /skill:name expansion.
Skills only work if manually pasted into the system prompt.

---

## Card 11: What WibWob HAS That pi CLI Does NOT

WibWob is not just a subset. It has unique capabilities:

```
✓ TUI tools          — open/close/move/resize windows, read widget content
✓ Desktop state      — injected every turn via transformContext
✓ Session bridge     — list_sessions, send_to_session, peer socket server
✓ Music tools        — play_music, list_music via sharedPlayer
✓ Custom rendering   — Wib/Wob voice markers, kaomoji, tool collapsing
✓ Theme integration  — agent palette from semantic theme tokens
✓ Window lifecycle   — /reload hot-swaps prompt without losing session
✓ Control API        — HTTP surface for external automation
```

These are the things to PRESERVE regardless of which backend option we choose.

---

## Card 12: The Decision

WibWob builds on Agent (layer 2). It needs AgentSession (layer 3) features.

Three paths:
- **A: Adopt AgentSession** (score: 3.65) — fastest parity, adaptation tax
- **B: Reimplement** (score: 2.95) — full control, perpetual catch-up
- **C: Hybrid** (score: 3.30) — best of both, dual-state risk

See docs/agent-backend-decision-matrix.md for full scoring.

Key insight: the rendering layer (wibwob-agent-render.ts) and tool layer
(TuiToolContext) are already decoupled from the session backend. The adapter
seam for Option A is narrower than it looks.
