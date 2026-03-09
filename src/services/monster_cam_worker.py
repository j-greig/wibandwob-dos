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

USE_SOLUTIONS = hasattr(mp, "solutions") and hasattr(mp.solutions, "face_detection")

if USE_SOLUTIONS:
    log("Using mp.solutions API")
    face_det  = mp.solutions.face_detection.FaceDetection(
        model_selection=0, min_detection_confidence=0.5)
    hands_det = mp.solutions.hands.Hands(
        static_image_mode=False, max_num_hands=2,
        min_detection_confidence=0.3, min_tracking_confidence=0.3)
    pose_det  = mp.solutions.pose.Pose(
        static_image_mode=False,
        min_detection_confidence=0.5, min_tracking_confidence=0.5)
    face_lm_det = None
else:
    log("Using mp.tasks API (mp.solutions not available)")
    from mediapipe.tasks import python as mp_tasks
    from mediapipe.tasks.python import vision as mp_vision

    # Face detection
    _face_opts = mp_vision.FaceDetectorOptions(
        base_options=mp_tasks.BaseOptions(
            model_asset_path=os.path.join(os.path.dirname(__file__), "..", "..", "assets", "mediapipe", "face_detector.tflite")
        ),
        min_detection_confidence=0.5,
        running_mode=mp_vision.RunningMode.IMAGE,
    )
    face_det = mp_vision.FaceDetector.create_from_options(_face_opts)

    # Hands — mp.tasks needs a hand_landmarker.task model
    _hand_model = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "mediapipe", "hand_landmarker.task")
    if os.path.exists(_hand_model):
        _hand_opts = mp_vision.HandLandmarkerOptions(
            base_options=mp_tasks.BaseOptions(model_asset_path=_hand_model),
            num_hands=2,
            min_hand_detection_confidence=0.3,
            min_tracking_confidence=0.3,
            running_mode=mp_vision.RunningMode.IMAGE,
        )
        hands_det = mp_vision.HandLandmarker.create_from_options(_hand_opts)
    else:
        log(f"Hand model not found at {_hand_model} — hand detection disabled")
        hands_det = None

    # Pose — mp.tasks needs a pose_landmarker.task model
    _pose_model = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "mediapipe", "pose_landmarker.task")
    if os.path.exists(_pose_model):
        _pose_opts = mp_vision.PoseLandmarkerOptions(
            base_options=mp_tasks.BaseOptions(model_asset_path=_pose_model),
            min_pose_detection_confidence=0.5,
            min_tracking_confidence=0.5,
            running_mode=mp_vision.RunningMode.IMAGE,
        )
        pose_det = mp_vision.PoseLandmarker.create_from_options(_pose_opts)
    else:
        log(f"Pose model not found at {_pose_model} — pose detection disabled")
        pose_det = None

    # Face landmarker (for emotion from 478 landmarks)
    _face_lm_model = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "mediapipe", "face_landmarker.task")
    if os.path.exists(_face_lm_model):
        _face_lm_opts = mp_vision.FaceLandmarkerOptions(
            base_options=mp_tasks.BaseOptions(model_asset_path=_face_lm_model),
            num_faces=1,
            min_face_detection_confidence=0.5,
            min_tracking_confidence=0.5,
            running_mode=mp_vision.RunningMode.IMAGE,
            output_face_blendshapes=True,
        )
        face_lm_det = mp_vision.FaceLandmarker.create_from_options(_face_lm_opts)
        log("Face landmarker ready (emotion detection enabled)")
    else:
        face_lm_det = None
        log(f"Face landmarker not found — emotion detection disabled")

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

def compute_emotion(blendshapes) -> str:
    """Map MediaPipe face blendshapes to a single emotion word."""
    if not blendshapes or not blendshapes[0]:
        return "neutral"

    bs = {s.category_name: s.score for s in blendshapes[0]}

    smile     = max(bs.get("mouthSmileLeft", 0), bs.get("mouthSmileRight", 0))
    frown     = max(bs.get("mouthFrownLeft", 0), bs.get("mouthFrownRight", 0))
    surprised = bs.get("jawOpen", 0)
    brow_up   = max(bs.get("browInnerUp", 0), bs.get("browOuterUpLeft", 0), bs.get("browOuterUpRight", 0))
    brow_down = max(bs.get("browDownLeft", 0), bs.get("browDownRight", 0))
    eye_wide  = max(bs.get("eyeWideLeft", 0), bs.get("eyeWideRight", 0))

    if surprised > 0.5 and (brow_up > 0.3 or eye_wide > 0.3):
        return "surprised"
    if smile > 0.5:
        return "happy"
    if frown > 0.4 and brow_down > 0.3:
        return "angry"
    if frown > 0.4:
        return "sad"
    if brow_down > 0.4:
        return "focused"
    if eye_wide > 0.4:
        return "surprised"
    return "neutral"

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
    face_keypoints = []
    has_hands  = False
    hand_count = 0
    hand_boxes  = []
    hand_labels = []
    has_pose   = False
    emotion    = "neutral"
    pose_landmarks = []

    if clients:
        hand_boxes  = []
        hand_labels = []

        if USE_SOLUTIONS:
            face_res = face_det.process(frame_rgb)
            if face_res.detections:
                has_face = True
                d  = face_res.detections[0].location_data.relative_bounding_box
                bbox = [int(d.xmin * W), int(d.ymin * H),
                        int(d.width * W), int(d.height * H)]
                kp_list = face_res.detections[0].location_data.relative_keypoints
                for kp in kp_list:
                    face_keypoints.append([round(kp.x * W), round(kp.y * H)])

            hands_res = hands_det.process(frame_rgb)
            if hands_res.multi_hand_landmarks:
                has_hands  = True
                hand_count = len(hands_res.multi_hand_landmarks)
                handedness = hands_res.multi_handedness or []
                for i, lm in enumerate(hands_res.multi_hand_landmarks):
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
                for lm in pose_res.pose_landmarks.landmark:
                    pose_landmarks.append([round(lm.x * W), round(lm.y * H)])

        else:
            # mp.tasks API
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)

            face_res = face_det.detect(mp_image)
            if face_res.detections:
                has_face = True
                bb = face_res.detections[0].bounding_box
                bbox = [int(bb.origin_x / frame_rgb.shape[1] * W),
                        int(bb.origin_y / frame_rgb.shape[0] * H),
                        int(bb.width / frame_rgb.shape[1] * W),
                        int(bb.height / frame_rgb.shape[0] * H)]

            if hands_det is not None:
                hands_res = hands_det.detect(mp_image)
                if hands_res.hand_landmarks:
                    has_hands  = True
                    hand_count = len(hands_res.hand_landmarks)
                    handedness_list = hands_res.handedness or []
                    for i, lm_list in enumerate(hands_res.hand_landmarks):
                        raw = handedness_list[i][0].category_name[0] if i < len(handedness_list) and handedness_list[i] else "?"
                        label = "R" if raw == "L" else ("L" if raw == "R" else raw)
                        xs = [p.x for p in lm_list]
                        ys = [p.y for p in lm_list]
                        pad_x, pad_y = (max(xs)-min(xs)) * 0.2, (max(ys)-min(ys)) * 0.2
                        x0 = max(0, int((min(xs) - pad_x) * W))
                        y0 = max(0, int((min(ys) - pad_y) * H))
                        x1 = min(W, int((max(xs) + pad_x) * W))
                        y1 = min(H, int((max(ys) + pad_y) * H))
                        hand_boxes.append([x0, y0, x1 - x0, y1 - y0])
                        hand_labels.append(label)

            if pose_det is not None:
                pose_res = pose_det.detect(mp_image)
                if pose_res.pose_landmarks:
                    has_pose = True
                    for lm_list in pose_res.pose_landmarks:
                        for lm in lm_list:
                            pose_landmarks.append([round(lm.x * W), round(lm.y * H)])
                        break

            if face_lm_det is not None and has_face:
                try:
                    lm_res = face_lm_det.detect(mp_image)
                    if lm_res.face_blendshapes:
                        emotion = compute_emotion(lm_res.face_blendshapes)
                except Exception as e:
                    log(f"emotion detect error: {e}")

    gray    = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
    header  = json.dumps({
        "w": W, "h": H, "ts": int(now * 1000),
        "has_face": has_face, "bbox": bbox, "face_keypoints": face_keypoints,
        "has_hands": has_hands, "hand_count": hand_count,
        "hand_boxes": hand_boxes, "hand_labels": hand_labels,
        "has_pose": has_pose, "pose_landmarks": pose_landmarks, "emotion": emotion, "fps": fps_val
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
