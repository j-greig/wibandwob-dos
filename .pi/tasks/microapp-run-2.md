# CCC Task — Microapp Run 2

> Paste this as the task prompt for the next Claude Code Cloud session.
> Branch: `claude/microapp-dev-documentation-aqRj0` (or a new branch from it)

---

## Before you write any code

Read in this order:
1. **`SDK-MICROAPP-DEV.md`** — the one guide: quick-start, host API, UI, persistence, cloud ops
2. **`GOTCHAS.md`** — non-obvious failure modes (especially the Microapps + Cloud sections)

---

## Setup

```bash
# 1. Install (cloud-safe — do NOT run bare bun install)
bun install --ignore-scripts

# 2. Start (--tmux only — never --direct in cloud Linux)
bash scripts/ensure-running.sh --tmux

# 3. Confirm
curl -sf --max-time 5 http://127.0.0.1:8099/health

# 4. Generate live command/endpoint snapshot (discover all IDs)
bun scripts/gen-coat.ts
# → writes COAT.md — grep it to find any microapp command ID
```

---

## Your task: build three microapps

Build exactly these three apps, in this order, one at a time.

### App 1 — `world-clock`

- **ID:** `wibwob.world-clock`
- **Title:** `World Clock`
- **Menu order:** 110
- **Behaviour:** Show current time in at least two timezones (e.g. UTC + one local).
  Update once per second. Use `createAnimationClock(1)` — 1fps is enough for a clock.
  Call `clock.pause()` immediately after creation, then `clock.play()` on start.
- **Layout:** Use `createHeaderBar` + `createTextViewer` or `createStatusBar`.
- **captureText** must return the displayed time string (≥50 chars).

### App 2 — `todo-list`

- **ID:** `wibwob.todo-list`
- **Title:** `Todo List`
- **Menu order:** 111
- **Behaviour:** Add items via `createInputLine`, display them in `createScrollView`
  or `createListPanel`, mark complete with a keypress, delete with another keypress.
  Persist via `host.registerSnapshot` (workspace restore) AND `safeWriteFile` / `safeReadJSON`
  at `host.repoRoot + /scratch/microapps/todo-list/data.json` (survives restart).
  Set `"persist": true` in `microapp.json`.
- **captureText** must return all todo items as text (≥50 chars once at least one item exists).
  Use `describeState` to return `{ summary: "N items, M done" }`.
- **Never use raw `fs.*`** — use `safeWriteFile` / `safeReadJSON` from the SDK.

### App 3 — `ascii-clock`

- **ID:** `wibwob.ascii-clock`
- **Title:** `ASCII Clock`
- **Menu order:** 112
- **Behaviour:** Large ASCII-art clock face using `createCanvas` and `gridToText`.
  Render digits as block characters or simple ASCII patterns. Update at ≤8fps via
  `createAnimationClock(8)`. Call `clock.pause()` immediately, then `clock.play()`.
- **captureText** must return the rendered grid text (≥50 chars).

---

## Rules for every app

### Hooks — use the typed helper

```typescript
import { registerMicroappHooks } from "../../src/services/microapp-sdk.js";

registerMicroappHooks(win, {
  captureText:   () => myContent,
  describeState: () => ({ summary: "..." }),
  onCleanup:     () => { clock?.destroy(); },
  onRestyle:     () => { /* re-apply host.theme() colours */ },
});
```

TypeScript will error if you miss any of the four — this is intentional.

### Imports — SDK surface only

```typescript
// ONLY ever import from this path:
import { createHeaderBar, createCanvas, safeWriteFile, safeReadJSON, ... } from "../../src/services/microapp-sdk.js";

// NEVER import from src/core/*, src/ui/*, node:fs, or any other src/services/* file.
// This is a COAT violation (ARCHITECTURE.md).
// safe-fs helpers (safeWriteFile, safeReadJSON, etc.) are now @public in the SDK.
```

### Animation clocks

- **Maximum fps: 8–10.** Never higher.
- **Always call `clock.pause()` immediately** after `createAnimationClock(...)`.
  The clock starts running immediately — if you don't pause it, it renders before
  the window is ready and may cause a CPU storm.
- **Always call `clock.destroy()`** in `onCleanup`.

### curl — always use --max-time

```bash
# Every curl must have --max-time 5:
curl -sf --max-time 5 http://127.0.0.1:8099/health
```

### No batch loops

Do NOT open multiple apps in a loop. Test one at a time with `sleep 1` between calls.

---

## Verification — mandatory before each commit

After building each app, run:

```bash
# default threshold is 10 chars; pass 50 for content-rich apps
bash scripts/validate-microapp.sh microapp.wibwob.<app-id>.open 50
```

Expected output:
```
✓ PASS — microapp.wibwob.world-clock.open (143 chars)
```

**After each app, run both checks before committing:**
```bash
bun run typecheck                                            # must be clean
bash scripts/validate-microapp.sh microapp.wibwob.<id>.open 50  # must PASS
```

**Do not commit an app without both passing.**
Include the PASS line in your commit message, e.g.:

```
feat(microapp): add world-clock mapp 110 — dual-timezone, 1fps clock

validate-microapp: ✓ PASS (143 chars)
```

If the script exits 1 (FAIL), your `captureText` hook is returning empty or too-short
content. Fix the hook before committing.

---

## Registry

Add each app to `src/core/microapp-registry.ts`:

```typescript
"wibwob.world-clock": "beta",
"wibwob.todo-list":   "beta",
"wibwob.ascii-clock": "beta",
```

Restart after each addition: `bash scripts/restart.sh --tmux`

---

## What success looks like

Three commits, each with:
- `✓ PASS` from validate-microapp.sh (char count in commit message)
- `bun run typecheck` clean
- All four hooks registered via `registerMicroappHooks`
- No animation clock above 8fps
- No imports outside `microapp-sdk.js`
