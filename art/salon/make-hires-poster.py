#!/usr/bin/env python3
"""
THE SALON — HIRES
2100×1050 char canvas (visually square at 2:1 cell aspect).
16 paintings at 500×180 each. Joan Stark throughout. Scaled figlet type.
"""
import subprocess, os, textwrap, random

JGS = "/Users/james/Repos/symbient-skills/skills/joan-stark-ascii-art/examples"
PRIMERS = "/tmp/hires-primers"
W, H = 2100, 1050

canvas = [[' '] * W for _ in range(H)]

def place(lines, row, col, transparent=True, clip=True):
    for r, line in enumerate(lines):
        y = row + r
        if clip and y >= H: break
        if y < 0: continue
        for c, ch in enumerate(line):
            x = col + c
            if x >= W or x < 0: break
            if transparent and ch == ' ': continue
            canvas[y][x] = ch

def hline(row, col, length, ch='─'):
    for x in range(col, min(col+length, W)):
        canvas[row][x] = ch

def vline(col, row, length, ch='│'):
    for y in range(row, min(row+length, H)):
        canvas[y][col] = ch

def load_jgs(fname):
    path = os.path.join(JGS, fname)
    lines = []
    for l in open(path):
        if not l.startswith('#'):
            lines.append(l.rstrip('\n'))
    while lines and not lines[0].strip(): lines.pop(0)
    while lines and not lines[-1].strip(): lines.pop()
    return lines

def load_primer(name):
    # try exact, then with suffix variants
    for candidate in [f"{name}.txt", f"{name}2.txt"]:
        path = os.path.join(PRIMERS, candidate)
        if os.path.exists(path):
            lines = open(path).read().splitlines()
            if len(lines) > 10:
                return lines
    return []

def figlet(text, font='standard', width=None):
    cmd = ['figlet', '-f', font]
    if width: cmd += ['-w', str(width)]
    cmd.append(text)
    out = subprocess.run(cmd, capture_output=True, text=True).stdout
    lines = out.splitlines()
    while lines and not lines[0].strip(): lines.pop(0)
    while lines and not lines[-1].strip(): lines.pop()
    return lines

def scale_type(lines, sx=4, sy=2):
    """Scale figlet output by repeating chars and rows."""
    result = []
    for line in lines:
        scaled = ''.join(ch * sx for ch in line)
        for _ in range(sy):
            result.append(scaled)
    return result

def center_x(lines):
    maxw = max((len(l) for l in lines), default=0)
    return max(0, (W - maxw) // 2)

def width_of(lines):
    return max((len(l) for l in lines), default=0)

# ============================================================
# SECTION: TOP TITLE BLOCK  (rows 0–92)
# ============================================================

# "THE" small banner scaled x5/y3, top-left
the_raw = figlet('THE', 'banner')
the_scaled = scale_type(the_raw, sx=5, sy=3)
place(the_scaled, 0, 4)

# "SALON" big banner scaled x8/y4, offset down and right for stagger
salon_raw = figlet('SALON', 'banner')
salon_scaled = scale_type(salon_raw, sx=8, sy=4)
place(salon_scaled, 10, 200)

# "A SURVEY OF" in small font, far right, small scale
survey_raw = figlet('A SURVEY OF', 'small')
survey_scaled = scale_type(survey_raw, sx=3, sy=2)
place(survey_scaled, 2, W - width_of(survey_scaled) - 10)

western_raw = figlet('THE WESTERN CANON', 'small')
western_scaled = scale_type(western_raw, sx=3, sy=2)
place(western_scaled, 10, W - width_of(western_scaled) - 10)

# Chandelier centred
chandelier = load_jgs('chandelier-0000.txt')
place(chandelier, 50, center_x(chandelier))

# Divider line
row = 93
hline(row, 0, W, '═')

# ============================================================
# PAINTING GRID — 4 cols × 4 rows
# Each cell: 510w × 185h (500 content + 10 gap / 180 content + 5 gap)
# ============================================================
COL_W = 510
ROW_H = 190

NAMES = [
    # row 1
    'american_gothic', 'arnolfini',    'bosch',        'gleaners',
    # row 2
    'great_wave',      'hay_wain',     'last_supper',  'liberty',
    # row 3
    'nighthawks',      'pearl_earring','persistence',  'saturn',
    # row 4
    'seurat_tn',       'wanderer',     'water_lilies', 'whistler',
]

GRID_TOP = 96
GAP_H = 38   # rows between painting rows for figlets and jgs

def grid_y(row_idx):
    return GRID_TOP + row_idx * (180 + GAP_H)

def grid_x(col_idx):
    return col_idx * COL_W

# Place all 16 paintings
for i, name in enumerate(NAMES):
    ri, ci = divmod(i, 4)
    p = load_primer(name)
    if p:
        place(p, grid_y(ri), grid_x(ci))
    else:
        print(f"MISSING: {name}")

# ============================================================
# GAP 1 (between row 1 and row 2) — "NIGHTHAWKS" + jgs strip
# ============================================================
G1 = grid_y(1) - GAP_H + 2   # row just below row 1 paintings

# "NIGHTHAWKS" scaled type on the left
hawks_raw = figlet('NIGHTHAWKS', 'banner', width=800)
hawks_sc  = scale_type(hawks_raw, sx=4, sy=3)
place(hawks_sc, G1, 10, transparent=False)

# "THE WAVE" on the right, smaller scale
wave_raw = figlet('THE WAVE', 'small')
wave_sc  = scale_type(wave_raw, sx=6, sy=3)
place(wave_sc, G1 + 4, W - width_of(wave_sc) - 20)

# Joan Stark scattered across the gap
jgs_gap1 = [
    ('moon-and-stars-0000.txt',  G1,    900),
    ('rose-0000.txt',            G1+6,  1100),
    ('rose-0000.txt',            G1+6,  1160),
    ('rose-0000.txt',            G1+6,  1220),
    ('musical-notes-0000.txt',   G1+2,  1400),
    ('a-ghost-0000.txt',         G1,    1650),
]
for fname, gy, gx in jgs_gap1:
    place(load_jgs(fname), gy, gx)

# ============================================================
# GAP 2 (between row 2 and row 3) — "LIBERTY" + "eternal"
# ============================================================
G2 = grid_y(2) - GAP_H + 2

lib_raw = figlet('LIBERTY', 'banner')
lib_sc  = scale_type(lib_raw, sx=5, sy=3)
place(lib_sc, G2, 30, transparent=False)

eternal_raw = figlet('eternal', 'shadow')
eternal_sc  = scale_type(eternal_raw, sx=4, sy=2)
place(eternal_sc, G2 + 8, W - width_of(eternal_sc) - 30)

# Small figlet centre gap
born_raw = figlet('memento mori', 'small')
born_sc  = scale_type(born_raw, sx=3, sy=2)
place(born_sc, G2 + 12, center_x(born_sc))

jgs_gap2 = [
    ('skull-w-rose-0000.txt',      G2,     750),
    ('chandelier-0000.txt',        G2,     980),
    ('masquarade-mask-0000.txt',   G2,    1280),
    ('girl-in-mirror-0000.txt',    G2,    1550),
    ('five-pointed-stars-0000.txt',G2+4,  1800),
]
for fname, gy, gx in jgs_gap2:
    place(load_jgs(fname), gy, gx)

# ============================================================
# GAP 3 (between row 3 and row 4) — "SATURN" + "persists"
# ============================================================
G3 = grid_y(3) - GAP_H + 2

sat_raw = figlet('SATURN', 'banner')
sat_sc  = scale_type(sat_raw, sx=5, sy=3)
place(sat_sc, G3, 10, transparent=False)

pers_raw = figlet('persists', 'slant')
pers_sc  = scale_type(pers_raw, sx=4, sy=2)
place(pers_sc, G3 + 5, W - width_of(pers_sc) - 20)

the_body_raw = figlet('the body of work', 'small')
the_body_sc  = scale_type(the_body_raw, sx=3, sy=2)
place(the_body_sc, G3 + 14, center_x(the_body_sc))

jgs_gap3 = [
    ('piano-0000.txt',          G3,     700),
    ('knight-0000.txt',         G3,     950),
    ('faces-0000.txt',          G3,    1250),
    ('man-looking-into-mirror-0500.txt', G3, 1500),
    ('grim-reaper-0000.txt',    G3,    1750),
]
for fname, gy, gx in jgs_gap3:
    art = load_jgs(fname)[:32]  # top portion only to fit in gap
    place(art, gy, gx)

# ============================================================
# BOTTOM SECTION (below row 4)
# ============================================================
BOT = grid_y(4) + 2  # just below last row

hline(BOT, 0, W, '═')

# "wib & wob" right-aligned, scaled
ww_raw = figlet('wib & wob', 'small')
ww_sc  = scale_type(ww_raw, sx=4, sy=2)
place(ww_sc, BOT + 2, W - width_of(ww_sc) - 5)

# "WESTERN CANON" reprise, scaled, bottom-left
wc_raw = figlet('WESTERN', 'banner')
wc_sc  = scale_type(wc_raw, sx=3, sy=2)
place(wc_sc, BOT + 4, 5)

# Joan Stark ASCII Art Gallery badge centred
gallery = load_jgs('ascii-art-gallery-0000.txt')
place(gallery, BOT + 6, center_x(gallery))

# Artist credit line
credit = 'ASCII art by jgs (Joan G. Stark)  ·  paintings via Wikimedia Commons  ·  chafa 1.16  ·  SF Mono  ·  wibwob-dos  ·  2026'
clen = len(credit)
ccol = (W - clen) // 2
for i, ch in enumerate(credit):
    canvas[BOT + 22][ccol + i] = ch

# ============================================================
# VERTICAL RULES between columns (subtle)
# ============================================================
for ci in range(1, 4):
    vx = grid_x(ci) - 1
    for ri in range(4):
        for dy in range(5, 175):
            y = grid_y(ri) + dy
            if canvas[y][vx] == ' ':
                canvas[y][vx] = '│'

# ============================================================
# WRITE OUTPUT
# ============================================================
OUT = '/tmp/hires-poster.txt'
final_row = min(BOT + 28, H)
with open(OUT, 'w') as f:
    for i in range(final_row):
        f.write(''.join(canvas[i]).rstrip() + '\n')

size = os.path.getsize(OUT)
print(f"Written: {OUT}")
print(f"{final_row} lines × {W} cols = {size:,} bytes")
