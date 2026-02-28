# pi-mono / Wib&Wob Chat Evaluation

First pass notes after vendoring `pi-mono` into the spike.

## Vendor location

- Vendored as git submodule at [pi-mono](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/vendor/pi-mono)
- Current submodule commit: `95276df0608dabe8d443c3191fa8e391f9922cca`

## Why this is interesting

The current C++ Wib&Wob chat stack is powerful but clunky:

- UI is tightly coupled to Turbo Vision window code
- model/tool flow routes through the API bridge / MCP surface
- customizing the chat UX is expensive

`pi-mono` offers an alternative TypeScript-native path:

- [@mariozechner/pi-coding-agent](https://www.npmjs.com/package/@mariozechner/pi-coding-agent) already has:
  - session management
  - streaming events
  - tools
  - skills / prompts / extensions
  - SDK embedding
  - RPC mode
- [packages/tui](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/vendor/pi-mono/packages/tui) is its own TUI stack, which is useful as reference even if we do not adopt it wholesale

## Important constraint

Do not confuse these two options:

1. **Use pi as the whole chat engine**
2. **Use pi's own interactive TUI inside our blessed window**

`1` is viable.  
`2` is probably the wrong move.

Trying to run pi's interactive TUI inside our blessed desktop would create the same "terminal-inside-terminal" trap we already hit with the shell pane:

- PTY nesting
- focus conflicts
- mouse routing conflicts
- alternate-screen / ANSI rendering issues
- two TUI frameworks competing for the same terminal

So the recommendation is:

- **Do not embed pi's interactive UI directly in a blessed window**
- **Do consider embedding pi's agent runtime via SDK or RPC and rendering the conversation in our own window chrome**

## Best integration path

### Preferred: SDK-backed Wib&Wob window

Use `createAgentSession()` from [sdk.ts](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/vendor/pi-mono/packages/coding-agent/src/core/sdk.ts) directly inside the spike app.

Why this is the cleanest fit:

- our app keeps ownership of window chrome, drag, resize, z-order, workspace restore, and state reporting
- pi provides the agent/session/tool engine
- the chat window can subscribe to streamed events and render them in a normal blessed transcript/input layout
- we avoid TUI-in-TUI problems

Likely shape:

- `services/wibwob-agent-service.ts`
  - wraps `createAgentSession()`
  - configures cwd, auth, model, prompt, tools, and session lifecycle
- `windows/wibwob-chat-window.ts`
  - blessed transcript + input
  - subscribes to pi session events
  - shows assistant deltas, tool starts/ends, errors, and queue state
- state surface:
  - `appType: "wibwob-chat"`
  - `interactive: true`
  - `streaming: boolean`
  - `pendingMessageCount`
  - `sessionId`
  - maybe `model`, `thinkingLevel`, `toolCount`

### Acceptable alternative: RPC subprocess

Use `pi --mode rpc` and speak JSON over stdin/stdout.

Why it may help:

- stronger process isolation
- easier crash containment
- keeps the spike from linking directly against the whole pi runtime

Why it is second choice:

- more plumbing
- harder lifecycle and state sync
- still not useful to render pi's own TUI

### Not recommended: PTY-hosted interactive pi

Launching `pi` in a terminal pane might look attractive because it feels "native," but architecturally it is the same fragile move as trying to host Codex/Claude in the terminal window:

- wrong ownership model
- bad mouse/focus integration
- no clean workspace/state metadata
- difficult save/restore semantics

## Fit against WibWob requirements

### What lines up well

- TypeScript-native agent runtime
- explicit SDK and RPC embedding surfaces
- session model
- extension/skill system
- streaming event model
- custom prompt/resource loading

### What does not line up automatically

- pi explicitly has **no built-in MCP**
- pi's default tools are coding-agent tools, not WibWob desktop/window tools
- pi's philosophy is not the same as Wib&Wob's symbient desktop model

So if we use pi, we still need to decide:

- whether Wib&Wob chat is a coding-first agent or a desktop-native agent
- whether to wrap WibWob window actions as tools inside pi
- whether to keep MCP compatibility at all in the TS spike

## Recommendation

Short version:

- vendor `pi-mono` for study and possible runtime reuse
- **do not** try to run pi's interactive UI inside a blessed window
- if we pursue this, build a **SDK-backed Wib&Wob chat window** in our own chrome

## Good next slice

1. Add `wibwob-agent-service.ts` that boots a minimal in-memory pi `AgentSession`
2. Build one experimental `Wib&Wob Chat` window in the spike
3. Start with:
   - transcript
   - input
   - streamed text deltas
   - abort
   - model/session metadata in `describeState()`
4. Only later decide whether to:
   - add WibWob desktop tools
   - bridge MCP
   - preserve pi session files
