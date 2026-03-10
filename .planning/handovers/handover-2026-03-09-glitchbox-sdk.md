---
date: 2026-03-09
session: glitchbox + sdk audit
branches:
  main_pr: chore/sdk-skeleton-renderer-main
  epic: epic/e027-glitchbox-tui (worktree ~/Repos/wibwob-glitchbox)
---

# Handover — 2026-03-09 GlitchBox + SDK Audit

## Quickstart prompt for next pi agent

Paste this at the start of a new session to restore context instantly:

---

We are building WibWob-DOS — a TypeScript/Bun terminal desktop (blessed TUI).
Two active workstreams from the last session:

**1. E027 GlitchBox** — worktree at `~/Repos/wibwob-glitchbox`, branch `epic/e027-glitchbox-tui`.
App runs on port 8098. Start it: `tmux new-session -d -s glitchbox -x 220 -y 60 "cd ~/Repos/wibwob-glitchbox && CONTROL_API_PORT=8098 bun run start"`.
GlitchBox is a microapp where symbient agents get ASCII stick-figure bodies in a generative field.
Key files: `modules/glitchbox/index.ts`, `src/core/skeleton-renderer.ts`.
What's DONE: window opens, skeleton animates (5 poses × 3 keyframes each), PLAY button runs full dance sequence, pose/move/state/field API commands, button bars, energy-driven tick speed, field moods.
What's LEFT (to close epic): AC-4 `/dance` slash command in `src/services/wibwob-agent-session.ts`, AC-5 `/dance` in `src/services/scramble-brain.ts`, AC-10 haiku autonomous tick (~60s per dancer, haiku decides x/y/energy/mood). Both slash routers use `createSlashRouter` — `/dance` is a small addition.

**2. SDK audit branch** — `chore/sdk-skeleton-renderer-main` on main repo, needs PR merge.
Adds `src/core/skeleton-renderer.ts` + ~50 new SDK exports to `src/services/microapp-sdk.ts`.
Audit doc at `.planning/refactor-docs/030-microapp-sdk-audit-2026-03.md`.

**Main app** runs on port 8099, tmux session `wibwob`. Health: `curl http://127.0.0.1:8099/health`.

**E025 (§y² Chronicles)** is also in-progress on `epic/e025-calculating-empires`.
Outstanding ACs: AC-3 (resize reflow — call buildPanels() not renderLayoutAndContent() on resize), AC-11 (drag verify), AC-13 (double-click edit verify), AC-14 (scroll-jump fix verify).

**Rule**: always work on a branch, never commit to main directly (pre-commit hook blocks it).
Check branch before touching anything: `git status` / `git branch`.

---

## What was done this session

### SDK audit (`.planning/refactor-docs/030-microapp-sdk-audit-2026-03.md`)
Found 6 categories of exports that modules were bypassing the SDK to import directly.
All patched in `src/services/microapp-sdk.ts`:
- `createTimer`, `clearTimers` + ui-primitive helpers
- figlet raw renderers (`renderFiglet`, `measureFiglet`, etc.)
- markdown rendering (`renderMarkdown`, `PLAIN_HEADING_CONFIG`)
- contour low-level (`renderContour`, `renderContourFromHills`)
- motion/tween (`tween`, `tweenWindowPosition`, `EASINGS`)
- tree widget (`createTreeWidget`, `TreeNode`)

### E027 S01 — skeleton window foundation
- `src/core/skeleton-renderer.ts` — new. `renderSkeletonAt()`, `POSE_CONNECTIONS`, `POSE_PRESETS`, `landmarksFromPreset()`. 5 poses × 2-3 keyframes each (idle, arms-raised, step-left, jump, wave + their -b/-c variants).
- `modules/glitchbox/` — new microapp. `glitchbox.open` in Applications menu.
- Two-layer window: generative field (background) + skeleton (foreground, tags:true).
- `DancerState` model: agentId, label, color, x, y, preset, energy, mood, paused, playing.

### E027 S01+ — commands + button bars
- `glitchbox.pose`, `glitchbox.move` (tween), `glitchbox.state`, `glitchbox.field` commands.
- Pose button bar: ▶ ⏸ IDLE \O/ STEP JUMP WAVE.
- Mood/energy bar: E- E+ CALM PULSE CHAOS DRIFT.
- PLAY button runs full `DANCE_SEQUENCE` (24 frames, all poses, loops).
- Tick speed = `800 - energy * 65` ms. Energy 0 = 800ms, energy 10 = 150ms.

### Branch hygiene fix
- `skeleton-renderer.ts` was accidentally on wrong branch (main worktree untracked).
- Copied best version (worktree's, with full animation frames) to main repo.
- Committed to `chore/sdk-skeleton-renderer-main` — needs PR merge.

### Planning docs updated
- E027 ACs: 12/15 ticked. Remaining: AC-4, AC-5, AC-10.
- E025 ACs: table updated in brief.
- `030-microapp-sdk-audit-2026-03.md` — all 6 gaps marked [x].
- SG-6 choreopath story added to E027 (choreopath PyPI tool, extract landmarks from dance video).

## Remaining to close E027

| AC | Work | File |
|----|------|------|
| AC-4 | `/dance` slash command | `src/services/wibwob-agent-session.ts` — add to `createSlashRouter` |
| AC-5 | `/dance` slash command | `src/services/scramble-brain.ts` — add to `createSlashRouter` |
| AC-10 | haiku tick | in `modules/glitchbox/index.ts` — `setInterval` per dancer, haiku JSON call → update x/y/energy/mood |

AC-4 and AC-5 are ~10 lines each. AC-10 is the haiku prompt + JSON parse + state update.

## Ports / sessions cheatsheet

| What | Port | tmux session |
|------|------|-------------|
| Main app | 8099 | wibwob |
| GlitchBox worktree | 8098 | glitchbox (may need restart) |

Restart glitchbox if dead:
```bash
lsof -ti:8098 | xargs kill -9 2>/dev/null; sleep 1
tmux kill-session -t glitchbox 2>/dev/null; sleep 1
tmux new-session -d -s glitchbox -x 220 -y 60 \
  "cd ~/Repos/wibwob-glitchbox && CONTROL_API_PORT=8098 bun run start 2>/tmp/glitchbox.log"
sleep 12 && curl -sf http://127.0.0.1:8098/health
```
