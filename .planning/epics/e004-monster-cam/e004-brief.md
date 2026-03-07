Status: in-progress
GitHub issue: #107
PR: —

# E004 — Monster Cam

## TL;DR

Webcam → ASCII window in the TS TUI. Python/MediaPipe worker via Unix socket. Face detection + hand tracking working. ASCII BG toggle working. Pose detected but no skeleton render yet.

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
  - Test: Wave in front of camera — visible change in terminal ASCII render. Manually verified. BG toggle (b key + button) working.

- [x] **AC-4:** `hasFace` in `/state` tracks camera correctly (F01).
  - Test: Face detection box appears/disappears with face presence; `describeState()` reports `hasFace`. Manually verified.

- [x] **AC-5:** `handCount` in `/state` tracks hands correctly (F02).
  - Test: L/R coloured double-line boxes appear per hand; `describeState()` reports `handCount`. Manually verified.

- [ ] **AC-6:** `hasPose` in `/state` set when body visible (F03).
  - Test: step into frame → `hasPose: true`; step out → `hasPose: false`. Detection wired, skeleton render not yet done.

- [ ] **AC-7:** Window closes cleanly — Python worker exits, socket removed.
  - Test: Close window; `ps aux | grep python` shows worker gone; `/tmp/face_monster_cam.sock` removed.

- [x] **AC-8:** App boots normally with no camera — window shows error state, no crash.
  - Test: Unset camera device, open window — error shown in status bar, app continues.

- [ ] **AC-9:** `bun run typecheck` passes with all monster cam source included.
  - Test: `bun run typecheck` exits 0 from repo root.

Branch worktree-e004-monster-cam merged to main (b3d9d1d). Remaining: AC-6 pose skeleton, AC-7 socket cleanup verification, AC-9 typecheck.

## Out of Scope

- Monster/emoji face compositing
- Multiple simultaneous cameras
- Recording or video export
- Windows/Linux camera capture (avfoundation is macOS only — abstract later)

## Known Risks

- `@mediapipe/tasks-vision` WASM init is async and ~200ms first-load — worker should pre-init before opening socket
- ffmpeg avfoundation requires camera permission prompt on macOS on first run
- MediaPipe model files are fetched from CDN by default in browser mode — Node path needs `FilesetResolver` pointed at local WASM assets; bundle them or cache them
