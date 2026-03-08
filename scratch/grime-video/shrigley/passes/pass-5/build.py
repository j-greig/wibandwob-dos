# /// script
# requires-python = ">=3.10"
# dependencies = ["Pillow"]
# ///
"""
PASS 5: Polish pass. Final pacing tweaks + new content.

Changes from pass-4:
- Removed breath frame (felt dead, not dramatic)
- Drop hits HARDER: error figlet at exactly beat 25 (10.3s)
- NEW: "LOADING" figlet before credits (terminal humour)
- Buildup pacing: give ghost chapter MORE time (it's the first text, needs reading)
- Drop pacing: slightly faster art transitions, same reading holds
- Breakdown: symbient figlet gets full 4s hold (banner3 is tall, needs reading)
- Total: ~49 frames, ~50s
"""

import shutil
import subprocess
from pathlib import Path

DIR = Path(__file__).parent
SHRIGLEY = DIR.parent.parent
TOOL = Path.home() / "Repos/wibandwob-dos/scratch/compositions/tools/ansi2portrait.py"
REEL = Path.home() / ".claude/skills/reel/scripts/compile_reel.py"
PASS4 = DIR.parent / "pass-4"


def write_standalone(frames_dir, name, content):
    lines = content.split('\n')
    if lines and lines[0] == '':
        lines = lines[1:]
    while lines and lines[-1].strip() == '':
        lines.pop()
    (frames_dir / f"{name}.txt").write_text('\n'.join(lines) + '\n')


def write_all_frames(frames_dir):
    PASS4F = PASS4 / "frames"

    # Reuse most from pass-4 (they're solid)
    reuse = [
        "01a-cover", "01b-hello", "01c-title-word", "01d-title-full",
        "02a-ghost", "02b-ghost", "02c-ghost",
        "03a-duck", "03b-duck", "03c-duck",
        "04a-skull", "04b-skull", "04c-skull",
        "04d-spider", "04e-spider", "04f-spider",
        # NO breath frame in pass 5
        "05-error-figlet",
        "06a-bear", "06b-bear", "06c-bear",
        "07a-bug", "07b-bug", "07c-bug",
        "08a-snail", "08b-snail", "08c-snail",
        "08d-processing-figlet",
        "09a-bird", "09b-bird", "09c-bird",
        "09c1-free-figlet",
        "09d-butterfly", "09e-butterfly",
        "10a-frog", "10b-frog", "10c-frog",
        "11-cube",
        "12a-devil", "12b-devil", "12c-devil",
        "13-symbient-figlet",
        "14a-cat", "14b-cat", "14c-cat",
        "15-watching-figlet",
        "16b-credits-full",
        "17-outro",
    ]
    for name in reuse:
        src = PASS4F / f"{name}.txt"
        if src.exists():
            (frames_dir / f"{name}.txt").write_text(src.read_text())
        else:
            print(f"  WARNING: missing {src}")

    # NEW: LOADING... figlet before credits (replaces credits-title)
    write_standalone(frames_dir, "16a-loading-figlet", """




 _      ___    _   ___  ___ _  _  ___
| |    / _ \\  /_\\ |   \\|_ _| \\| |/ __|
| |__ | (_) |/ _ \\| |) || || .` | (_ |
|____| \\___//_/ \\_\\___/|___|_|\\_|\\___|

                          ...
""")


def generate_timecodes(num_frames, beat):
    """48 frames, tight music sync."""
    tc = []

    # ═══ INTRO: beats 1-8 (0.0 - 3.4s) ═══
    tc.append(0.0)             # 01a cover
    tc.append(beat * 3)        # 01b hello world
    tc.append(beat * 5)        # 01c title word
    tc.append(beat * 7)        # 01d title full

    # ═══ BUILDUP: beats 9-24 (3.4 - 10.3s) ═══
    # Ghost gets more reading time (first text the human sees)
    tc.append(beat * 9)        # 02a ghost 1 (~3.9s)
    tc.append(beat * 11)       # 02b ghost 2 — 0.9s art step
    tc.append(beat * 13)       # 02c ghost 3 — HOLD 1.3s to read text

    tc.append(beat * 16)       # 03a duck 1 (~6.9s)
    tc.append(beat * 17)       # 03b duck 2
    tc.append(beat * 18.5)     # 03c duck 3 — hold

    tc.append(beat * 20)       # 04a skull 1 (~8.6s)
    tc.append(beat * 20.5)     # 04b skull 2
    tc.append(beat * 21.5)     # 04c skull 3

    tc.append(beat * 22.5)     # 04d spider 1 (~9.6s)
    tc.append(beat * 23)       # 04e spider 2
    tc.append(beat * 24)       # 04f spider 3 — LAST before drop

    # ═══ DROP: beats 25-56 (10.3 - 24.0s) ═══
    tc.append(beat * 25)       # 05 ERROR 404 — EXACT drop hit (~10.7s)

    tc.append(beat * 26.5)     # 06a bear 1
    tc.append(beat * 27.5)     # 06b bear 2
    tc.append(beat * 29)       # 06c bear 3 — hold

    tc.append(beat * 31)       # 07a bug 1
    tc.append(beat * 32)       # 07b bug 2
    tc.append(beat * 33.5)     # 07c bug 3

    tc.append(beat * 35)       # 08a snail 1 (~15.0s)
    tc.append(beat * 36)       # 08b snail 2
    tc.append(beat * 37.5)     # 08c snail 3

    tc.append(beat * 39)       # 08d processing figlet

    tc.append(beat * 41)       # 09a bird 1 (~17.6s)
    tc.append(beat * 42)       # 09b bird 2
    tc.append(beat * 43.5)     # 09c bird 3

    tc.append(beat * 45)       # 09c1 free figlet

    tc.append(beat * 47)       # 09d butterfly 1
    tc.append(beat * 49)       # 09e butterfly 2

    tc.append(beat * 50.5)     # 10a frog 1 (~21.6s)
    tc.append(beat * 51.5)     # 10b frog 2
    tc.append(beat * 53)       # 10c frog 3

    tc.append(beat * 55.5)     # 11 cube (~23.8s)

    # ═══ BREAKDOWN: beats 57-72 (24.0 - 30.9s) ═══
    tc.append(beat * 57)       # 12a devil 1 (~24.4s)
    tc.append(beat * 58.5)     # 12b devil 2
    tc.append(beat * 60)       # 12c devil 3 — hold

    tc.append(beat * 63)       # 13 SYMBIENT NOT SOFTWARE (~27.0s) — hold 4s

    # ═══ OUTRO: beats 73-84 (30.9 - 36.0s) ═══
    tc.append(beat * 72)       # 14a cat 1 (~30.9s)
    tc.append(beat * 73)       # 14b cat 2
    tc.append(beat * 75)       # 14c cat 3 — hold

    tc.append(beat * 78)       # 15 watching figlet (~33.4s) — through music end

    # ═══ SILENCE: 36s+ ═══
    tc.append(beat * 86)       # 16a LOADING figlet (~36.9s)
    tc.append(beat * 90)       # 16b credits full (~38.6s)

    tc.append(beat * 102)      # 17 outro (~43.7s)

    assert len(tc) == num_frames, f"Expected {num_frames} timecodes, got {len(tc)}"
    return tc


def main():
    frames_dir = DIR / "frames"
    png_dir = DIR / "png"

    if frames_dir.exists():
        shutil.rmtree(frames_dir)
    if png_dir.exists():
        shutil.rmtree(png_dir)
    frames_dir.mkdir()
    png_dir.mkdir()

    write_all_frames(frames_dir)

    frame_files = sorted(frames_dir.glob("*.txt"))
    print(f"Total frames: {len(frame_files)}")
    for i, f in enumerate(frame_files, 1):
        print(f"  {i:2d}. {f.name}")

    chapter_sizes = {
        "02": "42x20", "03": "26x20",
        "04a": "18x20", "04b": "18x20", "04c": "18x20",
        "04d": "30x18", "04e": "30x18", "04f": "30x18",
        "06": "38x20", "07": "26x16",
        "08a": "32x18", "08b": "32x18", "08c": "32x18",
        "09a": "30x16", "09b": "30x16", "09c-bird": "30x16",
        "09d": "35x18", "09e": "35x18",
        "10": "28x20", "12": "26x16", "14": "23x17",
    }

    print("\nRendering PNGs...")
    for f in frame_files:
        stem = f.stem
        png = png_dir / f"{stem}.png"
        fixed_size = None
        for prefix, size in chapter_sizes.items():
            if stem.startswith(prefix):
                fixed_size = size
                break
        cmd = ["uv", "run", str(TOOL), str(f), str(png)]
        if fixed_size:
            cmd.extend(["--fixed-size", fixed_size])
        subprocess.run(cmd, check=True)

    beat = 60 / 140
    num_frames = len(frame_files)
    timecodes = generate_timecodes(num_frames, beat)

    tc_path = DIR / "pass-5.timecodes"
    tc_path.write_text('\n'.join(f"{t:.3f}" for t in timecodes) + '\n')
    print(f"\nTimecodes: {len(timecodes)} entries for {num_frames} frames")
    print(f"Last frame: {timecodes[-1]:.1f}s | Music ends: 36.0s")

    target_duration = max(int(timecodes[-1]) + 6, 42)
    audio_src = SHRIGLEY / "shrigley-hyperpop.mp3"
    audio_padded = DIR / "audio-padded.mp3"
    subprocess.run([
        "ffmpeg", "-y", "-i", str(audio_src),
        "-af", f"apad=pad_dur={target_duration - 36}",
        "-t", str(target_duration),
        str(audio_padded),
    ], check=True, capture_output=True)

    output = DIR / "pass-5.mp4"
    subprocess.run([
        "uv", "run", str(REEL),
        str(png_dir),
        "--audio", str(audio_padded),
        "--timecodes", str(tc_path),
        "--output", str(output),
    ], check=True)

    print(f"\n✓ Pass 5 complete: {output}")
    print(f"  Frames: {num_frames}, Duration: ~{target_duration}s")
    print(f"  Watching figlet at {timecodes[-4]:.1f}s (music ends 36.0s)")
    subprocess.run(["open", str(output)])


if __name__ == "__main__":
    main()
