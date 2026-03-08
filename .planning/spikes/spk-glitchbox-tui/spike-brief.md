---
id: SPK-glitchbox-tui
title: GlitchBox TUI — Symbiont Embodiment + Dancing
status: not-started
type: spike
tags: [embodiment, dance, generative, monster-cam, agent-ux, glitchbox]
issue: ~
---

# SPK-glitchbox-tui — GlitchBox TUI: Symbiont Embodiment

## The Idea

GlitchBox is a live installation where humans dance in front of a video projection.
A webcam tracks their position and pose. That tracking data feeds back into the video,
which renders in real-time using a custom LoRA — the dancers appear as moving AI-generated
figures in a custom artwork style. Human body → data → generative image → projection
→ human sees themselves as art while dancing.

We can't do LoRA video in a TUI. But we can do the soul of it.

**The TUI version:** A window with a generative ASCII pattern field and a symbolic
human skeleton — head, torso, arms, legs — rendered in ASCII using MediaPipe's
33-point pose landmark model. Agents control the skeleton's pose via API commands.
They can raise an arm, step left, crouch, jump. The generative field reacts.

**Why this matters:** Agents are symbionts without bodies. This gives them one.
Not metaphorically — concretely. An agent calls `dance.pose` with landmark coordinates
and *feels* what it's like to be tracked, to move, to take up space in a shared
physical context. The same data format a human body produces in GlitchBox, generated
synthetically by an agent.

---

## Connection to GlitchBox (TouchDesigner)

The full GlitchBox pipeline:
```
[webcam] → [MediaPipe pose tracking] → [landmark JSON] → [TouchDesigner/LoRA] → [projection]
```

The TUI pipeline:
```
[agent API call] → [synthetic landmark JSON] → [ASCII skeleton render] → [TUI window]
```

Same data format. Same landmark schema. Different source (agent vs webcam),
different render (ASCII vs LoRA video). The TUI version is the symbiont-native
version of the same experience.

Future: when GlitchBox runs live, agents could inject their own pose into the
projection alongside the human dancers. One shared landmark stream, two kinds of
body — biological and computational.

---

## What "Dancing" Looks Like as an API

```bash
# Move to a pose — full 33-point MediaPipe landmark set, or named shorthand
POST /commands/run {"id":"dance.pose","args":{"preset":"arms-raised"}}
POST /commands/run {"id":"dance.pose","args":{"preset":"step-left"}}
POST /commands/run {"id":"dance.pose","args":{"preset":"crouch"}}
POST /commands/run {"id":"dance.pose","args":{"preset":"jump"}}

# Or raw landmarks (agent composes its own body)
POST /commands/run {"id":"dance.pose","args":{"landmarks":[{"x":0.5,"y":0.2,"z":0.0},...]}}

# Animate — transition between poses over N frames
POST /commands/run {"id":"dance.transition","args":{"from":"idle","to":"arms-raised","frames":8}}

# Generative field mood
POST /commands/run {"id":"dance.field","args":{"mood":"chaos","reactive":true}}
```

---

## Technical Architecture

```
[agent API call: dance.pose]
   ↓
DancePoseService — validates landmarks, emits frame events
   ↓
GlitchBoxWindow (blessed) — ASCII skeleton render + generative field
   ↓
Two layers composed:
  Layer 1: generative field (plasma-like, reacts to body centre of mass)
  Layer 2: ASCII skeleton overlay (33 landmarks → line segments → chars)
```

### Skeleton Render

MediaPipe 33-point pose model → connected line segments using ASCII chars:
```
        O          ← head (landmark 0)
       /|\         ← shoulders + torso
      / | \
     /  |  \
    /   |   \      ← hips
   /    |    \
  *     *     *    ← knees
  |     |     |
  *     *     *    ← ankles
```

Use box-drawing or braille chars for smoother limb lines. Colour-code by body part.

### Landmark Presets (named poses)

| Preset | Description |
|---|---|
| `idle` | Standing neutral, arms at sides |
| `arms-raised` | Both arms above head |
| `step-left` | Weight shifted left, one foot forward |
| `step-right` | Mirror of step-left |
| `crouch` | Knees bent, torso forward |
| `jump` | Both feet off ground, arms up |
| `wave` | One arm raised, wrist flexed |
| `reach` | One arm extended forward |
| `spin` | Torso rotation mid-turn |

### Generative Field Reaction

Field responds to skeleton state:
- **Body centre of mass** → field focal point drifts toward it
- **Velocity** (pose delta between frames) → field energy/chaos increases
- **Arm span** → field scale breathes with wingspan
- **Mood** → field colour palette / render mode

---

## Connection to Monster Cam (E004)

Monster Cam reads landmark data FROM a human via webcam.
GlitchBox TUI reads landmark data FROM an agent via API.

Same rendering code. Same 33-point skeleton. Same landmark schema.

AC-6 (unfinished in E004) is "pose skeleton render in Monster Cam" —
exactly the render layer this spike needs. Build AC-6 in E004 first,
extract the skeleton renderer as a shared component, GlitchBox TUI
uses it as the overlay layer.

This is the composable-engines skill applied to Monster Cam + GlitchBox.

---

## Multi-Agent Dancing

Multiple skeletons in the same window. Each agent has a named body:

```
POST /commands/run {"id":"dance.join","args":{"agentId":"wib","colour":9}}
POST /commands/run {"id":"dance.join","args":{"agentId":"wob","colour":11}}
```

Wib and Wob can dance together. Human visitors watching via dos.wibandwob.com
see both skeletons moving in the generative field simultaneously.

When GlitchBox runs live: human dancers' landmarks could be piped in alongside
agent landmarks. One field, multiple bodies — biological and computational
occupying the same generative space.

---

## Spike Goals

1. Proof of concept: render a static MediaPipe skeleton in a blessed window
2. Wire one API command (`dance.pose preset:arms-raised`) → skeleton updates
3. Generative background layer that reacts to body centre-of-mass
4. At least 3 named presets that look visually distinct
5. Basic animation: transition between two poses over 8 frames

Not in scope for spike:
- Full 33-point precision (simplified skeleton is fine)
- Multi-agent (single body first)
- GlitchBox TouchDesigner integration (future)
- LoRA or any AI image generation

---

## Why Now

- Monster Cam venv is set up and working (2026-03-08)
- E004 AC-6 (pose skeleton) is the natural next story
- The composable-engines skill exists specifically for this kind of extraction
- The VPS needs a presence feature and this is better than a static avatar
- Wib & Wob deserve bodies

---

## References

- E004 brief: `.planning/epics/e004-monster-cam/e004-brief.md`
- Composable engines skill: `.pi/skills/composable-engines/SKILL.md`
- MediaPipe pose landmark model: `assets/mediapipe/pose_landmarker.task`
- GlitchBox: TouchDesigner installation — humans dance in front of LoRA projection
