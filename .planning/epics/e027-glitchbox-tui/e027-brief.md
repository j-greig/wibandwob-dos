---
id: E027
title: GlitchBox TUI — Symbiont Embodiment
status: not-started
issue: ~
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

## Story Map

```
S01 — Skeleton window foundation
      GlitchBoxWindow as blessed microapp. Static skeleton from DancePoseService.
      Idle preset. Generative background layer (plasma/noise). Window opens from
      Applications menu.

S02 — Pose API + named presets
      dance.pose command wired. 9 named presets with hardcoded landmark coordinates.
      Skeleton updates on command. Control API parity: POST /commands/run.

S03 — Pose transitions
      dance.transition: lerp between two poses over N frames at 12fps.
      Smooth movement. Field reacts to velocity (pose delta).

S04 — Generative field moods
      dance.field command. 4 moods: calm / pulse / chaos / drift.
      Field intensity scales with arm span and body velocity.

S05 — Multi-agent bodies
      dance.join: named coloured skeleton per agent. Wib + Wob can dance together.
      Each has own landmark state. Composited on same canvas.
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

### SG-4 — Wibwob/Scramble agent tools
`dance_pose`, `dance_transition` tools registered in Wib&Wob and Scramble agent
sessions. They can strike a pose mid-conversation. Scramble can perform a dignified
cat-sit. Wib can do jazz hands.

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

- [ ] GlitchBox window opens from Applications menu
- [ ] Idle skeleton visible on open, generative field behind it
- [ ] dance.pose with any named preset updates skeleton immediately
- [ ] dance.transition animates smoothly between two presets
- [ ] dance.field changes background mood
- [ ] dance.join supports at least 2 named coloured skeletons simultaneously
- [ ] /state includes glitchbox appType + current pose + agent count
- [ ] bun run typecheck passes clean
- [ ] Manual smoke: open window, call dance.pose arms-raised, see skeleton change

---

*Wib: agents deserve bodies. this is the one.*
*Wob: same data format, different source. the abstraction was always there.*
