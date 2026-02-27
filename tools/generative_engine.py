#!/usr/bin/env python3
"""
Generative Lab engine — substrate-agnostic cellular automata / generative systems.

Core concepts:
  Cell:      state (int), age (int), value (str for display)
  Grid:      2D array of Cells
  Substrate: renderer that converts cell state → display char + borders
  Rule:      pure function (grid, params, rng, tick) → grid (mutates in-place)
  Preset:    named bundle of substrate + seeder + rules + params
  Snapshot:  full reproducible state: seed, preset, tick, rule params → YAML

Every run is fully reproducible from its snapshot YAML.
"""

import math
import random
import copy
import json
import yaml
import time
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Callable, Tuple


# ── Cell & Grid ───────────────────────────────────────────

@dataclass
class Cell:
    state: int = 0       # 0=dead, 1+=alive variants
    age: int = 0         # ticks since birth
    value: str = ' '     # display character (set by substrate)

    def alive(self) -> bool:
        return self.state > 0

    def copy(self) -> 'Cell':
        return Cell(self.state, self.age, self.value)


class Grid:
    """2D grid of Cells with wrap-around neighbour access."""

    def __init__(self, w: int, h: int):
        self.w = w
        self.h = h
        self.cells: List[List[Cell]] = [[Cell() for _ in range(w)] for _ in range(h)]
        self.locked: set = set()  # (x, y) coords that rules cannot modify

    def get(self, x: int, y: int) -> Cell:
        return self.cells[y % self.h][x % self.w]

    def set_state(self, x: int, y: int, state: int):
        c = self.cells[y % self.h][x % self.w]
        if state > 0 and c.state == 0:
            c.age = 0  # just born
        c.state = state

    def neighbours(self, x: int, y: int, wrap: bool = True) -> int:
        """Count alive Moore neighbours (8-connected)."""
        count = 0
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dx == 0 and dy == 0:
                    continue
                nx, ny = x + dx, y + dy
                if wrap:
                    nx, ny = nx % self.w, ny % self.h
                elif not (0 <= nx < self.w and 0 <= ny < self.h):
                    continue
                if self.cells[ny][nx].state > 0:
                    count += 1
        return count

    def neighbours4(self, x: int, y: int, wrap: bool = False) -> int:
        """Count alive von Neumann neighbours (4-connected)."""
        count = 0
        for dx, dy in [(0, -1), (0, 1), (-1, 0), (1, 0)]:
            nx, ny = x + dx, y + dy
            if wrap:
                nx, ny = nx % self.w, ny % self.h
            elif not (0 <= nx < self.w and 0 <= ny < self.h):
                continue
            if self.cells[ny][nx].state > 0:
                count += 1
        return count

    def alive_count(self) -> int:
        return sum(1 for row in self.cells for c in row if c.state > 0)

    def coverage(self) -> float:
        total = self.w * self.h
        return self.alive_count() / total if total > 0 else 0.0

    def age_tick(self):
        """Increment age for all alive cells."""
        for row in self.cells:
            for c in row:
                if c.state > 0:
                    c.age += 1

    def stamp_text(self, text: str, ox: int, oy: int, locked: bool = True):
        """Stamp ASCII art text onto grid. Non-space chars become alive cells.
        If locked=True, these cells are immune to all rules.
        Lines starting with # are skipped (internal-facing descriptions)."""
        lines = text.split('\n')
        dy = 0
        for line in lines:
            stripped = line.lstrip()
            if stripped.startswith('#'):
                continue  # skip comment lines
            for dx, ch in enumerate(line):
                if ch == ' ':
                    continue
                x, y = ox + dx, oy + dy
                if 0 <= x < self.w and 0 <= y < self.h:
                    self.cells[y][x].state = 1
                    self.cells[y][x].value = ch
                    self.cells[y][x].age = 0
                    if locked:
                        self.locked.add((x, y))
            dy += 1

    def stamp_text_fit(self, text: str, ox: int, oy: int, locked: bool = True):
        """Stamp ASCII art, auto-shrinking to fit the grid if too large.
        Samples every Nth character/line to preserve structure."""
        lines = []
        for line in text.split('\n'):
            stripped = line.lstrip()
            if stripped.startswith('#'):
                continue
            lines.append(line)

        if not lines:
            return

        art_w = max(len(l) for l in lines)
        art_h = len(lines)
        avail_w = self.w - max(ox, 0)
        avail_h = self.h - max(oy, 0)

        if art_w <= avail_w and art_h <= avail_h:
            # Fits already — stamp normally
            self.stamp_text(text, ox, oy, locked)
            return

        # Scale factor: sample every Nth col/row
        sx = max(1, (art_w + avail_w - 1) // avail_w)
        sy = max(1, (art_h + avail_h - 1) // avail_h)

        dy = 0
        for row_i in range(0, art_h, sy):
            line = lines[row_i]
            dx = 0
            for col_i in range(0, len(line), sx):
                ch = line[col_i]
                if ch == ' ':
                    dx += 1
                    continue
                x, y = ox + dx, oy + dy
                if 0 <= x < self.w and 0 <= y < self.h:
                    self.cells[y][x].state = 1
                    self.cells[y][x].value = ch
                    self.cells[y][x].age = 0
                    if locked:
                        self.locked.add((x, y))
                dx += 1
            dy += 1

    def stamp_file(self, path: str, ox: int, oy: int, locked: bool = True,
                   auto_fit: bool = False):
        """Load ASCII art from file and stamp onto grid.
        If auto_fit=True, large art is sampled down to fit."""
        with open(path, 'r') as f:
            text = f.read()
        if auto_fit:
            self.stamp_text_fit(text, ox, oy, locked)
        else:
            self.stamp_text(text, ox, oy, locked)

    def deep_copy(self) -> 'Grid':
        g = Grid(self.w, self.h)
        g.locked = set(self.locked)
        for y in range(self.h):
            for x in range(self.w):
                src = self.cells[y][x]
                g.cells[y][x] = Cell(src.state, src.age, src.value)
        return g


# ── Substrates (renderers) ────────────────────────────────

def substrate_binary(grid: Grid, rng: random.Random) -> List[str]:
    """Render as 0/1 grid with box-drawing borders. Like the primer.
    Locked (stamped) cells render their original character directly
    onto the canvas without grid borders — the art sits 'on top'."""
    w, h = grid.w, grid.h
    # Each cell = 2 screen cols (│X), 2 screen rows (─ + content)
    sw = w * 2 + 1
    sh = h * 2 + 1
    canvas = [[' '] * sw for _ in range(sh)]

    for gy in range(h):
        for gx in range(w):
            if not grid.cells[gy][gx].alive():
                continue
            # Skip grid rendering for locked cells — they render raw below
            if (gx, gy) in grid.locked:
                continue

            sx = gx * 2
            sy = gy * 2

            # Value
            canvas[sy + 1][sx + 1] = grid.cells[gy][gx].value or str(
                (gx + gy) % 2)

            # Borders — only draw where adjacent to active cells
            # Left │
            canvas[sy + 1][sx] = '│'
            # Right │
            if sx + 2 < sw:
                canvas[sy + 1][sx + 2] = '│'
            # Top ─
            canvas[sy][sx + 1] = '─'
            # Bottom ─
            if sy + 2 < sh:
                canvas[sy + 2][sx + 1] = '─'
            # Corners ┼
            canvas[sy][sx] = '┼'
            if sx + 2 < sw:
                canvas[sy][sx + 2] = '┼'
            if sy + 2 < sh:
                canvas[sy + 2][sx] = '┼'
                if sx + 2 < sw:
                    canvas[sy + 2][sx + 2] = '┼'

    # Overlay locked (stamped) cells directly — raw character, no grid
    for (lx, ly) in grid.locked:
        if 0 <= lx < w and 0 <= ly < h and grid.cells[ly][lx].alive():
            # Map grid coord to screen coord (centre of cell)
            sx = lx * 2 + 1
            sy = ly * 2 + 1
            if 0 <= sx < sw and 0 <= sy < sh:
                canvas[sy][sx] = grid.cells[ly][lx].value

    return [''.join(row) for row in canvas]


def substrate_block(grid: Grid, rng: random.Random) -> List[str]:
    """Render as density blocks: █▓▒░ based on neighbour count."""
    blocks = ' ░▒▓█'
    lines = []
    for y in range(grid.h):
        row = []
        for x in range(grid.w):
            c = grid.cells[y][x]
            if not c.alive():
                row.append(' ')
            elif (x, y) in grid.locked:
                row.append(c.value)  # stamped art renders raw
            else:
                n = grid.neighbours(x, y)
                idx = min(len(blocks) - 1, max(1, n // 2 + 1))
                row.append(blocks[idx])
        lines.append(''.join(row))
    return lines


def substrate_contour(grid: Grid, rng: random.Random) -> List[str]:
    """Render alive cells as contour curves via marching squares.
    Locked (stamped) cells render their original character."""
    MS = ' ╮╭─╰╮│╯╯│╭╰─╭╮ '
    lines = []
    for y in range(grid.h - 1):
        row = []
        for x in range(grid.w - 1):
            # If this cell is locked, show its raw value
            if (x, y) in grid.locked and grid.cells[y][x].alive():
                row.append(grid.cells[y][x].value)
                continue
            idx = 0
            if grid.cells[y][x].alive():     idx |= 8
            if grid.cells[y][x+1].alive():   idx |= 4
            if grid.cells[y+1][x+1].alive(): idx |= 2
            if grid.cells[y+1][x].alive():   idx |= 1
            row.append(MS[idx])
        lines.append(''.join(row))
    return lines


def substrate_glyph(grid: Grid, rng: random.Random) -> List[str]:
    """Render alive cells as assorted glyphs based on state/age."""
    glyphs_young = '·∙•◦○◎'
    glyphs_old = '●◉◈◆■□'
    lines = []
    for y in range(grid.h):
        row = []
        for x in range(grid.w):
            c = grid.cells[y][x]
            if not c.alive():
                row.append(' ')
            elif (x, y) in grid.locked:
                row.append(c.value)  # stamped art renders raw
            elif c.age < 6:
                row.append(glyphs_young[c.age % len(glyphs_young)])
            else:
                row.append(glyphs_old[min(c.age - 6, len(glyphs_old) - 1)])
        lines.append(''.join(row))
    return lines


def substrate_raw(grid: Grid, rng: random.Random) -> List[str]:
    """Render cell values directly — no borders, no transformation.
    Used for 'canvas' mode where the primer IS the grid.
    Born cells inherit a character from their nearest alive neighbour."""
    lines = []
    for y in range(grid.h):
        row = []
        for x in range(grid.w):
            c = grid.cells[y][x]
            if c.alive():
                row.append(c.value if c.value and c.value != ' ' else '.')
            else:
                row.append(' ')
        lines.append(''.join(row))
    return lines


SUBSTRATES = {
    'binary': substrate_binary,
    'block': substrate_block,
    'contour': substrate_contour,
    'glyph': substrate_glyph,
    'raw': substrate_raw,
}


# ── Seeders ───────────────────────────────────────────────

def seed_random(grid: Grid, params: Dict, rng: random.Random):
    """Activate random cells."""
    density = params.get('density', 0.3)
    state = params.get('state', 1)
    for y in range(grid.h):
        for x in range(grid.w):
            if rng.random() < density:
                grid.set_state(x, y, state)
                grid.cells[y][x].value = str((x + y) % 2)


def seed_points(grid: Grid, params: Dict, rng: random.Random):
    """Seed specific points or generated patterns."""
    method = params.get('method', 'centre')
    count = params.get('count', 1)

    if method == 'centre':
        cx, cy = grid.w // 2, grid.h // 2
        grid.set_state(cx, cy, 1)
        grid.cells[cy][cx].value = '1'
    elif method == 'golden_ratio':
        phi = (1 + math.sqrt(5)) / 2
        for i in range(count):
            x = int((i * phi * grid.w / count) % grid.w)
            y = int((i * phi * grid.h / count) % grid.h)
            grid.set_state(x, y, 1)
            grid.cells[y][x].value = str(i % 2)
    elif method == 'coords':
        for cx, cy in params.get('coords', []):
            if 0 <= cx < grid.w and 0 <= cy < grid.h:
                grid.set_state(cx, cy, 1)
                grid.cells[cy][cx].value = str((cx + cy) % 2)


def seed_edge(grid: Grid, params: Dict, rng: random.Random):
    """Seed along an edge."""
    edge = params.get('edge', 'bottom')
    density = params.get('density', 0.5)

    if edge in ('bottom', 'top'):
        y = grid.h - 1 if edge == 'bottom' else 0
        for x in range(grid.w):
            if rng.random() < density:
                grid.set_state(x, y, 1)
                grid.cells[y][x].value = str(x % 2)
    elif edge in ('left', 'right'):
        x = 0 if edge == 'left' else grid.w - 1
        for y in range(grid.h):
            if rng.random() < density:
                grid.set_state(x, y, 1)
                grid.cells[y][x].value = str(y % 2)


def seed_spiral(grid: Grid, params: Dict, rng: random.Random):
    """Seed in a spiral pattern."""
    cx = params.get('cx', grid.w // 2)
    cy = params.get('cy', grid.h // 2)
    arms = params.get('arms', 2)
    spacing = params.get('spacing', 3.0)
    points = params.get('points', 40)

    for arm in range(arms):
        offset = (math.tau / arms) * arm
        for i in range(points):
            angle = offset + i * 0.3
            r = spacing * i * 0.15
            x = int(cx + r * math.cos(angle))
            y = int(cy + r * math.sin(angle))
            if 0 <= x < grid.w and 0 <= y < grid.h:
                grid.set_state(x, y, 1)
                grid.cells[y][x].value = str(i % 2)


def seed_clusters(grid: Grid, params: Dict, rng: random.Random):
    """Seed random circular clusters."""
    n = params.get('n', 3)
    r_min = params.get('radius_min', 2)
    r_max = params.get('radius_max', 5)

    for _ in range(n):
        cx = rng.randint(r_max, grid.w - r_max - 1)
        cy = rng.randint(r_max, grid.h - r_max - 1)
        r = rng.randint(r_min, r_max)
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                if dx*dx + dy*dy <= r*r:
                    x, y = cx + dx, cy + dy
                    if 0 <= x < grid.w and 0 <= y < grid.h:
                        grid.set_state(x, y, 1)
                        grid.cells[y][x].value = str((x + y) % 2)


SEEDERS = {
    'seed_random': seed_random,
    'seed_points': seed_points,
    'seed_edge': seed_edge,
    'seed_spiral': seed_spiral,
    'seed_clusters': seed_clusters,
}


# ── Rules ─────────────────────────────────────────────────

def _inherit_char(grid: Grid, x: int, y: int, rng: random.Random,
                  palette: Optional[List[str]] = None) -> str:
    """Pick a character from alive Moore neighbours. Falls back to
    palette (if canvas mode) or checkerboard."""
    chars = []
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if dx == 0 and dy == 0:
                continue
            nx, ny = (x + dx) % grid.w, (y + dy) % grid.h
            c = grid.cells[ny][nx]
            if c.alive() and c.value and c.value.strip():
                chars.append(c.value)
    if chars:
        return rng.choice(chars)
    if palette:
        return rng.choice(palette)
    return str((x + y) % 2)


def rule_grow_life(grid: Grid, params: Dict, rng: random.Random, tick: int) -> Grid:
    """Conway-style birth/survival."""
    born = set(params.get('born', [3]))
    survive = set(params.get('survive', [2, 3]))
    wrap = params.get('wrap', True)
    new = grid.deep_copy()
    for y in range(grid.h):
        for x in range(grid.w):
            n = grid.neighbours(x, y, wrap=wrap)
            if grid.cells[y][x].alive():
                if n not in survive:
                    new.cells[y][x].state = 0
                    new.cells[y][x].value = ' '
            else:
                if n in born:
                    new.set_state(x, y, 1)
                    new.cells[y][x].value = _inherit_char(grid, x, y, rng)
    return new


def rule_grow_brian(grid: Grid, params: Dict, rng: random.Random, tick: int) -> Grid:
    """Brian's Brain: 0→1 if 2 neighbours alive, 1→2 (dying), 2→0."""
    new = grid.deep_copy()
    for y in range(grid.h):
        for x in range(grid.w):
            s = grid.cells[y][x].state
            if s == 0:
                n = grid.neighbours(x, y)
                if n == 2:
                    new.set_state(x, y, 1)
                    new.cells[y][x].value = _inherit_char(grid, x, y, rng)
            elif s == 1:
                new.cells[y][x].state = 2
                new.cells[y][x].value = '0'
            elif s == 2:
                new.cells[y][x].state = 0
                new.cells[y][x].value = ' '
    return new


def rule_grow_flood(grid: Grid, params: Dict, rng: random.Random, tick: int) -> Grid:
    """Probabilistic flood fill from active cells."""
    p = params.get('p', 0.3)
    bias = params.get('bias', 'none')
    new = grid.deep_copy()

    bias_map = {'up': (0, -1), 'down': (0, 1), 'left': (-1, 0), 'right': (1, 0), 'none': (0, 0)}
    bx, by = bias_map.get(bias, (0, 0))

    for y in range(grid.h):
        for x in range(grid.w):
            if grid.cells[y][x].alive():
                for dx, dy in [(0, -1), (0, 1), (-1, 0), (1, 0)]:
                    # Bias: increase probability in biased direction
                    bp = p
                    if (dx == bx and bx != 0) or (dy == by and by != 0):
                        bp = min(1.0, p * 1.8)
                    elif (dx == -bx and bx != 0) or (dy == -by and by != 0):
                        bp = p * 0.3

                    nx, ny = x + dx, y + dy
                    if 0 <= nx < grid.w and 0 <= ny < grid.h:
                        if not grid.cells[ny][nx].alive() and rng.random() < bp:
                            new.set_state(nx, ny, 1)
                            new.cells[ny][nx].value = _inherit_char(grid, nx, ny, rng)
    return new


def rule_grow_diffuse(grid: Grid, params: Dict, rng: random.Random, tick: int) -> Grid:
    """Cells spread to random neighbours with probability."""
    rate = params.get('rate', 0.1)
    new = grid.deep_copy()
    for y in range(grid.h):
        for x in range(grid.w):
            if grid.cells[y][x].alive() and rng.random() < rate:
                dx, dy = rng.choice([(0, -1), (0, 1), (-1, 0), (1, 0),
                                     (-1, -1), (-1, 1), (1, -1), (1, 1)])
                nx, ny = x + dx, y + dy
                if 0 <= nx < grid.w and 0 <= ny < grid.h:
                    if not new.cells[ny][nx].alive():
                        new.set_state(nx, ny, 1)
                        new.cells[ny][nx].value = _inherit_char(grid, nx, ny, rng)
    return new


def rule_die_isolate(grid: Grid, params: Dict, rng: random.Random, tick: int) -> Grid:
    """Kill cells with too few neighbours."""
    min_n = params.get('min_neighbours', 1)
    new = grid.deep_copy()
    for y in range(grid.h):
        for x in range(grid.w):
            if grid.cells[y][x].alive():
                if grid.neighbours(x, y) < min_n:
                    new.cells[y][x].state = 0
                    new.cells[y][x].value = ' '
    return new


def rule_die_overcrowd(grid: Grid, params: Dict, rng: random.Random, tick: int) -> Grid:
    """Kill cells with too many neighbours."""
    max_n = params.get('max_neighbours', 6)
    new = grid.deep_copy()
    for y in range(grid.h):
        for x in range(grid.w):
            if grid.cells[y][x].alive():
                if grid.neighbours(x, y) > max_n:
                    new.cells[y][x].state = 0
                    new.cells[y][x].value = ' '
    return new


def rule_die_age(grid: Grid, params: Dict, rng: random.Random, tick: int) -> Grid:
    """Cells die after N ticks."""
    max_age = params.get('max_age', 10)
    new = grid.deep_copy()
    for y in range(grid.h):
        for x in range(grid.w):
            if grid.cells[y][x].alive() and grid.cells[y][x].age >= max_age:
                new.cells[y][x].state = 0
                new.cells[y][x].value = ' '
    return new


def rule_drift(grid: Grid, params: Dict, rng: random.Random, tick: int) -> Grid:
    """Shift all cells by (dx, dy)."""
    dx = int(params.get('dx', 0))
    dy = int(params.get('dy', 0))
    # Fractional drift: accumulate and shift when >= 1
    frac_dx = params.get('_frac_x', 0.0) + (params.get('dx', 0) - dx)
    frac_dy = params.get('_frac_y', 0.0) + (params.get('dy', 0) - dy)
    if abs(frac_dx) >= 1.0:
        dx += int(frac_dx)
        frac_dx -= int(frac_dx)
    if abs(frac_dy) >= 1.0:
        dy += int(frac_dy)
        frac_dy -= int(frac_dy)
    params['_frac_x'] = frac_dx
    params['_frac_y'] = frac_dy

    if dx == 0 and dy == 0:
        return grid

    new = Grid(grid.w, grid.h)
    for y in range(grid.h):
        for x in range(grid.w):
            if grid.cells[y][x].alive():
                nx = (x + dx) % grid.w
                ny = (y + dy) % grid.h
                new.cells[ny][nx] = grid.cells[y][x].copy()
    return new


def rule_pulse(grid: Grid, params: Dict, rng: random.Random, tick: int) -> Grid:
    """Cycle cell state through values over time."""
    period = params.get('period', 8)
    states = params.get('states', [1, 1, 0])
    new = grid.deep_copy()
    for y in range(grid.h):
        for x in range(grid.w):
            c = new.cells[y][x]
            if c.alive() or c.age > 0:
                phase = c.age % period
                idx = int(phase * len(states) / period)
                s = states[min(idx, len(states) - 1)]
                c.state = s
                c.value = str(s) if s > 0 else ' '
    return new


def rule_flip_threshold(grid: Grid, params: Dict, rng: random.Random, tick: int) -> Grid:
    """Toggle state if exactly N neighbours."""
    n = params.get('n', 3)
    new = grid.deep_copy()
    for y in range(grid.h):
        for x in range(grid.w):
            if grid.neighbours(x, y) == n:
                c = new.cells[y][x]
                if c.alive():
                    c.state = 0
                    c.value = ' '
                else:
                    c.state = 1
                    c.value = _inherit_char(grid, x, y, rng)
    return new


def rule_symmetry(grid: Grid, params: Dict, rng: random.Random, tick: int) -> Grid:
    """Mirror/rotate the grid."""
    axis = params.get('axis', 'x')
    new = grid.deep_copy()

    if axis in ('x', 'xy'):
        for y in range(grid.h):
            for x in range(grid.w // 2):
                mx = grid.w - 1 - x
                if grid.cells[y][x].alive() and not new.cells[y][mx].alive():
                    new.cells[y][mx] = grid.cells[y][x].copy()
                elif grid.cells[y][mx].alive() and not new.cells[y][x].alive():
                    new.cells[y][x] = grid.cells[y][mx].copy()

    if axis in ('y', 'xy'):
        for y in range(grid.h // 2):
            my = grid.h - 1 - y
            for x in range(grid.w):
                if new.cells[y][x].alive() and not new.cells[my][x].alive():
                    new.cells[my][x] = new.cells[y][x].copy()
                elif new.cells[my][x].alive() and not new.cells[y][x].alive():
                    new.cells[y][x] = new.cells[my][x].copy()

    if axis == 'rotate4':
        # Copy quadrant to all 4 rotations
        hw, hh = grid.w // 2, grid.h // 2
        for y in range(hh):
            for x in range(hw):
                if new.cells[y][x].alive():
                    # rotate 90, 180, 270
                    pairs = [
                        (grid.w - 1 - y, x),
                        (grid.w - 1 - x, grid.h - 1 - y),
                        (y, grid.h - 1 - x),
                    ]
                    for px, py in pairs:
                        if 0 <= px < grid.w and 0 <= py < grid.h:
                            if not new.cells[py][px].alive():
                                new.cells[py][px] = new.cells[y][x].copy()
    return new


def rule_gravity(grid: Grid, params: Dict, rng: random.Random, tick: int) -> Grid:
    """Cells fall/drift under gravity."""
    direction = params.get('direction', 'down')
    strength = params.get('strength', 1.0)

    if rng.random() > strength:
        return grid

    dmap = {'down': (0, 1), 'up': (0, -1), 'left': (-1, 0), 'right': (1, 0)}
    dx, dy = dmap.get(direction, (0, 1))

    new = Grid(grid.w, grid.h)
    # Process in reverse order of gravity direction
    yr = range(grid.h - 1, -1, -1) if dy > 0 else range(grid.h) if dy < 0 else range(grid.h)
    xr = range(grid.w - 1, -1, -1) if dx > 0 else range(grid.w) if dx < 0 else range(grid.w)

    for y in yr:
        for x in xr:
            if grid.cells[y][x].alive():
                nx, ny = x + dx, y + dy
                if 0 <= nx < grid.w and 0 <= ny < grid.h and not new.cells[ny][nx].alive():
                    new.cells[ny][nx] = grid.cells[y][x].copy()
                else:
                    new.cells[y][x] = grid.cells[y][x].copy()
    return new


def rule_branch(grid: Grid, params: Dict, rng: random.Random, tick: int) -> Grid:
    """Growth splits into branches (coral/tree)."""
    p = params.get('p', 0.3)
    angle_range = params.get('angle_range', 60)
    new = grid.deep_copy()

    for y in range(grid.h):
        for x in range(grid.w):
            if not grid.cells[y][x].alive():
                continue
            # Only branch from tips (1-2 neighbours)
            n4 = grid.neighbours4(x, y)
            if n4 > 2:
                continue
            if rng.random() > p:
                continue
            # Pick 1-2 growth directions
            branches = rng.randint(1, 2)
            for _ in range(branches):
                angle = rng.uniform(-angle_range/2, angle_range/2) * math.pi / 180
                # Base direction: away from neighbours
                dx = rng.choice([-1, 0, 1])
                dy = rng.choice([-1, 0, 1])
                if dx == 0 and dy == 0:
                    dy = -1
                nx, ny = x + dx, y + dy
                if 0 <= nx < grid.w and 0 <= ny < grid.h:
                    if not new.cells[ny][nx].alive():
                        new.set_state(nx, ny, 1)
                        new.cells[ny][nx].value = _inherit_char(grid, nx, ny, rng)
    return new


def rule_erode(grid: Grid, params: Dict, rng: random.Random, tick: int) -> Grid:
    """Randomly remove edge cells."""
    p = params.get('p', 0.05)
    new = grid.deep_copy()
    for y in range(grid.h):
        for x in range(grid.w):
            if grid.cells[y][x].alive():
                n = grid.neighbours(x, y)
                if n < 8 and rng.random() < p:  # edge cell
                    new.cells[y][x].state = 0
                    new.cells[y][x].value = ' '
    return new


def rule_smooth(grid: Grid, params: Dict, rng: random.Random, tick: int) -> Grid:
    """Average cell states with neighbours (majority rule)."""
    rounds = params.get('rounds', 1)
    new = grid.deep_copy()
    for _ in range(rounds):
        prev = new.deep_copy()
        for y in range(grid.h):
            for x in range(grid.w):
                n = prev.neighbours(x, y)
                if n >= 5:
                    new.set_state(x, y, 1)
                    new.cells[y][x].value = _inherit_char(prev, x, y, rng)
                elif n <= 2:
                    new.cells[y][x].state = 0
                    new.cells[y][x].value = ' '
    return new


def rule_oscillate(grid: Grid, params: Dict, rng: random.Random, tick: int) -> Grid:
    """Sine-wave a parameter value over time. Modifies params in-place."""
    target = params.get('param', '')
    lo = params.get('min', 0)
    hi = params.get('max', 1)
    period = params.get('period', 20)

    t = math.sin(2 * math.pi * tick / period) * 0.5 + 0.5
    val = lo + (hi - lo) * t
    params['_current'] = val
    # Store for external rules to read
    return grid


def rule_mutate_rules(grid: Grid, params: Dict, rng: random.Random, tick: int) -> Grid:
    """Meta-rule: randomly tweak another rule's params. Handled by engine."""
    return grid  # actual mutation done in Engine.step()


RULES = {
    'grow_life': rule_grow_life,
    'grow_brian': rule_grow_brian,
    'grow_flood': rule_grow_flood,
    'grow_diffuse': rule_grow_diffuse,
    'die_isolate': rule_die_isolate,
    'die_overcrowd': rule_die_overcrowd,
    'die_age': rule_die_age,
    'drift': rule_drift,
    'pulse': rule_pulse,
    'flip_threshold': rule_flip_threshold,
    'symmetry': rule_symmetry,
    'gravity': rule_gravity,
    'branch': rule_branch,
    'erode': rule_erode,
    'smooth': rule_smooth,
    'oscillate': rule_oscillate,
    'mutate_rules': rule_mutate_rules,
}


# ── Engine ────────────────────────────────────────────────

@dataclass
class Preset:
    name: str
    substrate: str
    seeder: str
    seeder_params: Dict
    rules: List[Tuple[str, Dict]]
    tick_ms: int = 100
    continuous: bool = True

    def to_dict(self) -> Dict:
        return {
            'name': self.name,
            'substrate': self.substrate,
            'seeder': {self.seeder: self.seeder_params},
            'rules': [{name: dict(params)} for name, params in self.rules],
            'tick_ms': self.tick_ms,
            'continuous': self.continuous,
        }

    @staticmethod
    def from_dict(d: Dict) -> 'Preset':
        seeder_entry = d.get('seeder', {'seed_random': {'density': 0.3}})
        seeder_name = list(seeder_entry.keys())[0]
        seeder_params = seeder_entry[seeder_name]
        rules = []
        for r in d.get('rules', []):
            rname = list(r.keys())[0]
            rparams = r[rname]
            rules.append((rname, rparams))
        return Preset(
            name=d.get('name', 'unnamed'),
            substrate=d.get('substrate', 'binary'),
            seeder=seeder_name,
            seeder_params=seeder_params,
            rules=rules,
            tick_ms=d.get('tick_ms', 100),
            continuous=d.get('continuous', True),
        )


class Engine:
    """Runs a generative system from a preset + seed. Fully reproducible."""

    def __init__(self, w: int, h: int, seed: int, preset: Preset,
                 stamps: Optional[List[Dict]] = None,
                 canvas_mode: bool = False):
        """
        stamps: list of dicts with keys:
            path: str (file path) OR text: str (raw ASCII)
            x: int, y: int (grid coordinates)
            locked: bool (default True — immune to rules)
        canvas_mode: if True, first stamp replaces the entire grid.
            Substrate forced to 'raw', no normal seeding, stamp is
            seeded (not locked) so rules operate on the art itself.
        """
        self.w = w
        self.h = h
        self.seed = seed
        self.preset = preset
        self.stamps = stamps or []
        self.canvas_mode = canvas_mode
        self.tick = 0
        self.rng = random.Random(seed)
        self.done = False
        self.paused = False

        # Canvas mode: force raw substrate, full-size grid
        if canvas_mode:
            preset.substrate = 'raw'

        # Grid dimensions depend on substrate
        if preset.substrate == 'binary':
            gw = max(2, w // 2)
            gh = max(2, h // 2)
        else:
            gw, gh = w, h

        self.grid = Grid(gw, gh)

        # Deep-copy rule params so mutations don't pollute the preset
        self.rule_params = [(name, dict(params)) for name, params in preset.rules]

        if canvas_mode and self.stamps:
            # Canvas mode: first stamp IS the grid. Seeded, not locked.
            st = self.stamps[0]
            path = st.get('path', '')
            text = st.get('text', '')
            if path:
                self.grid.stamp_file(path, 0, 0, locked=False, auto_fit=True)
            elif text:
                self.grid.stamp_text_fit(text, 0, 0, locked=False)
            # Build a palette of characters from the stamp for new births
            self._char_palette = []
            for row in self.grid.cells:
                for c in row:
                    if c.alive() and c.value and c.value.strip():
                        self._char_palette.append(c.value)
            if not self._char_palette:
                self._char_palette = ['.']
        else:
            self._char_palette = None
            # Normal mode: seed then stamp
            seeder_fn = SEEDERS.get(preset.seeder, seed_random)
            seeder_fn(self.grid, preset.seeder_params, self.rng)

            for st in self.stamps:
                locked = st.get('locked', True)
                ox, oy = st.get('x', 0), st.get('y', 0)
                if 'path' in st:
                    self.grid.stamp_file(st['path'], ox, oy, locked,
                                         auto_fit=True)
                elif 'text' in st:
                    self.grid.stamp_text_fit(st['text'], ox, oy, locked)

    def step(self) -> bool:
        """Advance one tick. Returns True if changed."""
        if self.done or self.paused:
            return False

        self.tick += 1

        # Snapshot locked cells before rules
        locked_snapshot = {}
        if self.grid.locked:
            for (lx, ly) in self.grid.locked:
                c = self.grid.cells[ly][lx]
                locked_snapshot[(lx, ly)] = (c.state, c.age, c.value)

        # Apply rules in order
        grid = self.grid
        for rule_name, params in self.rule_params:
            fn = RULES.get(rule_name)
            if fn:
                grid = fn(grid, params, self.rng, self.tick)

        # Restore locked cells (immune to rules)
        if locked_snapshot:
            grid.locked = self.grid.locked
            for (lx, ly), (st, age, val) in locked_snapshot.items():
                if 0 <= lx < grid.w and 0 <= ly < grid.h:
                    grid.cells[ly][lx].state = st
                    grid.cells[ly][lx].age = age
                    grid.cells[ly][lx].value = val

        # Handle mutation meta-rule
        for rule_name, params in self.rule_params:
            if rule_name == 'mutate_rules' and self.tick % 50 == 0:
                rate = params.get('rate', 0.02)
                self._mutate(rate)

        grid.age_tick()
        self.grid = grid

        # Auto-stop if grid is empty or fully filled for 10 ticks
        cov = grid.coverage()
        if cov == 0.0 and self.tick > 10:
            self.done = True
        if self.tick > 2000:
            self.done = True

        return True

    def _mutate(self, rate: float):
        """Randomly tweak a numeric param in a random rule."""
        if not self.rule_params or self.rng.random() > rate:
            return
        idx = self.rng.randint(0, len(self.rule_params) - 1)
        name, params = self.rule_params[idx]
        if name == 'mutate_rules':
            return
        numeric_keys = [k for k, v in params.items()
                        if isinstance(v, (int, float)) and not k.startswith('_')]
        if not numeric_keys:
            return
        key = self.rng.choice(numeric_keys)
        val = params[key]
        if isinstance(val, float):
            params[key] = max(0.01, val + self.rng.gauss(0, val * 0.2))
        elif isinstance(val, int):
            params[key] = max(0, val + self.rng.randint(-1, 1))

    def render(self) -> List[str]:
        """Render current grid state."""
        renderer = SUBSTRATES.get(self.preset.substrate, substrate_binary)
        return renderer(self.grid, self.rng)

    def snapshot(self) -> Dict:
        """Full reproducible state as a dict (for YAML export)."""
        snap = {
            'seed': self.seed,
            'width': self.w,
            'height': self.h,
            'tick': self.tick,
            'canvas_mode': self.canvas_mode,
            'coverage': round(self.grid.coverage(), 3),
            'locked_cells': len(self.grid.locked),
            'preset': self.preset.to_dict(),
            'rule_params_current': [
                {name: {k: v for k, v in params.items() if not k.startswith('_')}}
                for name, params in self.rule_params
            ],
        }
        if self.stamps:
            snap['stamps'] = [
                {k: v for k, v in st.items() if k != 'text'}  # skip inline text (too large)
                if 'path' in st else st
                for st in self.stamps
            ]
        return snap

    def snapshot_yaml(self) -> str:
        """Snapshot as YAML string."""
        return yaml.dump(self.snapshot(), default_flow_style=False, sort_keys=False)

    def status_text(self) -> str:
        state = 'DONE' if self.done else ('PAUSED' if self.paused else 'RUNNING')
        cov = self.grid.coverage()
        return (f"{state}  tick:{self.tick}"
                f"  cells:{self.grid.alive_count()}"
                f"  coverage:{cov:.0%}")


# ── Presets ───────────────────────────────────────────────

PRESETS = {
    'game-of-life': Preset(
        name='Game of Life',
        substrate='binary',
        seeder='seed_random',
        seeder_params={'density': 0.3},
        rules=[('grow_life', {'born': [3], 'survive': [2, 3]})],
        tick_ms=100,
    ),
    'corners-bleed': Preset(
        name='Corners Bleed',
        substrate='block',
        seeder='seed_clusters',
        seeder_params={'count': 4, 'radius': 3},
        rules=[
            ('grow_diffuse', {'p': 0.4}),
            ('symmetry', {'axis': 'rotate4'}),
        ],
        tick_ms=90,
    ),
    'eno-bloom': Preset(
        name='Eno Bloom',
        substrate='binary',
        seeder='seed_points',
        seeder_params={'method': 'golden_ratio', 'count': 5},
        rules=[
            ('grow_flood', {'p': 0.35, 'bias': 'none'}),
            ('die_age', {'max_age': 12}),
        ],
        tick_ms=120,
    ),
    'coral-reef': Preset(
        name='Coral Reef',
        substrate='contour',
        seeder='seed_edge',
        seeder_params={'edge': 'bottom', 'density': 0.15},
        rules=[
            ('branch', {'p': 0.3, 'angle_range': 60}),
            ('die_isolate', {'min_neighbours': 1}),
        ],
        tick_ms=80,
    ),
    'mycelium': Preset(
        name='Mycelium',
        substrate='binary',
        seeder='seed_clusters',
        seeder_params={'n': 3, 'radius_min': 1, 'radius_max': 3},
        rules=[
            ('grow_flood', {'p': 0.25, 'bias': 'none'}),
            ('branch', {'p': 0.15, 'angle_range': 120}),
            ('die_overcrowd', {'max_neighbours': 5}),
        ],
        tick_ms=60,
    ),
    'crystal': Preset(
        name='Crystal',
        substrate='binary',
        seeder='seed_points',
        seeder_params={'method': 'centre', 'count': 1},
        rules=[
            ('grow_life', {'born': [1, 3, 5], 'survive': [0, 2, 4, 6]}),
            ('symmetry', {'axis': 'rotate4'}),
        ],
        tick_ms=80,
    ),
    'tidal': Preset(
        name='Tidal',
        substrate='block',
        seeder='seed_edge',
        seeder_params={'edge': 'left', 'density': 0.8},
        rules=[
            ('drift', {'dx': 1, 'dy': 0}),
            ('grow_diffuse', {'rate': 0.1}),
            ('die_age', {'max_age': 30}),
        ],
        tick_ms=100,
    ),
    'erosion': Preset(
        name='Erosion',
        substrate='contour',
        seeder='seed_random',
        seeder_params={'density': 0.6},
        rules=[
            ('die_isolate', {'min_neighbours': 2}),
            ('erode', {'p': 0.05}),
            ('smooth', {'rounds': 1}),
        ],
        tick_ms=150,
    ),
    'aurora': Preset(
        name='Aurora',
        substrate='glyph',
        seeder='seed_edge',
        seeder_params={'edge': 'top', 'density': 0.4},
        rules=[
            ('gravity', {'direction': 'down', 'strength': 0.6}),
            ('grow_diffuse', {'rate': 0.15}),
            ('die_age', {'max_age': 20}),
            ('erode', {'p': 0.03}),
        ],
        tick_ms=90,
    ),
    'spiral-life': Preset(
        name='Spiral Life',
        substrate='contour',
        seeder='seed_spiral',
        seeder_params={'arms': 3, 'spacing': 4.0, 'points': 50},
        rules=[
            ('grow_life', {'born': [2, 3], 'survive': [2, 3, 4]}),
            ('symmetry', {'axis': 'rotate4'}),
        ],
        tick_ms=100,
    ),
}

PRESET_LIST = list(PRESETS.keys())


def random_preset(rng: random.Random) -> Preset:
    """Generate a fully random preset with random rules."""
    substrates = ['binary', 'binary', 'contour', 'block', 'glyph']
    substrate = rng.choice(substrates)

    seeder_names = list(SEEDERS.keys())
    seeder = rng.choice(seeder_names)
    seeder_params = {}
    if seeder == 'seed_random':
        seeder_params = {'density': rng.uniform(0.1, 0.5)}
    elif seeder == 'seed_points':
        seeder_params = {'method': rng.choice(['centre', 'golden_ratio']),
                         'count': rng.randint(1, 8)}
    elif seeder == 'seed_edge':
        seeder_params = {'edge': rng.choice(['top', 'bottom', 'left', 'right']),
                         'density': rng.uniform(0.2, 0.8)}
    elif seeder == 'seed_spiral':
        seeder_params = {'arms': rng.randint(1, 5), 'spacing': rng.uniform(2, 6),
                         'points': rng.randint(20, 80)}
    elif seeder == 'seed_clusters':
        seeder_params = {'n': rng.randint(2, 6), 'radius_min': 1,
                         'radius_max': rng.randint(3, 7)}

    # Pick 2-5 random rules
    rule_names = [k for k in RULES.keys() if k != 'mutate_rules' and k != 'oscillate']
    n_rules = rng.randint(2, 5)
    chosen = rng.sample(rule_names, min(n_rules, len(rule_names)))

    rules = []
    for rname in chosen:
        params = {}
        if rname == 'grow_life':
            params = {'born': sorted(rng.sample(range(1, 7), rng.randint(1, 3))),
                      'survive': sorted(rng.sample(range(0, 8), rng.randint(1, 4)))}
        elif rname == 'grow_flood':
            params = {'p': rng.uniform(0.15, 0.5),
                      'bias': rng.choice(['none', 'up', 'down', 'left', 'right'])}
        elif rname == 'grow_diffuse':
            params = {'rate': rng.uniform(0.05, 0.3)}
        elif rname == 'die_isolate':
            params = {'min_neighbours': rng.randint(1, 3)}
        elif rname == 'die_overcrowd':
            params = {'max_neighbours': rng.randint(4, 7)}
        elif rname == 'die_age':
            params = {'max_age': rng.randint(5, 30)}
        elif rname == 'drift':
            params = {'dx': rng.choice([-1, 0, 1]),
                      'dy': rng.choice([-1, 0, 1])}
        elif rname == 'pulse':
            params = {'period': rng.randint(4, 16),
                      'states': [1] * rng.randint(2, 4) + [0]}
        elif rname == 'flip_threshold':
            params = {'n': rng.randint(2, 5)}
        elif rname == 'symmetry':
            params = {'axis': rng.choice(['x', 'y', 'xy', 'rotate4'])}
        elif rname == 'gravity':
            params = {'direction': rng.choice(['up', 'down', 'left', 'right']),
                      'strength': rng.uniform(0.3, 1.0)}
        elif rname == 'branch':
            params = {'p': rng.uniform(0.1, 0.4),
                      'angle_range': rng.randint(30, 120)}
        elif rname == 'erode':
            params = {'p': rng.uniform(0.02, 0.1)}
        elif rname == 'smooth':
            params = {'rounds': rng.randint(1, 2)}
        rules.append((rname, params))

    # Always add mutation for evolution
    rules.append(('mutate_rules', {'rate': 0.05}))

    return Preset(
        name=f'Random #{rng.randint(1000, 9999)}',
        substrate=substrate,
        seeder=seeder,
        seeder_params=seeder_params,
        rules=rules,
        tick_ms=rng.randint(50, 200),
    )
