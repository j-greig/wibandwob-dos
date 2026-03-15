---
name: composable-engines
description: >
  Extract a rendering/animation engine from a window, make it a reusable
  FramePlayer, and embed it as a component inside other windows or microapps.
  Three-phase process: (1) extract engine from window, (2) compose into another
  surface, (3) system integration audit. Use when: embedding one animation
  inside another window, making a window's core logic reusable, composing
  dashboard-style layouts, or adding a new mode to an existing microapp that
  reuses an engine from elsewhere.
---

# Composable Engines

Three-phase technique for making any animated window's core logic embeddable
anywhere in the app.

## Phase 1: Extract the engine

Goal: separate pure computation from window chrome so the engine can be
reused without its original window.

### Steps

1. Identify the pure logic (math, rendering, state machine) vs the window
   wiring (blessed boxes, key bindings, describeState, cleanup).

2. Move the pure logic into a service file (`src/services/`). It should:
   - Take dimensions and config, return string arrays or content
   - Own any animation state machine (grow, tick, swell)
   - Have zero blessed imports
   - Export a `create*Player()` function returning a `FramePlayer`

3. The player factory should accept:
   ```typescript
   {
     getViewport: () => { width: number; height: number };
     onFrame: (content: string) => void;
     onStatus?: (state: {...}) => void;  // optional status callback
     // ...config options with defaults
   }
   ```

4. The player should implement `FramePlayer` from `animation-service.ts`:
   `play(), pause(), stop(), destroy(), togglePause()` plus state getters.

5. Add mutation methods for anything the UI needs to change at runtime:
   `setMode(), setTerrain(), reroll()` etc. These reset the animation.

6. IMPORTANT: Do NOT emit frames in the constructor. First frame should
   only fire from `play()`. Blessed dimensions are unreliable before render.

7. IMPORTANT: Sanitize viewport dimensions — `Number(box.width)` can return
   NaN from blessed's anchored sizing. Use `Number(v) || fallback`.
   `Math.max(n, NaN)` returns NaN, not n. Always use `Number(v) || fallback`
   BEFORE `Math.max`.

8. Refactor the original window to consume the new player. The window
   should shrink to just: createFrame, mount player, bind keys, describeState.

### Validation

- Original window still works identically
- `bun run typecheck` passes
- Window file is smaller (contour went 218 → 88 lines)

## Phase 2: Compose into another surface

Goal: embed the extracted engine as one panel inside a larger window or
microapp.

Three patterns exist, from simplest to most integrated:

### Pattern A: Direct blessed box (standalone window)

Create a blessed box, wire the player's `onFrame` to `box.setContent()`,
and lay out the box alongside other UI elements manually.

```typescript
const contourBox = blessed.box({ parent: frame.body, style: theme().body });

const player = createContourPlayer({
  getViewport: () => ({
    width: Number(contourBox.width) || 40,
    height: Number(contourBox.height) || 15,
  }),
  onFrame: (content) => {
    contourBox.setContent(content);
    deps.screen.render();
  },
});

// Position contourBox alongside other elements in doLayout()
// AFTER registerWindow — blessed dims are unreliable before render
player.play();
```

Used by: `terrain-lab-window.ts`

### Pattern B: createAnimatedPanel (microapp, attachTarget bridge)

If embedding inside a microapp that uses the `MicroappHost` UI parts
system, create a thin bridge player with `attachTarget` + `setRunning`:

```typescript
function createMyPlayer(host: MicroappHost) {
  let target: UiNode | null = null;
  let player: ContourPlayer | null = null;
  let running = false;

  return {
    attachTarget(nextTarget) { target = nextTarget; },
    setRunning(nextRunning) {
      running = nextRunning;
      if (!running) {
        player?.destroy(); player = null;
        if (target) { target.setContent(""); host.screen.render(); }
        return;
      }
      if (!target || player) return;
      const t = target;
      player = createContourPlayer({
        getViewport: () => ({
          width: Number((t as any).width) || 20,
          height: Number((t as any).height) || 10,
        }),
        onFrame: (content) => { t.setContent(content); host.screen.render(); },
      });
      player.play();
    },
    shuffle() { /* randomise player settings */ },
    destroy() { player?.destroy(); player = null; target = null; },
  };
}
```

Then wire into the microapp layout:

```typescript
const myPlayer = createMyPlayer(host);
const panel = host.ui.createAnimatedPanel(win.body, { player: myPlayer });

// In createColumns:
{ key: "terrain", basis: "3fr", part: panel,
  visible: () => someCondition }
```

Key insight: the bridge player owns the lifecycle. `setRunning(true)`
creates the engine player, `setRunning(false)` destroys it. This means
the engine only runs when visible — no wasted frames.

Used by: poetry clock terrain voice in `microapps/wibwob-poetry-clock/index.ts`

### Pattern C: Direct mode addition (microapp, no new window)

When adding a mode to an existing microapp rather than a new window:

1. Import the engine in the microapp module
2. Create the bridge player (Pattern B)
3. Add panel + rule to the existing columns/stack layout
4. Add visibility predicate tied to the new mode
5. Wire `setRunning()` in the render function
6. Add mode to the cycle array and voice/mode labels
7. Optionally add a `shuffle()` method for variation on timer ticks

This is the lightest path — no new window type, no types.ts changes, no
command catalog entry. The mode just appears in the existing cycle.

### Layout tips (all patterns)

- Register the window BEFORE calling `doLayout()` — blessed dimensions
  are unreliable until after registration and first render
- Set `frame.refresh = doLayout` so resize events re-layout
- Clamp all dimension calculations to minimum 1
- Use `frame.frame.on("resize", doLayout)` for resize handling
- Make the animated panel the HERO (large basis like "3fr") and text
  the sidebar ("1fr") — not the other way round

## Phase 3: System integration audit

After the feature works, audit against the system's moving parts.
This catches gaps that typecheck alone misses.

### Scripts to run

```bash
bun run typecheck                    # type safety
bash scripts/check-surface-parity.sh # catalog ↔ registry ↔ snapshot alignment
bash scripts/command-registry-smoke.sh  # agent command list verification
```

### If you added a new window type

Follow `.pi/skills/new-window-type/SKILL.md` — full checklist:

- [ ] `AppType` + optionally `PersistableAppType` in `src/core/types.ts`
- [ ] Command in `src/core/command-catalog.ts` with `api: true, agent: true`
- [ ] `actionKey` entry in `AppMenuActions` interface
- [ ] Handler in `app-controller.ts` `getAppMenuActions()`
- [ ] `focusOrCreate()` if single-instance
- [ ] `onStateChanged: () => this.syncState()` passed to factory
- [ ] `describeState()`, `cleanup()`, `captureText()` on the frame
- [ ] Snapshot registry entry if persistable

### If you added a new window management feature

Check these surfaces (AGENTS.md invariant 12: user-visible = API-visible):

- [ ] `WindowFacade` interface — add method if it is a geometry operation
      like move/resize/maximize (not needed for mode-only changes)
- [ ] `WindowManager` — implement the facade method
- [ ] Command catalog — command with description, menu/palette placement
- [ ] Control API — dedicated endpoint if parallel to existing endpoints
      (e.g. `/windows/maximize` alongside `/windows/move`, `/windows/resize`)
- [ ] State reporting — add field to `DesktopWindowState` if the state is
      observable (e.g. `maximized: boolean`)
- [ ] `onChange?.()` — call it after any mutation so state stays fresh
- [ ] Reconciliation — other geometry operations should clear/update the
      new state (e.g. tile/cascade/move/resize clear maximize state)

### If you added a mode to an existing microapp

Lighter audit — no new types or catalog entries needed:

- [ ] Mode appears in the voice/mode cycle
- [ ] `describeState()` reports the new mode
- [ ] `set-mode` command description updated with new option
- [ ] Engine cleanup runs on window close (bridge `destroy()`)
- [ ] Engine only runs when visible (`setRunning` tied to visibility)

### Codex review

After integration, get `codex-standard` to review. It catches:
- State publication gaps (`onChange` not called)
- Layout reconciliation misses (maximize + tile interaction)
- Coordinate system confusion (screen vs desktop-relative)
- Context menu scoping errors

## Examples

### Example 1: Contour engine → standalone + composed windows

Phase 1: Extracted from `contour-window.ts` (218 lines) into
`contour-engine.ts` as `createContourPlayer()`. Window shrank to 88 lines.

Phase 2 (Pattern A): `terrain-lab-window.ts` uses direct blessed box
with manual layout. Contour map left, info panel right.

Phase 2 (Pattern B): Poetry clock terrain voice in
`microapps/wibwob-poetry-clock/index.ts`. Bridge player with
`attachTarget` + `setRunning`. Shuffles all settings each minute.

Phase 3: Terrain Lab needed full new-window-type checklist. Poetry clock
terrain voice only needed mode-addition audit (lighter).

### Files

- `src/services/contour-engine.ts` — engine + `createContourPlayer()`
- `src/services/animation-service.ts` — `FramePlayer` interface
- `src/windows/contour-window.ts` — standalone window (Pattern A consumer)
- `src/windows/terrain-lab-window.ts` — composed window (Pattern A consumer)
- `microapps/wibwob-poetry-clock/index.ts` — microapp mode (Pattern B consumer)
- `src/core/ui-parts.ts` — `createAnimatedPanel` and layout primitives

### Example 2: Double-click maximize (window management feature)

Not an engine extraction, but demonstrates the Phase 3 audit catching
real gaps. Initial implementation had:
- `toggleMaximize` on WindowManager (internal only)
- Command in catalog
- State reporting

Codex review + Phase 3 audit found:
- Missing `onChange()` call — state went stale after maximize
- Missing WindowFacade method — control API couldn't reach it
- Missing `/windows/maximize` endpoint — inconsistent with move/resize
- Coordinate confusion — used screen coords, windows live in desktop
- No reconciliation — tile/cascade left stale maximize state
- Context menu mis-scoped as desktop instead of window

All fixed in follow-up commits. The audit process works.
