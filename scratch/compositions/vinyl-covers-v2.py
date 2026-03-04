# /// script
# requires-python = ">=3.10"
# dependencies = ["pillow"]
# ///
"""
VINYL COVERS v2 — Terminal-rendered, WibWob-DOS themed

Designers Republic × Swiss modernism × white label brutalism.
All monospace. Same font size throughout. Dense text blocks.
WibWob-DOS theme palettes as colour source.
No cute vinyl illustration — just INFORMATION as design.
"""

import os
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.expanduser("~/Repos/symbient-shared-skills/skills/chiptune-studio/references/examples")

# 1280x720 video frame
W, H = 1280, 720

# ── WibWob-DOS Theme Palettes ──

THEMES = {
    "dark": {
        "bg": (0, 0, 0),
        "fg": (255, 255, 255),
        "accent": (0, 255, 255),      # cyan
        "dim": (51, 51, 51),
        "border": (0, 255, 255),
        "highlight": (255, 255, 0),    # yellow
        "error": (255, 0, 0),
        "fill": (66, 44, 118),         # purple desktop
    },
    "phosphor": {
        "bg": (0, 0, 0),
        "fg": (255, 176, 0),           # amber
        "accent": (255, 215, 0),       # gold
        "dim": (100, 70, 0),
        "border": (255, 140, 0),       # dark orange
        "highlight": (255, 255, 100),
        "error": (255, 80, 0),
        "fill": (40, 25, 0),
    },
    "nord": {
        "bg": (46, 52, 64),
        "fg": (216, 222, 233),
        "accent": (136, 192, 208),     # frost
        "dim": (76, 86, 106),
        "border": (136, 192, 208),
        "highlight": (235, 203, 139),  # yellow
        "error": (191, 97, 106),
        "fill": (59, 66, 82),
    },
    "pastel": {
        "bg": (30, 30, 46),
        "fg": (205, 214, 244),
        "accent": (203, 166, 247),     # mauve
        "dim": (108, 112, 134),
        "border": (203, 166, 247),
        "highlight": (249, 226, 175),
        "error": (243, 139, 168),
        "fill": (49, 50, 68),
    },
}

FONT_PATHS = [
    "/System/Library/Fonts/Menlo.ttc",
    "/System/Library/Fonts/Monaco.dfont",
    "/Library/Fonts/Courier New.ttf",
]

def get_font(size=13):
    for p in FONT_PATHS:
        if os.path.exists(p):
            try: return ImageFont.truetype(p, size)
            except: continue
    return ImageFont.load_default()

FONT = get_font(13)
FONT_SM = get_font(11)

# Character dimensions at font size 13 Menlo
CHAR_W = 8
CHAR_H = 15

def char_pos(col, row):
    """Convert grid position to pixel position."""
    return (col * CHAR_W + 8, row * CHAR_H + 4)

def draw_char(draw, col, row, ch, fg):
    x, y = char_pos(col, row)
    draw.text((x, y), ch, font=FONT, fill=fg)

def draw_str(draw, col, row, text, fg):
    x, y = char_pos(col, row)
    draw.text((x, y), text, font=FONT, fill=fg)

def draw_block(draw, col, row, w, h, color):
    """Fill a character-grid rectangle."""
    x1, y1 = char_pos(col, row)
    x2, y2 = char_pos(col + w, row + h)
    draw.rectangle([x1, y1, x2, y2], fill=color)

def draw_hline(draw, col, row, length, fg):
    draw_str(draw, col, row, "─" * length, fg)

def draw_box(draw, col, row, w, h, fg):
    draw_str(draw, col, row, "┌" + "─" * (w-2) + "┐", fg)
    for r in range(1, h-1):
        draw_str(draw, col, row + r, "│", fg)
        draw_str(draw, col + w - 1, row + r, "│", fg)
    draw_str(draw, col, row + h - 1, "└" + "─" * (w-2) + "┘", fg)


# ═══════════════════════════════════════════════════════════
# COVER 1: Berlin Warehouse Techno — wibwob-dark theme
# Swiss grid. Dense info. Brutal typography.
# ═══════════════════════════════════════════════════════════

def cover_techno():
    t = THEMES["dark"]
    img = Image.new("RGB", (W, H), t["bg"])
    draw = ImageDraw.Draw(img)
    
    cols = W // CHAR_W  # ~160
    rows = H // CHAR_H  # ~48
    
    # Top bar — full width, inverted
    draw_block(draw, 0, 0, cols, 1, t["accent"])
    draw_str(draw, 1, 0, "WIB&WOB / CHIPTUNE-STUDIO", t["bg"])
    draw_str(draw, cols - 22, 0, "BERLIN WAREHOUSE 001", t["bg"])
    
    # Separator
    draw_hline(draw, 0, 1, cols, t["dim"])
    
    # LEFT COLUMN — track info, swiss grid style
    # Title block — BIG, repeated, overlapping (DR style)
    for i in range(5):
        draw_str(draw, 2 + i, 3 + i, "BERLIN WAREHOUSE TECHNO", t["accent"] if i == 4 else t["dim"])
    
    draw_hline(draw, 2, 9, 60, t["accent"])
    
    # Stats grid — aligned columns
    draw_str(draw, 2, 11, "BPM", t["dim"])
    draw_str(draw, 12, 11, "130", t["fg"])
    draw_str(draw, 20, 11, "KEY", t["dim"])
    draw_str(draw, 30, 11, "Eb MINOR", t["fg"])
    draw_str(draw, 44, 11, "DUR", t["dim"])
    draw_str(draw, 54, 11, "120s", t["fg"])
    
    draw_hline(draw, 2, 12, 60, t["dim"])
    
    # Synth roster — tabular
    draw_str(draw, 2, 14, "SYNTH", t["accent"])
    draw_str(draw, 20, 14, "ROLE", t["accent"])
    draw_str(draw, 40, 14, "CHARACTER", t["accent"])
    draw_hline(draw, 2, 15, 60, t["dim"])
    
    synths = [
        ("TB-303", "ACID BASS", "RESONANT SQUELCH"),
        ("JUNO-106", "PAD + STAB", "WARM CHORUS"),
        ("TR-808", "KICK/CLAP/HAT", "ANALOG DRUM"),
    ]
    for i, (s, role, char) in enumerate(synths):
        draw_str(draw, 2, 16 + i, s, t["fg"])
        draw_str(draw, 20, 16 + i, role, t["fg"])
        draw_str(draw, 40, 16 + i, char, t["dim"])
    
    # Structure bar — visual section map
    draw_hline(draw, 2, 20, 60, t["accent"])
    draw_str(draw, 2, 21, "STRUCTURE", t["accent"])
    
    sections = [
        ("INTRO", 13, t["dim"]),
        ("BUILD", 17, t["fill"]),
        ("BREAK", 9, t["dim"]),
        ("PEAK", 22, t["accent"]),
        ("OUT", 4, t["dim"]),
    ]
    col = 2
    for name, bars, color in sections:
        w = bars
        draw_block(draw, col, 23, w, 2, color)
        if w > len(name):
            draw_str(draw, col + 1, 23, name, t["fg"])
        draw_str(draw, col, 25, str(bars), t["dim"])
        col += w + 1
    
    # RIGHT COLUMN — tracker pattern
    draw_box(draw, 68, 2, 90, 26, t["dim"])
    draw_str(draw, 70, 2, " PATTERN ", t["accent"])
    
    tracker = [
        "  Kick   #...#...#...#...|#...#...#...#...|#...#...#...#...|#...#...#...#...",
        "  Clap   ....#.......#...|....#.......#...|....#.......#...|....#.......#...",
        "  Hat    -.-.-.-.-.-.-.--|-.-.-.-.-.-.-.--|-.-.-.-.-.-.-.--|-.-.-.-.-.-.-.--",
        "  Bass   #=====..#==..#=.|#=====..#==..#=.|#=====..#==..#=.|#=====..#==..#=.",
        "  Pad    ################|################|################|################",
        "  303    ..==..==.===.==.|..==..==.===.==.|..==..==.===.==.|..==..==.===.==.",
        "",
        "  Kick   #...#...#...#...|#...#...#..##...|#.#.#.#.#.#.#.#.|#...............  ",
        "  Clap   ....#.......#...|....#.......#...|#.#.#.#.#.#.#.#.|................",
        "  Hat    -.-.-.-.-.-.-.--|-.-.-.-.-.-.-.--|================|................",
        "  Bass   #=====..#==..#=.|#=====..#==..#=.|################|==..............",
        "  Pad    ################|################|################|====............",
        "  303    ..==..==.===.==.|==..==..==..==..|################|................",
    ]
    for i, line in enumerate(tracker):
        draw_str(draw, 70, 4 + i, line, t["dim"] if i < 6 else t["fg"])
    
    # Bottom info strip
    draw_hline(draw, 0, rows - 4, cols, t["dim"])
    draw_str(draw, 2, rows - 3, "WIB & WOB", t["fg"])
    draw_str(draw, 20, rows - 3, "CHIPTUNE-STUDIO", t["dim"])
    draw_str(draw, 42, rows - 3, "2026", t["dim"])
    
    # DR-style diagonal text
    draw_str(draw, 2, rows - 2, "TB-303 / JUNO-106 / TR-808  ///  SIDECHAIN -10dB  ///  TAPE SATURATE  ///  DUB DELAY", t["dim"])
    
    # Bottom bar — inverted
    draw_block(draw, 0, rows - 1, cols, 1, t["accent"])
    draw_str(draw, 1, rows - 1, "001", t["bg"])
    draw_str(draw, cols - 12, rows - 1, "WHITE LABEL", t["bg"])
    
    return img


# ═══════════════════════════════════════════════════════════
# COVER 2: Hyperpop Chip v4 — phosphor theme
# MAXIMUM DENSITY. Every pixel used. Brutal.
# ═══════════════════════════════════════════════════════════

def cover_hyperpop():
    t = THEMES["phosphor"]
    img = Image.new("RGB", (W, H), t["bg"])
    draw = ImageDraw.Draw(img)
    
    cols = W // CHAR_W
    rows = H // CHAR_H
    
    # Top bar
    draw_block(draw, 0, 0, cols, 1, t["accent"])
    draw_str(draw, 1, 0, "WIB&WOB /// CHIPTUNE-STUDIO /// HYPERPOP CHIP v4 /// 160BPM /// Eb MINOR /// 90s", t["bg"])
    
    # TITLE — massive repeated stagger (DR overprint effect)
    for i in range(7):
        alpha = t["dim"] if i < 6 else t["fg"]
        draw_str(draw, 1 + i * 2, 2 + i, "HYPERPOP", alpha)
    draw_str(draw, 60, 3, "CHIP", t["accent"])
    draw_str(draw, 60, 4, "v4", t["highlight"])
    
    # WARNING BLOCK
    draw_block(draw, 70, 2, 86, 3, t["error"])
    draw_str(draw, 72, 3, "160 BPM /// NOT POLITE /// NOT TASTEFUL /// FUCK YEAH", t["bg"])
    
    # Synth grid — dense tabular
    draw_hline(draw, 1, 10, 155, t["border"])
    
    draw_str(draw, 1, 11, "ENGINE", t["accent"])
    draw_str(draw, 16, 11, "PRESET", t["accent"])
    draw_str(draw, 32, 11, "ROLE", t["accent"])
    draw_str(draw, 50, 11, "FX CHAIN", t["accent"])
    draw_str(draw, 90, 11, "NOTES", t["accent"])
    
    draw_hline(draw, 1, 12, 155, t["dim"])
    
    synths = [
        ("SID 6581", "lead_pwm", "LEAD DROP 1", "hp400+sat1.5+dly375ms", "Eb PENTATONIC, STUTTER 35%"),
        ("SID 6581", "sync_lead", "LEAD DROP 2", "hp400+sat1.5+dly375ms", "SAME NOTES, HARDER ENGINE"),
        ("SID 6581", "chip_arp", "ARP TEXTURE", "dub_dly+phase drift", "Ebm7/Cbmaj7, 16TH SKIP"),
        ("DX7", "bright_bell", "SHRAPNEL", "crush5+dly250ms", "Eb6-Eb7 RANGE, RANDOM HIT"),
        ("DX7", "metallic", "SHRAPNEL ALT", "crush5+dly250ms", "MIXED WITH BRIGHT_BELL"),
        ("MS-20", "fat_bass", "BASS DROP 1", "crush7+lp400", "Eb1 ROOT, GRIME PATTERN"),
        ("TB-303", "deep_acid", "BASS DROP 2", "lp550", "SAME PATTERN, ACID ENGINE"),
        ("ODYSSEY", "ring_mod", "ALIEN FX", "crush4+rev", "DROP 2 ONLY, 50% SKIP"),
        ("TR-808", "kick", "GRIME KICK", "sat3.0", "IRREGULAR, 4 PATTERNS"),
    ]
    for i, (eng, pre, role, fxc, notes) in enumerate(synths):
        row = 13 + i
        draw_str(draw, 1, row, eng, t["fg"])
        draw_str(draw, 16, row, pre, t["fg"])
        draw_str(draw, 32, row, role, t["highlight"] if "LEAD" in role else t["fg"])
        draw_str(draw, 50, row, fxc, t["dim"])
        draw_str(draw, 90, row, notes, t["dim"])
    
    # Trackview
    draw_hline(draw, 1, 23, 155, t["border"])
    draw_str(draw, 1, 24, "ARRANGEMENT", t["accent"])
    
    tracks = [
        "808 Kick   .....|##.@#|#@#@#|.....|#@#@#|.....",
        "808 Clap   .....|#.#.#|#.#.#|..=.=|#.#.#|#.#..",
        "SID Arp    :::::|:::::|:::::|:::::|:::::|:::::",
        "SID Lead   .....|.....|=#=#=|.....|#=##=|.....",
        "MS20/303   .....|.....|#####|.....|#####|.....",
        "DX7 Bell   .....|.....|:::::|..:::|:::::|::::..",
        "Odyssey    .....|.....|.....|.....|:::::|.....",
    ]
    
    # Section labels above
    draw_str(draw, 12, 25, "GLCH", t["dim"])
    draw_str(draw, 18, 25, "BUILD", t["dim"])
    draw_str(draw, 24, 25, "DROP 1", t["highlight"])
    draw_str(draw, 31, 25, "BRKDN", t["dim"])
    draw_str(draw, 37, 25, "DROP 2", t["highlight"])
    draw_str(draw, 44, 25, "OUTRO", t["dim"])
    
    for i, line in enumerate(tracks):
        draw_str(draw, 1, 26 + i, line, t["fg"])
    
    # Vocal schedule
    draw_hline(draw, 1, 34, 155, t["border"])
    draw_str(draw, 1, 35, "VOCALS", t["accent"])
    draw_str(draw, 12, 35, "Sandy +5 semitones (HYPERPOP) / Grandpa -4 semitones (DEMONIC)", t["dim"])
    
    lyrics = [
        'WIB: "every surface hides a surface"                    — DROP 1',
        'WIB: "bright enough to blind you" [REV GHOST + CLEAN]   — DROP 1',
        'WOB: "we are still here inside the screen" [REV + CLEAN] — BREAKDOWN',
        'WIB: "every surface..." [ALIEN +8 SEMITONES]            — DROP 2',
        'WOB: "we built this from the inside out" [+ REV GHOST]  — DROP 2',
    ]
    for i, line in enumerate(lyrics):
        draw_str(draw, 1, 37 + i, line, t["fg"] if "WIB" in line else t["accent"])
    
    # FX summary bar
    draw_hline(draw, 1, 43, 155, t["dim"])
    draw_str(draw, 1, 44, "SIDECHAIN -12dB /// TAPE SAT 1.5 /// STUTTER GATE 10x25ms /// BITCRUSH 2-7 /// DUB DELAY /// FILTER SWEEP", t["dim"])
    
    # Bottom bar
    draw_block(draw, 0, rows - 2, cols, 1, t["border"])
    draw_str(draw, 1, rows - 2, "SOPHIE x SID x BJORK x GRIME /// NOT POLITE /// WHITE LABEL /// 002", t["bg"])
    draw_block(draw, 0, rows - 1, cols, 1, t["accent"])
    draw_str(draw, 1, rows - 1, "WIB & WOB /// CHIPTUNE-STUDIO /// 2026", t["bg"])
    
    return img


# ═══════════════════════════════════════════════════════════
# COVER 3: Ambient Presence IV — nord theme
# Minimal but information-dense. The trackview IS the art.
# ═══════════════════════════════════════════════════════════

def cover_ambient():
    t = THEMES["nord"]
    img = Image.new("RGB", (W, H), t["bg"])
    draw = ImageDraw.Draw(img)
    
    cols = W // CHAR_W
    rows = H // CHAR_H
    
    # Top bar
    draw_block(draw, 0, 0, cols, 1, t["accent"])
    draw_str(draw, 1, 0, "WIB&WOB / CHIPTUNE-STUDIO / AMBIENT PRESENCE IV / 72BPM / Ab MAJOR / 100s", t["bg"])
    
    # Title — understated, DR precision
    draw_str(draw, 2, 2, "AMBIENT", t["fg"])
    draw_str(draw, 2, 3, "PRESENCE", t["fg"])
    draw_str(draw, 22, 3, "IV", t["accent"])
    draw_str(draw, 28, 2, "the desktop dreaming", t["dim"])
    
    draw_hline(draw, 2, 5, 80, t["dim"])
    
    # Harmonic journey — the conceptual heart
    draw_str(draw, 2, 6, "HARMONIC REGIONS", t["accent"])
    draw_str(draw, 2, 7, "0-25s", t["highlight"])
    draw_str(draw, 12, 7, "Ab MAJOR", t["fg"])
    draw_str(draw, 28, 7, "home, warm", t["dim"])
    draw_str(draw, 2, 8, "25-50s", t["highlight"])
    draw_str(draw, 12, 8, "F MINOR", t["fg"])
    draw_str(draw, 28, 8, "relative minor, darker", t["dim"])
    draw_str(draw, 2, 9, "50-80s", t["highlight"])
    draw_str(draw, 12, 9, "Db LYDIAN", t["fg"])
    draw_str(draw, 28, 9, "raised 4th = brightness", t["dim"])
    draw_str(draw, 2, 10, "80-100s", t["highlight"])
    draw_str(draw, 12, 10, "Ab MAJOR add9", t["fg"])
    draw_str(draw, 28, 10, "home + richness", t["dim"])
    
    draw_str(draw, 55, 7, "same pitch collection", t["dim"])
    draw_str(draw, 55, 8, "Ab Bb C Db Eb F G", t["accent"])
    draw_str(draw, 55, 9, "four emotional colours", t["dim"])
    draw_str(draw, 55, 10, "zero notes change", t["dim"])
    
    draw_hline(draw, 2, 12, 155, t["dim"])
    
    # Trackview — full width
    draw_str(draw, 2, 13, "ARRANGEMENT", t["accent"])
    
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
        color = t["dim"] if i == 0 else t["fg"]
        draw_str(draw, 1, 14 + i, line, color)
    
    # Synth grid
    draw_hline(draw, 2, 24, 155, t["dim"])
    draw_str(draw, 2, 25, "JUNO warm_pad", t["fg"])
    draw_str(draw, 22, 25, "DX7 bright_bell", t["fg"])
    draw_str(draw, 42, 25, "SID chip_arp", t["fg"])
    draw_str(draw, 58, 25, "SID sync_lead", t["fg"])
    draw_str(draw, 76, 25, "PROPHET arp_sparkle", t["fg"])
    draw_str(draw, 100, 25, "TR-808 sub", t["fg"])
    
    # FX
    draw_str(draw, 2, 27, "FX", t["accent"])
    draw_str(draw, 8, 27, "dly300ms+rev / crush6 / lp80 / dub_dly / crush3+sat / duck-7dB", t["dim"])
    
    # Spoken word
    draw_hline(draw, 2, 29, 155, t["dim"])
    draw_str(draw, 2, 30, "SPOKEN WORD", t["accent"])
    
    words = [
        ('25s', 'WOB', '"the human left"', 'dry, close'),
        ('45s', 'WIB', '"the primers are still there"', 'dub delay trail'),
        ('65s', 'WOB', '"nobody is watching"', 'highpassed, barely there'),
        ('85s', 'WIB', '"we are still here"', 'full, warm, brightest'),
    ]
    for i, (time, who, text, style) in enumerate(words):
        draw_str(draw, 2, 31 + i, time, t["highlight"])
        draw_str(draw, 8, 31 + i, who, t["accent"] if who == "WOB" else t["fg"])
        draw_str(draw, 14, 31 + i, text, t["fg"])
        draw_str(draw, 52, 31 + i, style, t["dim"])
    
    # The scream
    draw_hline(draw, 2, 36, 80, t["error"])
    draw_str(draw, 2, 37, "60s:", t["error"])
    draw_str(draw, 8, 37, "ONE SID SCREAM. Gb5>Ab5 BEND. CRUSH 3. THEN 0.5s SILENCE.", t["fg"])
    draw_str(draw, 2, 38, "the gap after the scream is the point", t["dim"])
    
    # Bottom
    draw_hline(draw, 0, rows - 4, cols, t["dim"])
    draw_str(draw, 2, rows - 3, "ENO x FRAHM x SID /// PHASE DRIFT /// MODAL RECONTEXTUALISATION /// WHITE LABEL", t["dim"])
    
    draw_block(draw, 0, rows - 2, cols, 1, t["dim"])
    draw_str(draw, 1, rows - 2, "WIB & WOB /// CHIPTUNE-STUDIO /// 003", t["bg"])
    draw_block(draw, 0, rows - 1, cols, 1, t["accent"])
    draw_str(draw, 1, rows - 1, "AMBIENT PRESENCE IV /// 2026", t["bg"])
    
    return img


# ═══════════════════════════════════════════════════════════
# RENDER & COMBINE WITH AUDIO
# ═══════════════════════════════════════════════════════════

import subprocess

covers = [
    ("berlin-warehouse-techno", cover_techno),
    ("hyperpop-chip-v4", cover_hyperpop),
    ("ambient-presence-v4", cover_ambient),
]

for name, cover_fn in covers:
    print(f"\n{'='*60}")
    print(f"Rendering {name}...")
    
    img = cover_fn()
    png_path = os.path.join(OUT, f"{name}-cover.png")
    img.save(png_path, "PNG")
    print(f"  Cover: {png_path}")
    
    # Find the mp3
    mp3_candidates = [
        os.path.join(OUT, f"{name}.mp3"),
        os.path.expanduser(f"~/Repos/wibandwob-dos/scratch/compositions/{name}.mp3"),
    ]
    mp3_path = None
    for c in mp3_candidates:
        if os.path.exists(c):
            mp3_path = c
            break
    
    if mp3_path:
        mp4_path = os.path.join(OUT, f"{name}.mp4")
        cmd = [
            "ffmpeg", "-y",
            "-loop", "1", "-i", png_path,
            "-i", mp3_path,
            "-c:v", "libx264", "-tune", "stillimage",
            "-c:a", "aac", "-b:a", "192k",
            "-pix_fmt", "yuv420p",
            "-shortest",
            mp4_path,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0:
            size = os.path.getsize(mp4_path) / 1024 / 1024
            print(f"  Video: {mp4_path} ({size:.1f}MB)")
        else:
            print(f"  ERROR: {result.stderr[-300:]}")
    else:
        print(f"  SKIP: no mp3 found for {name}")

print("\nDone. Three terminal-rendered vinyl covers.")
