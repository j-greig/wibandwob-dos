---
id: E042-B3
title: "Hero 7"
status: not-started
depends_on: [E042-B2]
---

# E042-B3 — Hero 7

**Sessions**: 1–2

## Why Third

Uses new primitives, becomes the canonical reference. Every hero app is a teaching document. "If an external dev only read this one file, they'd know how to build for the platform."

## Hero 7

| # | App | Target Lines | Shows | Current Status |
|---|---|---|---|---|
| 1 | **hello-world** | ~30 | Minimum viable: createWindow, describeState | Rewrite (currently 494 lines!) |
| 2 | **notepad** | ~130 | Read/write buffer, captureText, onInput, plumb | Exists, cleanup pass |
| 3 | **runtime-inspector** | ~425 | Live state, command introspection, tree views | Exists, review |
| 4 | **figlet-banner** | ~400 | Multi-command, font picker, prompts, writeHandlers | Exists, cleanup |
| 5 | **layout-stress-test** | ~464 | Responsive layout, breakpoints, contrib grid, animation | Rename from demo-layout-stress-test-pi, promote |
| 6 | **data-dashboard** | ~200 | Live-updating panels, timers, split layout, theming | New build |
| 7 | **file-manager** | ~1622 | Full app: search, preview, sort, icon/list modes | Migrate from src/windows/ |

**Progression**: trivial → buffer → introspection → creative tool → layout proof → dashboard → full app.

## Tasks

- [ ] **hello-world**: Rewrite from 494→~30 lines. Absolute minimum viable microapp
- [ ] **notepad**: Cleanup pass. Use SDK primitives (createStatusBar, createTextViewer)
- [ ] **runtime-inspector**: Review, minor polish. Already good
- [ ] **figlet-banner**: Cleanup pass. Standardise keyboard shortcuts
- [ ] **layout-stress-test**: Rename from `demo-layout-stress-test-pi`, promote to beta tier
- [ ] **data-dashboard**: New build (~200 lines). System info panels, timers, theming
- [ ] **file-manager**: Migrate from `src/windows/file-manager-window.ts` to microapp
- [ ] Every hero: describeState + captureText + consistent keyboard shortcuts (q=close, /=search)
- [ ] Document in `docs/microapp-examples.md` — what each hero teaches

## Acceptance

- 7/7 hero apps open via API and return valid describeState
- All 7 have captureText
- hello-world ≤ 40 lines
- `docs/microapp-examples.md` exists
- `bun run typecheck` clean

## Autoresearch

Harness at `autoresearch/hero-apps/`. Primary metric: hero pass count out of 7.
