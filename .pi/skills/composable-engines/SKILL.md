---
name: composable-engines
description: >
  Extract a rendering/animation engine from a window, make it a reusable
  FramePlayer, and embed it as a component inside other windows or microapps.
  Two-phase process: (1) extract engine from window, (2) compose into another
  surface. Use when: embedding one animation inside another window, making a
  window's core logic reusable, composing dashboard-style layouts, or adding
  a new mode to an existing microapp that reuses an engine from elsewhere.
---

# Composable Engines

Two-phase technique for making any animated window's core logic embeddable
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

8. Refactor the original window to consume the new player. The window
   should shrink to just: createFrame, mount player, bind keys, describeState.

### Validation

- Original window still works identically
- `bun run typecheck` passes
- Window is smaller (ours went 218 → 88 lines)

## Phase 2: Compose into another surface

Goal: embed the extracted engine as one panel inside a larger window.

### Option A: Direct blessed box (simplest)

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
player.play();
```

### Option B: createAnimatedPanel (microapp context)

If embedding inside a microapp that uses the `MicroappHost` UI parts system,
wrap the player in `createAnimatedPanel`:

```typescript
const panel = host.ui.createAnimatedPanel(parent, { player });
```

The player needs `attachTarget` / `mount` methods for this path. The direct
blessed box approach (Option A) is simpler and always works.

### Layout tips

- Register the window BEFORE calling `doLayout()` — blessed dimensions
  are unreliable until after registration and first render
- Set `frame.refresh = doLayout` so resize events re-layout
- Clamp all dimension calculations to minimum 1
- Use `frame.frame.on("resize", doLayout)` for resize handling

### Checklist for the composed window

Follow `.pi/skills/new-window-type/SKILL.md` for the full window checklist.
Key points:
- Add WindowKind and AppType to `types.ts`
- Add command to `command-catalog.ts` with `api: true, agent: true`
- Wire in `app-controller.ts` with `focusOrCreate`
- Pass `onStateChanged: () => this.syncState()` if Phase 2 state contract exists
- Implement `describeState()`, `cleanup()`, `captureText()`

## Example: Contour Engine

### Before (single window, 218 lines)

`contour-window.ts` had inline grow animation, hill scaling, coverage
estimation, mode cycling, AND blessed wiring all in one file.

### After extraction

`contour-engine.ts` gained `createContourPlayer()` (~120 lines):
- Pure grow state machine
- Hill scaling and coverage estimation
- `setMode()`, `setTerrain()`, `reroll()`, `setLevels()` mutation methods
- Returns standard `FramePlayer` interface

`contour-window.ts` shrank to 88 lines:
- createFrame, mount player to a blessed box, bind keys, describeState

### Composed window

`terrain-lab-window.ts` (~160 lines):
- Same `createContourPlayer`, different layout
- Contour map on the left, info panel on the right
- Uses `createHeaderBar`, `createStatusBar`, `createTextBlock`, `createRule`
- Manual layout in `doLayout()` function

### Files

- `src/services/contour-engine.ts` — engine + `createContourPlayer()`
- `src/services/animation-service.ts` — `FramePlayer` interface
- `src/windows/contour-window.ts` — standalone window (consumer)
- `src/windows/terrain-lab-window.ts` — composed window (consumer)
- `src/core/ui-parts.ts` — `createAnimatedPanel` and layout primitives
