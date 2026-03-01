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


ADDENDUM: ARCHITECTURE-WIDE DRY AND MODULARITY AUDIT

Date: 2026-03-01


PRD REVIEW

The WindowFacade PRD is sound.

It correctly identifies the most immediate duplicated
window-operations contract and the restore race caused
by async openers plus getLastWindow().

Two things are missing:

1. The same problem exists for window OPENING, not just
   window OPERATIONS. open-* callbacks are duplicated
   across menus, context menus, control API handlers,
   workspace restore, and agent tool maps.

2. The larger root cause is not only "missing facade".
   It is "no canonical window type/module contract".
   Without a WindowTypeRegistry / WindowTypeModule seam,
   facade work will reduce one hotspot but not the
   switchboards and bag-of-optionals elsewhere.

Recommended PRD follow-on:

  After WindowFacade, the next extraction should be:

    WindowTypeModule<TState>
      create()
      describeState()
      serializeSnapshot()
      restoreSnapshot()
      getMenuEntries?()
      getCommands?()

  and a WindowTypeRegistry keyed by app/window slug.


ROOT CAUSE

The spike has no single module boundary for a window
type or a user command.

Because of that, each new feature is mirrored by hand
across:

  - shared type bags
  - app-controller wrapper methods
  - control-api interfaces and routes
  - agent tool interfaces and maps
  - menu and palette action interfaces
  - workspace snapshot switches
  - per-window describeState closures

The repeated declarations are not accidental. They are
the result of missing first-class abstractions for:

  - window capabilities
  - window type registration
  - snapshot/state ownership
  - command dispatch
  - editor session ownership
  - overlay prompt composition
  - theme tokens


FINDINGS

1. Repeated window OPENING contracts and spawn maps

Problem
  The same open-* surface is declared in multiple
  interfaces and maps:

  menu-config.ts:3-37
    AppMenuActions lists ~30 open/save/window actions.

  context-menu-items.ts:3-12
    SystemContextActions repeats a subset.

  control-api.ts:32-60
    ControlApiHandlers repeats another subset.

  workspace-snapshots.ts:94-121
    WorkspaceRestoreActions repeats restore openers.

  app-controller.ts:153-181, 322-333, 403-454,
  1915-1935, 1947-1983
    The same window types are manually re-exposed via
    constructor wiring, system menu wiring, agent tool
    maps, restore actions, and menu action builders.

Shotgun surgery count
  Adding one new window type usually touches 5-7 places:
  menu-config, control-api handlers, app-controller
  constructor wiring, agent open map, restore actions,
  snapshot restore switch, and often context menu.

Extracted abstraction
  WindowTypeRegistry plus OpenWindowService.

  Registry owns:
    slug
    label
    create/open
    restore
    menu/palette metadata
    control-api exposure metadata
    agent exposure metadata

Future feature impact
  Blocks BUILD-ORDER step 2 directly.
  Complicates every new window type, especially paint,
  browser, games, and agent surfaces.

Effort
  1.5-2.5 days for a 3-window pilot.


2. Snapshot serialize/restore switchboards are still
   centralized and drift-prone

Problem
  workspace-snapshots.ts:6-91
    buildWindowSnapshotPayload() is a switch on
    window.kind with per-kind payload conventions.

  workspace-snapshots.ts:123-232
    restoreWindowSnapshot() is another switch on
    snapshot.kind with more per-kind branching on
    payload.appType.

  windows/*.ts and app-controller.ts define ad-hoc
  describeState() payloads independently:
    text-windows.ts:36-42
    content-windows.ts:62-67, 232-238, 307-318,
      578-584
    misc-windows.ts:39-43, 171-176, 219-223,
      268-272, 337-343, 375-379, 416-420
    wibwob-chat-window.ts:164-178
    wibwob-agent-window.ts:203-211
    app-controller.ts:590-605, 735-741, 978-983,
      1326-1334

  State shape, snapshot shape, and restore shape are
  owned by different files. They can drift silently.

Shotgun surgery count
  Changing one window's persisted state commonly
  touches 3-5 places:
  window file describeState, workspace serialize,
  workspace restore, app-controller open signature,
  and sometimes control/state consumers.

Extracted abstraction
  WindowTypeModule<TState> with:
    describeState(record): WindowStateDetails
    serialize(record): SnapshotPayload
    restore(snapshot, deps): Promise<WindowRecord>

Future feature impact
  Directly blocks BUILD-ORDER step 2 and step 3.
  Makes workspace save/load, screenshot regression,
  and state/control parity brittle as more windows land.

Effort
  2-3 days once registry extraction starts.


3. WindowRecord is a growing bag of optionals instead
   of a capability model

Problem
  types.ts:171-193
    WindowRecord mixes every window family's private
    state and hooks:
      editor?
      isDirty?
      lastSavedContent?
      terminal?
      chat?
      writeInput?
      cleanup?
      refresh?
      captureText?
      describeState?
      openContextMenu?

  Consumers probe these ad hoc:
    app-controller.ts:441-445, 459-461, 2025-2044
    workspace-snapshots.ts:22-88
    state-service.ts:96-112
    context-menu-items.ts:28-32

  This is feature envy plus SRP breakage. Shared code
  knows too much about each window family's internals.

Shotgun surgery count
  Adding a new capability usually touches 4+ places:
  types.ts, window factory, controller/service call
  sites, and snapshot/state code.

Extracted abstraction
  Keep WindowRecord minimal:
    id, kind, title, frame, focus, close

  Move per-family data into module-owned state and add
  small capability interfaces:
    TextCapturable
    InputWritable
    StateDescribable
    SnapshotSerializable
    ResizableContent

Future feature impact
  Directly called out by BUILD-ORDER-FINAL and
  refactor-epoch-plan.
  Will get worse with paint, games, browser state,
  richer terminal state, and per-window commands.

Effort
  2-4 days depending on how many windows migrate.


4. Editor behavior is split across three layers with no
   canonical editor service boundary

Problem
  text-windows.ts:7-50
    openEditorWindow() creates the frame and editor
    state but does not own mutation lifecycle.

  app-controller.ts:1565-1620, 1651-1778, 2034-2044
    Controller owns save orchestration, save-as write,
    dirty tracking, title rendering, keyboard edits,
    tool/API edits, and render calls.

  file-actions.ts:81-123
    saveEditorWindow()/writeEditorWindow() own file IO
    and some title/filePath updates.

  editor-service.ts:3-35
    Owns low-level text mutation and render.

  A behavior change like "editor write should update
  dirty state and title consistently" spans four files.

Shotgun surgery count
  4 files for editor mutation/save behavior:
  app-controller, text-windows, file-actions,
  editor-service.

Extracted abstraction
  EditorSession / EditorFacade:
    insertText
    deleteBackward
    deleteForward
    moveCursor
    render
    save
    saveAs
    markDirty/markClean
    describeState

  Window factory should host the session, not the
  controller.

Future feature impact
  Complicates docs/development/spike-editor-save.md.
  Will block richer editor model work from BUILD-ORDER
  step 6 and any command/API parity for editor actions.

Effort
  1-1.5 days.


5. Command surfaces are duplicated across menu,
   palette, control API, and agent tools

Problem
  menu-config.ts:41-144
    Menu items and palette commands are hand-listed.

  control-api.ts:185-321
    REST routes are hand-dispatched per behavior.

  agent-tools.ts:24-227
    Agent tools are hand-declared per behavior.

  app-controller.ts:152-181, 1947-1983
    AppController wires each callback separately.

  Same intent, four representations, no typed registry.

Shotgun surgery count
  A new command-like behavior can touch 4-6 places:
  controller method, control-api route, handler
  interface, menu/palette entry, agent tool, and docs.

Extracted abstraction
  CommandRegistry:
    name
    label
    schema
    execute
    menu visibility
    API visibility
    agent visibility

  Full PRD already exists:
  spikes/ts-tui-mvp/docs/018-command-registry-and-tool-adapter-prd.md

  That doc defines CommandDefinition, CommandContext,
  adapters for menu/palette/API/agent/MCP, a 5-phase
  migration plan, and uses the file manager as the
  reference implementation. Treat it as the canonical
  plan for this problem.

Future feature impact
  Directly blocks BUILD-ORDER step 4.
  Makes external agent integration unstable because
  prompts freeze around ad-hoc routes/tools.

Effort
  2 days for core commands and adapters.


6. OverlayManager duplicates prompt/list-browser logic
   and remains a UI god object

Problem
  overlay-manager.ts:51-105
    openValuePrompt()

  overlay-manager.ts:108-191
    openPathPrompt()

  overlay-manager.ts:214-399
    openBrowserPrompt()

  overlay-manager.ts:403-648
    openFileBrowserPrompt()

  openBrowserPrompt() and openFileBrowserPrompt()
  duplicate modal creation, search box wiring, list
  wiring, close cleanup, preview plumbing, and jump
  behavior. The file browser is mostly "browser prompt
  plus directory source".

Shotgun surgery count
  Search/list UX changes require 2-4 edits inside the
  same class, and any new picker is likely to copy one
  of these again.

Extracted abstraction
  PromptOverlay primitives:
    ModalPrompt
    FilterableListPrompt
    PreviewPanePrompt
    FileSystemDataSource

Future feature impact
  Complicates future font pickers, browser pickers,
  save/load prompts, command palette evolution, and
  themed overlay work.

Effort
  1-1.5 days.


7. WibWob chat windows are parallel implementations of
   the same transcript/input shell

Problem
  wibwob-chat-window.ts:24-190
    Native chat window.

  wibwob-agent-window.ts:54-230
    Agent chat window.

  Both create:
    transcript pane
    input pane
    local draft state
    renderInput()
    focus/blur/click wiring
    keypress handling
    subscribe/unsubscribe lifecycle
    writeInput()
    describeState()

  They already diverge:
    different wrap behavior
    different status line behavior
    different transcript formatting
    different restore/hydrate paths

Shotgun surgery count
  Chat-shell behavior changes touch 2 files now, and
  likely a third when Pi/PTy chat parity is revisited.

Extracted abstraction
  Do not extract a separate ChatWindowView. Instead,
  collapse wibwob-chat-window into wibwob-agent-window.

  The "plain chat" window is just an agent window with
  zero tools registered. WibWobAgentSession already
  accepts tools via createTuiTools — pass an empty
  array and you get a vanilla LLM chat. The session
  class, event handling, transcript rendering, and
  input plumbing are identical.

  Concrete plan:
    Remove wibwob-chat-window.ts entirely.
    Remove WibWobChatSession (wibwob-chat-service.ts).
    WibWobAgentSession gains a constructor option:
      tools?: "full" | "none" (default "full")
    "none" skips createTuiTools and createJailedCodingTools.
    openWibWobChatWindow delegates to openWibWobAgentWindow
    with tools: "none".
    Menu entries, API routes, and restore paths collapse
    from two branches to one with a tools flag.

  This eliminates the duplication at source rather than
  papering over it with a shared component. One session
  class, one window factory, one restore path.

Future feature impact
  Directly complicates
  spk-agent-window-enhancement.md.
  Tool event rendering, model switching, history clear,
  and workspace persistence will drift between chat
  windows unless unified.

Effort
  1 day (less than the shared-component approach
  because it deletes code rather than extracting it).


8. Content measurement and metadata mapping are still
   duplicated instead of becoming one content contract

Problem
  content-service.ts:171-190
    readPrimerMetadata() measures primer files.

  file-actions.ts:39-77
    openPrimerFile() re-reads and re-measures primer
    content instead of consuming canonical metadata.

  content-windows.ts:268-330
    openTextViewerWindow() defines another inline
    contentMeasurement shape.

  app-controller.ts:1987-2001
    getPrimerInfo() remaps the same metadata again.

  figlet-service.ts:138-157
    Figlet has a separate measure path and result shape.

Shotgun surgery count
  Adding one new metadata field like contentAspect or
  recommendedChrome touches 4-5 places.

Extracted abstraction
  MeasuredContent / ContentDescriptor:
    sourceType
    contentWidth
    contentHeight
    recommendedWidth
    recommendedHeight
    animated
    frameCount
    previewText

  All open/info/state APIs consume this shared type.

Future feature impact
  Directly blocks BUILD-ORDER step 1, step 5 parcel
  work, and universal typeInfo sizing workflows.

Effort
  1 day.


9. Theme and chrome styling are duplicated as literals
   across core and window factories

Problem
  window-manager.ts:66-121
    frame/title/body/close/grip styles are inline.

  overlay-manager.ts:31-35, 62-65, 77-79, 125-128,
  140-154, 230-289, 423-483
    prompt styles repeat the same fg/bg/border triples.

  windows/*.ts repeat white/black/blue/cyan styling:
    text-windows.ts:27
    content-windows.ts:30,45,99,109,124,136,178,
      301,357,365,379,388,400
    misc-windows.ts:28,121,131,202,242,299,318,
      371,408
    wibwob-chat-window.ts:49,59
    wibwob-agent-window.ts:78,87,98
    figlet-windows.ts:55,69

Shotgun surgery count
  A theme pass already means multi-file edits.
  Adding desktop presets would multiply this.

Extracted abstraction
  Theme tokens:
    frameBorderActive
    frameBorderInactive
    titleBar
    textBody
    inputField
    menuAccent
    footerHint
    notification

  WindowManager and overlays consume roles, not colors.

Future feature impact
  Directly blocks BUILD-ORDER step 5.
  Also makes extracted modules copy visual literals.

Effort
  0.5-1 day.


10. State contract is structurally weak: describeState()
    is untyped and doubles as live UI summary plus
    persistence source

Problem
  types.ts:102-107
    WindowStateDetails has only appType plus an index
    signature `[key: string]: unknown`.

  state-service.ts:96-112
    StateService trusts describeState() blindly.

  workspace-snapshots.ts:29-88
    Snapshot payload extraction reaches back into that
    loose shape via typeof checks.

  This is a DRY violation at the schema level. The same
  meaning is re-encoded by convention, not by type.

Shotgun surgery count
  Any field rename or shape change touches producer,
  state consumer, snapshot serializer, restore logic,
  and sometimes API consumers.

Extracted abstraction
  Per-window typed state DTO owned by the module.
  State service should consume a typed module contract,
  not a free-form bag.

Future feature impact
  Blocks reliable state/control parity and regression
  fixtures from BUILD-ORDER step 3.

Effort
  Fold into WindowTypeModule work above.


PRIORITY ORDER

If fixing in dependency order:

  1. WindowFacade
  2. WindowTypeRegistry / module contract
  3. WindowRecord capability cleanup
  4. CommandRegistry
  5. EditorSession extraction
  6. Overlay prompt primitives
  7. Chat shell unification
  8. ContentDescriptor unification
  9. Theme tokens


RISKS IF LEFT AS-IS

  New window types will continue to require edits in
  5+ files.

  Workspace save/load will drift from live state.

  Agent tools and control API will keep exposing subtly
  different semantics for the same action.

  Theme work will become a mass search/replace across
  factories instead of a token swap.

  The next large feature (paint, browser, game, or
  richer editor) will expand app-controller again
  instead of shrinking it.


TESTS TO ADD WITH THE REFACTOR

  WindowFacade contract tests:
    get/focus/move/resize/close/sendInput/writeEditor/
    captureText semantics.

  WindowTypeModule round-trip tests:
    create -> describeState -> serialize -> restore.

  Workspace restore async tests:
    buffered terminal/xterm/pi openers restore geometry
    onto the correct record.

  CommandRegistry adapter tests:
    same command callable from menu, API, and agent
    adapter with one implementation.

  EditorSession tests:
    insert/delete/cursor/save/save-as/dirty/title sync.

  Overlay prompt tests:
    filter, selection, preview, close cleanup, path
    completion, and directory navigation.

  Chat shell tests:
    input handling, transcript rendering, tool event
    rendering, and hydrate/restore parity.

  ContentDescriptor tests:
    primer and figlet measurement map to one schema.

  Theme token smoke tests:
    a token change updates frame, overlays, and at
    least one extracted window family.
