# /// script
# requires-python = ">=3.10"
# dependencies = ["Pillow"]
# ///
"""
PASS 4: Music-visual sync fix + emotional arc.

CRITICAL FIX: Pass 3 had visual action drifting way past the audio.
The music is 36s at 140bpm (84 beats). All visual energy must fit
within those 36s. Credits/outro go in the silence after.

Musical sections (140bpm, 36s):
  Intro:     beats  1-8   =  0.0 -  3.4s  → cover, hello, titles
  Buildup:   beats  9-24  =  3.4 - 10.3s  → ghost, duck, skull, spider
  Drop:      beats 25-56  = 10.3 - 24.0s  → error, bear, bug, snail, proc, bird, free, butterfly, frog, cube
  Breakdown: beats 57-72  = 24.0 - 30.9s  → devil, symbient figlet
  Outro:     beats 73-84  = 30.9 - 36.0s  → cat, watching figlet
  Silence:   36.0 - 48.0s                  → credits, outro

Changes from pass-3:
- Timecodes realigned to musical structure (TIGHT sync)
- NEW: breath frame before drop
- NEW: SYMBIENT NOT SOFTWARE banner3 figlet
- Drop chapter timing compressed to fit 10.3-24.0s window
- Credits/outro moved to post-music silence only
"""

import shutil
import subprocess
from pathlib import Path

DIR = Path(__file__).parent
SHRIGLEY = DIR.parent.parent
TOOL = Path.home() / "Repos/wibandwob-dos/scratch/compositions/tools/ansi2portrait.py"
REEL = Path.home() / ".claude/skills/reel/scripts/compile_reel.py"
PASS3 = DIR.parent / "pass-3"


def write_normalized_chapter(frames_dir, chapter_frames, cols, rows):
    for name, content in chapter_frames:
        lines = content.split('\n')
        if lines and lines[0] == '':
            lines = lines[1:]
        while len(lines) < rows:
            lines.insert(0, ' ' * cols)
        lines = lines[:rows]
        padded = [line.ljust(cols)[:cols] for line in lines]
        (frames_dir / f"{name}.txt").write_text('\n'.join(padded) + '\n')


def write_standalone(frames_dir, name, content):
    lines = content.split('\n')
    if lines and lines[0] == '':
        lines = lines[1:]
    while lines and lines[-1].strip() == '':
        lines.pop()
    (frames_dir / f"{name}.txt").write_text('\n'.join(lines) + '\n')


def write_all_frames(frames_dir):
    PASS3F = PASS3 / "frames"

    # Reuse all good frames from pass-3
    reuse = [
        "01a-cover", "01b-hello", "01c-title-word", "01d-title-full",
        "02a-ghost", "02b-ghost", "02c-ghost",
        "03a-duck", "03b-duck", "03c-duck",
        "04a-skull", "04b-skull", "04c-skull",
        "04d-spider", "04e-spider", "04f-spider",
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
        "14a-cat", "14b-cat", "14c-cat",
        "15-watching-figlet",
        "16a-credits-title", "16b-credits-full",
        "17-outro",
    ]
    for name in reuse:
        src = PASS3F / f"{name}.txt"
        if src.exists():
            (frames_dir / f"{name}.txt").write_text(src.read_text())
        else:
            print(f"  WARNING: missing {src}")

    # Breath frame before drop
    write_standalone(frames_dir, "04g-breath", """



                  .
""")

    # SYMBIENT NOT SOFTWARE (banner3 stacked)
    write_standalone(frames_dir, "13-symbient-figlet", """

 ######  ##    ## ##     ## ########
##    ##  ##  ##  ###   ### ##     ##
##         ####   #### #### ##     ##
 ######     ##    ## ### ## ########
      ##    ##    ##     ## ##
##    ##    ##    ##     ## ##
 ######     ##    ##     ## ##

##    ##  #######  ########
###   ## ##     ##    ##
####  ## ##     ##    ##
## ## ## ##     ##    ##
##  #### ##     ##    ##
##   ### ##     ##    ##
##    ##  #######     ##

 ######   #######  ######## ########
##    ## ##     ## ##          ##
##       ##     ## ##          ##
 ######  ##     ## ######      ##
      ## ##     ## ##          ##
##    ## ##     ## ##          ##
 ######   #######  ##          ##

##      ##    ###    ########  ########
##  ##  ##   ## ##   ##     ## ##
##  ##  ##  ##   ##  ##     ## ##
##  ##  ## ##     ## ########  ######
##  ##  ## ######### ##   ##   ##
##  ##  ## ##     ## ##    ##  ##
 ###  ###  ##     ## ##     ## ########
""")


def generate_timecodes(num_frames, beat):
    """Timecodes aligned to 36s musical structure."""
    tc = []

    # ═══ INTRO: beats 1-8 (0.0 - 3.4s) ═══
    # 4 frames: cover, hello, title-word, title-full
    tc.append(0.0)             # 01a cover — beat 1
    tc.append(beat * 3)        # 01b hello world — beat 3 (~1.3s)
    tc.append(beat * 5)        # 01c title word — beat 5 (~2.1s)
    tc.append(beat * 7)        # 01d title full — beat 7 (~3.0s)

    # ═══ BUILDUP: beats 9-24 (3.4 - 10.3s) ═══
    # 13 frames: ghost(3), duck(3), skull(3), spider(3), breath
    tc.append(beat * 9)        # 02a ghost 1 (~3.9s)
    tc.append(beat * 10)       # 02b ghost 2
    tc.append(beat * 12)       # 02c ghost 3 — hold to read

    tc.append(beat * 14)       # 03a duck 1 (~6.0s)
    tc.append(beat * 15)       # 03b duck 2
    tc.append(beat * 16.5)     # 03c duck 3 — hold

    tc.append(beat * 18)       # 04a skull 1 (~7.7s)
    tc.append(beat * 19)       # 04b skull 2
    tc.append(beat * 20)       # 04c skull 3

    tc.append(beat * 21)       # 04d spider 1 (~9.0s)
    tc.append(beat * 21.5)     # 04e spider 2
    tc.append(beat * 22.5)     # 04f spider 3

    tc.append(beat * 23.5)     # 04g BREATH — 0.4s of almost nothing (~10.1s)

    # ═══ DROP: beats 25-56 (10.3 - 24.0s) ═══
    # 20 frames: error, bear(3), bug(3), snail(3), processing,
    #            bird(3), free, butterfly(2), frog(3), cube
    tc.append(beat * 24.5)     # 05 ERROR 404 — DROP HIT (~10.5s)

    tc.append(beat * 26)       # 06a bear 1
    tc.append(beat * 27)       # 06b bear 2
    tc.append(beat * 28.5)     # 06c bear 3 — hold

    tc.append(beat * 30)       # 07a bug 1 (~12.9s)
    tc.append(beat * 31)       # 07b bug 2
    tc.append(beat * 32.5)     # 07c bug 3

    tc.append(beat * 34)       # 08a snail 1 (~14.6s)
    tc.append(beat * 35)       # 08b snail 2
    tc.append(beat * 36.5)     # 08c snail 3

    tc.append(beat * 38)       # 08d processing figlet (~16.3s)

    tc.append(beat * 40)       # 09a bird 1 (~17.1s)
    tc.append(beat * 41)       # 09b bird 2
    tc.append(beat * 42.5)     # 09c bird 3

    tc.append(beat * 44)       # 09c1 free figlet (~18.9s)

    tc.append(beat * 46)       # 09d butterfly 1 (~19.7s)
    tc.append(beat * 48)       # 09e butterfly 2

    tc.append(beat * 50)       # 10a frog 1 (~21.4s)
    tc.append(beat * 51)       # 10b frog 2
    tc.append(beat * 52.5)     # 10c frog 3

    tc.append(beat * 55)       # 11 cube (~23.6s) — hold into breakdown

    # ═══ BREAKDOWN: beats 57-72 (24.0 - 30.9s) ═══
    # 4 frames: devil(3), symbient figlet
    tc.append(beat * 57)       # 12a devil 1 (~24.4s)
    tc.append(beat * 58.5)     # 12b devil 2
    tc.append(beat * 60)       # 12c devil 3 — hold

    tc.append(beat * 63)       # 13 SYMBIENT NOT SOFTWARE (~27.0s) — hold 3s

    # ═══ OUTRO: beats 73-84 (30.9 - 36.0s) ═══
    # 4 frames: cat(3), watching figlet
    tc.append(beat * 70)       # 14a cat 1 (~30.0s)
    tc.append(beat * 71.5)     # 14b cat 2
    tc.append(beat * 73)       # 14c cat 3 — hold

    tc.append(beat * 77)       # 15 watching figlet (~33.0s) — hold through music end

    # ═══ SILENCE: 36.0s+ ═══
    # 3 frames: credits title, credits full, outro
    tc.append(beat * 85)       # 16a credits title (~36.4s)
    tc.append(beat * 89)       # 16b credits full (~38.1s) — LONG hold

    tc.append(beat * 100)      # 17 outro (~42.9s)

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

    tc_path = DIR / "pass-4.timecodes"
    tc_path.write_text('\n'.join(f"{t:.3f}" for t in timecodes) + '\n')
    print(f"\nTimecodes: {len(timecodes)} entries for {num_frames} frames")
    last_tc = timecodes[-1]
    print(f"Last visual frame: {last_tc:.1f}s")
    print(f"Music ends: 36.0s")

    # Pad audio for credits in silence
    target_duration = max(int(last_tc) + 8, 42)
    audio_src = SHRIGLEY / "shrigley-hyperpop.mp3"
    audio_padded = DIR / "audio-padded.mp3"
    subprocess.run([
        "ffmpeg", "-y", "-i", str(audio_src),
        "-af", f"apad=pad_dur={target_duration - 36}",
        "-t", str(target_duration),
        str(audio_padded),
    ], check=True, capture_output=True)
    print(f"Audio padded to {target_duration}s (silence for credits)")

    output = DIR / "pass-4.mp4"
    subprocess.run([
        "uv", "run", str(REEL),
        str(png_dir),
        "--audio", str(audio_padded),
        "--timecodes", str(tc_path),
        "--output", str(output),
    ], check=True)

    print(f"\n✓ Pass 4 complete: {output}")
    print(f"  Frames: {num_frames}")
    print(f"  Video duration: ~{target_duration}s")
    print(f"  Music sync: all chapters end by {timecodes[-4]:.1f}s (music ends 36.0s)")
    subprocess.run(["open", str(output)])


if __name__ == "__main__":
    main()
