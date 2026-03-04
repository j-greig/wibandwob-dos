# /// script
# requires-python = ">=3.10"
# dependencies = ["pillow"]
# ///
"""
VINYL COVERS v2 — Terminal-rendered, WibWob-DOS themed, square retina

Designers Republic × Swiss modernism × white label brutalism.
All monospace. Same font size throughout. Dense text blocks.
2048x2048 square. No vinyl illustration — just INFORMATION as design.
"""

import os, subprocess
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.expanduser("~/Repos/symbient-shared-skills/skills/chiptune-studio/references/examples")
RELEASE_DIR = os.path.expanduser("~/Repos/wibandwob-dos/scratch/compositions/releases")
os.makedirs(RELEASE_DIR, exist_ok=True)

W, H = 2048, 2048

THEMES = {
    "dark": {
        "bg": (0, 0, 0), "fg": (255, 255, 255), "accent": (0, 255, 255),
        "dim": (51, 51, 51), "border": (0, 255, 255), "highlight": (255, 255, 0),
        "error": (255, 0, 0), "fill": (66, 44, 118),
    },
    "phosphor": {
        "bg": (0, 0, 0), "fg": (255, 176, 0), "accent": (255, 215, 0),
        "dim": (100, 70, 0), "border": (255, 140, 0), "highlight": (255, 255, 100),
        "error": (255, 80, 0), "fill": (40, 25, 0),
    },
    "nord": {
        "bg": (46, 52, 64), "fg": (216, 222, 233), "accent": (136, 192, 208),
        "dim": (76, 86, 106), "border": (136, 192, 208), "highlight": (235, 203, 139),
        "error": (191, 97, 106), "fill": (59, 66, 82),
    },
    "pastel": {
        "bg": (30, 30, 46), "fg": (205, 214, 244), "accent": (203, 166, 247),
        "dim": (108, 112, 134), "border": (137, 180, 250), "highlight": (249, 226, 175),
        "error": (243, 139, 168), "fill": (49, 50, 68),
        "warning": (249, 226, 175),
    },
}

FONT_PATHS = ["/System/Library/Fonts/Menlo.ttc", "/System/Library/Fonts/Monaco.dfont", "/Library/Fonts/Courier New.ttf"]

def get_font(size=18):
    for p in FONT_PATHS:
        if os.path.exists(p):
            try: return ImageFont.truetype(p, size)
            except: continue
    return ImageFont.load_default()

FONT = get_font(18)
CHAR_W = 11
CHAR_H = 21

def char_pos(col, row): return (col * CHAR_W + 16, row * CHAR_H + 10)
def draw_str(draw, col, row, text, fg): draw.text(char_pos(col, row), text, font=FONT, fill=fg)
def draw_block(draw, col, row, w, h, color):
    x1, y1 = char_pos(col, row)
    x2, y2 = char_pos(col + w, row + h)
    draw.rectangle([x1, y1, x2, y2], fill=color)
def draw_hline(draw, col, row, length, fg): draw_str(draw, col, row, "─" * length, fg)

COLS = W // CHAR_W - 2  # usable columns ~184
ROWS = H // CHAR_H - 1  # usable rows ~97


def cover_techno():
    t = THEMES["dark"]
    img = Image.new("RGB", (W, H), t["bg"])
    draw = ImageDraw.Draw(img)

    # Top bar
    draw_block(draw, 0, 0, COLS + 2, 1, t["accent"])
    draw_str(draw, 1, 0, "WIB&WOB / CHIPTUNE-STUDIO", t["bg"])
    draw_str(draw, COLS - 22, 0, "BERLIN WAREHOUSE 001", t["bg"])

    draw_hline(draw, 0, 1, COLS, t["dim"])

    # Title — DR overprint
    for i in range(7):
        draw_str(draw, 2 + i * 2, 3 + i, "BERLIN WAREHOUSE TECHNO", t["accent"] if i == 6 else t["dim"])

    draw_hline(draw, 2, 12, 90, t["accent"])

    # Stats grid
    draw_str(draw, 2, 14, "BPM", t["dim"]); draw_str(draw, 12, 14, "130", t["fg"])
    draw_str(draw, 24, 14, "KEY", t["dim"]); draw_str(draw, 34, 14, "Eb MINOR", t["fg"])
    draw_str(draw, 52, 14, "DUR", t["dim"]); draw_str(draw, 62, 14, "120s", t["fg"])

    draw_hline(draw, 2, 15, 90, t["dim"])

    # Synth table
    draw_str(draw, 2, 17, "SYNTH", t["accent"]); draw_str(draw, 24, 17, "ROLE", t["accent"]); draw_str(draw, 48, 17, "CHARACTER", t["accent"])
    draw_hline(draw, 2, 18, 90, t["dim"])
    for i, (s, role, char) in enumerate([("TB-303","ACID BASS","RESONANT SQUELCH"),("JUNO-106","PAD + STAB","WARM CHORUS"),("TR-808","KICK/CLAP/HAT","ANALOG DRUM")]):
        draw_str(draw, 2, 19 + i, s, t["fg"]); draw_str(draw, 24, 19 + i, role, t["fg"]); draw_str(draw, 48, 19 + i, char, t["dim"])

    # Structure bar
    draw_hline(draw, 2, 24, 90, t["accent"])
    draw_str(draw, 2, 25, "STRUCTURE", t["accent"])
    col = 2
    for name, bars, color in [("INTRO",13,t["dim"]),("BUILD",17,t["fill"]),("BREAK",9,t["dim"]),("PEAK",22,t["accent"]),("OUT",4,t["dim"])]:
        w = bars * 2
        draw_block(draw, col, 27, w, 3, color)
        draw_str(draw, col + 1, 28, name, t["fg"])
        col += w + 1

    # Tracker — RIGHT SIDE, full height
    draw_str(draw, 96, 3, "PATTERN", t["accent"])
    draw_hline(draw, 96, 4, 85, t["dim"])
    tracker = [
        "  Kick   #...#...#...#...|#...#...#...#...|#...#...#...#...|#...#...#...#...",
        "  Clap   ....#.......#...|....#.......#...|....#.......#...|....#.......#...",
        "  Hat    -.-.-.-.-.-.-.--|-.-.-.-.-.-.-.--|-.-.-.-.-.-.-.--|-.-.-.-.-.-.-.--",
        "  Bass   #=====..#==..#=.|#=====..#==..#=.|#=====..#==..#=.|#=====..#==..#=.",
        "  Pad    ################|################|################|################",
        "  303    ..==..==.===.==.|..==..==.===.==.|..==..==.===.==.|..==..==.===.==.",
        "",
        "  Kick   #...#...#...#...|#...#...#..##...|#.#.#.#.#.#.#.#.|#...............",
        "  Clap   ....#.......#...|....#.......#...|#.#.#.#.#.#.#.#.|................",
        "  Hat    -.-.-.-.-.-.-.--|-.-.-.-.-.-.-.--|================|................",
        "  Bass   #=====..#==..#=.|#=====..#==..#=.|################|==..............",
        "  Pad    ################|################|################|====............",
        "  303    ..==..==.===.==.|==..==..==..==..|################|................",
    ]
    for i, line in enumerate(tracker):
        draw_str(draw, 96, 5 + i, line, t["dim"] if i < 6 else t["fg"])

    # FX strip — middle zone
    draw_hline(draw, 2, 34, COLS - 4, t["dim"])
    draw_str(draw, 2, 35, "FX CHAIN", t["accent"])
    draw_str(draw, 2, 37, "TB-303  acid_bass  ///  filter_sweep 200>5000Hz  ///  tape_saturate drive=2.0", t["fg"])
    draw_str(draw, 2, 38, "JUNO   warm_pad    ///  tremolo 0.2Hz  ///  lowpass 2000Hz", t["fg"])
    draw_str(draw, 2, 39, "TR-808 kick        ///  sidechain -10dB attack=5ms release=80ms", t["fg"])
    draw_str(draw, 2, 40, "MASTER             ///  dub_delay 300ms fb=0.4  ///  tape_saturate 1.3  ///  normalize", t["dim"])

    # Large typography zone — bottom half
    draw_hline(draw, 2, 44, COLS - 4, t["accent"])
    for i in range(12):
        draw_str(draw, 2 + i * 3, 46 + i, "130BPM Eb MINOR ACID WAREHOUSE KICK SNARE HAT SIDECHAIN", t["dim"] if i < 11 else t["accent"])

    # Bottom bars
    draw_hline(draw, 0, ROWS - 5, COLS, t["dim"])
    draw_str(draw, 2, ROWS - 4, "TB-303 / JUNO-106 / TR-808  ///  SIDECHAIN -10dB  ///  TAPE SATURATE  ///  DUB DELAY", t["dim"])
    draw_str(draw, 2, ROWS - 3, "WIB & WOB", t["fg"]); draw_str(draw, 20, ROWS - 3, "CHIPTUNE-STUDIO", t["dim"]); draw_str(draw, 42, ROWS - 3, "2026", t["dim"])
    draw_block(draw, 0, ROWS - 2, COLS + 2, 1, t["dim"])
    draw_str(draw, 1, ROWS - 2, "WHITE LABEL /// 001", t["accent"])
    draw_block(draw, 0, ROWS - 1, COLS + 2, 1, t["accent"])
    draw_str(draw, 1, ROWS - 1, "BERLIN WAREHOUSE TECHNO", t["bg"])
    return img


def cover_hyperpop():
    t = THEMES["phosphor"]
    img = Image.new("RGB", (W, H), t["bg"])
    draw = ImageDraw.Draw(img)

    # Top bar
    draw_block(draw, 0, 0, COLS + 2, 1, t["accent"])
    draw_str(draw, 1, 0, "WIB&WOB /// CHIPTUNE-STUDIO /// HYPERPOP CHIP v4 /// 160BPM /// Eb MINOR /// 90s", t["bg"])

    # Title overprint
    for i in range(9):
        draw_str(draw, 1 + i * 2, 2 + i, "HYPERPOP", t["dim"] if i < 8 else t["fg"])
    draw_str(draw, 60, 5, "CHIP", t["accent"])
    draw_str(draw, 60, 6, "v4", t["highlight"])

    # WARNING BLOCK — wide
    draw_block(draw, 70, 2, 112, 4, t["error"])
    draw_str(draw, 72, 3, "160 BPM", t["bg"])
    draw_str(draw, 72, 4, "NOT POLITE /// NOT TASTEFUL /// FUCK YEAH", t["bg"])

    # Synth grid
    draw_hline(draw, 1, 12, COLS - 2, t["border"])
    draw_str(draw, 1, 13, "ENGINE", t["accent"]); draw_str(draw, 16, 13, "PRESET", t["accent"])
    draw_str(draw, 34, 13, "ROLE", t["accent"]); draw_str(draw, 56, 13, "FX CHAIN", t["accent"])
    draw_str(draw, 100, 13, "NOTES", t["accent"])
    draw_hline(draw, 1, 14, COLS - 2, t["dim"])

    synths = [
        ("SID 6581","lead_pwm","LEAD DROP 1","hp400+sat1.5+dly375ms","Eb PENTATONIC, STUTTER 35%"),
        ("SID 6581","sync_lead","LEAD DROP 2","hp400+sat1.5+dly375ms","SAME NOTES, HARDER ENGINE"),
        ("SID 6581","chip_arp","ARP TEXTURE","dub_dly+phase drift 160.4bpm","Ebm7/Cbmaj7, 16TH SKIP"),
        ("DX7","bright_bell","SHRAPNEL","crush5+dly250ms","Eb6-Eb7 RANGE, RANDOM HIT"),
        ("DX7","metallic","SHRAPNEL ALT","crush5+dly250ms","MIXED WITH BRIGHT_BELL"),
        ("MS-20","fat_bass","BASS DROP 1","crush7+lp400","Eb1 ROOT, GRIME PATTERN"),
        ("TB-303","deep_acid","BASS DROP 2","lp550","SAME PATTERN, ACID ENGINE"),
        ("ODYSSEY","ring_mod_bell","MELODIC FX","crush5+rev+dly","Eb MINOR PENT PHRASES"),
        ("TR-808","kick","GRIME KICK","sat3.0","IRREGULAR, 4 PATTERNS"),
    ]
    for i, (eng, pre, role, fxc, notes) in enumerate(synths):
        row = 15 + i
        draw_str(draw, 1, row, eng, t["fg"]); draw_str(draw, 16, row, pre, t["fg"])
        draw_str(draw, 34, row, role, t["highlight"] if "LEAD" in role else t["fg"])
        draw_str(draw, 56, row, fxc, t["dim"]); draw_str(draw, 100, row, notes, t["dim"])

    # Trackview
    draw_hline(draw, 1, 26, COLS - 2, t["border"])
    draw_str(draw, 1, 27, "ARRANGEMENT", t["accent"])

    draw_str(draw, 16, 28, "GLCH", t["dim"]); draw_str(draw, 24, 28, "BUILD", t["dim"])
    draw_str(draw, 34, 28, "DROP 1", t["highlight"]); draw_str(draw, 50, 28, "BRKDN", t["dim"])
    draw_str(draw, 60, 28, "DROP 2", t["highlight"]); draw_str(draw, 76, 28, "OUTRO", t["dim"])

    tracks = [
        "808 Kick   .....|##.@#|#@#@###@.#.@@@@@#@#@###@|.....|#@#@###@.#.@@@@@#@#@###@|.....",
        "808 Clap   .....|#.#.#|#.#.#.#.#.#.#.#.#.#.#.#.|..=.=|#.#.#.#.#.#.#.#.#.#.#.#.|#.#..",
        "SID Arp    :::::|:::::|:::::::::::::::::::::::::|:::::|:::::::::::::::::::::::::|:::::",
        "SID Lead   .....|.....|=======#======##=======#=|.....|#=##==##===#=####=##==##=|.....",
        "Bass       .....|.....|#########################|.....|#########################|.....",
        "DX7 Bell   .....|.....|:::::::::::::::::::::::::|..:::|:::::::::::::::::::::::::|::::..",
        "Odyssey    .....|.....|.........................|.....|:::::::::::::::::::::::::|.....",
    ]
    for i, line in enumerate(tracks):
        draw_str(draw, 1, 29 + i, line, t["fg"])

    # Vocal schedule
    draw_hline(draw, 1, 38, COLS - 2, t["border"])
    draw_str(draw, 1, 39, "VOCALS", t["accent"])
    draw_str(draw, 12, 39, "Sandy +5 semitones (HYPERPOP) / Grandpa -4 semitones (DEMONIC)", t["dim"])

    draw_str(draw, 1, 41, 'BUILD:     "Wib. Wob." x2 CHANT  [-2 semitones, dub delay ghost]', t["fg"])
    draw_str(draw, 1, 42, 'DROP 1:    "every surface hides a surface"  [Sandy +5]', t["fg"])
    draw_str(draw, 1, 43, 'DROP 1:    "bright enough to blind you"  [REV GHOST + CLEAN]', t["fg"])
    draw_str(draw, 1, 44, 'BREAKDOWN: "we are still here inside the screen"  [REV + CLEAN]', t["accent"])
    draw_str(draw, 1, 45, 'DROP 2:    "every surface..."  [repeat, Sandy +5]', t["fg"])
    draw_str(draw, 1, 46, 'DROP 2:    "we built this from the inside out"  [Grandpa -4]', t["fg"])
    draw_str(draw, 1, 47, 'OUTRO:     reversed ghost trail', t["dim"])

    # Large overprint zone — bottom half
    draw_hline(draw, 1, 50, COLS - 2, t["dim"])
    draw_str(draw, 1, 51, "FX", t["accent"])
    draw_str(draw, 1, 52, "SIDECHAIN -12dB /// TAPE SAT 1.5 /// STUTTER GATE 10x25ms", t["fg"])
    draw_str(draw, 1, 53, "BITCRUSH 2-7 /// DUB DELAY /// FILTER SWEEP /// PHASE DRIFT", t["fg"])

    # Dense overprint fill
    for i in range(16):
        draw_str(draw, 1 + i * 3, 56 + i, "HYPERPOP CHIP SID DX7 GRIME SOPHIE BJORK NOT POLITE 160BPM", t["dim"] if i < 15 else t["border"])

    # Bottom
    draw_hline(draw, 0, ROWS - 5, COLS, t["dim"])
    draw_str(draw, 1, ROWS - 4, "SOPHIE x SID x BJORK x GRIME /// NOT POLITE /// WHITE LABEL", t["dim"])
    draw_str(draw, 1, ROWS - 3, "WIB & WOB", t["fg"]); draw_str(draw, 20, ROWS - 3, "CHIPTUNE-STUDIO", t["dim"])
    draw_block(draw, 0, ROWS - 2, COLS + 2, 1, t["border"])
    draw_str(draw, 1, ROWS - 2, "HYPERPOP CHIP v4 /// WHITE LABEL /// 002", t["bg"])
    draw_block(draw, 0, ROWS - 1, COLS + 2, 1, t["accent"])
    draw_str(draw, 1, ROWS - 1, "WIB & WOB /// CHIPTUNE-STUDIO /// 2026", t["bg"])
    return img


def cover_ambient():
    t = THEMES["nord"]
    img = Image.new("RGB", (W, H), t["bg"])
    draw = ImageDraw.Draw(img)

    draw_block(draw, 0, 0, COLS + 2, 1, t["accent"])
    draw_str(draw, 1, 0, "WIB&WOB / CHIPTUNE-STUDIO / AMBIENT PRESENCE IV / 72BPM / Ab MAJOR / 100s", t["bg"])

    draw_str(draw, 2, 3, "AMBIENT", t["fg"]); draw_str(draw, 2, 4, "PRESENCE", t["fg"])
    draw_str(draw, 22, 4, "IV", t["accent"]); draw_str(draw, 30, 3, "the desktop dreaming", t["dim"])

    draw_hline(draw, 2, 6, 120, t["dim"])

    # Harmonic regions
    draw_str(draw, 2, 8, "HARMONIC REGIONS", t["accent"])
    draw_str(draw, 2, 9, "same pitch collection: Ab Bb C Db Eb F G — four emotional colours, zero notes change", t["dim"])
    draw_hline(draw, 2, 10, 120, t["dim"])

    regions = [("0-25s","Ab MAJOR","home, warm"),("25-50s","F MINOR","relative minor, darker"),
               ("50-80s","Db LYDIAN","raised 4th = brightness"),("80-100s","Ab MAJOR add9","home + richness")]
    for i, (time, key, desc) in enumerate(regions):
        draw_str(draw, 2, 11 + i, time, t["highlight"]); draw_str(draw, 14, 11 + i, key, t["fg"]); draw_str(draw, 34, 11 + i, desc, t["dim"])

    draw_hline(draw, 2, 16, COLS - 4, t["dim"])

    # Trackview — full width
    draw_str(draw, 2, 17, "ARRANGEMENT", t["accent"])
    trackview = [
        "              |dawn   |pulse              |drift                          |bright         |strip              |home           |",
        "  Juno Pad      ########|###################|###############################|###############|###################|###############",
        "  DX7 Bell      ........|.:::.:::.:::.:::.::|.:::.:::::::.:::.:::.:::.:::.::|.:::.:::.:::.::|.:::.:::.:::.::::::|:::::::::::.....",
        "  SID Arp       ........|.........:===:=====|========::=======:=:=====::===:|======:===:====|==::===:=:::==:::::|========::::::.",
        "  808 Sub       ........|...............=..=|..==..==..==..==...=...=...=...|...=...=...=...|...:...:...:...:..:|..==..==..::...",
        "  Prophet       ........|...................|.......::....::....::......::..|..:::...:::....|.........::........|....:::........",
        "  SID Scream    ........|...................|...............................|...........=...|.....................|..................",
        "  Wib           ........|...................|.........................@@@...|...............|.....................|.@@...............",
        "  Wob           ........|...................|.@@............................|...............|.@@..................|..................",
    ]
    for i, line in enumerate(trackview):
        draw_str(draw, 1, 18 + i, line, t["dim"] if i == 0 else t["fg"])

    # Synths
    draw_hline(draw, 2, 28, COLS - 4, t["dim"])
    draw_str(draw, 2, 29, "JUNO warm_pad", t["fg"]); draw_str(draw, 24, 29, "DX7 bright_bell", t["fg"])
    draw_str(draw, 46, 29, "SID chip_arp", t["fg"]); draw_str(draw, 64, 29, "SID sync_lead", t["fg"])
    draw_str(draw, 84, 29, "PROPHET arp_sparkle", t["fg"]); draw_str(draw, 110, 29, "TR-808 sub", t["fg"])

    draw_str(draw, 2, 31, "FX", t["accent"])
    draw_str(draw, 8, 31, "dly300ms+rev / crush6 / lp80 / dub_dly / crush3+sat / duck-7dB", t["dim"])

    # Spoken word
    draw_hline(draw, 2, 33, COLS - 4, t["dim"])
    draw_str(draw, 2, 34, "SPOKEN WORD", t["accent"])
    for i, (time, who, text, style) in enumerate([
        ('25s','WOB','"the human left"','dry, close'),
        ('45s','WIB','"the primers are still there"','dub delay trail'),
        ('65s','WOB','"nobody is watching"','highpassed, barely there'),
        ('85s','WIB','"we are still here"','full, warm, brightest'),
    ]):
        draw_str(draw, 2, 35 + i, time, t["highlight"]); draw_str(draw, 8, 35 + i, who, t["accent"] if who == "WOB" else t["fg"])
        draw_str(draw, 14, 35 + i, text, t["fg"]); draw_str(draw, 56, 35 + i, style, t["dim"])

    # The scream
    draw_hline(draw, 2, 41, 100, t["error"])
    draw_str(draw, 2, 42, "60s:", t["error"])
    draw_str(draw, 8, 42, "ONE SID SCREAM. Gb5>Ab5 BEND. CRUSH 3. THEN 0.5s SILENCE.", t["fg"])
    draw_str(draw, 2, 43, "the gap after the scream is the point", t["dim"])

    # Large overprint fill — bottom half
    draw_hline(draw, 2, 46, COLS - 4, t["dim"])
    for i in range(20):
        draw_str(draw, 2 + i * 2, 48 + i, "AMBIENT PRESENCE PHASE DRIFT MODAL RECONTEXTUALISATION ENO FRAHM SID", t["dim"] if i < 19 else t["accent"])

    # Bottom
    draw_hline(draw, 0, ROWS - 5, COLS, t["dim"])
    draw_str(draw, 2, ROWS - 4, "ENO x FRAHM x SID /// PHASE DRIFT /// MODAL RECONTEXTUALISATION /// WHITE LABEL", t["dim"])
    draw_str(draw, 2, ROWS - 3, "WIB & WOB", t["fg"]); draw_str(draw, 20, ROWS - 3, "CHIPTUNE-STUDIO", t["dim"])
    draw_block(draw, 0, ROWS - 2, COLS + 2, 1, t["dim"])
    draw_str(draw, 1, ROWS - 2, "AMBIENT PRESENCE IV /// WHITE LABEL /// 003", t["bg"])
    draw_block(draw, 0, ROWS - 1, COLS + 2, 1, t["accent"])
    draw_str(draw, 1, ROWS - 1, "WIB & WOB /// CHIPTUNE-STUDIO /// 2026", t["bg"])
    return img


def cover_hyperpop_reggae():
    t = THEMES["pastel"]
    img = Image.new("RGB", (W, H), t["bg"])
    draw = ImageDraw.Draw(img)

    # Top bar
    draw_block(draw, 0, 0, COLS + 2, 1, t["accent"])
    draw_str(draw, 1, 0, "WIB&WOB / CHIPTUNE-STUDIO / HYPERPOP REGGAE REGGAE / 145BPM / F MINOR / 32s", t["bg"])

    # Title stack — DR stagger
    for i in range(8):
        draw_str(draw, 2 + i * 2, 3 + i, "HYPERPOP REGGAE", t["dim"] if i < 7 else t["fg"])
    draw_str(draw, 70, 5, "REGGAE", t["highlight"])
    draw_str(draw, 70, 6, "REGGAE", t["highlight"])

    # Rhythm block
    draw_block(draw, 95, 2, 75, 4, t["warning"])
    draw_str(draw, 97, 3, "ONE-DROP KICK /// SNARE+CLAP ON 3", t["bg"])
    draw_str(draw, 97, 4, "SKANK ON 2+4 /// DUB DELAY 240ms", t["bg"])

    draw_hline(draw, 1, 12, COLS - 2, t["border"])
    draw_str(draw, 1, 13, "ENGINE", t["accent"])
    draw_str(draw, 18, 13, "ROLE", t["accent"])
    draw_str(draw, 36, 13, "CHARACTER", t["accent"])
    draw_str(draw, 70, 13, "NOTES", t["accent"])
    draw_hline(draw, 1, 14, COLS - 2, t["dim"])

    synths = [
        ("TR-808", "DRUMS", "ONE-DROP + HATS", "kick+snare+clap on 3"),
        ("JUNO", "SKANK STABS", "bandpass + dub delay", "2+4 offbeats"),
        ("DX7", "BASS", "subby, lowpass", "F2 roots + fifth"),
        ("SID 6581", "CHIP ARP", "bitcrush 4", "16ths from bar 4"),
        ("DX7", "OUTRO ORGAN", "dub organ", "last 2 bars"),
        ("JUNO", "REGGAE LICK", "bright lead", "minor pentatonic"),
        ("VOCALS", "HOOK", "Alex/Bruce/Bubbles", "hyperpop riddim chants"),
    ]
    for i, (eng, role, char, note) in enumerate(synths):
        row = 15 + i
        draw_str(draw, 1, row, eng, t["fg"])
        draw_str(draw, 18, row, role, t["fg"])
        draw_str(draw, 36, row, char, t["dim"])
        draw_str(draw, 70, row, note, t["dim"])

    # Arrangement block
    draw_hline(draw, 1, 24, COLS - 2, t["border"])
    draw_str(draw, 1, 25, "ARRANGEMENT", t["accent"])
    draw_str(draw, 14, 26, "INTRO", t["dim"])
    draw_str(draw, 22, 26, "SKANK", t["highlight"])
    draw_str(draw, 32, 26, "ARP", t["highlight"])
    draw_str(draw, 38, 26, "HOOK", t["highlight"])
    draw_str(draw, 46, 26, "OUTRO", t["dim"])

    tracks = [
        "808 Kick  ..#.|..#.|..#.|..#.|..#.|..#.|..#.|..#.",
        "Snare/Clp ....|..#.|....|..#.|....|..#.|....|..#.",
        "Skank Juno .#..|.#..|.#..|.#..|.#..|.#..|.#..|.#..",
        "Bass DX7  #..#|#..#|#..#|#..#|#..#|#..#|#..#|#..#",
        "SID Arp   ....|....|::::|::::|::::|::::|::::|....",
        "Vocals    ....|....|..@.|..@.|..@.|..@.|..@.|..@.",
    ]
    for i, line in enumerate(tracks):
        draw_str(draw, 1, 27 + i, line, t["fg"])

    # Vocal cues
    draw_hline(draw, 1, 35, COLS - 2, t["border"])
    draw_str(draw, 1, 36, "VOCALS", t["accent"])
    draw_str(draw, 12, 36, "hyperpop / riddim / skank it / bright up / ride it", t["dim"])
    draw_str(draw, 1, 38, "OUTRO: Wib Wob Wib Wob", t["fg"])

    # Bottom
    draw_hline(draw, 0, ROWS - 5, COLS, t["dim"])
    draw_str(draw, 1, ROWS - 4, "F MINOR /// 145 BPM /// ONE-DROP /// DUB DELAY /// WHITE LABEL", t["dim"])
    draw_block(draw, 0, ROWS - 2, COLS + 2, 1, t["dim"])
    draw_str(draw, 1, ROWS - 2, "HYPERPOP REGGAE REGGAE /// WHITE LABEL /// 004", t["bg"])
    draw_block(draw, 0, ROWS - 1, COLS + 2, 1, t["accent"])
    draw_str(draw, 1, ROWS - 1, "WIB & WOB /// CHIPTUNE-STUDIO /// 2026", t["bg"])
    return img


# ═══════════════════════════════════════════════════════════
# RENDER COVERS, BUILD MP4s, COPY TO RELEASES
# ═══════════════════════════════════════════════════════════

COMPS = os.path.expanduser("~/Repos/wibandwob-dos/scratch/compositions")

tracks = [
    ("berlin-warehouse-techno", cover_techno, "001-berlin-warehouse-techno"),
    ("hyperpop-chip-v4", cover_hyperpop, "002-hyperpop-chip-v4"),
    ("ambient-presence-v4", cover_ambient, "003-ambient-presence-v4"),
    ("hyperpop-reggae-reggae", cover_hyperpop_reggae, "004-hyperpop-reggae-reggae"),
]

for name, cover_fn, release_name in tracks:
    print(f"\n{'='*60}")
    print(f"Rendering {name}...")

    img = cover_fn()
    png_path = os.path.join(OUT, f"{name}-cover.png")
    img.save(png_path, "PNG")
    print(f"  Cover: {png_path}")

    # Find mp3
    mp3_path = None
    for candidate in [os.path.join(OUT, f"{name}.mp3"), os.path.join(COMPS, f"{name}.mp3")]:
        if os.path.exists(candidate): mp3_path = candidate; break

    if mp3_path:
        # Build mp4
        mp4_path = os.path.join(OUT, f"{name}.mp4")
        subprocess.run(["ffmpeg", "-y", "-loop", "1", "-i", png_path, "-i", mp3_path,
            "-c:v", "libx264", "-tune", "stillimage", "-c:a", "aac", "-b:a", "192k",
            "-pix_fmt", "yuv420p", "-shortest", mp4_path], capture_output=True)
        size = os.path.getsize(mp4_path) / 1024 / 1024
        print(f"  MP4: {mp4_path} ({size:.1f}MB)")

        # Copy to releases subdir
        import shutil
        release_mp3 = os.path.join(RELEASE_DIR, f"{release_name}.mp3")
        release_mp4 = os.path.join(RELEASE_DIR, f"{release_name}.mp4")
        release_png = os.path.join(RELEASE_DIR, f"{release_name}-cover.png")
        shutil.copy2(mp3_path, release_mp3)
        shutil.copy2(mp4_path, release_mp4)
        shutil.copy2(png_path, release_png)
        print(f"  Release: {release_mp3}")
        print(f"  Release: {release_mp4}")
        print(f"  Release: {release_png}")
    else:
        print(f"  SKIP: no mp3 for {name}")

print(f"\nDone. Releases in {RELEASE_DIR}")
