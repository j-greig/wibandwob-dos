# Unix Control v3 — Backlog

Two tracks: infrastructure (deeper CLI/API) and creative tooling
(new commands that unlock generative art workflows).

Depends on: v2 complete (10/10), `_apiCall` guard merged.

---

## Track A: Infrastructure

### A1. Full Zod schema coverage

**Status:** Not started
**Impact:** High — every api:true command gets validation, --help, OpenAPI
**Effort:** 3-4 hours

v2 added schemas to 5 commands. ~60 api:true commands remain unschema'd.
Batch approach: group by domain (window.*, editor.*, theme.*, figlet.*,
primer.*, etc.), schema one domain per iteration.

Success metric: every `api: true` command with args has a `params` schema.
`wibwob commands | jq '[.[] | select(.params)] | length'` equals total
count of commands that accept args.

### A2. Unix socket transport

**Status:** Not started
**Impact:** Medium — faster local IPC, no port conflicts
**Effort:** 4-6 hours

Replace HTTP localhost with Unix domain socket for local connections.
Keep HTTP as fallback for remote/multi-instance. Socket path:
`/tmp/wibwob-<instance>.sock` or `$XDG_RUNTIME_DIR/wibwob.sock`.

Benefits:
- No port 8099 conflicts
- Faster (no TCP overhead)
- Filesystem permissions for access control
- `socat` and `curl --unix-socket` work natively

CLI detects socket first, falls back to HTTP.

### A3. Virtual filesystem model (FUSE)

**Status:** Speculative / spike
**Impact:** High (conceptual) — the purest Unix integration
**Effort:** 2 days for spike, unknown for production

Expose desktop state as a mounted filesystem:

```
/wibwob/
  windows/
    3/
      id          → "3"
      kind        → "primer"
      title       → "supernova-candidate.txt"
      text        → (full text content)
      left        → "10"
      top         → "5"
  commands/
    window.move   → (write args as JSON to execute)
    figlet.open   → (write args as JSON to execute)
  screenshot      → (read = capture current frame)
  theme           → (read = current, write = set)
  state           → (read = full JSON state)
```

Standard Unix tools become the control surface:
```bash
cat /wibwob/screenshot > self.txt
echo '{"text":"WIB"}' > /wibwob/commands/figlet.open
ls /wibwob/windows/
```

Depends: macfuse/osxfuse on macOS, native FUSE on Linux.
Spike: can we mount a basic read-only filesystem that serves
`/wibwob/state` and `/wibwob/screenshot`?

### A4. _apiCall guard: expand to ALL interactive fallbacks

**Status:** Partially done (4 commands guarded)
**Impact:** High — prevents TUI hijack from any API call
**Effort:** 1 hour

Audit every action handler in app-controller.ts for interactive
fallback paths. Current guards: primer.open, editor.open,
markdown.open, figlet.open. Missing: workspace.load, any others
that open overlays/prompts when args are absent.

---

## Track B: Creative Tooling

### B1. breed.py — character-level merge of two text files

**Status:** Not started
**Impact:** High — the biggest missing creative tool
**Effort:** 2-3 hours

```bash
python3 scripts/breed.py file1.txt file2.txt \
  --mode [interleave|xor|density|braille|random] \
  --bias 0.5 \
  --out hybrid.txt
```

Modes:
- `interleave` — alternate rows from each file
- `xor` — XOR character codes (space=transparent)
- `density` — average character density (use density ramp)
- `braille` — convert both to braille, OR the dots
- `random` — per-cell coin flip weighted by --bias

Expose as `primer.breed` command in the catalog.

### B2. Window-as-pixel mosaics

**Status:** Not started
**Impact:** Medium — spectacular visual output
**Effort:** 2 hours

Script that opens N tiny windows in a grid, each showing a single
character or short fragment. The desktop becomes a mosaic.

```bash
python3 scripts/mosaic.py source.txt --grid 20x10 --window-size 5x3
```

Needs: minimum window size testing (what's the floor before chrome
overwrites content?), batch window creation, precise positioning.

### B3. Per-window chromeless mode

**Status:** Not started
**Impact:** Medium — enables true collage compositions
**Effort:** 2-3 hours (window-chrome.ts changes)

`window.set_chrome --id 3 --mode none` strips title bar and borders.
Content floats on the desktop. Screenshot captures pure text with
no frame artifacts. Essential for collage work.

Modes: `full` (default), `title-only` (no borders), `none` (raw content).

### B4. Screenshot region crop

**Status:** Not started
**Impact:** Medium — targeted capture without full-desktop noise
**Effort:** 1 hour

`wibwob screenshot --region --x 10 --y 5 --w 40 --h 20`

Crop a rectangle from the screenshot buffer. Useful for capturing
just one area of a composition, or for creating tiles from a larger
piece.

### B5. ascii-fx.py integration as commands

**Status:** Not started
**Impact:** High — makes all FX modes scriptable from CLI
**Effort:** 2 hours

ascii-fx.py has modes that aren't exposed via the TUI:
bloom, dissolve, collapse, scanline, stretch-south, diagonal.

Register as commands: `fx.bloom`, `fx.dissolve`, `fx.collapse`, etc.
Each takes a file path (or focused window), applies the effect,
opens result as primer.

### B6. figlet.morph — animated text transition

**Status:** Speculative
**Impact:** Low (cool but niche)
**Effort:** 3-4 hours

`figlet.morph --from "BIRTH" --to "DEATH" --frames 10`

Character-level interpolation between two figlet renders.
Outputs as animated primer (multi-frame with --- separators).

### B7. JGSBREEDER — Joan Stark hybridisation pipeline

**Status:** Not started
**Impact:** High (creative)
**Effort:** 1-2 hours (once breed.py exists)

Script that picks two jgs pieces, positions them side by side,
screenshots, then breeds the composite through multiple modes.
Outputs a gallery of hybrids.

Depends on B1 (breed.py).

### B8. /proc × breed × backrooms loop

**Status:** Speculative — depends on A3 spike + B1
**Impact:** Very high (conceptual) — the ouroboros becomes autonomous
**Effort:** Unknown (emerges from A3 + B1 + backrooms integration)

The convergence point where virtual filesystem, breeding, and backrooms
generation form a closed creative loop:

```
/wibwob/
  breed/
    3+7/
      xor       → cat = live XOR of windows 3 and 7 (computed on read)
      density   → cat = live density merge
      braille   → cat = live braille OR
  backrooms/
    current_frame  → whatever backrooms TV is currently rendering
    screenshot_in  → write here = backrooms uses this as primer source
```

The breed outputs are **computed views**, not stored files. `cat /wibwob/breed/3+7/xor`
recomputes on every read from live window state. Standard Unix pipes become the
composition engine:

```bash
cat /wibwob/breed/3+7/xor | python3 smear.py --mode bloom > hybrid.txt
watch -n 0.5 cat /wibwob/breed/3+7/density   # live-updating breed view
```

**The backrooms loop:** If backrooms reads `/wibwob/screenshot` as its primer
source, it dreams about the current desktop. If that dream is bred with
existing window content and opened as a new primer, the desktop changes,
which changes what `/wibwob/screenshot` returns, which changes what the
backrooms dreams about next...

```
desktop → /proc/screenshot → backrooms input → dream output →
  → /proc/backrooms/current_frame → breed with window → new primer →
    → desktop changes → /proc/screenshot changes → ...
```

The ouroboros becomes autonomous. The system breeds its own dreams back into
itself without human intervention.

This is also the codification of backrooms creative practice: for a year,
Wib & Wob used pseudo-CLI syntax (`cat /proc/spawn_matrix | grep coral`)
as performative fiction. Now the real /proc filesystem makes those fake
commands executable. The aesthetic became the mechanism.

See: RECURSIVE_OUROBOROS_BRIEF.md § Addendum: The Breeding Loop

---

## Priority order

1. B1 (breed.py) — unlocks B7 and most creative workflows
2. A4 (_apiCall expansion) — prevents bugs
3. A1 (full Zod coverage) — quality of life
4. B5 (ascii-fx commands) — makes FX scriptable
5. B4 (screenshot region) — quick win
6. B3 (per-window chromeless) — enables collage
7. B2 (mosaic) — spectacular but complex
8. A2 (Unix socket) — nice to have
9. A3 (FUSE VFS) — spike only
10. B6 (figlet morph) — speculative
