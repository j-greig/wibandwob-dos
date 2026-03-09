# Handover — Monday 9 March 2026

## HANDOVER PROMPT FOR NEXT AGENT SESSION:

E025 Calculating Empires is DONE and merged to main. E025 branch merged clean.

### What shipped this session

E025 Calculating Empires TUI — closed (16/19 ACs, 2 dropped, 1 parked):
- Blessed mouse/focus/key bug cluster: triple root cause (global key registration,
  fixed:true lpos desync, screen._focus auto-scroll). Fix: removed clickable from
  all panel children, ALL interaction via screen-level handleDragMouse + pointerToContent.
  Full analysis in scratch/e025-bug-analysis.md
- Viewport clipping: panels at bottom edge no longer overflow (manual height clip
  since fixed:true bypasses blessed scroll clipping)
- Panel type glyph prefixes: PANEL_TYPE_PREFIX registry in panel-types.ts,
  switchable between glyph and label mode via setPrefixMode()
- Bottom toolbar: createButtonBar from src/core/ui-parts.ts with Search/Map/Pause
- Search: / key, readInput() pattern (not manual key handlers — blessed textbox
  crashes without it), enter submits, escape cancels
- Pause/play: p key freezes all animation ticks, toolbar button toggles
- Monster Cam: static ASCII art placeholder, w key still activates live webcam
- Search escape crash: blessed.textbox requires readInput(callback) or escape
  calls undefined done()

Planning infra (T3-D + T3-E):
- Deleted 3 ghost C++ skills (ww-build-game, ww-scaffold-view, micropolis-engine)
- Pre-commit hook fixed (protected paths: src/ modules/ not app/ tools/) and installed
- PARKED.md pruned, handovers moved to .planning/handovers/
- Agentic devlog updated with blessed patterns and SDK audit notes

### State of main

Clean. Typecheck passes. Zero open todos. Pre-commit hook active.

### Parked work (from E025)

- AC-11: Panel drag in dense grid — needs megatidyup, too many overlapping panels
  to drag meaningfully. Code is wired (handleDragMouse in index.ts) but UX blocked.
- AC-15: SDK boundary audit — 9 direct imports past microapp-sdk.ts in sy2-chronicles.
  Logged in agentic-devlog with file refs. Standalone chore.
- planning:sync should auto-run — friction note in devlog, option 1 (pre-commit hook)
  recommended but not yet implemented.

### Key files from this session

- modules/sy2-chronicles/index.ts — main module (~2450 lines)
- modules/sy2-chronicles/panel-types.ts — PANEL_TYPE_PREFIX registry
- src/core/panel-layout.ts — layoutPanels, pointerToContent, hitPanel
- src/core/ui-parts.ts:649 — createButtonBar component
- .claude/hooks/pre-commit-main-guard.sh — live pre-commit hook
- .planning/PARKED.md — current parking lot
- .planning/spikes/spk-agentic-tui-runtime-roadmap/agentic-devlog.md — friction log

### Critical blessed knowledge (carry forward)

- element.key() registers GLOBALLY on program, not per-element. Never register
  same keys on parent + child.
- fixed:true children bypass scroll clipping AND lpos hit-testing. Keep for
  rendering, but make them non-clickable. Handle clicks at screen level.
- screen._focus auto-scrolls on any clickable child focus. Override
  canvas._scrollIntoView AND canvas.focus to preserve childBase.
- blessed.textbox requires readInput(callback). Without it, escape crashes.
- Viewport clipping must be manual for fixed:true children in scrollable boxes.

### Next session candidates (ranked)

1. E027 GlitchBox TUI — Symbiont Embodiment (agents get ASCII bodies, depends E004+E016)
2. E019 Rogue TUI Port (not-started)
3. E001 Codified Context Infrastructure (not-started, foundational)
4. Implement planning:sync auto-run in pre-commit hook (quick win from devlog)
5. SDK boundary audit from AC-15 (chore, ~30min)
