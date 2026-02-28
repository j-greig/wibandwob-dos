# Agent State Injection — Auto Context per Turn

## Problem
Agents (Wib&Wob chat, pi-agent, any MCP client) make layout and window decisions based on stale or assumed desktop state. They forget dimensions, pick wrong sizes, don't know what's already open. Every turn starts blind.

## Solution
Inject a compact state snapshot at the start of every agent turn, automatically. The agent never needs to call get_state — it already knows.

## What to inject

```
[Desktop 193x63 | 4 windows]
z0: frame_player "folk-punk-ai.txt" (1,1) 72x24
z1: frame_player "maze-cheese.txt" (74,0) 72x22
z2: frame_player "scramble-the-cat.txt" (1,26) 21x4
z3: wibwob_chat (100,30) 60x30
```

Fields per window:
- z-order index (z0 = backmost)
- type
- title or primer path
- position (x,y)
- size wxh
- state flags if relevant (animated, playing, scrolled)

Desktop line:
- width x height in characters
- window count
- cell_aspect (for aspect-ratio-aware layouts)
- theme mode/variant

## Format
Plain text, not JSON. Compact. Under 20 lines for a busy desktop. The agent reads it as natural context, not as a data structure to parse.

## Where to inject

### 1. Pi-agent prototype (do first)
Pi has hooks/skills. Create a skill or pre-prompt that:
- Checks if API is reachable (curl state endpoint)
- If yes, formats compact state block
- Prepends it to the user message or injects as system context

### 2. Wib&Wob chat (transfer later)
The C++ SDK bridge already has system prompt injection. Add a `[DESKTOP STATE]` block that refreshes every turn:
- Before sending user message to LLM, query own app state
- Format compact block
- Insert after system prompt, before conversation history
- Or: insert as a synthetic "system" message each turn

### 3. MCP clients (any external agent)
Expose a `/state/compact` endpoint that returns the plain-text format directly. Agents can curl it into their context window.

## What NOT to inject
- Full window content (too large)
- Raw JSON (wastes tokens, harder to read)
- Historical state (only current matters)
- Internal IDs unless needed for commands (use titles/paths)

## Open questions
- Should we include content dimensions for primer windows? (lines/width so agent knows if content is clipped)
- Should we include a "suggested actions" line? e.g. "3 windows overlap at bottom-right"
- Rate: every turn, or only when state changed since last injection?
- Token budget: cap at ~200 tokens? Current format is ~5 tokens per window.

## Implementation order
1. Write a pi pre-prompt hook that queries API and formats state
2. Test with layout tasks — does the agent make better decisions?
3. If yes, port to C++ SDK bridge for Wib&Wob chat
4. Add /state/compact endpoint for any client

## Success criteria
- Agent never asks "what size is the desktop?" — it already knows
- Agent never opens windows at wrong size due to stale assumptions
- Layout quality improves measurably (fewer clipped windows, better use of space)
- Zero extra latency (state query is <10ms local)
