{
  "id": "a7c3e891",
  "title": "Make contour engine embeddable as UiPart via FramePlayer adapter",
  "tags": [
    "issue-108",
    "DRY",
    "composability"
  ],
  "status": "open",
  "created_at": "2026-03-04T00:15:00.000Z"
}

Ref: https://github.com/j-greig/wibandwob-dos/issues/108 (lego bricks of code, not new crap)

## Problem

contour-window.ts has its own animation loop and blessed wiring. The poetry
clock embeds scramble-the-cat via createAnimatedPanel(parent, { player }).
The contour engine should be embeddable the same way — but right now it is
locked inside its own window factory.

## What exists already

- `contour-engine.ts` — PURE. Takes (w, h, opts) → string[]. No UI. Good.
- `contour-window.ts` — window factory with inline grow animation + key bindings
- `animation-service.ts` — FramePlayer interface + createLivePlayer
- `ui-parts.ts` — createAnimatedPanel wraps any FramePlayer as a UiPart
- Poetry clock uses this exact pattern for the scramble cat panel

## What to build (small)

One function in contour-engine.ts or a new contour-player.ts:

```typescript
export function createContourPlayer(opts: {
  mode: ContourMode;
  seed: number;
  terrainIdx: number;
  nLevels: number;
  fps?: number;
  getViewport: () => { width: number; height: number };
  onFrame: (content: string) => void;
}): FramePlayer
```

This wraps the grow animation (hill-by-hill swell) as a standard FramePlayer.
Then createAnimatedPanel can embed it in any microapp layout.

## What to refactor (DRY)

contour-window.ts should CONSUME createContourPlayer instead of having its
own animation loop. The window becomes:
1. createFrame
2. createContourPlayer → createAnimatedPanel or direct mount
3. key bindings for mode/terrain/seed cycling
4. status bar

The grow state machine moves into the player, not the window.

## What NOT to build

- No new UI primitive. createAnimatedPanel already exists.
- No new window type. The contour window stays as-is, just thinner.
- No abstraction layer. Just one function returning a FramePlayer.

## Validates

- #108 principle: "one concept, one owner" — the animation engine owns animation
- Architecture invariant 9: "services own logic, windows own wiring"
- The contour engine stays pure computation, the player is the animation adapter,
  the window is just chrome + key bindings

## Test

1. Open contour window — still works, same keys, same modes
2. Embed contour panel in poetry clock as experiment — verify it renders
   in a column alongside the poem text
3. typecheck passes

## Files

- src/services/contour-engine.ts (add createContourPlayer or new file)
- src/windows/contour-window.ts (refactor to consume the player)
- src/services/animation-service.ts (no changes, just consume FramePlayer)
- src/core/ui-parts.ts (no changes, just consume createAnimatedPanel)
