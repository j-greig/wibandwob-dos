# Monster Cam — Agent Notes

## Why it might not be working

The mediapipe Python venv is **gitignored** — it is never in the repo.
If `monster_cam.open` is missing from the Applications menu, the venv doesn't exist yet.

The capability probe at startup checks:
```
assets/mediapipe-venv/bin/python
```
If that path doesn't exist → `path.monster_cam.venv` = false → command hidden from menu silently.
No error, no warning. It just disappears.

## First-time setup (one command)

```bash
python3 -m venv assets/mediapipe-venv
assets/mediapipe-venv/bin/pip install -r assets/mediapipe/requirements.txt
```

Then restart the app so the capability probe re-runs:
```bash
bash scripts/restart.sh
```

After restart, `monster_cam.open` should appear in Applications → Monster Cam.

## What's in this directory

| File | Purpose |
|---|---|
| `requirements.txt` | mediapipe + opencv-python — pip install target |
| `face_detector.tflite` | Face detection model |
| `hand_landmarker.task` | Hand tracking model |
| `pose_landmarker.task` | Body pose model |
| `monster_cam_worker.py` | Python worker — camera capture, detection, socket IPC |

## Source files (TS side)

```
src/services/monster-cam-service.ts  — socket reader, frame events
src/services/monster-cam-worker.ts   — spawns the Python worker
src/windows/monster-cam-window.ts    — blessed window, ASCII render
```

## Socket protocol

Per frame:
1. JSON line: `{"w":80,"h":45,"ts":...,"has_face":true,"hand_count":0,...}\n`
2. `w*h` raw grayscale bytes

Socket path: `/tmp/face_monster_cam.sock`
