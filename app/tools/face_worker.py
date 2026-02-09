#!/usr/bin/env python3
"""
Minimal webcam → Unix socket streamer for Monster Cam (Emoji).

Protocol per frame:
 1) One ASCII JSON header line terminated by \n, e.g.:
    {"w":80,"h":45,"ts":1694450000,"has_face":true,"bbox":[x,y,w,h]}
 2) Followed by w*h raw bytes (grayscale luminance 0..255).

Server path: /tmp/face_monster_cam.sock

Dependencies: opencv-python (pip install -r tools/requirements.txt)
"""

import cv2
import os
import sys
import time
import json
import socket
import signal
import argparse

SOCK_PATH = "/tmp/face_monster_cam.sock"

def cleanup(*_):
    try:
        os.unlink(SOCK_PATH)
    except OSError:
        pass
    sys.exit(0)

def open_camera(dev_index=0, width=320, height=240, fps=12):
    cap = cv2.VideoCapture(dev_index)
    if not cap.isOpened():
        return None
    # Best-effort settings
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
    cap.set(cv2.CAP_PROP_FPS, fps)
    return cap

def detect_face(gray, cascade):
    try:
        faces = cascade.detectMultiScale(gray, 1.2, 3, minSize=(30, 30))
        if len(faces) > 0:
            # pick the largest
            x, y, w, h = max(faces, key=lambda r: r[2]*r[3])
            return True, (int(x), int(y), int(w), int(h))
    except Exception:
        pass
    return False, (0, 0, 0, 0)

def main():
    parser = argparse.ArgumentParser(description="Monster Cam face worker (webcam → Unix socket)")
    parser.add_argument("--sock", default=SOCK_PATH, help="Unix socket path")
    parser.add_argument("--device", type=int, default=int(os.environ.get("FM_DEVICE", "0")), help="Camera device index")
    parser.add_argument("--width", type=int, default=int(os.environ.get("FM_WIDTH", "80")), help="Output width (cols)")
    parser.add_argument("--height", type=int, default=int(os.environ.get("FM_HEIGHT", "45")), help="Output height (rows)")
    parser.add_argument("--fps", type=int, default=int(os.environ.get("FM_FPS", "12")), help="Output FPS")
    parser.add_argument("--no-face", action="store_true", help="Disable face detection (speed)")
    parser.add_argument("-v", "--verbose", action="count", default=0, help="Increase logging verbosity")
    parser.add_argument("--log-interval", type=float, default=10.0, help="Seconds between status logs")
    args = parser.parse_args()

    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)
    # Remove stale socket
    try:
        os.unlink(args.sock)
    except FileNotFoundError:
        pass

    srv = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    srv.bind(args.sock)
    srv.listen(1)
    os.chmod(args.sock, 0o666)
    print(f"[face_worker] listening at {args.sock}")

    # Load face + eye cascades (best effort)
    face_cascade = None
    eye_cascade = None
    if not args.no_face:
        try:
            cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
            face_cascade = cv2.CascadeClassifier(cascade_path)
            print(f"[face_worker] face cascade loaded: {cascade_path}")
        except Exception as e:
            print(f"[face_worker] WARN: could not load face cascade: {e}")
            face_cascade = None
        try:
            eye_path = cv2.data.haarcascades + 'haarcascade_eye_tree_eyeglasses.xml'
            eye_cascade = cv2.CascadeClassifier(eye_path)
            print(f"[face_worker] eye cascade loaded: {eye_path}")
        except Exception as e:
            print(f"[face_worker] WARN: could not load eye cascade: {e}")
            eye_cascade = None

    cap = open_camera(args.device, 320, 240, fps=max(1, args.fps))
    if cap is None:
        print("[face_worker] ERROR: cannot open webcam; using synthetic frames", file=sys.stderr)
    else:
        w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        bf = cap.get(cv2.CAP_PROP_BACKEND)
        print(f"[face_worker] webcam opened: dev={args.device} size={w}x{h} backend={bf}")

    target_w = int(args.width)
    target_h = int(args.height)
    frame_delay = max(1e-3, 1.0 / float(max(1, args.fps)))

    while True:
        conn, _ = srv.accept()
        conn.setsockopt(socket.SOL_SOCKET, socket.SO_SNDBUF, 1<<20)
        print("[face_worker] client connected")
        try:
            last = 0.0
            frames = 0
            face_hits = 0
            hud_last = time.time()
            prev_has_face = False
            blink = False
            noeye_frames = 0
            eye_frames = 0
            # Add smoothing for stable face coordinates
            smooth_cx, smooth_cy = -1, -1
            smooth_alpha = 0.3  # Higher = more responsive, lower = more stable
            blink_timeout_frames = 30  # Max frames to stay blinking (2.5s at 12fps)
            while True:
                now = time.time()
                if now - last < frame_delay:
                    time.sleep(0.005)
                    continue
                last = now

                if cap is None:
                    # Synthetic fallback: gradient + noise
                    t = now
                    import numpy as np
                    y = np.linspace(0, 1, target_h, dtype=np.float32)[:, None]
                    x = np.linspace(0, 1, target_w, dtype=np.float32)[None, :]
                    img = (127 + 127*(np.sin((x*10+t)*0.7) * np.cos((y*10-t)*0.6))).astype('uint8')
                    has_face = False
                    bbox = (0,0,0,0)
                else:
                    ok, frame = cap.read()
                    if not ok:
                        continue
                    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                    # Resize to target
                    gray = cv2.resize(gray, (target_w, target_h), interpolation=cv2.INTER_AREA)
                    has_face = False
                    bbox = (0,0,0,0)
                    if face_cascade is not None:
                        # Use a small version for speed
                        det = cv2.resize(gray, (160, 120), interpolation=cv2.INTER_AREA)
                        hf, bb = detect_face(det, face_cascade)
                        if hf:
                            # Map bbox back to target size
                            sx = target_w/160.0; sy = target_h/120.0
                            x,y,w,h = bb
                            # Raw coordinates
                            raw_cx = int(x*sx) + int(w*sx)//2  
                            raw_cy = int(y*sy) + int(h*sy)//2
                            
                            # Apply smoothing to reduce jitter
                            if smooth_cx < 0 or smooth_cy < 0:
                                # First detection - initialize
                                smooth_cx, smooth_cy = raw_cx, raw_cy
                            else:
                                # Smooth using EMA filter
                                smooth_cx = smooth_cx + smooth_alpha * (raw_cx - smooth_cx)
                                smooth_cy = smooth_cy + smooth_alpha * (raw_cy - smooth_cy)
                            
                            # Use smoothed center to rebuild bbox
                            smooth_w, smooth_h = int(w*sx), int(h*sy)
                            smooth_x = int(smooth_cx - smooth_w//2)
                            smooth_y = int(smooth_cy - smooth_h//2)
                            bbox = (smooth_x, smooth_y, smooth_w, smooth_h)
                            has_face = True
                            # Blink detection via eyes in face ROI
                            if eye_cascade is not None:
                                fx, fy, fw, fh = bbox
                                # Ensure bbox is within frame bounds
                                fx = max(0, min(fx, target_w-1))
                                fy = max(0, min(fy, target_h-1))
                                fw = max(1, min(fw, target_w - fx))
                                fh = max(1, min(fh, target_h - fy))
                                
                                # Upper half of face for eyes region
                                ey = fy
                                eh = max(1, min(int(fh * 0.6), target_h - ey))
                                
                                # Extract eye region safely
                                if ey + eh <= target_h and fx + fw <= target_w:
                                    eyroi = gray[ey:ey+eh, fx:fx+fw]
                                    if eyroi.size > 0:  # Check if ROI is valid
                                        eyes = eye_cascade.detectMultiScale(eyroi, 1.1, 3, minSize=(8, 6))
                                        if len(eyes) == 0:
                                            noeye_frames += 1
                                            eye_frames = 0
                                        else:
                                            eye_frames += 1
                                            noeye_frames = 0
                                    else:
                                        # Invalid ROI - assume eyes present to avoid stuck blink
                                        eye_frames += 1
                                        noeye_frames = 0
                                else:
                                    # Invalid bounds - assume eyes present
                                    eye_frames += 1
                                    noeye_frames = 0
                                    
                                # Hysteresis: need 2 consecutive frames no eyes to set blink,
                                # and 2 with eyes to clear it.
                                if noeye_frames >= 2:
                                    blink = True
                                elif eye_frames >= 2:
                                    blink = False
                                
                                # Blink timeout - force reset if blinking too long
                                if blink and noeye_frames > blink_timeout_frames:
                                    blink = False
                                    noeye_frames = 0
                                    eye_frames = 0
                # Reset blink state on face detection transitions  
                if has_face != prev_has_face:
                    # Face status changed - reset blink detection
                    blink = False
                    noeye_frames = 0
                    eye_frames = 0
                    # Reset smoothing when face detection lost/regained
                    if not has_face:
                        smooth_cx, smooth_cy = -1, -1
                        
                if has_face:
                    face_hits += 1
                img = gray

                hdr = {
                    "w": int(target_w),
                    "h": int(target_h),
                    "ts": int(now),
                    "has_face": bool(has_face),
                    "bbox": [int(b) for b in bbox],
                    "blink": bool(blink)
                }
                line = (json.dumps(hdr) + "\n").encode('ascii')
                conn.sendall(line)
                conn.sendall(img.tobytes() if hasattr(img, 'tobytes') else bytes(img))
                frames += 1
                # Edge transition logs
                if args.verbose:
                    if has_face and not prev_has_face:
                        cx = bbox[0] + bbox[2]//2; cy = bbox[1] + bbox[3]//2
                        print(f"[face_worker] face: appeared at (x={cx}, y={cy}) bbox={bbox}")
                    elif (not has_face) and prev_has_face:
                        print("[face_worker] face: lost")
                    prev_has_face = has_face

                if (now - hud_last) >= max(0.5, args.log_interval):
                    fps = frames / (now - hud_last)
                    if has_face:
                        cx = bbox[0] + bbox[2]//2; cy = bbox[1] + bbox[3]//2
                        ux = cx / float(target_w); uy = cy / float(target_h)
                        print(f"[face_worker] fps={fps:.1f} face=yes center=({cx},{cy}) norm=({ux:.2f},{uy:.2f}) bbox={bbox} blink={blink}")
                    else:
                        print(f"[face_worker] fps={fps:.1f} face=no")
                    frames = 0
                    face_hits = 0
                    hud_last = now
        except (BrokenPipeError, ConnectionResetError):
            print("[face_worker] client disconnected")
        except Exception as e:
            print(f"[face_worker] error: {e}", file=sys.stderr)
        finally:
            try:
                conn.close()
            except Exception:
                pass

if __name__ == "__main__":
    main()
