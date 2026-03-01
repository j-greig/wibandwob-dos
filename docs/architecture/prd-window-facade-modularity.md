PRD: WindowManager as the Single Source of Truth
WibWob-DOS / ts-tui-mvp
Status: DRAFT
Date: 2026-03-01


PROBLEM STATEMENT

app-controller.ts is 2015 lines and growing. The same
window operations (move, resize, focus, close) are
implemented or re-wrapped in at least FIVE separate
interfaces:

  1. WindowManager methods (the canonical implementation)
       moveWindow, resizeWindow, focusWindowById,
       closeWindowById

  2. AppController public methods (thin pass-throughs)
       moveWindowById, resizeWindowById, focusWindowById,
       closeWindowById, sendWindowInputById etc.
       These exist only so ControlApiHandlers can call
       them without holding a windowManager reference.

  3. ControlApiHandlers interface (services/control-api.ts)
       moveWindowById, resizeWindowById, focusWindowById,
       closeWindowById — same names, same signatures,
       third declaration of the same contract.

  4. TuiToolContext interface (services/agent-tools.ts)
       moveWindow, focusWindow, closeWindow — same ops,
       different naming convention (no "ById" suffix),
       fourth declaration.

  5. WorkspaceRestoreActions interface
       (core/workspace-snapshots.ts)
       moveWindow, resizeWindow — added 2026-03-01 to fix
       the restore bug. Fifth declaration of a subset of
       the same contract.

The result: a change to window move semantics (e.g.
adding animation, adding an event hook) requires edits
in five places. The bug fixed on 2026-03-01 existed
precisely because workspace-snapshots.ts was bypassing
the canonical path.


ROOT CAUSE

AppController acts as a God Object. It holds
windowManager privately and mediates every consumer's
access to it through bespoke wrapper interfaces. Each
new consumer (control API, agent tools, workspace
restore) gets its own hand-rolled subset of the same
window operations.


PROPOSED SOLUTION: WindowFacade

Extract a single exported interface WindowFacade from
WindowManager. Every consumer gets a reference to the
same facade object. AppController stops being the
broker.

  File: core/window-facade.ts

  export interface WindowFacade {
    // Query
    getWindows(): WindowRecord[];
    getWindowById(id: number): WindowRecord | undefined;
    getLastWindow(): WindowRecord | undefined;
    getFocusedWindow(): WindowRecord | undefined;

    // Manipulation
    moveWindow(id: number, left: number, top: number): boolean;
    resizeWindow(id: number, w: number, h: number): boolean;
    focusWindow(id: number): boolean;
    closeWindow(id: number): boolean;

    // Input / content
    sendInput(id: number, input: string): boolean;
    writeEditorText(id: number, text: string): boolean;
    captureText(id: number): string | undefined;
  }

WindowManager implements WindowFacade directly (it
already has all these methods; mostly renaming and
exposing getLastWindow).


MIGRATION PLAN

Phase 1 — Define and implement WindowFacade (low risk)
  - Create core/window-facade.ts with the interface
  - Add getLastWindow() to WindowManager
  - Make WindowManager satisfy WindowFacade
  - No behaviour change, pure interface work

Phase 2 — Collapse WorkspaceRestoreActions (easy win)
  - Remove moveWindow + resizeWindow from
    WorkspaceRestoreActions (the ones added in the fix)
  - Pass WindowFacade directly into restoreWindowSnapshot
  - Reduces WorkspaceRestoreActions to pure open-window
    callbacks, which is its proper concern

Phase 3 — Collapse TuiToolContext into WindowFacade
  - agent-tools.ts TuiToolContext has moveWindow,
    focusWindow, closeWindow already
  - Add the remaining ops (sendInput, writeEditorText,
    captureText) to WindowFacade
  - AppController passes windowManager (as WindowFacade)
    directly to agent tools
  - Eliminates the lambda wrappers at app-controller.ts
    lines 424-445

Phase 4 — Collapse ControlApiHandlers window ops
  - ControlApiHandlers currently receives individual
    callbacks for focusWindowById, moveWindowById etc.
  - Replace those four fields with a single
    windows: WindowFacade
  - ControlApiService calls facade directly
  - Removes the moveWindowById / resizeWindowById /
    focusWindowById / closeWindowById methods from
    AppController entirely (lines 1944-2005)

Phase 5 — AppController diet
  - After phases 2-4, AppController no longer needs the
    *ById family of public methods
  - Those methods exist only to bridge private
    windowManager to external consumers — once consumers
    hold WindowFacade directly, the bridge dissolves
  - Estimated line reduction: ~100-150 lines from
    app-controller.ts

Phase 6 — Agent session restore (stretch goal)
  See AGENT SESSION RESTORE section below.


WHAT DOES NOT CHANGE

  - WindowManager internal logic is untouched
  - All window opening functions stay in AppController
    (they need screen, overlays, services — fair home)
  - WorkspaceRestoreActions keeps its open-window
    callbacks (those ARE specific to restore logic)
  - ControlApiHandlers keeps its open-* callbacks
    (those need AppController business logic)


RISKS AND MITIGATIONS

  Risk: circular imports if window-facade.ts imports
  from types.ts which imports from window-manager.ts
  Mitigation: WindowFacade uses only WindowRecord,
  already in core/types.ts. No circular dependency.

  Risk: TuiToolContext currently has a combined
  moveWindow(id, left, top, width?, height?) signature
  that does move+resize in one call. WindowFacade splits
  these. Agent tools need a two-call sequence.
  Mitigation: add a convenience moveAndResize() to
  WindowFacade, or handle in the tool itself. Minor.

  Risk: AppController passes different subsets to
  different consumers today. Some consumers only need
  read access. Giving them full WindowFacade is slightly
  over-permissive.
  Mitigation: acceptable trade. Can split into
  WindowReader / WindowWriter later if needed.


SUCCESS CRITERIA

  - WorkspaceRestoreActions no longer contains any
    move/resize operations
  - TuiToolContext no longer re-declares move/focus/
    close/send operations
  - ControlApiHandlers no longer re-declares
    move/resize/focus/close operations
  - AppController loses the *ById public method family
  - A change to moveWindow semantics requires editing
    exactly one file: window-manager.ts
  - TypeScript compiles clean throughout


EFFORT ESTIMATE

  Phase 1: 1 hour
  Phase 2: 30 min (we are halfway there already)
  Phase 3: 1 hour
  Phase 4: 1.5 hours
  Phase 5: 30 min cleanup
  Phase 6: 3 hours (see below)

  Total phases 1-5: ~4.5 hours
  Total with phase 6: ~7.5 hours
  Low risk. Phases are independent and can be PRd
  separately.


AGENT SESSION RESTORE (Phase 6)

Background

WibWobAgentSession generates a sessionId on construction
(e.g. "wibwob-agent-1709295600000"). This is passed to
pi-agent-core Agent as a provider cache hint, NOT a
server-side session store. Anthropic ignores it.
Conversation lives only in Agent's in-memory state.

The agent window's describeState currently returns only
appType, status, messageCount, streaming, model, ready.
No sessionId, no messages. So on workspace restore the
agent window opens completely fresh — no transcript, no
LLM context.

Additionally: the restore path in workspace-snapshots.ts
for kind "chat" with appType "wibwob-chat-v2" routes to
openWibWobChatWindow. There is NO branch for
"wibwob-agent". The agent window is silently skipped
and reopened blank. This is a separate bug.

Two levels of messages to restore

  UI messages — ChatMessageEntry[] — what the transcript
  renders (user/assistant/status/tool records). Restoring
  these gives the display back.

  LLM messages — AgentMessage[] — what gets sent to the
  model as conversation context. Restoring these means
  the model can continue coherently. Agent.replaceMessages()
  exists for exactly this purpose.

What needs changing

  wibwob-agent-session.ts
    Accept optional sessionId in constructor, fall back
    to generating one if not supplied.
    Add hydrate(restore: { uiMessages, llmMessages })
    that populates this.messages and calls
    agent.replaceMessages() if agent is already
    initialised (or stores for use on next initialize).
    Add getLlmMessages() getter returning
    agent.state.messages snapshot.

  wibwob-agent-window.ts
    Add sessionId, uiMessages, and llmMessages to
    describeState return value.

  workspace-snapshots.ts
    buildWindowSnapshotPayload for "chat" kind: detect
    appType "wibwob-agent" and save sessionId,
    uiMessages, llmMessages alongside existing fields.
    restoreWindowSnapshot for "chat" kind: add branch
    for appType "wibwob-agent" that calls a new
    openWibWobAgentWindow restore action with hydration
    data.

  app-controller.ts
    Add openWibWobAgentWindow to WorkspaceRestoreActions.
    Wire it in loadWorkspace.
    Pass sessionId and messages through to session
    constructor/hydrate.

Note on sessionId semantics

  Restoring the sessionId preserves cache coherence on
  providers that support it (currently only OpenAI Codex
  in this codebase). It does NOT restore model memory on
  its own. The LLM message restore via replaceMessages()
  is what gives genuine continuity. The sessionId comes
  along for correctness but is not the mechanism.
