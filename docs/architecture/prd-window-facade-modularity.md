PRD: WindowFacade — Single Window Operations Contract
WibWob-DOS / ts-tui-mvp
Status: READY
Date: 2026-03-01


PROBLEM

app-controller.ts is a god object. The same window
operations (move, resize, focus, close, send input,
write editor text, capture text) are declared across
five separate interfaces with inconsistent names,
different return types, and divergent semantics.

A change to window move behaviour requires edits in
five files. Bugs happen when one declaration drifts.


THE FIVE DECLARATIONS

1. WindowManager (core/window-manager.ts)
   The canonical geometry + stacking implementation.
     moveWindow(id, left, top): boolean
     resizeWindow(id, width, height): boolean
     focusWindowById(id): boolean
     closeWindowById(id): boolean
   Does NOT own: sendInput, writeEditorText, captureText.
   Does NOT have: getLastWindow().

2. AppController public bridge methods (app-controller.ts)
   Thin wrappers that exist solely so external consumers
   can reach windowManager without holding a reference.
     moveWindowById, resizeWindowById, focusWindowById,
     closeWindowById, sendWindowInputById,
     writeEditorTextById, captureWindowTextById
   ~60 lines of pure delegation.

3. ControlApiHandlers (services/control-api.ts)
   Interface consumed by ControlApiService.
     moveWindowById, resizeWindowById, focusWindowById,
     closeWindowById, sendWindowInput, writeEditorText,
     captureWindowText
   Same ops, third declaration.

4. TuiToolContext (services/agent-tools.ts)
   Interface consumed by WibWobAgentSession.
     moveWindow(id, left, top, width?, height?): boolean
     focusWindow, closeWindow, sendWindowInput,
     writeEditorText, captureWindowText
   Different naming (no "ById"). moveWindow combines
   move+resize in one call. captureWindowText returns
   raw text, unlike the control API version which
   exports to disk and returns a file path.

5. WorkspaceRestoreActions (core/workspace-snapshots.ts)
   Interface consumed by restoreWindowSnapshot.
     getLastWindow(): WindowRecord | undefined
     moveWindow(id, left, top): void
     resizeWindow(id, width, height): void
   Return type is void (hides success/failure).
   Async window openers create a race condition:
   getLastWindow() can return the wrong window.


SEMANTIC MISMATCHES

Move
  WindowManager: move only, returns boolean.
  TuiToolContext: move + optional resize in one call.
    Width-only or height-only resize is silently dropped.
  WorkspaceRestoreActions: move only, returns void.

Capture text
  WindowRecord.captureText(): raw text string.
  TuiToolContext.captureWindowText: raw text.
  ControlApiHandlers.captureWindowText: writes to disk,
    returns file path. Same verb, different meaning.

Restore geometry
  restoreWindowSnapshot is synchronous. Terminal and
  xterm-shell openers are async. getLastWindow() fires
  before the window exists. Geometry applies to the
  wrong window or fails silently.

Editor writes
  writeEditorTextById in AppController calls
  markEditorDirty. The TuiToolContext wrapper must
  route through the same path or dirty state drifts.
  (Bug existed, now fixed — but the architecture
  makes it easy to reintroduce.)


SOLUTION: WindowFacade

One interface. Every consumer gets the same object.
AppController stops brokering.

  File: core/window-facade.ts

  import type { WindowRecord } from "./types.js";

  export interface WindowFacade {
    // Query
    getWindows(): WindowRecord[];
    getWindowById(id: number): WindowRecord | undefined;
    getLastWindow(): WindowRecord | undefined;
    getFocusedWindow(): WindowRecord | undefined;

    // Geometry
    moveWindow(id: number, left: number, top: number): boolean;
    resizeWindow(id: number, w: number, h: number): boolean;
    focusWindow(id: number): boolean;
    closeWindow(id: number): boolean;

    // Content
    sendInput(id: number, input: string): boolean;
    writeEditorText(id: number, text: string): boolean;
    captureText(id: number): string | undefined;
  }

captureText always returns raw text. File export is a
concern of ControlApiService, not the facade.

sendInput delegates to WindowRecord.writeInput.
writeEditorText delegates to the editor mutation path
including dirty marking. These behaviours currently live
in AppController — they move into the facade
implementation (a thin wrapper around WindowManager +
WindowRecord hooks).


IMPLEMENTATION

WindowManager already owns geometry and stacking. The
facade implementation wraps WindowManager and adds the
three content methods that currently live in
AppController. Two options:

  Option A: WindowManager implements WindowFacade
  directly. Add sendInput, writeEditorText, captureText
  as methods on WindowManager that delegate to
  WindowRecord hooks.

  Option B: Create a WindowFacadeImpl class that holds
  a WindowManager reference and adds the content methods.
  Keeps WindowManager focused on geometry.

Recommended: Option A. WindowManager already calls
record.focus() and record.close() — adding
record.writeInput() and record.captureText() is the
same pattern. writeEditorText needs access to the
editor mutation + dirty marking path, which can be
injected as a callback at construction time.


MIGRATION PLAN

Phase 1 — Define interface, implement on WindowManager
  Create core/window-facade.ts with the interface.
  Add to WindowManager:
    getLastWindow()
    sendInput(id, input) — delegates to record.writeInput
    captureText(id) — delegates to record.captureText
    writeEditorText(id, text) — needs a callback for
      editor mutation + dirty marking. Accept an
      onEditorWrite callback in WindowManager constructor
      or as a setter. AppController provides it.
  Rename focusWindowById → focusWindow,
  closeWindowById → closeWindow (keep old names as
  aliases during migration).
  Make WindowManager satisfy WindowFacade.
  No behaviour change. Tests: facade contract test
  covering all 11 methods.

  Effort: 1.5 hours.

Phase 2 — Collapse WorkspaceRestoreActions
  Remove moveWindow + resizeWindow from the interface.
  Pass WindowFacade into restoreWindowSnapshot.
  Fix the async restore race: change async window
  openers to return Promise<WindowRecord> so restore
  can await them and apply geometry to the correct
  window. If that's too invasive, have openers accept
  an optional geometry argument applied internally
  after creation.
  Reduces WorkspaceRestoreActions to pure open-window
  callbacks.

  Effort: 1.5 hours (includes async fix).

Phase 3 — Collapse TuiToolContext
  Replace moveWindow, focusWindow, closeWindow,
  sendWindowInput, writeEditorText, captureWindowText
  in TuiToolContext with a single windows: WindowFacade
  field.
  Agent tool implementations call facade directly.
  The tui_move_window tool calls facade.moveWindow then
  facade.resizeWindow (two calls, explicit). Remove the
  combined move+resize signature.
  Validate that width-only or height-only resize
  requests are rejected at the tool schema level (both
  required, or neither).
  Eliminates the lambda wrappers in AppController's
  openWibWobAgentWindow method (~40 lines).

  Effort: 1 hour.

Phase 4 — Collapse ControlApiHandlers window ops
  Replace the seven individual window-op callbacks in
  ControlApiHandlers with windows: WindowFacade.
  ControlApiService calls facade directly.
  File-export capture moves into ControlApiService:
  call facade.captureText for raw text, then write to
  disk locally if needed.
  Removes moveWindowById, resizeWindowById,
  focusWindowById, closeWindowById, sendWindowInputById,
  writeEditorTextById, captureWindowTextById from
  AppController entirely.

  Effort: 1.5 hours.

Phase 5 — AppController diet
  Delete the public *ById bridge methods (~60 lines).
  Delete the constructor-time wrapper lambdas (~30
  lines).
  windowManager (as WindowFacade) is now passed directly
  to consumers at construction time.
  Estimated net reduction: 100-150 lines.

  Effort: 30 minutes.


WHAT DOES NOT CHANGE

  WindowManager internal stacking/z-order/tiling logic.
  All window opening functions stay in AppController
  (they need screen, overlays, services).
  WorkspaceRestoreActions keeps its open-window callbacks
  (those are specific to restore, not window ops).
  ControlApiHandlers keeps its open-* callbacks
  (those need AppController business logic).


RISKS AND MITIGATIONS

Risk: writeEditorText needs dirty marking, which lives
in AppController today.
Mitigation: inject an onEditorWrite callback into the
facade implementation. AppController provides it. The
facade calls it after mutation. Single call site.

Risk: circular imports if window-facade.ts imports from
types.ts which imports from window-manager.ts.
Mitigation: WindowFacade uses only WindowRecord, already
in core/types.ts. No circular dependency.

Risk: TuiToolContext's combined move+resize signature is
used by the agent. Splitting it requires updating the
tool schema.
Mitigation: make both width and height required in
tui_move_window schema (not optional). Tool calls
facade.moveWindow then facade.resizeWindow. If neither
width nor height is provided, only move happens.

Risk: over-permissive — some consumers only need read
access.
Mitigation: acceptable. Can split WindowFacade into
reader/writer later if needed.

Risk: async workspace restore race.
Mitigation: addressed in Phase 2. Either await the
opener or have openers accept initial geometry.


SUCCESS CRITERIA

  WorkspaceRestoreActions contains zero move/resize ops.
  TuiToolContext contains zero window-op re-declarations.
  ControlApiHandlers contains zero window-op callbacks.
  AppController has zero public *ById bridge methods.
  A change to moveWindow semantics requires editing
  exactly one file: window-manager.ts.
  captureText means raw text everywhere. File export
  is ControlApiService's concern only.
  TypeScript compiles clean throughout.
  Facade contract test covers all 11 methods.


TOTAL EFFORT

  Phase 1: 1.5 hours
  Phase 2: 1.5 hours
  Phase 3: 1 hour
  Phase 4: 1.5 hours
  Phase 5: 30 minutes

  Total: ~6 hours
  Low risk. Phases are independent and can be committed
  separately. Each phase leaves the codebase in a
  working state.


STRETCH: AGENT SESSION RESTORE (Phase 6)

WibWobAgentSession generates a sessionId on construction.
Conversation lives only in Agent's in-memory state. On
workspace restore the agent window opens fresh — no
transcript, no LLM context. The restore path in
workspace-snapshots.ts has no branch for appType
"wibwob-agent" — agent windows are silently skipped.

Two levels of messages to restore:

  UI messages (ChatMessageEntry[]) — what the transcript
  renders. Restoring these gives the display back.

  LLM messages (AgentMessage[]) — what gets sent to the
  model. Restoring these gives the model continuity.
  Agent.replaceMessages() exists for this.

Changes needed:

  wibwob-agent-session.ts
    Accept optional sessionId in constructor.
    Add hydrate({ uiMessages, llmMessages }) that
    populates transcript and calls replaceMessages().
    Add getLlmMessages() returning agent.state.messages.

  wibwob-agent-window.ts
    describeState returns sessionId, uiMessages, and
    llmMessages.

  workspace-snapshots.ts
    buildWindowSnapshotPayload detects appType
    "wibwob-agent" and saves session data.
    restoreWindowSnapshot adds a branch for
    "wibwob-agent" that calls a new restore action.

  app-controller.ts
    Add openWibWobAgentWindow to WorkspaceRestoreActions.
    Pass hydration data through.

  Effort: 3 hours.


FILE REFERENCE

  core/window-facade.ts         NEW — interface definition
  core/window-manager.ts        lines 21-303 — canonical impl
  core/app-controller.ts        lines 140-180, 304-460, 1556-1610, 1876-1878, 1961-2020
  core/workspace-snapshots.ts   lines 111-120, 226-229
  core/context-menu-items.ts    lines 17-28
  core/types.ts                 WindowRecord lines 175-192
  services/control-api.ts       ControlApiHandlers lines 32-58
  services/agent-tools.ts       TuiToolContext lines 26-42
