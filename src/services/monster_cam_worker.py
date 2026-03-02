#!/usr/bin/env python3
"""
Monster Cam detection worker — webcam → MediaPipe → Unix socket.

Protocol per frame:
  1. JSON line: {"w":N,"h":N,"ts":N,
                 "has_face":bool,"bbox":[x,y,w,h],
                 "has_hands":bool,"hand_count":N,
                 "has_pose":bool,"fps":N}\n
  2. w*h raw bytes (grayscale luminance 0-255)

Camera capture: OpenCV VideoCapture (macOS, headless)
Detection:      MediaPipe face_detection + hands + pose
"""
import sys, os, json, socket, time, argparse, signal

import cv2
import mediapipe as mp

# ── args ──────────────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser()
parser.add_argument("--sock",   default=os.environ.get("MONSTER_CAM_SOCK",   "/tmp/face_monster_cam.sock"))
parser.add_argument("--device", default=int(os.environ.get("MONSTER_CAM_DEVICE", "0")), type=int)
parser.add_argument("--width",  default=int(os.environ.get("MONSTER_CAM_W",  "80")),    type=int)
parser.add_argument("--height", default=int(os.environ.get("MONSTER_CAM_H",  "45")),    type=int)
parser.add_argument("--fps",    default=int(os.environ.get("MONSTER_CAM_FPS", "10")),   type=int)
args = parser.parse_args()

W, H = args.width, args.height

def log(msg):
    sys.stderr.write(f"[monster-cam-py] {msg}\n")
    sys.stderr.flush()

# ── MediaPipe detectors ────────────────────────────────────────────────────────
log("Initialising MediaPipe...")
face_det  = mp.solutions.face_detection.FaceDetection(
    model_selection=0, min_detection_confidence=0.5)
hands_det = mp.solutions.hands.Hands(
    static_image_mode=False, max_num_hands=2,
    min_detection_confidence=0.3, min_tracking_confidence=0.3)
pose_det  = mp.solutions.pose.Pose(
    static_image_mode=False,
    min_detection_confidence=0.5, min_tracking_confidence=0.5)
log("MediaPipe ready")

# ── Camera ─────────────────────────────────────────────────────────────────────
cap = cv2.VideoCapture(args.device)
if not cap.isOpened():
    log(f"Cannot open camera device {args.device}")
    sys.exit(1)
cap.set(cv2.CAP_PROP_FRAME_WIDTH,  320)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 240)
cap.set(cv2.CAP_PROP_FPS, args.fps)
log(f"Camera {args.device} open")

# ── Unix socket server ─────────────────────────────────────────────────────────
if os.path.exists(args.sock):
    os.unlink(args.sock)

srv = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
srv.bind(args.sock)
srv.listen(4)
srv.setblocking(False)
clients: list = []
log(f"Socket ready: {args.sock}")

def cleanup(*_):
    log("Shutting down")
    cap.release()
    srv.close()
    try: os.unlink(args.sock)
    except: pass
    sys.exit(0)

signal.signal(signal.SIGINT,  cleanup)
signal.signal(signal.SIGTERM, cleanup)

# ── Main loop ──────────────────────────────────────────────────────────────────
fps_count = 0
fps_val   = 0
fps_ts    = time.time()

while True:
    # Accept new clients (non-blocking)
    try:
        conn, _ = srv.accept()
        conn.setblocking(False)
        clients.append(conn)
        log("client connected")
    except BlockingIOError:
        pass

    ok, frame_bgr = cap.read()
    if not ok:
        time.sleep(0.05)
        continue

    fps_count += 1
    now = time.time()
    if now - fps_ts >= 1.0:
        fps_val   = fps_count
        fps_count = 0
        fps_ts    = now

    frame_bgr = cv2.resize(frame_bgr, (W, H))
    frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)

    has_face   = False
    bbox       = [0, 0, 0, 0]
    has_hands  = False
    hand_count = 0
    has_pose   = False

    if clients:
        face_res = face_det.process(frame_rgb)
        if face_res.detections:
            has_face = True
            d  = face_res.detections[0].location_data.relative_bounding_box
            bbox = [int(d.xmin * W), int(d.ymin * H),
                    int(d.width * W), int(d.height * H)]

        hands_res = hands_det.process(frame_rgb)
        hand_boxes  = []
        hand_labels = []
        if hands_res.multi_hand_landmarks:
            has_hands  = True
            hand_count = len(hands_res.multi_hand_landmarks)
            handedness = hands_res.multi_handedness or []
            for i, lm in enumerate(hands_res.multi_hand_landmarks):
                # macOS webcam is mirrored — flip L/R to match what user sees
                raw = handedness[i].classification[0].label[0] if i < len(handedness) else "?"
                label = "R" if raw == "L" else ("L" if raw == "R" else raw)
                xs = [p.x for p in lm.landmark]
                ys = [p.y for p in lm.landmark]
                pad_x, pad_y = (max(xs)-min(xs)) * 0.2, (max(ys)-min(ys)) * 0.2
                x0 = max(0, int((min(xs) - pad_x) * W))
                y0 = max(0, int((min(ys) - pad_y) * H))
                x1 = min(W, int((max(xs) + pad_x) * W))
                y1 = min(H, int((max(ys) + pad_y) * H))
                hand_boxes.append([x0, y0, x1 - x0, y1 - y0])
                hand_labels.append(label)

        pose_res = pose_det.process(frame_rgb)
        if pose_res.pose_landmarks:
            has_pose = True

    gray    = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
    header  = json.dumps({
        "w": W, "h": H, "ts": int(now * 1000),
        "has_face": has_face, "bbox": bbox,
        "has_hands": has_hands, "hand_count": hand_count,
        "hand_boxes": hand_boxes, "hand_labels": hand_labels,
        "has_pose": has_pose, "fps": fps_val
    }) + "\n"
    payload = header.encode() + bytes(gray)

    dead = []
    for c in clients:
        try:
            c.sendall(payload)
        except Exception:
            dead.append(c)
    for c in dead:
        clients.remove(c)
        log("client disconnected")
