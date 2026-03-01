# Chat Collapse Review

## Root cause

The collapse removed the dedicated plain-chat service/window, but the replacement did not preserve the old plain-chat identity contract.

`WibWobAgentSession` does create an `Agent` with `tools: []` and no `transformContext` when `toolMode === "none"` in [src/services/wibwob-agent-session.ts](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/services/wibwob-agent-session.ts#L267), [src/services/wibwob-agent-session.ts](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/services/wibwob-agent-session.ts#L275), and [src/services/wibwob-agent-session.ts](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/services/wibwob-agent-session.ts#L288). The regression is that the shared window/session still identifies and behaves like the agent surface in several places, while workspace save/restore still expects the old chat-window contract.

## Findings

### 1. Plain chat workspace save/restore is broken

High severity.

- Restore still has a dedicated `wibwob-chat-v2` branch in [src/core/workspace-snapshots.ts](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/core/workspace-snapshots.ts#L162).
- That branch passes transcript, draft, and messages into `openWibWobChatWindow(...)`, but `openWibWobChatWindow(_restore)` ignores the payload entirely in [src/core/app-controller.ts](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/core/app-controller.ts#L382).
- The new shared agent window reports `appType: "wibwob-agent"` in [src/windows/wibwob-agent-window.ts](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/windows/wibwob-agent-window.ts#L306), not `wibwob-chat-v2`.
- Snapshot serialization for `kind: "chat"` still depends on `window.chat` in [src/core/workspace-snapshots.ts](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/core/workspace-snapshots.ts#L55), but the agent window does not populate `frame.chat`.

Effect:

- Existing `wibwob-chat-v2` snapshots restore as a blank plain-chat window with lost transcript/draft.
- Newly saved plain-chat windows likely serialize with no chat payload at all, then restore through the fallback `openChatWindow(...)` path instead of `openWibWobChatWindow(...)`.

### 2. Plain chat prompt is not actually tool-free

High severity.

- `loadChatSystemPrompt()` just returns `loadBasePrompt()` in [src/services/wibwob-agent-session.ts](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/services/wibwob-agent-session.ts#L208).
- `loadBasePrompt()` reads `.pi/APPEND_SYSTEM.md` in [src/services/wibwob-agent-session.ts](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/services/wibwob-agent-session.ts#L183).
- That file explicitly says the model experiences the desktop and has TUI tools in [APPEND_SYSTEM.md](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/.pi/APPEND_SYSTEM.md#L35), [APPEND_SYSTEM.md](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/.pi/APPEND_SYSTEM.md#L54), [APPEND_SYSTEM.md](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/.pi/APPEND_SYSTEM.md#L56), and [APPEND_SYSTEM.md](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/.pi/APPEND_SYSTEM.md#L61).

Effect:

- API-level tool registration is disabled correctly.
- Prompt-level behavior is still telling plain chat it can see/control the desktop, so the mode split is semantically incorrect.

### 3. Deleted file references are gone from live code, but stale references remain in comments/docs

Low severity.

- I found no live imports or symbol references to `wibwob-chat-window.ts`, `wibwob-chat-service.ts`, `WibWobChatWindow`, or `WibWobChatSession` under `spikes/ts-tui-mvp/src`.
- Remaining mentions are comments and docs, for example in [src/core/app-controller.ts](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/core/app-controller.ts#L45), [src/core/app-controller.ts](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/core/app-controller.ts#L72), and [src/services/wibwob-agent-session.ts](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/services/wibwob-agent-session.ts#L138).

This is mostly cleanup, not a runtime bug.

### 4. The plain window title is correct, but some shared UI text still says "Agent"

Low severity.

- The title bar is correct because plain chat passes `title: "Wib&Wob Chat"` into the shared window in [src/core/app-controller.ts](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/core/app-controller.ts#L393), and the frame uses `params.title ?? "Wib&Wob Agent"` in [src/windows/wibwob-agent-window.ts](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/windows/wibwob-agent-window.ts#L86).
- But the empty transcript placeholder still says `Starting Wib&Wob Agent…` in [src/windows/wibwob-agent-window.ts](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/windows/wibwob-agent-window.ts#L58).
- `captureText()` also hardcodes `WIB&WOB AGENT` in [src/services/wibwob-agent-session.ts](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/services/wibwob-agent-session.ts#L394).

So the visible window title is correct, but the shared surface still leaks agent-specific labels.

### 5. Typecheck is clean, but there is dead restore plumbing

Low severity.

- `bun run typecheck` passes in `spikes/ts-tui-mvp`.
- The `_restore` parameter in `openWibWobChatWindow(...)` is unused in [src/core/app-controller.ts](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/core/app-controller.ts#L382).
- `messages` is still threaded through restore actions in [src/core/workspace-snapshots.ts](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/core/workspace-snapshots.ts#L105) and [src/core/workspace-snapshots.ts](/Users/james/Repos/wibandwob-dos/spikes/ts-tui-mvp/src/core/workspace-snapshots.ts#L168), but the new path never consumes it.

## Fix options

### Option A: Preserve plain-chat identity in the shared window/session

Smallest correct fix.

- Add an explicit mode/app-type parameter to the shared window, for example `appType: "wibwob-agent" | "wibwob-chat-v2"` and maybe `uiLabel: "agent" | "chat"`.
- In plain mode, make `frame.describeState()` report `wibwob-chat-v2`.
- Attach a `frame.chat` adapter for agent-backed chat so workspace snapshots can still call `getTranscriptLines()` and `getDraft()`.
- Consume the restore payload in `openWibWobChatWindow(...)` and hydrate transcript/draft into the session/window.

Tradeoff:

- Keeps the current collapse design.
- Adds a compatibility shim layer to the agent window/session.

### Option B: Split identity from capability in `WibWobAgentSession`

Cleaner medium-term fix.

- Keep one session class, but give it an explicit `mode: "plain-chat" | "agent"` instead of only `toolMode`.
- Derive system prompt, window labels, app type, capture headers, and restore behavior from `mode`.

Tradeoff:

- Clearer design than overloading `toolMode`.
- Slightly larger refactor across constructor call sites and UI state.

### Option C: Restore a tiny plain-chat wrapper

Compatibility-first fix.

- Reintroduce a minimal plain-chat window/service wrapper that internally delegates to `WibWobAgentSession(..., "none")`.
- Keep `wibwob-chat-v2` save/restore semantics local to that wrapper.

Tradeoff:

- Lowest compatibility risk for workspace restore.
- Gives up some of the collapse simplification.

## Risks

- If only the prompt is fixed but app identity is not, workspace save/restore will still misroute plain chat windows.
- If only `appType` is fixed but `frame.chat` is not restored, saved transcript/draft data will still be missing.
- If restore hydration is added only at the window level, `captureText()` and other mode-specific labels can still leak "Agent" into plain chat behavior.

## Tests to add

- A serialization test for a plain chat window proving the snapshot payload contains `appType: "wibwob-chat-v2"` and transcript/draft content.
- A restore test proving a saved `wibwob-chat-v2` snapshot reopens the plain chat window, not the synthetic transcript window.
- A prompt selection test proving plain mode does not include tool/desktop instructions, while agent mode does.
- A UI state test for the shared window proving plain mode title/placeholder/capture labels say `Wib&Wob Chat`, while agent mode says `Wib&Wob Agent`.
- A regression test that `WibWobAgentSession(..., "none")` creates the agent with `tools.length === 0` and no `transformContext`.
