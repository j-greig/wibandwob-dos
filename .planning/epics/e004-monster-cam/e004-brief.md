---
id: E004
title: Monster Cam
status: done
issue: 107
pr: ~
depends_on: []
---

# E004 — Monster Cam

## TL;DR

Webcam → ASCII window in the TS TUI. Python/MediaPipe worker via Unix socket. Face detection + hand tracking working. ASCII BG toggle working. Pose detected but no skeleton render yet.

## ⚠️ Scope: LOCAL ONLY — no webcam on VPS

Monster Cam requires a physical webcam on the machine running the app.
It **cannot work on dos.wibandwob.com** or any headless VPS — there is no camera.
It is correctly `forceOff` in the `docker-safe` profile and will stay that way.

For the VPS/agent embodiment equivalent — where agents "dance" without a webcam —
see the GlitchBox TUI spike: `.planning/spikes/spk-glitchbox-tui/`
That is a separate feature with a separate brief. Do not confuse the two.

## Background

Original plan was ffmpeg + @mediapipe/tasks-vision WASM. Pivoted to Python/OpenCV/MediaPipe (simpler, more reliable on macOS, avoids WASM node-path issues). Stack diverges from brief but ships faster.

## Stack (actual)

| Concern | Solution | Notes |
|---------|----------|-------|
| Camera capture | OpenCV `VideoCapture` in Python | macOS, 320×240 input |
| Face detection | `mediapipe.solutions.face_detection` | FaceDetection model 0 |
| Hand detection | `mediapipe.solutions.hands` | max 2 hands, conf 0.3 |
| Body/pose | `mediapipe.solutions.pose` | detected, no render yet |
| Frame transport | Unix socket `/tmp/face_monster_cam.sock` | JSON header + raw grayscale bytes |
| Worker launcher | `monster-cam-worker.ts` → spawns Python | thin TS shim |

## Architecture

```
[camera]
   ↓ raw RGB bytes (ffmpeg pipe)
src/services/monster-cam-worker.ts    ← sidecar (Bun child process)
   ↓  JSON frame metadata + raw bytes over Unix socket
/tmp/face_monster_cam.sock
   ↓
src/services/monster-cam-service.ts   ← socket reader, typed frame events
   ↓
src/windows/monster-cam-window.ts     ← blessed box, ASCII render + overlays
```

Socket protocol (per frame):
1. JSON line: `{"w":80,"h":45,"ts":1694450000,"has_face":true,"has_hands":false,"has_pose":false,"face_landmarks":[...],"hand_count":0}\n`
2. `w*h*3` raw RGB bytes

## Features

### F01 — Face Detection
- Worker: spawn ffmpeg, pipe raw RGB, feed frames to `FaceLandmarker`
- Service: socket reader, emit `MonsterCamFrame` events
- Window: `WindowKind.monsterCam`, grayscale ASCII ramp, face bbox overlay, `describeState()` with `hasFace`, `fps`, `device`
- Registry: `open_monster_cam` → Applications menu, `POST /view/monster-cam/open`

### F02 — Hand Tracking
- Extend worker: run `HandLandmarker` alongside face detector
- Extend protocol: `has_hands`, `hand_count`, `hand_landmarks[]` in JSON header
- Window: ASCII skeleton overlay for hand landmarks (21-point model)
- State: `handCount` added to `describeState()`

### F03 — Body / Pose
- Extend worker: run `PoseLandmarker` alongside face + hands
- Extend protocol: `has_pose`, `pose_landmarks[]` in JSON header
- Window: ASCII stick figure overlay from 33-point pose model
- State: `hasPose` added to `describeState()`

## Acceptance Criteria

- [x] **AC-1:** Worker starts, opens camera via Python/OpenCV, writes valid frames to socket at ≥8fps.
  - Test: Worker spawned via `bun run src/services/monster-cam-worker.ts`; socket emits JSON header + grayscale bytes; FPS shown live in status bar. Manually verified.

- [x] **AC-2:** Window opens via Applications menu and `POST /view/monster-cam/open`.
  - Test: `curl -X POST localhost:PORT/view/monster-cam/open` → window visible; menu item produces same result.

- [x] **AC-3:** Live ASCII render updates in the blessed window (F01).
  - Test: Wave in front of camera — visible change in terminal ASCII render. Manually verified. BG toggle (b key + button) working. Re-verified 2026-03-08 on feat/e004-monster-cam-complete — face confirmed live.

- [x] **AC-4:** `hasFace` in `/state` tracks camera correctly (F01).
  - Test: Face detection box appears/disappears with face presence; `describeState()` reports `hasFace`. Manually verified.

- [x] **AC-5:** `handCount` in `/state` tracks hands correctly (F02).
  - Test: L/R coloured double-line boxes appear per hand; `describeState()` reports `handCount`. Manually verified.

- [x] **AC-6:** `hasPose` in `/state` set when body visible (F03).
  - Test: step into frame → `hasPose: true`; step out → `hasPose: false`. Detection wired, skeleton render not yet done.

- [x] **AC-7:** Window closes cleanly — Python worker exits, socket removed.
  - Fix: `stop()` now calls `fs.unlinkSync(SOCK_PATH)` after killing worker + socket.

- [x] **AC-8:** App boots normally with no camera — window shows error state, no crash.
  - Test: Unset camera device, open window — error shown in status bar, app continues.

- [x] **AC-9:** `bun run typecheck` passes with all monster cam source included.
  - Fix: typecheck script changed to `node_modules/.bin/tsc --noEmit` (tsc not on bun PATH).

Branch worktree-e004-monster-cam merged to main (b3d9d1d). Remaining: AC-6 pose skeleton, AC-7 socket cleanup verification, AC-9 typecheck.

**2026-03-08:** venv created at `assets/mediapipe-venv/` (gitignored). `monster_cam.open` now appears in Applications menu and opens successfully. Worktree: `feat/e004-monster-cam-complete`.

## Stretch Goals

Not part of the done definition. Pick up when the mood strikes.

### SG-1 — Pose skeleton render
Detection is wired, `hasPose` flows through to `/state`, but no visual overlay yet.
Render the 33-point MediaPipe pose model as an ASCII stick figure on top of the
grayscale feed. Use the same double-line box style as hands. Expected ~30 lines of
window render code.

### SG-2 — Monster/emoji face compositing
Replace (or overlay) the face bbox with a rendered emoji or ASCII monster face,
locked to the detected face landmarks. Mouth open/closed state from landmarks → swap
sprite. Very Wib. Could be a toggle key alongside `b` for bg.

### SG-3 — Recording / export
Capture frames to disk as a timelapse or short clip. Options:
- ASCII art frames → text file per second → playback via primer animation
- Raw frame buffer → ffmpeg pipe → mp4

### SG-4 — Multi-camera support
Open multiple camera devices simultaneously, each in its own Monster Cam window.
Worker would need a `DEVICE_INDEX` env var; window/service pair per device.
Low priority — needs a second webcam to test.

### SG-5 — Cross-platform camera
Current capture uses OpenCV `VideoCapture` which works on macOS, Linux, Windows.
The old ffmpeg avfoundation path was macOS-only. OpenCV already mostly solves this —
just needs testing on Linux and documenting.

## Out of Scope (permanent)

- VPS / headless server support — no webcam, never will be. See SPK-glitchbox-tui for agent embodiment without a camera.

## Known Risks

- `@mediapipe/tasks-vision` WASM init is async and ~200ms first-load — worker should pre-init before opening socket
- ffmpeg avfoundation requires camera permission prompt on macOS on first run
- MediaPipe model files are fetched from CDN by default in browser mode — Node path needs `FilesetResolver` pointed at local WASM assets; bundle them or cache them
