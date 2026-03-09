# Sidequest — ControlNet Pose Pipeline

> Status: parked. No GPU locally. CPU-only for now.
> Revisit when 0xG's Gradio instance is accessible or a GPU rig is available.

## What this is

0xG built GlitchBox using ControlNet — depth and pose variants.
ControlNet conditions Stable Diffusion generation on structural guides:
depth maps, pose skeletons (OpenPose format), edges, etc.

Reference: https://github.com/lllyasviel/ControlNet
Entry point: `python gradio_pose2image.py` — Gradio app, also exposes REST API.

## The pipeline idea

```
webcam frame
  → MediaPipe pose landmarks (already live in Monster Cam worker)
  → render as OpenPose skeleton image  ← the bridge step
  → POST to GlitchBox / ControlNet Gradio API
  → SD-generated image conditioned on pose
  → img-to-ascii
  → Monster Cam overlay / standalone primer window
```

## Why it's interesting

We already have the pose landmarks. MediaPipe gives 33 normalized points per frame.
OpenPose format is just coloured dots + lines on a black background — a `cv2` render job.
ControlNet then uses that skeleton to generate a stylised image of a person in that pose,
conditioned by a text prompt. You'd be driving generative art with your live body.

## Two integration options

**Option A — send webcam frame directly (simplest)**
ControlNet's OpenPose detector runs on the raw image. One HTTP POST from the Python worker.
Slightly redundant (two pose detectors) but zero extra code on our side.

**Option B — render our MediaPipe landmarks as OpenPose image (cleaner)**
Use `cv2.line` + the standard OpenPose colour scheme to render the skeleton ourselves.
Skips ControlNet's detector, lets us control exactly what it sees.
`controlnet_aux` library can help, or just raw cv2.

Start with A to prototype, move to B if quality matters.

## Why it's parked

- No GPU locally — Stable Diffusion is not CPU-friendly. Min ~4GB VRAM needed.
- Latency at CPU speeds: 30-120s per frame. Not live-cam territory.
- Needs 0xG's Gradio instance URL + any auth before we can even test Option A.

## When to unpick this

- 0xG exposes the Gradio API (URL + token)
- Or: a GPU rig is available (cloud, local, M-series with MPS backend)
- At CPU speeds, "generate every N seconds" mode is viable — not live but interesting

## Latency expectations (rough)

| Hardware | Per-frame time | Viable mode |
|----------|---------------|-------------|
| GPU (RTX 3080+) | 1-3s | slow live, every-N-seconds |
| Apple M2/M3 MPS | 5-15s | every-N-seconds only |
| CPU only | 30-120s | batch/offline only |

## Questions for 0xG

1. Is the Gradio instance accessible? URL + auth?
2. Depth ControlNet, pose ControlNet, or both running?
3. What model / GPU?
4. Does it accept raw webcam frames (Option A) or does it need an OpenPose skeleton image?

## Relation to SG-7

If this gets built, it becomes SG-7 in the E004 brief:
- New mode in the Monster Cam window (key: `p` for pose-art?)
- Python worker gains optional async HTTP call to ControlNet endpoint
- Falls back silently if endpoint unreachable
- Output image converted to ASCII and composited or shown in separate primer window
