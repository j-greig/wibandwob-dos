#!/usr/bin/env python3
"""
Contour Map Studio — curses TUI for generating topographic contour maps.

MODES:
  STATIC   — instant full map, press keys to switch terrain / randomise
  GROW     — hills appear one at a time, filling the canvas, then stop

Keys:
  r        Randomise seed (new map)
  1-7      Terrain type (new seed each press)
  TAB      Cycle terrain (new seed)
  +/-      More/fewer contour levels
  t        Triptych: 3 variations side by side
  g        Toggle GROW mode (animated fill)
  SPACE    In grow mode: pause/resume
  s        Save current view to timestamped file
  a        Save ALL terrains for current seed (batch)
  q/ESC    Quit

Uses only: ╭ ╮ ╰ ╯ │ ─
"""

import curses
import math
import random
import os
import time
import sys
from datetime import datetime

# ── engine ────────────────────────────────────────────────

MS = ' ╮╭─╰╮│╯╯│╭╰─╭╮ '

# Hill shape types
SHAPE_CIRCLE    = 0   # classic gaussian
SHAPE_POLYGON   = 1   # 3-8 sided (triangular, hex, octagonal hills)
SHAPE_ELLIPSE   = 2   # elongated with rotation (ridges, spurs)
SHAPE_SUPER     = 3   # superellipse / rounded rectangle
SHAPE_ASYM      = 4   # asymmetric blob (steeper one side)

_TAU = math.tau
_PI  = math.pi


def _shaped_distance(dx, dy, hill):
    """Return effective squared distance for a shaped hill.
    hill = (cx, cy, r, pk, shape, rotation, aspect, sides, power)
    """
    shape    = hill[4]
    rotation = hill[5]
    aspect   = hill[6]  # y-stretch: 1.0 = circle, >1 = elongated
    sides    = hill[7]  # polygon sides (3-12)
    power    = hill[8]  # superellipse exponent (2=circle, 3-6=squarish)

    # rotate point into hill's local frame
    cos_r = math.cos(rotation)
    sin_r = math.sin(rotation)
    lx =  dx * cos_r + dy * sin_r
    ly = -dx * sin_r + dy * cos_r

    # apply aspect ratio (stretch along local y)
    ly /= aspect

    r = hill[2]

    if shape == SHAPE_CIRCLE:
        d2 = lx*lx + ly*ly
        return d2

    elif shape == SHAPE_POLYGON:
        # polygon distance: scale by angular factor
        d = math.sqrt(lx*lx + ly*ly)
        if d < 1e-9:
            return 0.0
        angle = math.atan2(ly, lx)
        sector = _TAU / sides
        # angle within sector, centered
        a = (angle % sector) - sector * 0.5
        # polygon radius at this angle vs inscribed circle
        poly_scale = math.cos(_PI / sides) / max(math.cos(a), 1e-9)
        d_eff = d / poly_scale
        return d_eff * d_eff

    elif shape == SHAPE_ELLIPSE:
        # already handled by aspect ratio above
        d2 = lx*lx + ly*ly
        return d2

    elif shape == SHAPE_SUPER:
        # superellipse: (|x/r|^p + |y/r|^p)^(2/p)
        p = power
        ax = abs(lx / r) if r > 0 else 0
        ay = abs(ly / r) if r > 0 else 0
        # clamp to prevent overflow
        ax = min(ax, 10.0)
        ay = min(ay, 10.0)
        try:
            se = (ax**p + ay**p) ** (2.0/p)
        except (OverflowError, ValueError):
            se = 100.0
        return se * r * r

    elif shape == SHAPE_ASYM:
        # asymmetric: different falloff on +x vs -x side
        asym_factor = 1.6  # steeper on one side
        if lx > 0:
            lx *= asym_factor
        d2 = lx*lx + ly*ly
        return d2

    return lx*lx + ly*ly


def make_hill(cx, cy, r, pk, rng):
    """Create a hill tuple with random shape parameters."""
    shape = rng.choices(
        [SHAPE_CIRCLE, SHAPE_POLYGON, SHAPE_ELLIPSE, SHAPE_SUPER, SHAPE_ASYM],
        weights=[3, 4, 3, 3, 2],  # polygons slightly favoured
    )[0]
    rotation = rng.uniform(0, _TAU)
    aspect = 1.0
    sides = 4
    power = 2.0

    if shape == SHAPE_POLYGON:
        sides = rng.randint(3, 8)
        aspect = rng.uniform(0.8, 1.2)  # slight stretch allowed
    elif shape == SHAPE_ELLIPSE:
        aspect = rng.uniform(1.5, 3.0)  # noticeably elongated
    elif shape == SHAPE_SUPER:
        power = rng.uniform(3.0, 6.0)   # 3=rounded rect, 6=nearly square
        aspect = rng.uniform(0.7, 1.4)
    elif shape == SHAPE_ASYM:
        aspect = rng.uniform(0.9, 1.5)

    return (cx, cy, r, pk, shape, rotation, aspect, sides, power)


def heightmap(w, h, hills):
    g = [[0.0]*w for _ in range(h)]
    for hill in hills:
        cx, cy, r, pk = hill[0], hill[1], hill[2], hill[3]
        r2 = 2.0*r*r
        reach = 3.0 * r * (hill[6] if len(hill) > 6 else 1.0)  # aspect extends reach
        y0, y1 = max(0, int(cy-reach)), min(h, int(cy+reach)+1)
        x0, x1 = max(0, int(cx-reach)), min(w, int(cx+reach)+1)

        if len(hill) > 4:
            # shaped hill
            for y in range(y0, y1):
                for x in range(x0, x1):
                    d2 = _shaped_distance(x - cx, y - cy, hill)
                    g[y][x] += pk * math.exp(-d2 / r2)
        else:
            # legacy 4-tuple: plain circle
            for y in range(y0, y1):
                dy2 = (y - cy)**2
                for x in range(x0, x1):
                    g[y][x] += pk * math.exp(-((x-cx)**2 + dy2) / r2)

    lo = min(v for row in g for v in row)
    hi = max(v for row in g for v in row)
    if hi - lo < 1e-9:
        return g
    s = 1.0 / (hi - lo)
    for y in range(h):
        for x in range(w):
            g[y][x] = (g[y][x] - lo) * s
    return g


def march(g, h, w, thr):
    rows = []
    for y in range(h-1):
        row = []
        for x in range(w-1):
            idx = 0
            if g[y][x]     >= thr: idx |= 8
            if g[y][x+1]   >= thr: idx |= 4
            if g[y+1][x+1] >= thr: idx |= 2
            if g[y+1][x]   >= thr: idx |= 1
            row.append(MS[idx])
        rows.append(row)
    return rows


def composite(layers):
    rh, rw = len(layers[0]), len(layers[0][0])
    canvas = [[' ']*rw for _ in range(rh)]
    for layer in layers:
        for y in range(rh):
            for x in range(rw):
                if layer[y][x] != ' ':
                    canvas[y][x] = layer[y][x]
    return canvas


# ── terrain generators ────────────────────────────────────

def t_archipelago(w, h, rng):
    hills = []
    for _ in range(rng.randint(6, 12)):
        hills.append(make_hill(rng.uniform(w*0.05, w*0.95), rng.uniform(h*0.05, h*0.95),
                       rng.uniform(min(w,h)*0.04, min(w,h)*0.12), rng.uniform(0.3, 1.0), rng))
    return hills

def t_saddle_pass(w, h, rng):
    gap = rng.uniform(w*0.20, w*0.35)
    cx, cy = w*0.5, h*0.5
    r = min(w,h)*0.18
    hills = [make_hill(cx-gap*0.5, cy-h*0.05, r, 1.0, rng),
             make_hill(cx+gap*0.5, cy+h*0.05, r*0.9, 0.85, rng)]
    for _ in range(rng.randint(2, 5)):
        a = rng.uniform(0, _TAU)
        d = rng.uniform(r*0.8, r*2.0)
        hills.append(make_hill(cx+math.cos(a)*d, cy+math.sin(a)*d,
                       rng.uniform(min(w,h)*0.03, min(w,h)*0.07), rng.uniform(0.15, 0.4), rng))
    return hills

def t_ridge_valley(w, h, rng):
    hills = []
    ry = h * rng.uniform(0.3, 0.5)
    for i in range(8):
        x = w*(i+0.5)/8
        hills.append(make_hill(x, ry+rng.gauss(0, h*0.03),
                       rng.uniform(min(w,h)*0.08, min(w,h)*0.14), rng.uniform(0.6, 1.0), rng))
    ry2 = h * rng.uniform(0.65, 0.8)
    for i in range(5):
        x = w*(i+0.5)/5
        hills.append(make_hill(x, ry2+rng.gauss(0, h*0.02),
                       rng.uniform(min(w,h)*0.05, min(w,h)*0.10), rng.uniform(0.3, 0.6), rng))
    return hills

def t_caldera(w, h, rng):
    cx, cy = w*0.5, h*0.5
    rim_r = min(w,h) * rng.uniform(0.20, 0.30)
    n = rng.randint(6, 10)
    hills = []
    for i in range(n):
        a = _TAU*i/n + rng.gauss(0, 0.2)
        hills.append(make_hill(cx+math.cos(a)*rim_r, cy+math.sin(a)*rim_r,
                       rng.uniform(min(w,h)*0.06, min(w,h)*0.12), rng.uniform(0.6, 1.0), rng))
    hills.append(make_hill(cx+rng.gauss(0,2), cy+rng.gauss(0,2), min(w,h)*0.04, 0.5, rng))
    return hills

def t_lone_peak(w, h, rng):
    cx = w*rng.uniform(0.35, 0.65)
    cy = h*rng.uniform(0.35, 0.65)
    r = min(w,h)*0.20
    hills = [make_hill(cx, cy, r, 1.0, rng)]
    for _ in range(rng.randint(4, 8)):
        a = rng.uniform(0, _TAU)
        d = rng.uniform(r*0.6, r*2.5)
        hills.append(make_hill(cx+math.cos(a)*d, cy+math.sin(a)*d,
                       rng.uniform(min(w,h)*0.03, min(w,h)*0.08), rng.uniform(0.15, 0.45), rng))
    return hills

def t_meadow(w, h, rng):
    hills = []
    for _ in range(rng.randint(5, 9)):
        hills.append(make_hill(rng.uniform(w*0.05, w*0.95), rng.uniform(h*0.05, h*0.95),
                       rng.uniform(min(w,h)*0.10, min(w,h)*0.25), rng.uniform(0.3, 0.8), rng))
    for _ in range(rng.randint(1, 3)):
        hills.append(make_hill(rng.uniform(w*0.1, w*0.9), rng.uniform(h*0.1, h*0.9),
                       rng.uniform(min(w,h)*0.04, min(w,h)*0.08), rng.uniform(0.6, 1.0), rng))
    return hills

def t_twins(w, h, rng):
    sep = rng.uniform(w*0.15, w*0.30)
    cx, cy = w*0.5, h*0.5
    r1 = rng.uniform(min(w,h)*0.12, min(w,h)*0.20)
    r2 = rng.uniform(min(w,h)*0.10, min(w,h)*0.18)
    hills = [make_hill(cx-sep*0.5, cy, r1, 1.0, rng),
             make_hill(cx+sep*0.5, cy, r2, rng.uniform(0.7, 0.95), rng)]
    for _ in range(rng.randint(3, 6)):
        a = rng.uniform(0, _TAU)
        d = rng.uniform(sep*0.3, sep*1.5)
        hills.append(make_hill(cx+math.cos(a)*d, cy+math.sin(a)*d,
                       rng.uniform(min(w,h)*0.03, min(w,h)*0.07), rng.uniform(0.2, 0.5), rng))
    return hills


TERRAINS = [
    ('archipelago',  t_archipelago),
    ('saddle pass',  t_saddle_pass),
    ('ridge valley', t_ridge_valley),
    ('caldera',      t_caldera),
    ('lone peak',    t_lone_peak),
    ('meadow',       t_meadow),
    ('twin peaks',   t_twins),
]


# ── ordered grid engine ──────────────────────────────────
# Binary 0/1 grids placed using same hill algorithms as contours.
# Hill radius → cluster size, peak → cell density.
# Box-drawing chars: ┌─┬─┐ │0│1│ ├─┼─┤ └─┴─┘

# Grid content patterns
GRID_CHECKER = 0    # alternating 0/1
GRID_RANDOM  = 1    # random bits
GRID_SEQ     = 2    # sequential 0-9 then A-F
GRID_HEX     = 3    # random hex values

def _grid_cell(row, col, pattern, rng):
    """Return a single char for grid cell at (row, col)."""
    if pattern == GRID_CHECKER:
        return '1' if (row + col) % 2 else '0'
    elif pattern == GRID_RANDOM:
        return str(rng.randint(0, 1))
    elif pattern == GRID_SEQ:
        return "0123456789ABCDEF"[(row * 16 + col) % 16]
    elif pattern == GRID_HEX:
        return "0123456789ABCDEF"[rng.randint(0, 15)]
    return '0'

def render_grid_cluster(canvas, cx, cy, radius, density, cell_size,
                        pattern, rng):
    """Stamp a box-drawing grid cluster onto canvas.
    
    radius: approximate half-width/height of grid area
    density: 0.0-1.0, fraction of cells filled (vs empty)
    cell_size: 1, 2, or 3 chars per cell content
    """
    ch = len(canvas)
    cw = len(canvas[0]) if ch > 0 else 0
    
    # Grid cell metrics: each cell = cell_size content + 1 border
    step = cell_size + 1  # e.g. cell_size=1 → step=2 (│x│)
    
    # How many grid cells fit in the radius
    gcols = max(2, int(2 * radius / step))
    grows = max(2, int(2 * radius / (step * 0.5)))  # rows are half-height
    
    # Top-left corner of grid
    gx0 = int(cx - (gcols * step + 1) / 2)
    gy0 = int(cy - grows)
    
    # Render the grid
    for gr in range(grows + 1):
        y = gy0 + gr * 2  # each grid row = 2 screen rows (border + content)
        if y < 0 or y >= ch:
            continue
            
        # Border row: ┌─┬─┐ or ├─┼─┤ or └─┴─┘
        for gc in range(gcols + 1):
            x = gx0 + gc * step
            if x < 0 or x >= cw:
                continue
            
            # Corner/junction char
            if gr == 0 and gc == 0:       c = '┌'
            elif gr == 0 and gc == gcols: c = '┐'
            elif gr == grows and gc == 0:  c = '└'
            elif gr == grows and gc == gcols: c = '┘'
            elif gr == 0:                  c = '┬'
            elif gr == grows:              c = '┴'
            elif gc == 0:                  c = '├'
            elif gc == gcols:              c = '┤'
            else:                          c = '┼'
            canvas[y][x] = c
            
            # Horizontal border between corners
            if gc < gcols:
                for dx in range(1, step):
                    bx = x + dx
                    if 0 <= bx < cw:
                        canvas[y][bx] = '─'
        
        # Content row (between border rows)
        if gr < grows:
            cy_row = y + 1
            if cy_row < 0 or cy_row >= ch:
                continue
            for gc in range(gcols + 1):
                x = gx0 + gc * step
                if 0 <= x < cw:
                    canvas[cy_row][x] = '│'
            
            # Fill cell content
            for gc in range(gcols):
                if rng.random() > density:
                    continue  # skip cell (sparse)
                for dx in range(1, step):
                    cx_pos = gx0 + gc * step + dx
                    if 0 <= cx_pos < cw and 0 <= cy_row < ch:
                        canvas[cy_row][cx_pos] = _grid_cell(gr, gc * cell_size + dx - 1, pattern, rng)


def generate_ordered(w, h, seed, terrain_idx):
    """Generate ordered grid map using same hill placement as terrain.
    Returns list of strings."""
    rng = random.Random(seed)
    _, gen = TERRAINS[terrain_idx % len(TERRAINS)]
    hills = gen(w, h, rng)
    
    canvas = [[' '] * max(1, w - 1) for _ in range(max(1, h - 1))]
    
    # Use hill positions/sizes to place grid clusters
    grid_rng = random.Random(seed + 7777)
    patterns = [GRID_CHECKER, GRID_RANDOM, GRID_SEQ, GRID_HEX]
    
    for hill in hills:
        cx, cy, r, pk = hill[0], hill[1], hill[2], hill[3]
        pattern = grid_rng.choice(patterns)
        cell_size = grid_rng.choice([1, 1, 1, 2])  # mostly 1-char cells
        density = 0.3 + pk * 0.6  # higher peak = denser grid
        render_grid_cluster(canvas, int(cx), int(cy), r, density,
                           cell_size, pattern, grid_rng)
    
    return [''.join(row) for row in canvas]


def generate_hybrid(w, h, n_levels, seed, terrain_idx, order_ratio=0.5):
    """Hybrid chaos+order: contours where height varies, grids where flat.
    order_ratio: 0.0 = all contours, 1.0 = all grids.
    Returns list of strings."""
    rng = random.Random(seed)
    _, gen = TERRAINS[terrain_idx % len(TERRAINS)]
    hills = gen(w, h, rng)
    
    # Generate heightmap
    g = heightmap(w, h, hills)
    
    # Contour layer
    thresholds = [(i+1)/(n_levels+1) for i in range(n_levels)]
    layers = [march(g, h, w, t) for t in thresholds]
    contour_canvas = composite(layers)
    
    # Grid layer
    grid_canvas = [[' '] * max(1, w - 1) for _ in range(max(1, h - 1))]
    grid_rng = random.Random(seed + 7777)
    patterns = [GRID_CHECKER, GRID_RANDOM, GRID_SEQ, GRID_HEX]
    
    for hill in hills:
        cx, cy, r, pk = hill[0], hill[1], hill[2], hill[3]
        pattern = grid_rng.choice(patterns)
        density = 0.3 + pk * 0.6
        render_grid_cluster(grid_canvas, int(cx), int(cy), r * 0.7,
                           density, 1, pattern, grid_rng)
    
    # Composite: use quantile threshold to split zones
    # Flatten heights, find the cutoff
    flat = sorted(v for row in g for v in row)
    cutoff_idx = int(len(flat) * order_ratio)
    cutoff = flat[min(cutoff_idx, len(flat) - 1)]
    
    # Merge: below cutoff = grid (ordered), above = contour (chaos)
    rh = min(len(contour_canvas), len(grid_canvas))
    rw = min(len(contour_canvas[0]) if contour_canvas else 0,
             len(grid_canvas[0]) if grid_canvas else 0)
    result = [[' '] * rw for _ in range(rh)]
    
    for y in range(rh):
        for x in range(rw):
            # Sample height at this point (careful with grid bounds)
            hy = min(y, len(g) - 1)
            hx = min(x, len(g[0]) - 1) if g else 0
            h_val = g[hy][hx]
            
            if h_val <= cutoff:
                # Ordered zone
                if grid_canvas[y][x] != ' ':
                    result[y][x] = grid_canvas[y][x]
                elif contour_canvas[y][x] != ' ':
                    result[y][x] = contour_canvas[y][x]
            else:
                # Chaotic zone
                if contour_canvas[y][x] != ' ':
                    result[y][x] = contour_canvas[y][x]
                elif grid_canvas[y][x] != ' ':
                    result[y][x] = grid_canvas[y][x]
    
    return [''.join(row) for row in result]


# ── rendering ─────────────────────────────────────────────

def render_from_hills(w, h, n_levels, hills):
    """Render a map from an explicit hill list. Returns list of strings."""
    if not hills:
        return [' ' * max(0, w-1) for _ in range(max(0, h-1))]
    g = heightmap(w, h, hills)
    thresholds = [(i+1)/(n_levels+1) for i in range(n_levels)]
    layers = [march(g, h, w, t) for t in thresholds]
    canvas = composite(layers)
    return [''.join(row) for row in canvas]


def generate(w, h, n_levels, seed, terrain_idx):
    """Returns list of strings (the map lines)."""
    rng = random.Random(seed)
    _, gen = TERRAINS[terrain_idx]
    hills = gen(w, h, rng)
    return render_from_hills(w, h, n_levels, hills)


def generate_triptych(tw, th, n_levels, seed, terrain_idx):
    """Three variations side by side with dividers."""
    panel_w = (tw - 4) // 3
    lines_a = generate(panel_w, th, n_levels, seed, terrain_idx)
    lines_b = generate(panel_w, th, n_levels, seed + 1, terrain_idx)
    lines_c = generate(panel_w, th, n_levels, seed + 2, terrain_idx)
    combined = []
    for i in range(min(len(lines_a), len(lines_b), len(lines_c))):
        a = lines_a[i][:panel_w].ljust(panel_w)
        b = lines_b[i][:panel_w].ljust(panel_w)
        c = lines_c[i][:panel_w].ljust(panel_w)
        combined.append(f"{a} │{b} │{c}")
    return combined


def canvas_coverage(lines):
    """Fraction of non-space cells. Used by grow mode to know when to stop."""
    total = 0
    filled = 0
    for ln in lines:
        total += len(ln)
        filled += sum(1 for c in ln if c != ' ')
    return filled / total if total > 0 else 0.0


# ── grow mode state machine ──────────────────────────────
# Pre-generates ALL hills for the terrain at init, then reveals
# them one by one. Each hill also "swells" from radius 0 to
# its target radius over a few ticks. Fixed upper bounds on
# hill count and tick count prevent runaway.

MAX_GROW_HILLS = 60          # absolute cap on hills generated
MAX_GROW_TICKS = 500         # hard stop even if coverage not met
COVERAGE_TARGET = 0.35       # stop when 35% of cells are contour chars
HILL_SWELL_TICKS = 8         # ticks for a hill to reach full size
TICK_INTERVAL = 0.08         # seconds between grow frames


class GrowState:
    """Encapsulates one grow animation run."""

    __slots__ = ('all_hills', 'active', 'tick', 'paused',
                 'done', 'w', 'h', 'n_levels', 'next_hill_tick',
                 'hill_idx', 'swell_queue', 'cached_lines',
                 'seed', 'terrain_idx', 'mode', 'order_ratio',
                 'grid_canvas', 'grid_cluster_meta')

    def __init__(self, w, h, n_levels, seed, terrain_idx,
                 mode='chaos', order_ratio=0.5):
        self.w = w
        self.h = h
        self.n_levels = n_levels
        self.seed = seed
        self.terrain_idx = terrain_idx
        self.mode = mode
        self.order_ratio = order_ratio
        self.grid_canvas = None       # persistent canvas for order modes
        self.grid_cluster_meta = []   # per-cluster state for spread mode
        self.paused = False
        self.done = False
        self.tick = 0
        self.hill_idx = 0
        self.next_hill_tick = 0
        self.cached_lines = None

        # generate the full hill set then extend with extras to fill space
        rng = random.Random(seed)
        _, gen = TERRAINS[terrain_idx]
        base_hills = gen(w, h, rng)

        # add filler hills scattered across the map
        extras = MAX_GROW_HILLS - len(base_hills)
        for _ in range(max(0, extras)):
            base_hills.append(make_hill(
                rng.uniform(w*0.02, w*0.98),
                rng.uniform(h*0.02, h*0.98),
                rng.uniform(min(w,h)*0.03, min(w,h)*0.15),
                rng.uniform(0.2, 0.8), rng,
            ))

        self.all_hills = base_hills[:MAX_GROW_HILLS]
        # active hills: list of (cx, cy, current_r, target_r, peak, swell_remaining)
        self.active = []
        # swell_queue: hills still growing
        self.swell_queue = []

    def step(self):
        """Advance one tick. Returns True if canvas changed."""
        if self.done or self.paused:
            return False

        changed = False
        self.tick += 1

        # hard stop
        if self.tick >= MAX_GROW_TICKS:
            self.done = True
            return True

        # introduce next hill?
        if self.hill_idx < len(self.all_hills) and self.tick >= self.next_hill_tick:
            src = self.all_hills[self.hill_idx]
            # src is a 9-tuple: (cx, cy, r, pk, shape, rot, aspect, sides, power)
            # entry: full hill tuple with current_r swapped in, plus swell metadata
            # We store: [hill_tuple, target_r, swell_remaining]
            target_r = src[2]
            # start with tiny radius
            start_hill = (src[0], src[1], target_r * 0.1, src[3], src[4], src[5], src[6], src[7], src[8])
            entry = [start_hill, target_r, HILL_SWELL_TICKS]
            self.active.append(entry)
            self.swell_queue.append(entry)
            self.hill_idx += 1
            self.next_hill_tick = self.tick + random.randint(2, 5)
            changed = True

        # swell growing hills
        still_swelling = []
        for entry in self.swell_queue:
            if entry[2] > 0:
                entry[2] -= 1
                t = 1.0 - (entry[2] / HILL_SWELL_TICKS)
                new_r = entry[1] * t
                h_old = entry[0]
                entry[0] = (h_old[0], h_old[1], new_r, h_old[3], h_old[4], h_old[5], h_old[6], h_old[7], h_old[8])
                changed = True
                if entry[2] > 0:
                    still_swelling.append(entry)
        self.swell_queue = still_swelling

        # render if changed
        if changed:
            hills_for_render = [e[0] for e in self.active]
            if self.mode == 'order':
                self.cached_lines = self._render_ordered(hills_for_render)
            elif self.mode == 'order-spread':
                self.cached_lines = self._render_ordered_spread(hills_for_render)
            elif self.mode == 'hybrid':
                self.cached_lines = self._render_hybrid(hills_for_render)
            else:
                self.cached_lines = render_from_hills(self.w, self.h, self.n_levels, hills_for_render)

            # check coverage
            cov = canvas_coverage(self.cached_lines)
            if cov >= COVERAGE_TARGET and len(self.swell_queue) == 0:
                # all current hills done swelling and coverage met
                self.done = True
            # also stop if we've used all hills and nothing is swelling
            if self.hill_idx >= len(self.all_hills) and len(self.swell_queue) == 0:
                self.done = True

        return changed

    def get_lines(self):
        if self.cached_lines is None:
            return [' ' * max(0, self.w - 1) for _ in range(max(0, self.h - 1))]
        return self.cached_lines

    def status_text(self):
        cov = canvas_coverage(self.get_lines()) if self.cached_lines else 0.0
        state = 'DONE' if self.done else ('PAUSED' if self.paused else 'GROWING')
        return (f"{state}  hills:{len(self.active)}/{len(self.all_hills)}"
                f"  coverage:{cov:.0%}  tick:{self.tick}/{MAX_GROW_TICKS}")

    def _render_ordered(self, hills):
        """Order mode: re-render all active grids from scratch each frame.
        Grids change shape as hills swell — the original behavior."""
        canvas = [[' '] * max(1, self.w - 1) for _ in range(max(1, self.h - 1))]
        grid_rng = random.Random(self.seed + 7777)
        patterns = [GRID_CHECKER, GRID_RANDOM, GRID_SEQ, GRID_HEX]
        for hill in hills:
            cx, cy, r, pk = hill[0], hill[1], hill[2], hill[3]
            pattern = grid_rng.choice(patterns)
            cell_size = grid_rng.choice([1, 1, 1, 2])
            density = 0.3 + pk * 0.6
            render_grid_cluster(canvas, int(cx), int(cy), r, density,
                               cell_size, pattern, grid_rng)
        return [''.join(row) for row in canvas]

    def _render_ordered_spread(self, hills):
        """Order Spread: global grid floods outward from hill centres.
        One big aligned grid. Cells turn on via flood fill with jagged
        organic edges. Values locked once placed. Like the primer."""
        w, h = self.w, self.h
        cw = max(1, w - 1)
        ch = max(1, h - 1)

        # Global grid cell coordinates: each cell = 2 screen cols, 2 screen rows
        # (│X│ = col 0=border, col 1=value, then next cell)
        gcols = cw // 2
        grows = ch // 2

        if self.grid_canvas is None:
            # cell_on[gy][gx] = True if cell is active
            self.grid_cluster_meta = {
                'cell_on': [[False] * gcols for _ in range(grows)],
                'cell_val': [[' '] * gcols for _ in range(grows)],
                'frontier': [],   # cells to expand from next
                'val_rng': random.Random(self.seed + 7777),
                'spread_rng': random.Random(self.seed + 3333),
                'gcols': gcols,
                'grows': grows,
            }
            self.grid_canvas = [[' '] * cw for _ in range(ch)]

            # Pre-assign all cell values deterministically
            val_rng = self.grid_cluster_meta['val_rng']
            for gy in range(grows):
                for gx in range(gcols):
                    self.grid_cluster_meta['cell_val'][gy][gx] = \
                        str((gx + gy) % 2) if val_rng.random() > 0.3 \
                        else str(val_rng.randint(0, 1))

        meta = self.grid_cluster_meta
        cell_on = meta['cell_on']
        cell_val = meta['cell_val']
        spread_rng = meta['spread_rng']

        # Seed new frontier points from newly active hills
        n_seeded = len(meta.get('seeded_hills', []))
        if not meta.get('seeded_hills'):
            meta['seeded_hills'] = []

        for i in range(n_seeded, len(hills)):
            hill = hills[i]
            # Convert hill centre to grid coords
            gx = max(0, min(gcols - 1, int(hill[0]) // 2))
            gy = max(0, min(grows - 1, int(hill[1]) // 2))
            if not cell_on[gy][gx]:
                cell_on[gy][gx] = True
                meta['frontier'].append((gx, gy))
            meta['seeded_hills'].append(i)

        # Spread: expand frontier by 1-3 cells per tick (organic/jagged)
        new_frontier = []
        cells_to_add = spread_rng.randint(3, 8)
        attempts = 0
        while meta['frontier'] and cells_to_add > 0 and attempts < 200:
            attempts += 1
            idx = spread_rng.randint(0, len(meta['frontier']) - 1)
            fx, fy = meta['frontier'][idx]

            # Pick a random neighbour
            dx, dy = spread_rng.choice([(0, -1), (0, 1), (-1, 0), (1, 0)])
            nx, ny = fx + dx, fy + dy
            if 0 <= nx < gcols and 0 <= ny < grows and not cell_on[ny][nx]:
                cell_on[ny][nx] = True
                new_frontier.append((nx, ny))
                cells_to_add -= 1

            # Remove exhausted frontier cells (all neighbours filled)
            if all(
                not (0 <= fx+ddx < gcols and 0 <= fy+ddy < grows)
                or cell_on[fy+ddy][fx+ddx]
                for ddx, ddy in [(0, -1), (0, 1), (-1, 0), (1, 0)]
            ):
                meta['frontier'].pop(idx)

        meta['frontier'].extend(new_frontier)

        # Render: stamp active cells onto canvas with box-drawing borders
        canvas = self.grid_canvas
        # Clear canvas (re-render borders based on current active cells)
        for y in range(ch):
            for x in range(cw):
                canvas[y][x] = ' '

        for gy in range(grows):
            for gx in range(gcols):
                if not cell_on[gy][gx]:
                    continue
                sx = gx * 2  # screen x
                sy = gy * 2  # screen y

                # Value cell
                vx, vy = sx + 1, sy + 1
                if 0 <= vx < cw and 0 <= vy < ch:
                    canvas[vy][vx] = cell_val[gy][gx]

                # Left border │
                if 0 <= sx < cw and 0 <= vy < ch:
                    canvas[vy][sx] = '│'
                # Right border │
                rx = sx + 2
                if 0 <= rx < cw and 0 <= vy < ch:
                    canvas[vy][rx] = '│'

                # Top border ─
                if 0 <= vx < cw and 0 <= sy < ch:
                    canvas[sy][vx] = '─'
                # Bottom border ─
                by = sy + 2
                if 0 <= vx < cw and 0 <= by < ch:
                    canvas[by][vx] = '─'

                # Corners/junctions
                for cy_, cx_ in [(sy, sx), (sy, sx+2), (sy+2, sx), (sy+2, sx+2)]:
                    if 0 <= cx_ < cw and 0 <= cy_ < ch:
                        # Determine junction type from neighbours
                        up = cy_ > 0 and canvas[cy_-1][cx_] in '│┼┤├'
                        dn = cy_+1 < ch and (
                            (cy_+1 < ch and canvas[cy_+1][cx_] in '│┼┤├') or
                            any(cell_on[g][cx_//2] for g in range(grows)
                                if g * 2 == cy_ and 0 <= cx_//2 < gcols)
                        )
                        # Simple: use ┼ for internal, corners for edges
                        canvas[cy_][cx_] = '┼'

        return [''.join(row) for row in canvas]

    def _render_hybrid(self, hills):
        """Render active hills as both contours and grids, composited."""
        w, h = self.w, self.h
        if not hills:
            return [' ' * max(0, w - 1) for _ in range(max(0, h - 1))]

        g = heightmap(w, h, hills)
        thresholds = [(i+1)/(self.n_levels+1) for i in range(self.n_levels)]
        layers = [march(g, h, w, t) for t in thresholds]
        contour_canvas = composite(layers)

        grid_canvas = [[' '] * max(1, w - 1) for _ in range(max(1, h - 1))]
        grid_rng = random.Random(self.seed + 7777)
        patterns = [GRID_CHECKER, GRID_RANDOM, GRID_SEQ, GRID_HEX]
        for hill in hills:
            cx, cy, r, pk = hill[0], hill[1], hill[2], hill[3]
            pattern = grid_rng.choice(patterns)
            density = 0.3 + pk * 0.6
            render_grid_cluster(grid_canvas, int(cx), int(cy), r * 0.7,
                               density, 1, pattern, grid_rng)

        flat = sorted(v for row in g for v in row)
        cutoff_idx = int(len(flat) * self.order_ratio)
        cutoff = flat[min(cutoff_idx, len(flat) - 1)]

        rh = min(len(contour_canvas), len(grid_canvas))
        rw = min(len(contour_canvas[0]) if contour_canvas else 0,
                 len(grid_canvas[0]) if grid_canvas else 0)
        result = [[' '] * rw for _ in range(rh)]
        for y in range(rh):
            for x in range(rw):
                hy = min(y, len(g) - 1)
                hx = min(x, len(g[0]) - 1) if g else 0
                h_val = g[hy][hx]
                if h_val <= cutoff:
                    if grid_canvas[y][x] != ' ':
                        result[y][x] = grid_canvas[y][x]
                    elif contour_canvas[y][x] != ' ':
                        result[y][x] = contour_canvas[y][x]
                else:
                    if contour_canvas[y][x] != ' ':
                        result[y][x] = contour_canvas[y][x]
                    elif grid_canvas[y][x] != ' ':
                        result[y][x] = grid_canvas[y][x]
        return [''.join(row) for row in result]


# ── file export ───────────────────────────────────────────

EXPORT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'contour_exports')


def ensure_export_dir():
    os.makedirs(EXPORT_DIR, exist_ok=True)


def export_map(lines, seed, terrain_name, n_levels, triptych=False, mode_tag=''):
    """Save to timestamped file. Returns filename."""
    ensure_export_dir()
    ts = datetime.now().strftime('%Y%m%d_%H%M%S_%f')[:21]  # include millis
    layout = 'triptych' if triptych else 'single'
    tag = f"_{mode_tag}" if mode_tag else ''
    fname = f"contour_{ts}_s{seed}_{terrain_name.replace(' ','_')}_{layout}{tag}.txt"
    path = os.path.join(EXPORT_DIR, fname)
    with open(path, 'w') as f:
        f.write(f"Contour Map — {terrain_name} — seed {seed} — {n_levels} levels{' — '+mode_tag if mode_tag else ''}\n")
        f.write(f"Generated {datetime.now().isoformat()}\n")
        f.write('─' * 60 + '\n\n')
        for ln in lines:
            f.write(ln + '\n')
        f.write('\n')
    return fname


def export_batch(tw, th, n_levels, seed):
    """Export all terrains for this seed. Returns list of filenames."""
    ensure_export_dir()
    fnames = []
    for i, (name, _) in enumerate(TERRAINS):
        lines = generate(tw, th, n_levels, seed, i)
        fn = export_map(lines, seed, name, n_levels)
        fnames.append(fn)
    return fnames


# ── curses TUI ────────────────────────────────────────────

def main(stdscr):
    curses.curs_set(0)
    curses.use_default_colors()

    has_color = curses.has_colors()
    if has_color:
        curses.init_pair(1, curses.COLOR_BLACK, curses.COLOR_WHITE)
        curses.init_pair(2, curses.COLOR_GREEN, -1)
        curses.init_pair(3, curses.COLOR_YELLOW, -1)
        curses.init_pair(4, curses.COLOR_CYAN, -1)

    seed = random.randint(0, 99999)
    terrain_idx = 5  # meadow default
    n_levels = 5
    triptych = False
    grow_mode = False
    grow_state = None  # type: GrowState | None
    status_msg = ''
    status_time = 0
    needs_redraw = True
    last_grow_time = 0.0

    cached_lines = None
    cached_key = None

    stdscr.timeout(40)  # 25fps tick for grow mode

    while True:
        h, w = stdscr.getmaxyx()
        map_h = h - 3
        map_w = w - 2

        # ── generate / animate ────────────────────────
        if grow_mode:
            # init grow state if needed
            if grow_state is None or grow_state.w != map_w or grow_state.h != map_h:
                grow_state = GrowState(map_w, map_h, n_levels, seed, terrain_idx)
                needs_redraw = True

            now = time.time()
            if now - last_grow_time >= TICK_INTERVAL:
                if grow_state.step():
                    needs_redraw = True
                last_grow_time = now

            display_lines = grow_state.get_lines()
        else:
            # static mode
            cache_key = (seed, terrain_idx, n_levels, triptych, map_w, map_h)
            if cache_key != cached_key:
                if triptych:
                    cached_lines = generate_triptych(map_w, map_h, n_levels, seed, terrain_idx)
                else:
                    cached_lines = generate(map_w, map_h, n_levels, seed, terrain_idx)
                cached_key = cache_key
                needs_redraw = True
            display_lines = cached_lines

        # ── draw ──────────────────────────────────────
        if needs_redraw and display_lines:
            stdscr.erase()

            # title bar
            tname = TERRAINS[terrain_idx][0].upper()
            if grow_mode and grow_state:
                title = f" CONTOUR STUDIO │ {tname} │ seed {seed} │ {n_levels} lvl │ {grow_state.status_text()} "
            else:
                seeds_str = f"seeds {seed},{seed+1},{seed+2}" if triptych else f"seed {seed}"
                title = f" CONTOUR STUDIO │ {tname} │ {seeds_str} │ {n_levels} levels "
                if triptych:
                    title += "│ TRIPTYCH "
            title = title[:w-1]
            if has_color:
                stdscr.attron(curses.color_pair(1))
            try:
                stdscr.addstr(0, 0, title.ljust(w-1))
            except curses.error:
                pass
            if has_color:
                stdscr.attroff(curses.color_pair(1))

            # map area
            for i, ln in enumerate(display_lines[:map_h]):
                try:
                    stdscr.addstr(i + 1, 1, ln[:map_w])
                except curses.error:
                    pass

            # status bar
            bar_y = h - 2
            if grow_mode:
                keys = "r:new  1-7:terrain  +/-:levels  SPACE:pause  g:static  s:save  q:quit"
            else:
                keys = "r:random  1-7:terrain  TAB:cycle  +/-:levels  t:triptych  g:grow  s:save  a:batch  q:quit"
            if has_color:
                stdscr.attron(curses.color_pair(1))
            try:
                stdscr.addstr(bar_y, 0, keys[:w-1].ljust(w-1))
            except curses.error:
                pass
            if has_color:
                stdscr.attroff(curses.color_pair(1))

            # flash message
            if status_msg and time.time() - status_time < 3:
                msg_y = h - 1
                if has_color:
                    stdscr.attron(curses.color_pair(2) | curses.A_BOLD)
                try:
                    stdscr.addstr(msg_y, 1, status_msg[:w-2])
                except curses.error:
                    pass
                if has_color:
                    stdscr.attroff(curses.color_pair(2) | curses.A_BOLD)

            stdscr.refresh()
            needs_redraw = False

        # clear flash
        if status_msg and time.time() - status_time >= 3:
            status_msg = ''
            needs_redraw = True

        # ── input ─────────────────────────────────────
        try:
            k = stdscr.getch()
        except curses.error:
            continue

        if k == -1:
            continue

        if k in (ord('q'), ord('Q'), 27):
            break

        elif k == ord('r'):
            seed = random.randint(0, 99999)
            grow_state = None
            cached_key = None
            needs_redraw = True

        elif k == ord('g'):
            grow_mode = not grow_mode
            grow_state = None
            cached_key = None
            status_msg = 'GROW MODE' if grow_mode else 'STATIC MODE'
            status_time = time.time()
            needs_redraw = True

        elif k == ord(' '):
            if grow_mode and grow_state:
                grow_state.paused = not grow_state.paused
                status_msg = 'PAUSED' if grow_state.paused else 'RESUMED'
                status_time = time.time()
                needs_redraw = True

        elif k == ord('t') and not grow_mode:
            triptych = not triptych
            cached_key = None
            status_msg = 'TRIPTYCH ON' if triptych else 'TRIPTYCH OFF'
            status_time = time.time()
            needs_redraw = True

        elif k == ord('+') or k == ord('='):
            n_levels = min(12, n_levels + 1)
            grow_state = None
            cached_key = None
            needs_redraw = True

        elif k == ord('-') or k == ord('_'):
            n_levels = max(2, n_levels - 1)
            grow_state = None
            cached_key = None
            needs_redraw = True

        elif k == 9:  # TAB
            terrain_idx = (terrain_idx + 1) % len(TERRAINS)
            seed = random.randint(0, 99999)  # fresh seed on cycle
            grow_state = None
            cached_key = None
            needs_redraw = True

        elif k == curses.KEY_BTAB:
            terrain_idx = (terrain_idx - 1) % len(TERRAINS)
            seed = random.randint(0, 99999)
            grow_state = None
            cached_key = None
            needs_redraw = True

        elif ord('1') <= k <= ord('7'):
            terrain_idx = k - ord('1')
            seed = random.randint(0, 99999)  # fresh seed each press
            grow_state = None
            cached_key = None
            needs_redraw = True

        elif k == ord('s'):
            tname = TERRAINS[terrain_idx][0]
            lines = display_lines if display_lines else []
            tag = 'grow' if grow_mode else ''
            fn = export_map(lines, seed, tname, n_levels, triptych, mode_tag=tag)
            status_msg = f'SAVED: {fn}'
            status_time = time.time()
            needs_redraw = True

        elif k == ord('a') and not grow_mode:
            fnames = export_batch(map_w, map_h, n_levels, seed)
            status_msg = f'BATCH SAVED: {len(fnames)} files to contour_exports/'
            status_time = time.time()
            needs_redraw = True

        elif k == curses.KEY_LEFT:
            seed = max(0, seed - 1)
            grow_state = None
            cached_key = None
            needs_redraw = True

        elif k == curses.KEY_RIGHT:
            seed += 1
            grow_state = None
            cached_key = None
            needs_redraw = True

        elif k == curses.KEY_RESIZE:
            grow_state = None
            cached_key = None
            needs_redraw = True


if __name__ == '__main__':
    if '--batch' in sys.argv:
        sys.argv.remove('--batch')
        seed = int(sys.argv[1]) if len(sys.argv) > 1 else random.randint(0, 99999)
        bw = int(sys.argv[2]) if len(sys.argv) > 2 else 100
        bh = int(sys.argv[3]) if len(sys.argv) > 3 else 35
        n = 5
        print(f"Batch export: seed={seed}  {bw}x{bh}  {n} levels")
        print(f"Output dir: {EXPORT_DIR}")
        print()
        for i, (name, _) in enumerate(TERRAINS):
            lines = generate(bw, bh, n, seed, i)
            fn = export_map(lines, seed, name, n)
            print(f"  {fn}")
        for i, (name, _) in enumerate(TERRAINS):
            lines = generate_triptych(bw, bh, n, seed, i)
            fn = export_map(lines, seed, name, n, triptych=True)
            print(f"  {fn}")
        print(f"\nDone. {len(TERRAINS)*2} files written.")

    elif '--preview' in sys.argv:
        sys.argv.remove('--preview')
        seed = int(sys.argv[1]) if len(sys.argv) > 1 else random.randint(0, 99999)
        bw = int(sys.argv[2]) if len(sys.argv) > 2 else 100
        bh = int(sys.argv[3]) if len(sys.argv) > 3 else 30
        for i, (name, _) in enumerate(TERRAINS):
            print(f"\n {'─'*10} {name.upper()} seed={seed} {'─'*10}")
            for ln in generate(bw, bh, 5, seed, i):
                print(ln)

    elif '--grow-test' in sys.argv:
        # non-interactive grow test: run to completion and print final state
        sys.argv.remove('--grow-test')
        seed = int(sys.argv[1]) if len(sys.argv) > 1 else random.randint(0, 99999)
        bw = int(sys.argv[2]) if len(sys.argv) > 2 else 80
        bh = int(sys.argv[3]) if len(sys.argv) > 3 else 30
        tidx = int(sys.argv[4]) if len(sys.argv) > 4 else 5  # meadow
        gs = GrowState(bw, bh, 5, seed, tidx)
        while not gs.done:
            gs.step()
        print(f"Grow complete: {gs.status_text()}")
        print()
        for ln in gs.get_lines():
            print(ln)

    else:
        os.environ.setdefault('ESCDELAY', '25')
        curses.wrapper(main)
