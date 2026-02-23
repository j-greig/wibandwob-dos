# Epic Status Register

> Machine-parseable index. One line per epic: `<dir> — <status>`.
> Valid statuses: `not-started`, `in-progress`, `blocked`, `done`, `dropped`.
> Canonical detail lives in each epic's frontmatter and GitHub issue.

<today>
## Today's Focus — 2026-02-23

### E012 · ASCII Gallery & Wib Vision
- [x] E012-1  `primer_metadata` endpoint — `GET /primers/{filename}/metadata` + width/height/aspect_ratio added to `PrimerInfo` schema
- [x] E012-2  Masonry layout algorithm — pure Python, unit-tested (0 overlaps, 0 OOB on 6-piece test)
- [x] E012-3  `POST /gallery/arrange` — masonry + poetry algorithms, auto-opens missing primers, frameless flag wired
- [x] E012-4  Frameless window mode — `TGhostFrame` in `notitle_frame.h`, wired through `TFrameAnimationWindow`, `command_registry`, `window_type_registry`
- [x] E012-5  Workspace integration — `POST /workspace/save` + `/workspace/open` already exist; gallery workflow documented
- [ ] E012-6  (optional) `fit_to_content` / `preserve_aspect_ratio` flags on `tui_move_window` — defer to later sprint
- [ ] E012-7  Build + visual smoke-test (needs Docker / `make up-real`) — do after E013 + E008 work today

### E013 · Workspace Save/Restore Parity
- [ ] E013-1  Run F06 surface parity audit (commands ↔ window types ↔ API ↔ MCP ↔ workspace JSON)
- [ ] E013-2  Fix `getProps()`/`setProps()` gaps across view classes (per audit findings)
- [ ] E013-3  Window type registry completeness check
- [ ] E013-4  Round-trip test (save → close → load → verify state)

### E008 · Multiplayer PartyKit sprint  (E007 already done ✓)
- [ ] E008-1  Identify stall point — review last state, open PR/issues
- [ ] E008-2  WebSocket relay smoke test (PartyKit connection health)
- [ ] E008-3  Unblock and push to next milestone

---
</today>

e001-command-parity-refactor — done
e002-browser-and-state-export — done
e003-dark-pastel-theme — done
e004-browser-rendering-reliability — dropped
e005-theme-runtime-wiring — not-started
e006-scramble-tui-presence — in-progress
e007-browser-hosted-deployment — done
e008-multiplayer-partykit — in-progress
e009-menu-system-redesign — done
e010-paint-canvas-integration — done
e011-desktop-shell — not-started
e012-ascii-gallery-and-wib-vision — in-progress
e013-workspace-save-restore-parity — in-progress
