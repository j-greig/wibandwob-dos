# Agent Backend Decision Matrix

> Which path to close the gap between WibWob TUI agent and pi CLI agent?

## Options

- **A: Adopt AgentSession** — Replace WibWobAgentSession with pi-coding-agent's AgentSession as the engine. Adapt rendering and TUI tools as an integration layer on top.
- **B: Incremental Parity** — Keep WibWobAgentSession on raw Agent. Reimplement needed features (compaction, model switching, retry, cost tracking) inside WibWob code.
- **C: Hybrid Wrap** — Keep WibWobAgentSession as the public surface but internally delegate to AgentSession for lifecycle/context/model management. WibWob owns rendering, tools, and desktop integration.

## Scoring

Scale: 1 (worst) to 5 (best). Weights sum to 1.0.

| # | Dimension | Weight | A: Adopt | B: Incremental | C: Hybrid | Rationale for weights |
|---|-----------|--------|----------|----------------|-----------|----------------------|
| 1 | Time to critical parity (compaction, model switch, retry) | 0.25 | 5 | 2 | 4 | Compaction is the #1 user-facing bug. Weight high. |
| 2 | WibWob identity preservation (rendering, kaomoji, voice, theme) | 0.15 | 2 | 5 | 4 | Custom rendering is core to the project but can be layered. |
| 3 | Future maintenance burden (keeping up with pi-coding-agent) | 0.15 | 4 | 1 | 3 | pi evolves fast. Reimplementing means perpetual catch-up. |
| 4 | Architectural risk (dual state, coupling, breakage) | 0.15 | 3 | 4 | 2 | Hybrid has highest dual-state risk. Adopt is cleaner cut. |
| 5 | Extension/skill support | 0.10 | 5 | 1 | 3 | Extensions need AgentSession's runtime. Incremental can't get there. |
| 6 | Desktop integration (TUI tools, session bridge, window lifecycle) | 0.10 | 2 | 5 | 4 | WibWob's unique value. Adopt would need significant adaptation. |
| 7 | Implementation complexity (lines of code, seams to cross) | 0.05 | 3 | 4 | 2 | Hybrid has the most glue code. Incremental is local changes. |
| 8 | Testability (can we verify parity, catch regressions?) | 0.05 | 4 | 3 | 3 | Adopt inherits pi's test surface. Others need new tests. |

## Weighted Scores

| Option | D1 | D2 | D3 | D4 | D5 | D6 | D7 | D8 | Total |
|--------|------|------|------|------|------|------|------|------|-------|
| A: Adopt | 1.25 | 0.30 | 0.60 | 0.45 | 0.50 | 0.20 | 0.15 | 0.20 | **3.65** |
| B: Incremental | 0.50 | 0.75 | 0.15 | 0.60 | 0.10 | 0.50 | 0.20 | 0.15 | **2.95** |
| C: Hybrid | 1.00 | 0.60 | 0.45 | 0.30 | 0.30 | 0.40 | 0.10 | 0.15 | **3.30** |

## Ranking

1. **A: Adopt AgentSession** — 3.65
2. **C: Hybrid Wrap** — 3.30
3. **B: Incremental Parity** — 2.95

## Analysis

### Option A wins on fundamentals
The weight is dominated by time-to-parity (0.25) and A scores a clean 5 there.
Compaction, retry, model switching, cost tracking, and extension support all come
free. The tax is adapting the rendering layer and wiring TUI-specific tools into
AgentSession's tool registry, which is a known seam.

### Option A's weakness: desktop integration and identity
A scores lowest on desktop integration (2) and WibWob identity (2). AgentSession
assumes it owns the interactive loop, rendering, and input handling. Rewiring those
to blessed widgets and the WibWob transcript format is real work. But it is
BOUNDED work — once the adapter exists, future pi features flow through automatically.

### Option B is a trap
It scores well on identity preservation and desktop integration because it changes
nothing. But it scores 1 on future maintenance and 1 on extension support. Every
new pi feature (compaction improvements, new tool lifecycle hooks, skill loading)
would need manual reimplementation. This is the "boil the ocean slowly" option.

### Option C looks reasonable but has hidden cost
The dual-state risk (score 2 on D4) is real. WibWobAgentSession would need to
mirror AgentSession's lifecycle events, tool state, and context decisions without
drifting. Two sources of truth for "what model are we using" or "have we compacted"
is a bug factory. The glue code complexity (score 2 on D7) compounds this.

## Recommendation

**Option A with a phased approach:**

Phase 1 — Adapter seam (moderate, ~1 session)
- Create WibWobSessionAdapter that wraps AgentSession
- Map AgentSession events to WibWob's ChatMessageEntry transcript format
- Register TUI tools + jailed coding tools + session bridge tools via AgentSession's tool registry
- Wire /slash commands to AgentSession's built-in command surface where they overlap
- Keep WibWob-only commands (/reload, desktop-specific) as local extensions

Phase 2 — Rendering preservation (small)
- renderTranscript and renderMessage already extracted to wibwob-agent-render.ts
- These stay as-is — they consume ChatMessageEntry, not AgentSession internals
- Add thinking block rendering when thinking_delta events are available

Phase 3 — Desktop integration (small)
- TUI tools already use TuiToolContext which is independent of the session backend
- Session bridge tools are standalone — register them as AgentSession extension tools
- Window lifecycle (cleanup, /reload) stays in the window factory

Phase 4 — Kill WibWobAgentSession (cleanup)
- Once the adapter is stable, WibWobAgentSession becomes the adapter
- The raw Agent import disappears
- agent-session-helpers.ts may become unnecessary if AgentSession handles those concerns

## What we keep no matter what

- wibwob-agent-render.ts (rendering is ours)
- agent-slash-commands.ts (dispatch layer, extended with desktop-specific commands)
- TuiToolContext and all TUI tools (desktop integration is ours)
- Session bridge (pi-session-bridge.ts — our unique capability)
- Theme-aware C() palette (our visual identity)
- Kaomoji voice markers (our personality)
