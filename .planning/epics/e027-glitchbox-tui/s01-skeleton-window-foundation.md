# E027 S01 — Skeleton Window Foundation

Status: not-started
Worktree: ~/Repos/wibwob-glitchbox (branch: epic/e027-glitchbox-tui)

## Goal

Open a `GlitchBoxWindow` from the Applications menu. It shows an idle ASCII skeleton
centred on a generative plasma/noise background. No interaction yet — just the render
pipeline working end-to-end.

---

## How Monster Cam rendering works (read this first)

The render pipeline lives entirely in two files in E004:

```
src/services/monster-cam-service.ts  — MonsterCamFrame type + webcam worker
src/services/webcam-renderer.ts      — pure render functions, no blessed dep
```

Both are exported from `microapp-sdk.ts`. GlitchBox imports from there.

### The frame type

```ts
interface MonsterCamFrame {
  w: number;               // source width (pixel space for landmarks)
  h: number;               // source height (pixel space for landmarks)
  ts: number;              // timestamp ms
  hasFace: boolean;
  bbox: [number, number, number, number];
  faceKeypoints: [number, number][];
  hasHands: boolean;
  handCount: number;
  handBoxes: [number, number, number, number][];
  handLabels: string[];
  hasPose: boolean;        // ← skeleton renders only when this is true
  poseLandmarks: [number, number][];  // 33 points in SOURCE pixel space
  emotion: string;
  fps: number;
  gray: Uint8Array;        // w*h grayscale bytes (unused in GlitchBox — no camera)
}
```

### Landmark coordinate space

IMPORTANT: `poseLandmarks` are in SOURCE pixel space, not normalised 0-1.
`drawSkeleton()` converts them via `projectToCanvas(x, y, srcW, srcH, canvasW, canvasH)`.

The simplest approach for GlitchBox: use normalised 0.0–1.0 coords and set
`frame.w = 1` and `frame.h = 1`. Then `projectToCanvas` does
`Math.floor((x / 1) * canvasW)` which is just `Math.floor(x * canvasW)`. Clean.

So every landmark `[x, y]` in a DancePoseService frame should be in the 0.0–1.0
range for both axes.

### The render call

```ts
import { renderWebcamFrame, gridToBlessedContent } from "microapp-sdk"

const grid = renderWebcamFrame(frame, canvasW, canvasH, {
  showBg: false,      // no grayscale bg — we have our own generative field
  monsterMode: false, // no face sprite
})
const content = gridToBlessedContent(grid)
box.setContent(content)
box.screen.render()
```

`showBg: false` means `frame.gray` is never read. Pass `new Uint8Array(0)` for it.

### What drawSkeleton actually does

For each entry in `POSE_CONNECTIONS` (array of [a, b] landmark index pairs),
it draws a Bresenham line between landmarks a and b in green.
Then it stamps each landmark as `○` (green) except landmark 0 (head) which is `◉` (cyan).

The connections list is hardcoded in `webcam-renderer.ts` — it's the standard
MediaPipe pose topology (shoulders→elbows→wrists, hips→knees→ankles, etc).

### What GlitchBox does NOT use from Monster Cam

- Face box / keypoints — `hasFace: false`, empty arrays
- Hand boxes — `hasHands: false`, empty arrays
- Monster face sprite — `monsterMode: false`
- Grayscale background — `showBg: false`, `gray: new Uint8Array(0)`
- The `MonsterCamService` class itself — that's the webcam worker. GlitchBox
  only needs the frame TYPE and the render FUNCTIONS.

---

## What to build for S01

### 1. DancePoseService (`src/services/dance-pose-service.ts`)

Holds the current pose state. Emits `MonsterCamFrame`-shaped events.

```ts
import type { MonsterCamFrame } from "microapp-sdk"
import { EventEmitter } from "events"

export class DancePoseService extends EventEmitter {
  private current: MonsterCamFrame

  constructor() {
    super()
    this.current = buildFrame(IDLE_LANDMARKS)
  }

  setPose(landmarks: [number, number][]): void {
    this.current = buildFrame(landmarks)
    this.emit("frame", this.current)
  }

  getFrame(): MonsterCamFrame {
    return this.current
  }
}

function buildFrame(landmarks: [number, number][]): MonsterCamFrame {
  return {
    w: 1, h: 1, ts: Date.now(),
    hasFace: false, bbox: [0,0,0,0], faceKeypoints: [],
    hasHands: false, handCount: 0, handBoxes: [], handLabels: [],
    hasPose: true,
    poseLandmarks: landmarks,
    emotion: "neutral", fps: 0,
    gray: new Uint8Array(0),
  }
}
```

### 2. IDLE_LANDMARKS — the standing neutral pose

33 points, normalised 0-1. Only the key ones matter visually — fill the rest with
plausible values. Key MediaPipe indices:

```
0  = nose (head)
11 = left shoulder    12 = right shoulder
13 = left elbow       14 = right elbow
15 = left wrist       16 = right wrist
23 = left hip         24 = right hip
25 = left knee        26 = right knee
27 = left ankle       28 = right ankle
```

Rough idle pose (standing, arms at sides):
- Head: [0.50, 0.10]
- Shoulders: [0.38, 0.25] / [0.62, 0.25]
- Elbows: [0.34, 0.42] / [0.66, 0.42]
- Wrists: [0.32, 0.58] / [0.68, 0.58]
- Hips: [0.42, 0.55] / [0.58, 0.55]
- Knees: [0.42, 0.73] / [0.58, 0.73]
- Ankles: [0.42, 0.90] / [0.58, 0.90]

Fill landmarks 1–10, 17–22, 29–32 with safe mid-values — they are less prominent
body parts (eyes, ears, lips, feet) and draw poorly at terminal resolution anyway.

### 3. Generative background layer

A simple plasma/noise field painted BEFORE the skeleton. Two options:

**Option A — plasma (cos/sin, animated):**
Each cell gets a char from `" ░▒▓█"` or `" .·:+"` based on:
`Math.cos(cx * f1 + t) + Math.sin(cy * f2 + t)` where t advances each frame.

**Option B — static noise (simpler for S01):**
Random chars from a sparse set, re-rolled on each render. Or a fixed seeded pattern.

Start with Option B for S01. S04 upgrades it to reactive animated plasma.

The background layer is painted directly onto the canvas before `renderWebcamFrame`
adds the skeleton on top. Since `showBg: false`, `renderWebcamFrame` starts with
blank cells — paint the background chars into the grid AFTER getting it back,
or roll your own grid and merge. Simplest: use a separate blessed box for the
background and layer the skeleton box on top with `transparent: true`.

### 4. GlitchBoxWindow (`src/windows/glitchbox-window.ts`)

Standard blessed microapp window. Two blessed boxes stacked:
- `bgBox` — full size, background plasma (updated on timer or static)
- `skelBox` — same size, tags: true, transparent background, skeleton content

On `DancePoseService` frame event: re-render both layers, call `screen.render()`.

### 5. Command registration

In `command-catalog.ts`:
```ts
{ id: "glitchbox.open", label: "GlitchBox", category: "Applications", ... }
```

In `app-controller.ts`: wire to `new GlitchBoxWindow(screen, dancePoseService)`.

`DancePoseService` should be a singleton on `AppController` (like `ScrambleBrain`).

---

## Acceptance Criteria

- [ ] `glitchbox.open` appears in Applications menu and command palette
- [ ] Window opens, shows idle skeleton (head + torso + arms + legs visible)
- [ ] Background has some visual texture (even static noise is fine for S01)
- [ ] `bun run typecheck` passes clean
- [ ] Manual smoke: open window, skeleton visible and legible at 80×24

## Not in scope for S01

- Any API command to change pose (S02)
- Pose transitions / animation (S03)
- Field moods / reactivity (S04)
- Multi-agent bodies (S05)
- Window describeState / workspace persistence (do in S02 once shape is stable)

---

## Files to create

```
src/core/skeleton-renderer.ts        — new: renderSkeletonAt() extracted from webcam-renderer
src/services/dance-pose-service.ts   — new: DancePoseService + IDLE_LANDMARKS + preset table
modules/glitchbox/index.ts           — new: microapp module (follows sy2-chronicles pattern)
modules/glitchbox/module.json        — new: module manifest
```

## Files to touch

```
src/services/microapp-sdk.ts         — export renderSkeletonAt + POSE_CONNECTIONS
src/services/webcam-renderer.ts      — refactor drawSkeleton to call renderSkeletonAt
src/core/command-catalog.ts          — add glitchbox.open
src/core/app-controller.ts           — wire command + instantiate DancePoseService singleton
```

## Import path (from ~/Repos/wibwob-glitchbox worktree)

SDK exports all render primitives. Import as:

```ts
import {
  renderWebcamFrame, gridToBlessedContent,
  blankGrid, gridToText, waveLine,
  createTimer, clearTimers,
  tween,
} from "../../src/services/microapp-sdk.js"
import type { MonsterCamFrame } from "../../src/services/microapp-sdk.js"
import { renderSkeletonAt, POSE_CONNECTIONS } from "../../src/core/skeleton-renderer.js"
```

No new packages needed. All render logic already exists — S01 is pure extraction + wiring.
