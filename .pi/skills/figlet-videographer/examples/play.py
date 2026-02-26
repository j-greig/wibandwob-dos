#!/usr/bin/env python3
"""Play a figlet videographer timeline on a running WibWob-DOS instance.

Supports:
  - Figlet word placement with typewriter/cut transitions
  - Audio: backing track + stingers synced to frames
  - Primers: ASCII art windows placed alongside words
  - Speech: macOS `say` per-word with voice/rate control
  - Desktop state: colour/texture per meta

Usage:
  play.py <timeline.json> [--loop] [--mute] [--dry-run]
"""

import json
import os
import subprocess
import sys
import time
import urllib.request

API = os.environ.get("WIBWOB_API", "http://127.0.0.1:8089")

# Track child processes for cleanup
_children: list[subprocess.Popen] = []

# Layout constants
LEFT_MARGIN = 4
LINE_GAP = 1       # vertical gap between lines
WORD_GAP = 1       # horizontal gap between words on a line
PRIMER_COL = 130   # x position for sidebar primers


# ── API helpers ──────────────────────────────────────────

def post(cmd, args=None):
    body = {"command": cmd}
    if args:
        body["args"] = args
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        f"{API}/menu/command", data, {"Content-Type": "application/json"}
    )
    try:
        return json.loads(urllib.request.urlopen(req, timeout=5).read())
    except Exception as e:
        print(f"  ERR {cmd}: {e}")
        return {}


def get_state():
    return json.loads(
        urllib.request.urlopen(f"{API}/state", timeout=5).read()
    )


def position_window(wid, x, y, shadow=False):
    """Move a window and optionally disable its shadow."""
    post("move_window", {"id": wid, "x": str(x), "y": str(y)})
    if not shadow:
        post("window_shadow", {"id": wid, "on": "false"})


# ── Layout engine ────────────────────────────────────────

def measure_word(text, font):
    """Query the API for rendered size of a figlet word. Returns (w, h)."""
    resp = post("preview_figlet", {"text": text, "font": font, "width": "0", "info": "true"})
    result = resp.get("result", "")
    try:
        info = json.loads(result)
        return info["window_width"], info["window_height"]
    except (json.JSONDecodeError, KeyError):
        return 40, 10  # fallback


def auto_layout(timeline):
    """Compute x,y for all words across all frames using reading order.

    Layout rules (Swiss modernist):
      - Words flow left→right within each frame (one line per frame)
      - Lines stack top→bottom with LINE_GAP between them
      - Primers go in a right sidebar at PRIMER_COL
      - If a line would exceed canvas width, it wraps to next row
      - If total height exceeds canvas, gaps are compressed to fit

    Only fills in missing x,y — words with explicit positions are kept.
    Returns the timeline (mutated in place).
    """
    canvas_h = timeline.get("meta", {}).get("canvas", {}).get("height", 46)
    max_word_x = PRIMER_COL - 5  # leave room for primer sidebar

    # First pass: measure all lines to compute total height
    line_info = []  # (frame_idx, line_height, has_primer)
    for frame in timeline.get("frames", []):
        cursor_x = LEFT_MARGIN
        line_height = 0
        for word in frame.get("words", []):
            w, h = measure_word(word["text"], word.get("font", "standard"))
            if cursor_x + w > max_word_x and cursor_x > LEFT_MARGIN:
                # Would wrap — record this line, start new
                line_info.append((len(line_info), line_height, False))
                line_height = 0
                cursor_x = LEFT_MARGIN
            cursor_x += w + WORD_GAP
            line_height = max(line_height, h)
        line_info.append((len(line_info), line_height, frame.get("primer") is not None))

    total_h = sum(h for _, h, _ in line_info) + LINE_GAP * (len(line_info) - 1)
    # Compress gaps if we'd overflow canvas
    gap = LINE_GAP
    if total_h + 2 > canvas_h:  # +2 for top margin
        content_h = sum(h for _, h, _ in line_info)
        available_gap = canvas_h - 2 - content_h
        gap = max(0, available_gap // max(1, len(line_info) - 1))
        print(f"    (compressed gap: {LINE_GAP} → {gap}, fits {canvas_h} rows)")

    # Second pass: assign positions
    cursor_y = 1
    line_idx = 0

    for frame in timeline.get("frames", []):
        cursor_x = LEFT_MARGIN
        line_height = 0

        for word in frame.get("words", []):
            if "x" in word and "y" in word:
                w, h = measure_word(word["text"], word.get("font", "standard"))
                line_height = max(line_height, h)
                continue

            w, h = measure_word(word["text"], word.get("font", "standard"))

            # Wrap if we'd exceed the word area
            if cursor_x + w > max_word_x and cursor_x > LEFT_MARGIN:
                cursor_y += line_height + gap
                cursor_x = LEFT_MARGIN
                line_height = 0

            word["x"] = cursor_x
            word["y"] = cursor_y
            cursor_x += w + WORD_GAP
            line_height = max(line_height, h)

        # Place primer in sidebar at current line's y
        primer = frame.get("primer")
        if primer and "primer_pos" not in frame:
            frame["primer_pos"] = {"x": PRIMER_COL, "y": cursor_y}

        cursor_y += line_height + gap

    return timeline


# ── Audio ────────────────────────────────────────────────

def spawn(cmd):
    """Run a subprocess, track it for cleanup."""
    proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    _children.append(proc)
    return proc


def play_audio(path):
    """Play an mp3 via afplay (macOS). Non-blocking."""
    if not path or not os.path.exists(path):
        print(f"  WARN audio not found: {path}")
        return None
    return spawn(["afplay", path])


def say_word(text, voice="Wobble", rate=None):
    """Speak a word via macOS `say`. Non-blocking."""
    cmd = ["say", "-v", voice]
    if rate:
        cmd += ["-r", str(rate)]
    cmd.append(text)
    return spawn(cmd)


def stop_all_audio():
    """Kill only our child processes."""
    for proc in _children:
        try:
            proc.terminate()
        except OSError:
            pass
    _children.clear()


def wait_for_speech(timeout=5):
    """Wait for any running `say` processes to finish (up to timeout)."""
    deadline = time.time() + timeout
    for proc in list(_children):
        remaining = deadline - time.time()
        if remaining <= 0:
            break
        try:
            proc.wait(timeout=max(0.1, remaining))
        except subprocess.TimeoutExpired:
            pass


# ── Primers ──────────────────────────────────────────────

def _measure_primer(path):
    """Read a primer file and return (width, height) excluding comment lines."""
    # Resolve bare filenames via API to find the actual primer dir
    # Fallback: try common locations
    candidates = [path]
    if '/' not in path and '\\' not in path:
        for d in ["modules-private", "modules"]:
            if os.path.isdir(d):
                for sub in os.listdir(d):
                    candidate = os.path.join(d, sub, "primers", path)
                    if os.path.isfile(candidate):
                        candidates.insert(0, candidate)
                        break
    for full in candidates:
        try:
            max_w = 0
            lines = 0
            with open(full) as f:
                for line in f:
                    if line.startswith('#'):
                        continue
                    max_w = max(max_w, len(line.rstrip()))
                    lines += 1
            # Add window chrome: 2 for borders
            return max_w + 4, lines + 2
        except FileNotFoundError:
            continue
    return 40, 10  # fallback


def place_primer(path, x, y, known_ids):
    """Open a primer at exact position and size. Returns window ID or None.

    known_ids: set of frame_player IDs already placed — so we find the NEW one.
    """
    w, h = _measure_primer(path)
    post("open_primer", {
        "path": path,
        "x": str(x), "y": str(y),
        "w": str(w), "h": str(h),
    })
    time.sleep(0.3)
    state = get_state()
    for win in reversed(state.get("windows", [])):
        if win.get("type") == "frame_player" and win["id"] not in known_ids:
            wid = win["id"]
            print(f"    primer: {path} → {wid} at ({x},{y}) {w}x{h}")
            return wid
    # Fallback: open_primer may reuse the gallery window
    for win in reversed(state.get("windows", [])):
        if win.get("type") == "frame_player":
            wid = win["id"]
            print(f"    primer: {path} → {wid} at ({x},{y}) {w}x{h} (reused)")
            return wid
    print(f"  WARN: couldn't place primer {path}")
    return None


# ── Words ────────────────────────────────────────────────

def place_word(word, speech_cfg):
    """Open a figlet word at position. Optionally speak it."""
    args = {
        "text": word["text"],
        "font": word.get("font", "standard"),
    }
    # Spawn directly at position if given (no centre→move jump)
    if "x" in word and "y" in word:
        args["x"] = str(word["x"])
        args["y"] = str(word["y"])
        args["shadow"] = "false"
    post("open_figlet_text", args)
    time.sleep(0.15)

    # Speech
    say_cfg = word.get("say")
    if say_cfg and speech_cfg.get("enabled"):
        voice = say_cfg.get("voice", speech_cfg.get("default_voice", "Wobble"))
        rate = say_cfg.get("rate", speech_cfg.get("default_rate"))
        say_word(word["text"], voice=voice, rate=rate)


# ── Playback ─────────────────────────────────────────────

def setup_canvas(meta):
    """Clear desktop and set background from meta."""
    post("close_all")
    time.sleep(0.5)
    # Set background
    if meta.get("gallery_mode"):
        post("desktop_gallery", {"on": "true"})
    bg = meta.get("bg", {})
    if "fg" in bg or "bg" in bg:
        post("desktop_color", {"fg": str(bg.get("fg", 0)), "bg": str(bg.get("bg", 0))})
    if "texture" in bg:
        post("desktop_texture", {"char": bg["texture"]})
    # Force a clean redraw — close again in case gallery_mode opened something
    post("close_all")
    time.sleep(0.5)


def play_frame(frame, speech_cfg, mute, stingers, primer_ids):
    """Render a single frame: audio cue → primer → words."""
    # Audio cue
    cue = frame.get("audio_cue")
    if cue and cue in stingers and not mute:
        print(f"    ♫ stinger: {cue}")
        play_audio(stingers[cue])

    # Primers (placed before words, then raised to front after)
    frame_primer_wids = []

    # Single primer (legacy format)
    primer = frame.get("primer")
    if primer:
        pos = frame.get("primer_pos", {"x": 0, "y": 0})
        wid = place_primer(primer, pos["x"], pos["y"], primer_ids)
        if wid:
            primer_ids.add(wid)
            frame_primer_wids.append(wid)

    # Multiple primers (extended format)
    for p in frame.get("primers", []):
        wid = place_primer(p["path"], p["x"], p["y"], primer_ids)
        if wid:
            primer_ids.add(wid)
            frame_primer_wids.append(wid)

    # Words
    transition = frame.get("transition", "cut")
    delay = frame.get("typewriter_delay", 0.5) if transition == "typewriter" else 0.05
    for word in frame.get("words", []):
        voice = word.get("say", {}).get("voice", "")
        tag = f" 🗣 {voice}" if voice else ""
        print(f"    → {word['text']} ({word.get('font', 'standard')}){tag}")
        place_word(word, speech_cfg)
        time.sleep(delay)

    # Raise all primers above words so art is visible
    for wid in frame_primer_wids:
        post("raise_window", {"id": wid})


def play_timeline(timeline, mute=False, dry_run=False, loop=False, layout=False):
    if layout:
        print("  Auto-layout: computing positions...")
        auto_layout(timeline)
    meta = timeline.get("meta", {})
    frames = timeline.get("frames", [])
    audio_cfg = meta.get("audio", {})
    stingers = audio_cfg.get("stingers", {})
    speech_cfg = meta.get("speech", {}) if not mute else {}

    total_words = sum(len(f.get("words", [])) for f in frames)
    last_t = max((f.get("t", 0) for f in frames), default=0)
    print(f"Playing: {meta.get('title', 'untitled')}")
    print(f"  {len(frames)} frames, {total_words} words, {last_t:.0f}s timeline")
    if audio_cfg.get("backing"):
        print(f"  backing: {os.path.basename(audio_cfg['backing'])}")
    if stingers:
        print(f"  stingers: {list(stingers.keys())}")
    if speech_cfg.get("enabled"):
        print(f"  speech: {speech_cfg.get('default_voice', 'Wobble')}")
    if dry_run:
        print("  (dry run — no API calls)")
        return

    while True:
        setup_canvas(meta)
        primer_ids = set()  # track placed primer window IDs

        # Start backing track
        if audio_cfg.get("backing") and not mute:
            print("  ♫ backing track")
            play_audio(audio_cfg["backing"])

        t_start = time.time()

        for i, frame in enumerate(frames):
            # Wait until frame's scheduled time
            target = frame.get("t", 0)
            wait = target - (time.time() - t_start)
            if wait > 0:
                time.sleep(wait)

            n_words = len(frame.get("words", []))
            print(f"  Frame {i+1}/{len(frames)} t={target:.1f}s ({n_words} words)")
            play_frame(frame, speech_cfg, mute, stingers, primer_ids)

        # Let final speech finish before cleanup
        if speech_cfg.get("enabled"):
            wait_for_speech(timeout=4)

        # Hold until backing track would end (estimate: last_t + 10s buffer)
        elapsed = time.time() - t_start
        hold_until = last_t + 8
        if elapsed < hold_until:
            remaining = hold_until - elapsed
            print(f"  Holding {remaining:.0f}s...")
            time.sleep(remaining)

        if not loop:
            break
        print("  ♻ Looping...")
        stop_all_audio()

    print("Done")


def main():
    if len(sys.argv) < 2:
        print("Usage: play.py <timeline.json> [--loop] [--mute] [--dry-run]")
        sys.exit(1)

    with open(sys.argv[1]) as f:
        timeline = json.load(f)

    mute = "--mute" in sys.argv
    dry_run = "--dry-run" in sys.argv
    loop = "--loop" in sys.argv
    layout = "--auto-layout" in sys.argv

    try:
        play_timeline(timeline, mute=mute, dry_run=dry_run, loop=loop, layout=layout)
    except KeyboardInterrupt:
        print("\n  Interrupted")
    finally:
        stop_all_audio()


if __name__ == "__main__":
    main()
