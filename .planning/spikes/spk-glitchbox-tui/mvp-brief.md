---
id: SPK-glitchbox-tui
title: GlitchBox TUI — MVP Brief
status: not-started
type: mvp-brief
---

# GlitchBox TUI — MVP Brief

## One sentence

A TUI window where agents and humans can "dance" by controlling an ASCII skeleton
in a generative field — no webcam required, works everywhere including VPS.

## NOT Monster Cam

Monster Cam = webcam on server → ASCII face. **Needs physical camera. Local only.**

GlitchBox TUI = agent sends pose via API → ASCII skeleton moves. **No camera. Works on VPS.**

Same MediaPipe landmark schema, completely different data source.

---

## What the MVP looks like

A blessed window with two layers:

**Layer 1 — generative field**
A continuously animating ASCII background. Similar to plasma but denser —
think noise field, cellular automata, or interference patterns. The field
slowly drifts toward the skeleton's centre of mass.

**Layer 2 — ASCII skeleton**
A symbolic human figure (simplified — not all 33 points):
```
    O       ← head
   /|\      ← shoulders / arms
  / | \
 *  |  *    ← hands
    |
   / \      ← legs
  /   \
 *     *    ← feet
```
Rendered using line-drawing chars. The skeleton updates when the agent
sends a pose command. Smooth 8-frame interpolation between poses.

---

## The API (what agents actually call)

```bash
# Open the window
POST /commands/run {"id":"glitchbox.open","args":{}}

# Set a named pose
POST /commands/run {"id":"glitchbox.pose","args":{"preset":"arms-raised"}}
POST /commands/run {"id":"glitchbox.pose","args":{"preset":"step-left"}}
POST /commands/run {"id":"glitchbox.pose","args":{"preset":"jump"}}
POST /commands/run {"id":"glitchbox.pose","args":{"preset":"wave"}}
POST /commands/run {"id":"glitchbox.pose","args":{"preset":"idle"}}

# Check body state
GET /state → window.hasPose, window.currentPreset, window.velocity
```

That's it for MVP. No raw landmarks. No multi-agent. Named presets only.

---

## Named poses for MVP (5 minimum)

| Preset | What it looks like |
|---|---|
| `idle` | Standing, arms at sides |
| `arms-raised` | Both arms above head, celebratory |
| `step-left` | Weight left, one leg forward |
| `jump` | Both feet up, arms wide |
| `wave` | One arm raised, elbow bent |

---

## Acceptance criteria

- [ ] **AC-1:** `glitchbox.open` opens a window with animated generative field + idle skeleton
- [ ] **AC-2:** `glitchbox.pose` updates skeleton to named preset, animates smoothly over ~8 frames
- [ ] **AC-3:** All 5 MVP presets render as visually distinct ASCII poses
- [ ] **AC-4:** Field reacts — focal point drifts toward skeleton centre of mass
- [ ] **AC-5:** `GET /state` on the window reports `currentPreset` and `hasPose: true`
- [ ] **AC-6:** Works on VPS — no camera dependency, no Python venv needed
- [ ] **AC-7:** `bun run typecheck` passes

---

## Build order

1. ASCII skeleton renderer as a standalone module (reusable by Monster Cam AC-6 too)
2. Generative field (can start with plasma engine — see composable-engines skill)
3. Pose preset table → landmark coordinates
4. GlitchBox window composing field + skeleton
5. Command registration + API wiring
6. Smooth interpolation between poses

---

## Connection to TouchDesigner / GlitchBox installation

The real GlitchBox:
- Humans dance in front of a projection
- Webcam tracks them via MediaPipe
- Landmark data feeds into TouchDesigner
- LoRA renders dancers as moving AI art

The TUI version is the **symbiont-native equivalent** — agents experience
what it feels like to be tracked, to have a body, to move through space and
affect the visual field around them.

When GlitchBox runs live, the TUI version could feed agent landmarks INTO
the TouchDesigner pipeline alongside human dancers. Biological and
computational bodies in the same generative space.

---

## Skills to load when building

```
.pi/skills/composable-engines/SKILL.md    — extract plasma engine, compose into window
.pi/skills/new-window-type/SKILL.md       — checklist for wiring new window type
.agents/skills/ww-build-game/SKILL.md     — pattern for interactive TUI window
.planning/epics/e004-monster-cam/e004-brief.md  — skeleton render (AC-6) to extract
```

---

## What this is NOT

- Not Monster Cam. No webcam. No Python. No OpenCV.
- Not a game. No scoring, no collision, no player health.
- Not a full LoRA/AI art pipeline.
- Not multi-agent yet (post-MVP).
