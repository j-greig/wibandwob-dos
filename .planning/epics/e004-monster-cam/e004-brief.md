Status: not-started
GitHub issue: —
PR: —

# E004 — Monster Cam

## TL;DR

Webcam → ASCII window in the TS TUI. Pure TS, no native addons. Camera capture via ffmpeg subprocess (avfoundation on macOS). Detection via `@mediapipe/tasks-vision` (Google WASM). Three progressive features: face → hands → body.

## Background

Python prototype (`app/tools/face_worker.py`) existed briefly, deleted in `52fbfd5`. Used OpenCV + Haar cascades. This epic replaces it with a fully TS-native stack — no node-gyp, no native addons, runs under Bun.

## Stack

| Concern | Solution | Notes |
|---------|----------|-------|
| Camera capture | `ffmpeg` subprocess | `-f avfoundation -pix_fmt rgb24 -f rawvideo pipe:1` — raw RGB bytes to stdout. macOS native, no addon. |
| Face detection | `@mediapipe/tasks-vision` `FaceLandmarker` | WASM, zero native compile |
| Hand detection | `@mediapipe/tasks-vision` `HandLandmarker` | same package, F02 |
| Body/pose | `@mediapipe/tasks-vision` `PoseLandmarker` | same package, F03 |
| Frame decode | `sharp` or manual stride math | RGB stride = w*3 |

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

- [ ] **AC-1:** Worker starts, opens camera via ffmpeg, writes valid frames to socket at ≥8fps.
  - Test: `bun run src/services/monster-cam-worker.ts --dry-run` prints frame JSON without crashing; `nc -U /tmp/face_monster_cam.sock | head -c 500` shows JSON line then bytes.

- [ ] **AC-2:** Window opens via Applications menu and `POST /view/monster-cam/open`.
  - Test: `curl -X POST localhost:PORT/view/monster-cam/open` → window visible; menu item produces same result.

- [ ] **AC-3:** Live ASCII render updates in the blessed window (F01).
  - Test: wave in front of camera — visible change in terminal render.

- [ ] **AC-4:** `hasFace` in `/state` tracks camera correctly (F01).
  - Test: cover lens → `GET /state` shows `hasFace: false`; uncover → `hasFace: true`.

- [ ] **AC-5:** `handCount` in `/state` tracks hands correctly (F02).
  - Test: hold up one hand → `handCount: 1`; two → `handCount: 2`; none → `handCount: 0`.

- [ ] **AC-6:** `hasPose` in `/state` set when body visible (F03).
  - Test: step into frame → `hasPose: true`; step out → `hasPose: false`.

- [ ] **AC-7:** Window closes cleanly — ffmpeg and worker exit, socket removed.
  - Test: close window, `ps aux | grep ffmpeg` empty, `/tmp/face_monster_cam.sock` gone.

- [ ] **AC-8:** App boots normally with no camera or ffmpeg — window shows error state, no crash.
  - Test: unset camera device or rename ffmpeg binary, open window — error shown in window, app continues.

- [ ] **AC-9:** `bun run typecheck` passes with all monster cam source included.
  - Test: `bun run typecheck` exits 0 from repo root.

## Out of Scope

- Monster/emoji face compositing
- Multiple simultaneous cameras
- Recording or video export
- Windows/Linux camera capture (avfoundation is macOS only — abstract later)

## Known Risks

- `@mediapipe/tasks-vision` WASM init is async and ~200ms first-load — worker should pre-init before opening socket
- ffmpeg avfoundation requires camera permission prompt on macOS on first run
- MediaPipe model files are fetched from CDN by default in browser mode — Node path needs `FilesetResolver` pointed at local WASM assets; bundle them or cache them
