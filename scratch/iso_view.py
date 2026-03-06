#!/usr/bin/env python3
"""
Y-buffer voxel terrain renderer with 2x vertical resolution via ▄ half-blocks.
Each terminal row encodes two pixel rows: top=bg, bottom=fg colour + ▄.
"""
import json, math, sys, os, glob

import argparse
ap = argparse.ArgumentParser()
ap.add_argument("path", nargs="?")
ap.add_argument("--cx", type=float, default=None)
ap.add_argument("--cy", type=float, default=None)
ap.add_argument("--out", default=None)
args = ap.parse_args()

captures = sorted(glob.glob("scratch/captures/wibwobworld_*.json"), key=os.path.getmtime, reverse=True)
path = args.path or (captures[0] if captures else None)
if not path: sys.exit("no artifact found")
art   = json.load(open(path))
m     = art["map"]
W, H  = m["width"], m["height"]
cells = m["cells"]
sea   = m["seaLevel"]

def cell_at(wx, wy):
    x = max(0, min(W-1, int(wx)))
    y = max(0, min(H-1, int(wy)))
    return cells[y][x]

# Map each biome to an ANSI 256-colour index
BIOME_COL = {
    "deep-water":    27,
    "shallow-water": 45,
    "shore":        226,
    "plain":         34,
    "forest":        28,
    "hill":         244,
    "ridge":        252,
    "peak":         231,
}
FACE_COL = 236   # dark grey column face
SKY_COLS = [17, 17, 18, 18, 19, 19, 19, 20]   # gradient top→horizon

GLYPH = {"deep-water":"~","shallow-water":"~","shore":".","plain":"_",
          "forest":"T","hill":"n","ridge":"A","peak":"^"}

# Terminal size: SW cols x SH rows → SW x PH logical pixels (PH = SH*2)
SW, SH = 100, 36
PH     = SH * 2    # pixel rows

# Find highest peak → camera aim point
best_e, peak_x, peak_y = 0, W//2, H//2
for sy in range(0, H, 4):
    for sx in range(0, W, 4):
        c = cell_at(sx, sy)
        if c["elevation"] > best_e and not c["isWater"]:
            best_e, peak_x, peak_y = c["elevation"], sx, sy

# Place camera on the opposite side of the map from the peak, near shore
# so the ridge/hill appears in the distance across the scene
opp_x = W - 1 - peak_x
opp_y = H - 1 - peak_y
cam_wx, cam_wy = float(max(2, min(W-3, opp_x))), float(max(2, min(H-3, opp_y)))
# Nudge to nearest non-deep-water cell
for radius in range(0, 20):
    found = False
    for dy in range(-radius, radius+1):
        for dx in range(-radius, radius+1):
            tx, ty = int(cam_wx)+dx, int(cam_wy)+dy
            if 0 <= tx < W and 0 <= ty < H:
                c = cell_at(tx, ty)
                if c["biome"] not in ("deep-water",):
                    cam_wx, cam_wy = float(tx), float(ty)
                    found = True
                    break
        if found: break
    if found: break

# CLI camera override
if args.cx is not None: cam_wx = args.cx
if args.cy is not None: cam_wy = args.cy

cam_yaw  = math.atan2(peak_y - cam_wy, peak_x - cam_wx)
cam_elev = cell_at(cam_wx, cam_wy)["elevation"]  # stand on terrain surface

FOV     = math.pi / 2.0
FAR     = math.sqrt((peak_x-cam_wx)**2 + (peak_y-cam_wy)**2) * 1.4
STEPS   = 800
# Fixed-horizon y-buffer (far-to-near, relative to cam_elev).
# proj = HORIZON - (e - cam_elev) * ELEV_SC
# Works for any cam elevation: same-height terrain → HORIZON,
# above-cam terrain → above HORIZON, below-cam → below HORIZON.
# Scale higher for elevated cameras so 0.4-unit peaks stay dramatic.
HORIZON = int(PH * 0.52)
ELEV_SC = PH * (0.38 if cam_elev > sea + 0.05 else 0.22)

print(f"Terrain: {m['terrainName']}  seed:{m['seed']}  {W}x{H}  sea:{sea:.2f}", file=sys.stderr)
print(f"Cam ({int(cam_wx)},{int(cam_wy)}) elev={cam_elev:.2f} -> peak ({peak_x},{peak_y}) e={best_e:.2f}  yaw={math.degrees(cam_yaw):.0f}°", file=sys.stderr)

# Pixel canvas
canvas = [[None]*SW for _ in range(PH)]
y_buf  = [HORIZON] * SW   # topmost painted row per column; moves toward 0

for step in range(STEPS, 0, -1):   # far → near
    dist = FAR * step / STEPS
    for col in range(SW):
        if y_buf[col] <= 0:
            continue
        ang = cam_yaw + FOV * ((col / (SW-1)) - 0.5)
        wx  = cam_wx + math.cos(ang) * dist
        wy  = cam_wy + math.sin(ang) * dist
        if wx < 0 or wx >= W or wy < 0 or wy >= H:
            continue
        c   = cell_at(wx, wy)
        e   = c["elevation"]
        b   = c["biome"]
        col_idx = BIOME_COL.get(b, 34)
        proj = HORIZON - int((e - cam_elev) * ELEV_SC)
        proj = max(0, min(PH-1, proj))
        if proj < y_buf[col]:
            canvas[proj][col] = col_idx                         # surface pixel
            for r in range(proj+1, min(y_buf[col], PH)):        # column face
                if canvas[r][col] is None:
                    canvas[r][col] = FACE_COL
            y_buf[col] = proj

# Fill below horizon: water if near sea level, biome-tinted ground otherwise
fill_col = BIOME_COL["deep-water"] if cam_elev < sea + 0.08 else BIOME_COL["forest"]
for col in range(SW):
    for r in range(max(HORIZON, y_buf[col]), PH):
        if canvas[r][col] is None:
            canvas[r][col] = fill_col

# Sky fill above terrain
def sky_col(pixel_row):
    frac = min(1.0, pixel_row / HORIZON) if HORIZON > 0 else 0
    idx  = min(len(SKY_COLS)-1, int(frac * len(SKY_COLS)))
    return SKY_COLS[idx]

for r in range(PH):
    for col in range(SW):
        if canvas[r][col] is None:
            canvas[r][col] = sky_col(r)

# ANSI-256 index → RGB
def ansi256_rgb(i):
    if i < 16:
        table = [(0,0,0),(128,0,0),(0,128,0),(128,128,0),(0,0,128),(128,0,128),
                 (0,128,128),(192,192,192),(128,128,128),(255,0,0),(0,255,0),
                 (255,255,0),(0,0,255),(255,0,255),(0,255,255),(255,255,255)]
        return table[i]
    if i < 232:
        i -= 16
        b = i % 6; i //= 6
        g = i % 6; r = i // 6
        lv = lambda x: 0 if x == 0 else 55 + x * 40
        return (lv(r), lv(g), lv(b))
    v = 8 + (i - 232) * 10
    return (v, v, v)

# PNG export (pixel-doubled for clarity)
if args.out:
    from PIL import Image
    SCALE = 8   # each logical pixel → 8×8 image pixels
    img = Image.new("RGB", (SW * SCALE, PH * SCALE))
    px = img.load()
    for r in range(PH):
        for col in range(SW):
            rgb = ansi256_rgb(canvas[r][col])
            for dy in range(SCALE):
                for dx in range(SCALE):
                    px[col*SCALE+dx, r*SCALE+dy] = rgb
    import os; os.makedirs(os.path.dirname(args.out), exist_ok=True)
    img.save(args.out)
    print(f"saved {args.out}", file=sys.stderr)

# Combine pairs of pixel rows into terminal rows using ▄ half-block
# top pixel row → background, bottom pixel row → foreground
out_rows = []
for tr in range(SH):
    top_row = canvas[tr*2]
    bot_row = canvas[tr*2 + 1]
    line = []
    for col in range(SW):
        tc = top_row[col]
        bc = bot_row[col]
        # \033[48;5;{tc}m = bg, \033[38;5;{bc}m = fg, ▄ = lower half block
        line.append(f"\033[48;5;{tc}m\033[38;5;{bc}m▄\033[0m")
    out_rows.append("".join(line))

if not args.out:
    print("\n".join(out_rows))
