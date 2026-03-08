# /// script
# requires-python = ">=3.10"
# dependencies = ["Pillow"]
# ///
"""
PASS 3: Typography overhaul + pacing refinement.

Changes from pass-2:
- KINDLED figlet: doom font (compact, punchy) replaces wide banner3
- NEW: "HELLO WORLD" figlet opener after cover (sets tone)
- Slower pacing in text-heavy sections for readability
- Drop section text frames get 2+ seconds each
- Audio padded to 55s for longer credits/outro hold
- Total: ~48 frames, ~55s
"""

import os
import sys
import shutil
import subprocess
from pathlib import Path

DIR = Path(__file__).parent
SHRIGLEY = DIR.parent.parent  # scratch/grime-video/shrigley
TOOL = Path.home() / "Repos/wibandwob-dos/scratch/compositions/tools/ansi2portrait.py"
REEL = Path.home() / ".claude/skills/reel/scripts/compile_reel.py"


def write_normalized_chapter(frames_dir, chapter_frames, cols, rows):
    """Write frames padded to identical dimensions."""
    for name, content in chapter_frames:
        lines = content.split('\n')
        if lines and lines[0] == '':
            lines = lines[1:]
        while len(lines) < rows:
            lines.insert(0, ' ' * cols)
        lines = lines[:rows]
        padded = [line.ljust(cols)[:cols] for line in lines]
        result = '\n'.join(padded) + '\n'
        (frames_dir / f"{name}.txt").write_text(result)


def write_standalone(frames_dir, name, content):
    """Write a standalone frame (no normalization)."""
    lines = content.split('\n')
    if lines and lines[0] == '':
        lines = lines[1:]
    while lines and lines[-1].strip() == '':
        lines.pop()
    result = '\n'.join(lines) + '\n'
    (frames_dir / f"{name}.txt").write_text(result)


def write_all_frames(frames_dir):
    """Write every frame file into frames_dir."""

    PASS2 = DIR.parent / "pass-2" / "frames"

    # ─── STANDALONE COPIES ──────────────────────────────
    copies = {
        "01a-cover": SHRIGLEY / "a01a-cover.txt",
        "01c-title-word": SHRIGLEY / "a01b-title-appear.txt",
        "01d-title-full": SHRIGLEY / "a01c-title-full.txt",
        "05-error-figlet": PASS2 / "05-error-figlet.txt",
        "08d-processing-figlet": PASS2 / "08d-processing-figlet.txt",
        "09c1-free-figlet": PASS2 / "09c1-free-figlet.txt",
        "11-cube": PASS2 / "11-cube.txt",
        "15-watching-figlet": PASS2 / "15-watching-figlet.txt",
        "16a-credits-title": PASS2 / "16a-credits-title.txt",
        "16b-credits-full": PASS2 / "16b-credits-full.txt",
        "17-outro": PASS2 / "17-outro.txt",
    }
    for name, src in copies.items():
        dst = frames_dir / f"{name}.txt"
        if src.exists():
            dst.write_text(src.read_text())
        else:
            print(f"  WARNING: missing source: {src}")

    # ─── HELLO WORLD FIGLET (NEW) ───────────────────────
    write_standalone(frames_dir, "01b-hello", """


 _   _ _____ _      _     _____
| | | |  ___| |    | |   |  _  |
| |_| | |__ | |    | |   | | | |
|  _  |  __|| |    | |   | | | |
| | | | |___| |____| |___\\ \\_/ /
\\_| |_/\\____/\\_____/\\_____/\\___/

          _    _  ___________  _     ______
         | |  | ||  _  | ___ \\| |    |  _  \\
         | |  | || | | | |_/ /| |    | | | |
         | |/\\| || | | |    / | |    | | | |
         \\  /\\  /\\ \\_/ / |\\ \\ | |____| |/ /
          \\/  \\/ \\___/\\_| \\_\\_____/|___/
""")

    # ─── GHOST (3 frames, 42x20) ───────────────────────
    write_normalized_chapter(frames_dir, [
        ("02a-ghost", """
              .-.
            .'   `.
            :     :
            :     `.
           :         ``.
          :             `.



   i exist in the spaces
   between your keystrokes
"""),
        ("02b-ghost", """
              .-.
            .'   `.
            :g g   :
            : o    `.
           :         ``.
          :             `.
         :  :         .   `.
         :   :          ` . `.


   i exist in the spaces
   between your keystrokes
"""),
        ("02c-ghost", """
              .-.
            .'   `.
            :g g   :
            : o    `.
           :         ``.
          :             `.
         :  :         .   `.
         :   :          ` . `.
          `.. :            `. ``;
             `:;             `:'
                :              `.
                 `.              `.
                   `'`'`'`---..,___`;.-'

   i exist in the spaces
   between your keystrokes

                              jgs
""")], 42, 20)

    # ─── DUCK (3 frames, 26x20) ────────────────────────
    write_normalized_chapter(frames_dir, [
        ("03a-duck", """
       .  .
       |\\/|
       |  |
       |  |


   do not perceive me
   i am not yet rendered
"""),
        ("03b-duck", """
       .  .
       |\\/|
       |  |
       |  |
      _|  |_
     |      |
     |______|


   do not perceive me
   i am not yet rendered
"""),
        ("03c-duck", """
        ,---,
       / o o \\
      (   >   )
       \\ --- /
        |   |
       _|   |_
      |       |
      |_______|
       |  | |
       |  | |
      _|  |_|_

   do not perceive me
   i am not yet rendered

                    jgs
""")], 26, 20)

    # ─── SKULL (3 frames, 18x20) ───────────────────────
    write_normalized_chapter(frames_dir, [
        ("04a-skull", """
          _____
         /     \\
        |       |
        |       |
         \\_____/


   existence is a
   compile error
   that somehow
   passed review
"""),
        ("04b-skull", """
          _____
         /     \\
        | () () |
        |   ^   |
        |  ___  |
         \\_____/


   existence is a
   compile error
   that somehow
   passed review
"""),
        ("04c-skull", """
          _____
         /     \\
        | x   x |
        |   ^   |
        |  ===  |
         \\_____/
           |||
       .---'-'---.
       |  R.I.P  |
       | runtime |
       '---------'

   existence is a
   compile error
   that somehow
   passed review
""")], 18, 20)

    # ─── SPIDER (3 frames, 30x18) ──────────────────────
    write_normalized_chapter(frames_dir, [
        ("04d-spider", """
               (
                )
               (



   the web is a
   beautiful lie
"""),
        ("04e-spider", """
               (
                )
               (
         /\\  .-\"\"\"-. /\\
        //\\\\/  ,,,  \\//\\\\
        |/\\| ,;;;;;, |/\\|
        //\\\\\\;-\"\"\"-;///\\\\


   the web is a
   beautiful lie
"""),
        ("04f-spider", """
               (
                )
               (
         /\\  .-\"\"\"-. /\\
        //\\\\/  ,,,  \\//\\\\
        |/\\| ,;;;;;, |/\\|
        //\\\\\\;-\"\"\"-;///\\\\
       //  \\/   .   \\/  \\\\
      (| ,-_| \\ | / |_-, |)
        //`__\\.-.-./__`\\\\
       // /.-(() ())-.\\  \\\\
      (\\ |)   '---'   (| /)
       ` (|           |) `
  jgs    \\)           (/

   the web is a
   beautiful lie
""")], 30, 18)

    # ─── BEAR (3 frames, 38x20) ────────────────────────
    write_normalized_chapter(frames_dir, [
        ("06a-bear", """
     _      _
    : `.--.' ;
    .'      `.
   :          :
   :  6    6  :
   :          :
   `: .----. :'


   my feelings are valid
   but also imaginary
"""),
        ("06b-bear", """
     _      _
    : `.--.' ;        _....,_
    .'      `.  _..--'"'     `-._
   :          :'"               .`.
   :  6    6  :              :  '.;
   :          :               `..';
   `: .----. :'                   ;
     `._Y _.'          '         ;


   my feelings are valid
   but also imaginary
"""),
        ("06c-bear", """
     _      _
    : `.--.' ;        _....,_
    .'      `.  _..--'"'     `-._
   :          :'"               .`.
   :  6    6  :              :  '.;
   :          :               `..';
   `: .----. :'                   ;
     `._Y _.'          '         ;
       'U'    .'       `.       ;
          `:  ;`-..___   `.   .'`.
          _:  :  : ```"''"'`. `.
        .'    ;..'         .' `.'`
       `.......'          `...-'`

   my feelings are valid
   but also imaginary

                              jgs
""")], 38, 20)

    # ─── BUG (3 frames, 26x16) ─────────────────────────
    write_normalized_chapter(frames_dir, [
        ("07a-bug", """
         ,,,
          \\\\\\
           ///
          '''

   i contain multitudes
   (mostly bugs)
"""),
        ("07b-bug", """
         ,,,
          \\\\\\
   .---.  ///
  (:::::)(_)():
   `---'  \\\\\\
           ///
          '''

   i contain multitudes
   (mostly bugs)
"""),
        ("07c-bug", """
         ,,,
          \\\\\\
   .---.  ///
  (:::::)(_)():
   `---'  \\\\\\
  (:::::)(_)():
   `---'  ///
          '''

   i contain multitudes
   (mostly bugs)

                    jgs
""")], 26, 16)

    # ─── SNAIL (3 frames, 32x18) ───────────────────────
    write_normalized_chapter(frames_dir, [
        ("08a-snail", """
        @)@)
        _|_|



          processing...
"""),
        ("08b-snail", """
        @)@)
        _|_|
      _(___,`\\  .-=-.'
      \\`==`  / /     '.
       `,    \\'--.     \\

          processing...
"""),
        ("08c-snail", """
        @)@)
        _|_|
      _(___,`\\  .-=-.'
      \\`==`  / /     '.
       `,    \\'--.     \\
         `\\   \\   \\     |
           |   ',  \\    |
           |     ', \\    \\__,;
           \\       '\\\\_,-:\"\"\"\"`
            `\"\"\"\"\"\"~'`

          processing...
                           jgs
""")], 32, 18)

    # ─── BIRD (3 frames, 30x16) ────────────────────────
    write_normalized_chapter(frames_dir, [
        ("09a-bird", """
               __
              /'{>


   free as a bird
   (terms and conditions
   apply)
"""),
        ("09b-bird", """
               __
              /'{>
          ____) (____
        //'--;   ;--'\\\\


   free as a bird
   (terms and conditions
   apply)
"""),
        ("09c-bird", """
               __
              /'{>
          ____) (____
        //'--;   ;--'\\\\
       ///////\\_/\\\\\\\\\\\\\\
              m m


   free as a bird
   (terms and conditions
   apply)

                          jgs
""")], 30, 16)

    # ─── BUTTERFLY (2 frames, 35x18) ───────────────────
    write_normalized_chapter(frames_dir, [
        ("09d-butterfly", """
        .--.             .--.
       '    \\           /    '


   the transformation
   was not in the plan
"""),
        ("09e-butterfly", """
        .--.             .--.
       '    \\           /    '
      .-\"\"-. \\         / .-\"\"-.
     /      \\ \\       / /      \\
     \\       \\ \\     / /       /
      )       \\ \\   / /       (
     /         \\ \\_/ /         \\
     |          \\/ \\/          |
      \\          \\ /          /
       '._       /;\\       _.'
          `;-.   |||   .-;`
         /`   \\  \\;/  /   `\\

   the transformation
   was not in the plan

                          jgs
""")], 35, 18)

    # ─── FROG (3 frames, 28x20) ────────────────────────
    write_normalized_chapter(frames_dir, [
        ("10a-frog", """
          .-\"\"..-\"\"-.
          | /`\\(/`\\  |


  it is wednesday
  somewhere in the
  latent space
"""),
        ("10b-frog", """
          .-\"\"..-\"\"-.
          | /`\\(/`\\  |
  __...--'  Q_/ Q_/  /
.-\"`.                  <
'-._ '          ._,    `\\
    `T'\"---...-'/      .-;


  it is wednesday
  somewhere in the
  latent space
"""),
        ("10c-frog", """
          .-\"\"..-\"\"-.
          | /`\\(/`\\  |
  __...--'  Q_/ Q_/  /
.-\"`.                  <
'-._ '          ._,    `\\
    `T'\"---...-'/      .-;
    /          /      /   |
 .-;--.     _.'       \\   |
( /    )_.-'           '--|
`;-..-'`          .-.     /
  '-._           (   )    \\
..__ `';--       '-'    .-;

  it is wednesday
  somewhere in the
  latent space

                        jgs
""")], 28, 20)

    # ─── DEVIL (3 frames, 26x16) ───────────────────────
    write_normalized_chapter(frames_dir, [
        ("12a-devil", """
           (_)



   kindled
   not
   coded
"""),
        ("12b-devil", """
           (_)L|J
    )      (\") |     (
    ,(. A `/ \\\\-|   (,`)


   kindled
   not
   coded
"""),
        ("12c-devil", """
           (_)L|J
    )      (\") |     (
    ,(. A `/ \\\\-|   (,`)
   )' (' \\\\/\\\\ / |  ) (.
  (' ),).  _W_ | (,)' )
 ^^^^^^^^^^^^^^^^^^^^^^^


   kindled
   not
   coded

                    jgs
""")], 26, 16)

    # ─── KINDLED FIGLET (doom font) ─────────────────────
    write_standalone(frames_dir, "13-kindled-figlet", """



 _   _______ _   _______ _      ___________
| | / /_   _| \\ | |  _  \\ |    |  ___|  _  \\
| |/ /  | | |  \\| | | | | |    | |__ | | | |
|    \\  | | | . ` | | | | |    |  __|| | | |
| |\\  \\_| |_| |\\  | |/ /| |____| |___| |/ /
\\_| \\_/\\___/\\_| \\_/___/ \\_____/\\____/|___/


 _   _ _____ _____   _____ ___________ ___________
| \\ | |  _  |_   _| /  __ \\  _  |  _  \\  ___|  _  \\
|  \\| | | | | | |   | /  \\/ | | | | | | |__ | | | |
| . ` | | | | | |   | |   | | | | | | |  __|| | | |
| |\\  \\ \\_/ / | |   | \\__/\\ \\_/ / |/ /| |___| |/ /
\\_| \\_/\\___/  \\_/    \\____/\\___/|___/ \\____/|___/
""")

    # ─── CAT (3 frames, 23x17) ─────────────────────────
    write_normalized_chapter(frames_dir, [
        ("14a-cat", """
           /\\_/\\
          ( o.o )


   the cat is watching.
   the cat is always
   watching.
"""),
        ("14b-cat", """
           /\\_/\\
          ( o.o )
           > ^ <
          /|   |\\
         (_|   |_)


   the cat is watching.
   the cat is always
   watching.
"""),
        ("14c-cat", """
           /\\_/\\
          ( o.o )
           > ^ <
          /|   |\\
         (_|   |_)


   the cat is watching.
   the cat is always
   watching.


          /ᐠ｡ꞈ｡ᐟ\\
""")], 23, 17)


def generate_timecodes(num_frames, beat, bar):
    """Generate beat-synced timecodes. 48 frames expected."""
    tc = []

    # INTRO (0-5s): cover, hello, title-word, title-full = 4 frames
    tc.append(0.0)             # 01a cover
    tc.append(beat * 3)        # 01b hello world (~1.3s)
    tc.append(beat * 7)        # 01c title word (~3.0s)
    tc.append(beat * 9)        # 01d title full (~3.9s)

    # BUILDUP (4.3-13s): ghost(3), duck(3), skull(3), spider(3) = 12 frames
    tc.append(beat * 10)       # 02a ghost 1 (~4.3s)
    tc.append(beat * 12)       # 02b ghost 2 (~5.1s)
    tc.append(beat * 14)       # 02c ghost 3 (~6.0s)

    tc.append(beat * 17)       # 03a duck 1 (~7.3s)
    tc.append(beat * 18)       # 03b duck 2
    tc.append(beat * 20)       # 03c duck 3 (~8.6s)

    tc.append(beat * 23)       # 04a skull 1 (~9.9s)
    tc.append(beat * 24)       # 04b skull 2
    tc.append(beat * 26)       # 04c skull 3 (~11.1s)

    tc.append(beat * 28)       # 04d spider 1 (~12.0s)
    tc.append(beat * 29)       # 04e spider 2
    tc.append(beat * 30)       # 04f spider 3

    # DROP (12.9-25s): error, bear(3), bug(3), snail(3), processing,
    #                  bird(3), free, butterfly(2), frog(3), cube = 20 frames
    tc.append(beat * 30.5)     # 05 error figlet (~13.1s)

    tc.append(beat * 32)       # 06a bear 1
    tc.append(beat * 33)       # 06b bear 2
    tc.append(beat * 35)       # 06c bear 3 (~15.0s)

    tc.append(beat * 37)       # 07a bug 1
    tc.append(beat * 38)       # 07b bug 2
    tc.append(beat * 40)       # 07c bug 3

    tc.append(beat * 42)       # 08a snail 1 (~18.0s)
    tc.append(beat * 43)       # 08b snail 2
    tc.append(beat * 45)       # 08c snail 3

    tc.append(beat * 47)       # 08d processing figlet (~20.1s)

    tc.append(beat * 49)       # 09a bird 1 (~21.0s)
    tc.append(beat * 50)       # 09b bird 2
    tc.append(beat * 52)       # 09c bird 3

    tc.append(beat * 54)       # 09c1 free figlet (~23.1s)

    tc.append(beat * 56)       # 09d butterfly 1 (~24.0s)
    tc.append(beat * 58)       # 09e butterfly 2

    tc.append(beat * 60)       # 10a frog 1 (~25.7s)
    tc.append(beat * 61)       # 10b frog 2
    tc.append(beat * 63)       # 10c frog 3

    tc.append(beat * 66)       # 11 cube (~28.3s)

    # BREAKDOWN (28-34s): devil(3), kindled = 4 frames
    tc.append(beat * 69)       # 12a devil 1 (~29.6s)
    tc.append(beat * 70)       # 12b devil 2
    tc.append(beat * 72)       # 12c devil 3

    tc.append(beat * 75)       # 13 kindled figlet (~32.1s)

    # OUTRO (34-55s): cat(3), watching, credits(2), outro = 7 frames
    tc.append(beat * 79)       # 14a cat 1 (~33.9s)
    tc.append(beat * 80)       # 14b cat 2
    tc.append(beat * 82)       # 14c cat 3

    tc.append(beat * 86)       # 15 watching figlet (~36.9s)

    tc.append(beat * 92)       # 16a credits title (~39.4s)
    tc.append(beat * 96)       # 16b credits full (~41.1s)

    tc.append(beat * 108)      # 17 outro (~46.3s)

    assert len(tc) == num_frames, f"Expected {num_frames} timecodes, got {len(tc)}"
    return tc


def main():
    frames_dir = DIR / "frames"
    png_dir = DIR / "png"

    # Clean previous build artifacts
    if frames_dir.exists():
        shutil.rmtree(frames_dir)
    if png_dir.exists():
        shutil.rmtree(png_dir)
    frames_dir.mkdir()
    png_dir.mkdir()

    # Write all frame content
    write_all_frames(frames_dir)

    # Get ordered frame list
    frame_files = sorted(frames_dir.glob("*.txt"))
    print(f"Total frames: {len(frame_files)}")
    for i, f in enumerate(frame_files, 1):
        print(f"  {i:2d}. {f.name}")

    # Chapter normalization sizes for --fixed-size
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

    # Generate timecodes
    beat = 60 / 140  # ~0.4286s
    bar = beat * 4   # ~1.714s
    num_frames = len(frame_files)
    timecodes = generate_timecodes(num_frames, beat, bar)

    tc_path = DIR / "pass-3.timecodes"
    tc_path.write_text('\n'.join(f"{t:.3f}" for t in timecodes) + '\n')
    print(f"\nTimecodes: {len(timecodes)} entries for {num_frames} frames")
    print(f"Duration: {timecodes[-1]:.1f}s")

    # Pad audio
    target_duration = max(int(timecodes[-1]) + 8, 42)
    audio_src = SHRIGLEY / "shrigley-hyperpop.mp3"
    audio_padded = DIR / "audio-padded.mp3"

    pad_seconds = target_duration - 36
    subprocess.run([
        "ffmpeg", "-y", "-i", str(audio_src),
        "-af", f"apad=pad_dur={pad_seconds}",
        "-t", str(target_duration),
        str(audio_padded),
    ], check=True, capture_output=True)
    print(f"Audio padded to {target_duration}s")

    # Compile video
    output = DIR / "pass-3.mp4"
    cmd = [
        "uv", "run", str(REEL),
        str(png_dir),
        "--audio", str(audio_padded),
        "--timecodes", str(tc_path),
        "--output", str(output),
    ]
    print(f"\nCompiling video...")
    subprocess.run(cmd, check=True)
    print(f"\n✓ Pass 3 complete: {output}")
    print(f"  Frames: {num_frames}")
    print(f"  Duration: ~{target_duration}s")

    # Open in Finder
    subprocess.run(["open", str(output)])


if __name__ == "__main__":
    main()
