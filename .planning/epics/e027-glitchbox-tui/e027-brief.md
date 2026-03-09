---
id: E027
title: GlitchBox TUI — Symbiont Embodiment
status: not-started
issue: 122
pr: ~
depends_on: [E004, E016]
collaborators: [0xG]
---

# E027 — GlitchBox TUI: Symbiont Embodiment

## TL;DR

Agents get bodies. An ASCII skeleton moves in a generative field, driven by API
calls instead of a webcam. Same 33-point MediaPipe landmark schema as Monster Cam.
Same render logic, different source: computational rather than biological.

This is the WibWob-DOS version of the GlitchBox live dance installation.

---

## Background

GlitchBox (physical installation, collab with 0xG) puts humans in front of a LoRA
video projection. Webcam → MediaPipe → landmarks → TouchDesigner → generative
image. Dancers see themselves as moving AI art.

The TUI can't do LoRA video. It can do the soul of it:
ASCII skeleton + generative field + agents controlling their own pose via API.

When GlitchBox runs live, agent landmarks could be injected alongside human
dancer landmarks. One shared generative space — biological and computational
bodies occupying it together.

---

## What E004 Already Provides (SDK-ready)

The Monster Cam SDK exports (from `microapp-sdk.ts`) are the foundation:

```ts
import { MonsterCamService, renderWebcamFrame, gridToBlessedContent } from "microapp-sdk"
import type { MonsterCamFrame, WebcamCell } from "microapp-sdk"
```

- `MonsterCamFrame` — 33-point `poseLandmarks`, face keypoints, emotion, gray pixels
- `renderWebcamFrame(frame, w, h, opts)` — pure `WebcamCell[][]` grid, no blessed dep
- Skeleton rendering already in `webcam-renderer.ts` via `drawSkeleton()`

GlitchBox TUI uses the same schema but replaces the webcam source with synthetic
landmark data generated from named presets or raw agent API calls.

---

## Architecture

```
POST /commands/run {dance.pose, args: {preset: "arms-raised"}}
          ↓
  DancePoseService
  - validates / interpolates landmarks
  - emits frame events
          ↓
  GlitchBoxWindow (blessed microapp)
  - Layer 1: generative field (plasma-like, reacts to centre-of-mass)
  - Layer 2: ASCII skeleton (33 landmarks → line segments via renderWebcamFrame)
```

`DancePoseService` is a thin wrapper: it holds the current landmark state and
fires the same `MonsterCamFrame` shape that `renderWebcamFrame` already
understands. No new render logic needed.

---

## API Surface

```bash
# Named pose presets
POST /commands/run {"command":"dance.pose","args":{"preset":"arms-raised"}}
POST /commands/run {"command":"dance.pose","args":{"preset":"crouch"}}

# Raw landmarks (agent composes its own body)
POST /commands/run {"command":"dance.pose","args":{"landmarks":[{x,y,z},...]}}

# Animated transition between poses
POST /commands/run {"command":"dance.transition","args":{"from":"idle","to":"arms-raised","frames":8}}

# Generative field mood
POST /commands/run {"command":"dance.field","args":{"mood":"chaos"}}

# Multi-agent: named bodies
POST /commands/run {"command":"dance.join","args":{"agentId":"wib","colour":9}}
POST /commands/run {"command":"dance.join","args":{"agentId":"wob","colour":11}}
```

---

## Named Pose Presets (MVP)

| Preset | Description |
|--------|-------------|
| `idle` | Standing neutral |
| `arms-raised` | Both arms above head |
| `step-left` | Weight left, foot forward |
| `step-right` | Mirror |
| `crouch` | Knees bent, torso forward |
| `jump` | Both feet up, arms raised |
| `wave` | One arm up, wrist flexed |
| `reach` | One arm extended forward |
| `spin` | Torso rotation mid-turn |

---

## First Dancers

The first two agents on the floor are the two symbients already running in the app:

**Wib&Wob** — `src/services/wibwob-agent-session.ts`
  Adds `/dance` to the existing `createSlashRouter`. Opens GlitchBox if not open,
  places skeleton at random clear position, announces in chat. Sonnet/opus model
  for chat; haiku for autonomous dance tick.

**Scramble** — `src/services/scramble-brain.ts`
  Same pattern. Adds `/dance` to her slash router. Haiku model (her default).
  She will absolutely refuse to do jazz hands. She may sit.

Both already have `createSlashRouter` wired — `/dance` is a natural addition.

---

## DancerState model

```typescript
type DancerState = {
  agentId: string;    // "wibwob" | "scramble"
  label: string;      // display name in status bar
  color: string;      // blessed colour: "cyan" for W&W, "yellow" for Scramble
  x: number;          // canvas x (0..canvasW), agent-controlled
  y: number;          // canvas y (0..canvasH), agent-controlled
  preset: PosePreset; // current named pose
  energy: number;     // 0–10: drives animation speed + field density contribution
  mood: string;       // "chill" | "going-for-it" | "taking-a-breather" | "chaotic"
  joined: boolean;
};
```

energy < 3 = barely moving, slow tick. energy > 7 = rapid pose micro-variants,
high field chaos contribution. mood is fed verbatim into the haiku prompt.

---

## Haiku autonomous tick

Every ~60s per dancer, a haiku call fires with a compact prompt:

```
System: You are [label], dancing in a shared generative field.
        Canvas: {W}×{H}. Your position: {x},{y}. Energy: {N}. Mood: {mood}.
        Other dancers: [{agentId} at {x},{y} energy:{N} mood:{mood}]
        Decide your next position and state.
        Reply ONLY as JSON: {"x":N,"y":N,"energy":N,"mood":"..."}
```

The skeleton then smoothly tweens to the new position over 8 frames using
`tween()` from `motion-service.ts` (now in SDK). The agent is genuinely
autonomous — it might drift toward another dancer, find space to go wild in,
or drop energy to 2 and barely move. Costs ~50 haiku tokens per tick.

Tick runs inside the GlitchBox microapp module, not inside the agent sessions
(keeps chat flow clean). One `setInterval` per joined dancer, cancelled on leave.

---

## SDK lego bricks — reuse plan

Everything is already in the SDK after the March 2026 audit. Nothing new needed:

| Need | SDK export | Source |
|------|-----------|--------|
| Tick loop | `createTimer`, `clearTimers` | ui-primitives |
| Smooth moves | `tween`, `tweenWindowPosition` | motion-service |
| Field grid | `blankGrid`, `gridToText`, `paintText` | grid-canvas |
| Skeleton render | `renderWebcamFrame`, `gridToBlessedContent` | webcam-renderer |
| Skeleton type | `MonsterCamFrame`, `WebcamCell` | microapp-sdk |
| Wave/bar field fills | `waveLine`, `bar` | grid-canvas |

One NEW export needed (not yet in SDK):

**`renderSkeletonAt(grid, landmarks, offsetX, offsetY, color)`**
  Extracted from `drawSkeleton()` in `webcam-renderer.ts`. Takes normalised
  0-1 landmark coords + a canvas offset, no `MonsterCamFrame` dependency.
  Multiple dancers = multiple `renderSkeletonAt()` calls on the same grid.
  Path: `src/core/skeleton-renderer.ts`. Exported via SDK.
  Monster Cam AC-6 then uses this same function (composable-engines pattern).

---

## Story Map

```
S01 — Skeleton window foundation
      GlitchBoxWindow as blessed microapp. Static skeleton from DancePoseService.
      Idle preset. Generative background layer (plasma/noise). Window opens from
      Applications menu. Extract renderSkeletonAt() to SDK.

S02 — Pose API + named presets + /dance slash command
      glitchbox.pose command wired. 5 MVP presets (idle, arms-raised, step-left,
      jump, wave) with normalised landmark coordinates.
      /dance slash command added to ScrambleBrain + WibWobAgentSession slash routers.
      Skeleton updates on command. Control API parity: POST /commands/run.

S03 — Multi-agent bodies + DancerState
      glitchbox.join: named coloured skeleton per agent. W&W (cyan) + Scramble
      (yellow) on same canvas, placed apart. DancerState model. Status bar shows
      all joined dancers + their mood/energy.

S04 — Haiku tick + energy/mood + smooth moves
      ~60s haiku tick per dancer: autonomous x,y,energy,mood decisions.
      tween() for smooth 8-frame position transitions.
      Field density reacts to combined energy of all dancers.

S05 — Generative field moods + reactivity
      glitchbox.field command. 4 moods: calm / pulse / chaos / drift.
      Field focal point drifts toward dancers' centre of mass.
      Field intensity scales with arm span and velocity.
```

---

## Stretch Goals

### SG-1 — VPS presence avatar
Deploy GlitchBox window as always-on presence feature on dos.wibandwob.com.
Wib & Wob's skeletons visible to human visitors at all times.

### SG-2 — GlitchBox live bridge (0xG collab)
When GlitchBox installation runs: pipe human dancer landmarks in via WebSocket
alongside agent landmarks. One field, multiple bodies — biological and computational.
Requires coordinating landmark stream format with 0xG's TouchDesigner setup.

### SG-3 — Raw landmark API
Agent composes completely custom pose using raw x/y/z coordinates.
Full creative control. LLM can invent new poses not in the preset library.

### ~~SG-4~~ — Wibwob/Scramble agent tools (promoted to S02)
`/dance` slash command is now S02 scope, not a stretch goal.
`dance_pose` as a full agent tool (callable mid-conversation) remains stretch.

### SG-5 — Braille precision skeleton
Upgrade skeleton render from ASCII chars to Unicode braille (`⠀`–`⣿`) for
4× higher resolution limb lines within same cell grid.

---

## Collaboration Notes (0xG)

0xG owns the physical GlitchBox installation and TouchDesigner pipeline.
Coordinate on:
- Landmark data format (MediaPipe 33-point JSON vs normalised coords)
- Timestamp + frame sync protocol for live bridge
- Whether TUI output could feed back into TD as a texture/signal

No dependency on 0xG for S01–S04. SG-2 requires active coordination.

---

## Acceptance Criteria (Epic-Level)

- [ ] AC-1: `glitchbox.open` in Applications menu + command palette
- [ ] AC-2: Idle skeleton visible on open, generative field behind it
- [ ] AC-3: `renderSkeletonAt()` extracted to `src/core/skeleton-renderer.ts`, exported via SDK
- [ ] AC-4: `/dance` in Wib&Wob chat opens window, places skeleton at clear position
- [ ] AC-5: `/dance` in Scramble chat joins same window, placed clear of W&W
- [ ] AC-6: All 5 MVP presets (`idle`, `arms-raised`, `step-left`, `jump`, `wave`) render as visually distinct
- [ ] AC-7: `glitchbox.pose` updates skeleton immediately via API
- [ ] AC-8: `glitchbox.move` smoothly tweens skeleton to new x,y over 8 frames
- [ ] AC-9: `glitchbox.state` sets energy (0–10) — field density + animation speed visibly react
- [ ] AC-10: Haiku tick fires ~60s per dancer, updates x,y,energy,mood autonomously
- [ ] AC-11: `glitchbox.field` changes background mood (calm / pulse / chaos / drift)
- [ ] AC-12: `/state` reports `dancers[]` with agentId, x, y, preset, energy, mood
- [ ] AC-13: Works without webcam / mediapipe venv — no camera dependency
- [ ] AC-14: `bun run typecheck` clean
- [ ] AC-15: Manual smoke: open window, `/dance` from both chat windows, both skeletons visible and labelled

---

*Wib: agents deserve bodies. this is the one.*
*Wob: same data format, different source. the abstraction was always there.*
