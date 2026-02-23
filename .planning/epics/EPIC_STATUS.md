# Epic Status Register

> Machine-parseable index. One line per epic: `<dir> — <status>`.
> Valid statuses: `not-started`, `in-progress`, `blocked`, `done`, `dropped`.
> Canonical detail lives in each epic's frontmatter and GitHub issue.

<today>
## Completed — 2026-02-23

### E012 · ASCII Gallery & Wib Vision ✓ DONE (PR #82)
8 layout algorithms, pixel font stamp, chrome flags, gallery.py extraction.

### E013 · Workspace Save/Restore Parity ✓ DONE (PRs #85 #87)
- [x] 6 missing registry slugs (quadra, snake, rogue, deep_signal, app_launcher, gallery)
- [x] frame_player, text_view, gallery props — save + restore
- [x] Title persistence — filename stem on save, passed through on restore
- [x] `scripts/parity-check.py` — exits non-zero on any save/restore gap
- [x] `/ww-audit` skill — manual parity checker for any window type

## Up next

**E006** — Scramble TUI presence (in-progress, PR #89 open). F8 three-state cycle, jet-black visual polish, multi-line input wrapping, wider sidebar landed today. Remaining: F04 error/state reactions, F05 full scramble.* command surface + MCP parity.

| Epic | Status | Effort |
|---|---|---|
| E006 scramble TUI presence | done | medium |
| E005 theme runtime wiring | not-started | small |
| E008 multiplayer PartyKit | in-progress | unknown |
| E011 desktop shell | deferred | large |

---
</today>

## Active

e005-theme-runtime-wiring — not-started
e008-multiplayer-partykit — in-progress
e011-desktop-shell — not-started

## Done / Dropped

e001-command-parity-refactor — done
e006-scramble-tui-presence — done
e002-browser-and-state-export — done
e003-dark-pastel-theme — done
e004-browser-rendering-reliability — dropped
e007-browser-hosted-deployment — done
e009-menu-system-redesign — done
e010-paint-canvas-integration — done
e012-ascii-gallery-and-wib-vision — done
e013-workspace-save-restore-parity — done
