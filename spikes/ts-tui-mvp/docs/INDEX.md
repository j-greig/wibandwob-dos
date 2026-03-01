TS TUI Spike — Document Index
==============================


ACTION DOCS (do these)

These three drive all remaining work. Read in order.

1. BUILD-ORDER-FINAL.md
   The sequencing bible. 11-step build order for the
   full TS rewrite. Internal seams first, external
   contracts second, agent/LLM surfaces last.

2. docs/architecture/prd-window-facade-modularity.md
   (repo root, not spike dir)
   WindowFacade extraction + full architecture audit.
   11-method interface, 6-phase migration, plus addendum
   covering 9 codebase-wide DRY violations. Do first.

3. 018-command-registry-and-tool-adapter-prd.md
   CommandRegistry replacing 5-file shotgun surgery.
   Define a command once, project to menu/palette/API/
   agent/MCP. Do second (after WindowFacade).


DONE (findings absorbed, no action needed)

  window-facade-review.md
    Codex code review. All findings folded into the
    rewritten WindowFacade PRD. Reference only.

  editor-save-review.md
    Codex code review of editor save. 4 bugs found,
    all fixed in commit e91e188. Reference only.

  BUILD-ORDER.md
    Superseded by BUILD-ORDER-FINAL.md. Kept for the
    three-layer analysis (codex/pi/meta-review) which
    informed the final ordering.


FEATURE SPECS (pick up when ready)

  docs/development/spike-editor-save.md
    (repo root) Editor Save/Save As/dirty indicator.
    Implemented. Steps 1-7 done.

  spk-agent-window-enhancement.md
    Agent window with TUI tools. Implemented. 15 tools
    registered, desktop state injected per turn.

  wibwob-chat-v2-plan.md
    Chat window v2 plan. Partially superseded — the
    modularity audit recommends collapsing chat into
    agent window with tools="none".


REFERENCE (background reading)

  overview.md
    Spike overview, tech stack, what exists.

  refactor-epoch-plan.md
    Epoch 1 done (2878->2565 lines). Epoch 2 planned.
    Parking lot of 8 items.

  001-primer-dimensions-and-agent-sizing.md
    Primer measurement and agent sizing workflow.

  002-architecture-plan-content-sizing-layout.md
    Content sizing and layout architecture.

  003-document-plan.md
    Original 14-doc handover plan. Build order in
    003 is WRONG — superseded by BUILD-ORDER-FINAL.

  003-pi-mono-chat-window-evaluation.md
    Evaluation of pi-mono chat window for reuse.

  004-piclaw-sandbox-evaluation.md
    Evaluation of piclaw sandbox approach.

  004-window-type-registry-and-factories.md
    Window type registry handover doc from C++ app.

  005-llm-integration-and-claude-sdk-bridge.md
    LLM integration and Claude SDK bridge handover.

  006-command-registry-and-ipc-protocol.md
    C++ command registry and IPC protocol handover.

  007-terminal-emulator.md
    Terminal emulator handover.

  008-theme-system-and-desktop-rendering.md
    Theme system handover.

  009-paint-canvas-system.md
    Paint canvas handover.

  010-browser-and-text-rendering.md
    Browser and text rendering handover.

  011-games-and-generative-art.md
    Games and generative art handover.

  012-micropolis-integration.md
    Micropolis/SimCity integration handover.

  013-events-persistence-and-multi-instance.md
    Events, persistence, multi-instance handover.

  014-gaps-from-skill-crosscheck.md
    Gaps found by cross-checking skills against code.

  015-window-manager-reference-and-repair-plan.md
    Window manager repair plan.

  016-terminal-kit-screenbuffer-animation-spike.md
    Terminal-kit screenbuffer animation research.

  017-framework-direction-and-today-plan.md
    Framework direction notes.

  terminal-native-research.md
    Research into terminal-native approaches.


REPO-ROOT ARCHITECTURE DOCS

  docs/architecture/prd-window-facade-modularity.md
    THE main architecture doc. WindowFacade + audit.

  docs/architecture/chat-message-flow.md
    Chat message flow documentation.

  docs/architecture/parity-drift-audit.md
    C++/Python API parity drift audit.

  docs/architecture/phase-zero-canon-alignment.md
    Phase zero canonical alignment plan.

  docs/architecture/refactor-brief-vnext.md
    Refactor brief for next version.

  docs/development/github-markdown-posting.md
    GitHub markdown posting guardrails.

  docs/development/spike-editor-save.md
    Editor save feature spec (done).
