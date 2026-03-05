#!/usr/bin/env python3
"""Compositor for THE SALON — one massive ASCII poster."""
import subprocess, os, textwrap

JGS = "/Users/james/Repos/symbient-skills/skills/joan-stark-ascii-art/examples"
PRIMERS = "/tmp/salon-primers"
W, H = 316, 200

# --- Canvas -----------------------------------------------------------------
canvas = [[' '] * W for _ in range(H)]

def place(lines, row, col, transparent=True):
    """Place lines onto canvas. transparent=True skips spaces."""
    for r, line in enumerate(lines):
        y = row + r
        if y >= H: break
        for c, ch in enumerate(line):
            x = col + c
            if x >= W: break
            if transparent and ch == ' ':
                continue
            canvas[y][x] = ch

def hline(row, col, length, ch='-'):
    for x in range(col, min(col + length, W)):
        canvas[row][x] = ch

def load_jgs(fname):
    path = os.path.join(JGS, fname)
    lines = []
    for l in open(path):
        if not l.startswith('#'):
            lines.append(l.rstrip('\n'))
    # strip leading blank lines
    while lines and not lines[0].strip(): lines.pop(0)
    while lines and not lines[-1].strip(): lines.pop()
    return lines

def load_primer(name):
    path = os.path.join(PRIMERS, f"{name}.txt")
    lines = open(path).read().splitlines()
    return lines

def figlet(text, font='standard', width=None):
    cmd = ['figlet', '-f', font]
    if width: cmd += ['-w', str(width)]
    cmd.append(text)
    out = subprocess.run(cmd, capture_output=True, text=True).stdout
    lines = out.splitlines()
    while lines and not lines[0].strip(): lines.pop(0)
    while lines and not lines[-1].strip(): lines.pop()
    return lines

def center_x(lines):
    maxw = max((len(l) for l in lines), default=0)
    return (W - maxw) // 2

# ============================================================
# TITLE BLOCK — top of poster
# ============================================================
row = 1

# "THE" in shadow, "SALON" in big — staggered
the_lines = figlet('THE', 'shadow')
salon_lines = figlet('SALON', 'big')
place(the_lines, row, 4)
place(salon_lines, row + 2, 38)

# "A SURVEY OF THE WESTERN CANON" in slant, right-justified
survey = figlet('A SURVEY', 'small')
place(survey, row, 190)
survey2 = figlet('WESTERN CANON', 'small')
place(survey2, row + 4, 175)

row = 12

# Chandelier centred as header ornament
chandelier = load_jgs('chandelier-0000.txt')
place(chandelier, row, center_x(chandelier))

row = 14
# Decorative divider
hline(row, 0, W, '=')

row = 15
# Piano on left, moon on right of divider
piano = load_jgs('piano-0000.txt')
moon = load_jgs('moon-and-stars-0000.txt')
place(piano, row, 2)
place(moon, row, 288)

# ASCII Art Gallery badge between them
gallery = load_jgs('ascii-art-gallery-0000.txt')
place(gallery, row, center_x(gallery))

row = 15 + max(len(piano), len(moon), len(gallery)) + 1

# ============================================================
# ROW 1 — 6 paintings side by side
# ============================================================
ROW1_Y = row
xs1 = [0, 53, 106, 159, 212, 265]
names_r1 = ['american_gothic','arnolfini','bosch','gleaners','great_wave','hay_wain']
for x, name in zip(xs1, names_r1):
    p = load_primer(name)
    place(p, ROW1_Y, x)

row = ROW1_Y + 19

# "NIGHTHAWKS" figlet bleeding over the gap between row 1 and row 2
hawks = figlet('NIGHTHAWKS', 'banner', width=120)
place(hawks, row - 4, 90, transparent=False)

# Rose in the left margin
rose = load_jgs('rose-0000.txt')
place(rose, row - 6, 0)

# Skull w rose in far right gap
skullrose = load_jgs('skull-w-rose-0000.txt')
place(skullrose, row - 8, 270)

row += 2

# ============================================================
# ROW 2 — 5 paintings, offset +26
# ============================================================
ROW2_Y = row
xs2 = [26, 79, 132, 185, 238]
names_r2 = ['last_supper','liberty','nighthawks','pearl_earring','persistence']
for x, name in zip(xs2, names_r2):
    p = load_primer(name)
    place(p, ROW2_Y, x)

# Girl in mirror in the left gap (0-25 wide)
girl = load_jgs('girl-in-mirror-0000.txt')
place(girl, ROW2_Y, 0)

# Masquerade mask in right gap (288+)
mask = load_jgs('masquarade-mask-0000.txt')
place(mask, ROW2_Y, 275)

row = ROW2_Y + 19

# "LIBERTY" figlet in the gap between row 2 and 3
lib = figlet('LIBERTY', 'big')
place(lib, row - 3, 55, transparent=False)

# "eternal" in shadow font on the right
eternal = figlet('eternal', 'shadow')
place(eternal, row - 5, 210)

row += 2

# ============================================================
# ROW 3 — 5 paintings
# ============================================================
ROW3_Y = row
xs3 = [0, 53, 106, 159, 212]
names_r3 = ['saturn','seurat_tn','wanderer','water_lilies','whistler']
for x, name in zip(xs3, names_r3):
    p = load_primer(name)
    place(p, ROW3_Y, x)

# Knight in the right open space (x=265+)
knight_lines = load_jgs('knight-0000.txt')[:30]  # just top of the knight
place(knight_lines, ROW3_Y, 268)

row = ROW3_Y + 19

# ============================================================
# BELOW THE GRID
# ============================================================
hline(row, 0, W, '-')
row += 1

# "wanderer" in script on the left
wand = figlet('wanderer', 'script')
place(wand, row, 5)

# "SATURN" in banner in the middle
sat = figlet('SATURN', 'banner', width=80)
place(sat, row, 120)

# "persists" in slant on the right
pers = figlet('persists', 'slant')
place(pers, row, 240)

row += max(len(wand), len(sat), len(pers)) + 2

# Grim reaper (just the top half) on the right
reaper = load_jgs('grim-reaper-0000.txt')
# Find the interesting top section (lines 4-24)
reaper_top = [l for l in reaper if l.strip()][:24]
place(reaper_top, row, 220)

# Faces on the left
faces = load_jgs('faces-0000.txt')[:16]
place(faces, row, 2)

# "THE BODY OF WORK" figlet centre
body = figlet('THE BODY', 'big')
place(body, row + 4, center_x(body))

row += 22

# Closing divider
hline(row, 0, W, '=')
row += 1

# Bottom credits line
credit = '  ASCII art by jgs (Joan G. Stark) · paintings via Wikimedia Commons · chafa 1.16 · wibwob-dos · 2026  '
col = (W - len(credit)) // 2
for i, ch in enumerate(credit):
    if col + i < W: canvas[row][col + i] = ch

row += 2

# Final figlet — small "wibwob" in the corner
ww = figlet('wib & wob', 'small')
place(ww, row, W - max(len(l) for l in ww) - 2)

# ============================================================
# Write output
# ============================================================
OUT = '/tmp/salon-poster.txt'
final_row = row + len(ww) + 2
with open(OUT, 'w') as f:
    for i in range(final_row):
        f.write(''.join(canvas[i]).rstrip() + '\n')

import os
size = os.path.getsize(OUT)
lines = final_row
print(f"Written: {OUT}")
print(f"Size: {size:,} bytes, {lines} lines, {W} cols")
