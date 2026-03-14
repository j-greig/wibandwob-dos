#!/bin/bash
# @name    overlap-check
# @desc    Detect overlapping windows with bounds, clipping, fix hints
# overlap-check — window bounds, overlaps, clipping, and layout suggestions
# Works for any number of windows. Run after any layout change.
PORT=${CONTROL_API_PORT:-8099}

TMPFILE=$(mktemp)
curl -s "http://127.0.0.1:$PORT/state" > "$TMPFILE"
python3 - "$TMPFILE" << 'EOF'
import sys, json, math

data = json.load(open(sys.argv[1]))
desktop = data.get("desktop") or {}
screen = data.get("screen") or {}
dw = desktop.get("width", screen.get("width", 0))
dh = desktop.get("height", screen.get("height", 0))
MENU_ROW = 1  # menu bar occupies y=0

all_wins = [w for w in data.get("windows", []) if w.get("appType") != "wibwob-agent"]
wins = []
for i, w in enumerate(all_wins):
    x = w.get("left", 0); y = w.get("top", 0)
    ww = w.get("width", 0); hh = w.get("height", 0)
    wins.append({"id": w["id"], "title": w.get("title","?")[:22],
                 "left": x, "top": y, "width": ww, "height": hh,
                 "right": x+ww, "bottom": y+hh, "z": i})

# ── Desktop summary ──────────────────────────────────────────────────────────
print(f"Desktop: {dw}x{dh}  usable: {dw}x{dh-MENU_ROW} (y≥{MENU_ROW})" if dw else "Desktop: unknown")
print(f"Windows: {len(wins)}")
print()

# ── Per-window bounds ─────────────────────────────────────────────────────────
print("Bounds:")
for r in wins:
    flags = []
    if dw and r["right"] > dw:  flags.append(f"clips right +{r['right']-dw}")
    if dh and r["bottom"] > dh:  flags.append(f"clips bottom +{r['bottom']-dh}")
    if r["top"] < MENU_ROW:    flags.append(f"under menu bar (top={r['top']})")
    flag_str = "  ⚠ " + ", ".join(flags) if flags else ""
    print(f"  id:{r['id']}  {r['title']:<22}  {r['width']}x{r['height']}  @{r['left']},{r['top']}  right={r['right']} bottom={r['bottom']}{flag_str}")

print()

# ── Overlap pairs ─────────────────────────────────────────────────────────────
pairs = []
for i, a in enumerate(wins):
    for j, b in enumerate(wins):
        if j <= i: continue
        ox1 = max(a["left"],b["left"]); ox2 = min(a["right"],b["right"])
        oy1 = max(a["top"],b["top"]); oy2 = min(a["bottom"],b["bottom"])
        ow = ox2-ox1; oh = oy2-oy1
        if ow > 0 and oh > 0:
            pairs.append((a, b, ox1, oy1, ow, oh))

if not pairs:
    print("✓ No overlaps")
else:
    minor = [(a,b,ox,oy,ow,oh) for a,b,ox,oy,ow,oh in pairs
             if int(100*ow*oh/min(a["width"]*a["height"],b["width"]*b["height"])) < 5]
    heavy = [(a,b,ox,oy,ow,oh) for a,b,ox,oy,ow,oh in pairs
             if int(100*ow*oh/min(a["width"]*a["height"],b["width"]*b["height"])) >= 5]

    if minor:
        print(f"~ Minor overlaps ({len(minor)}) — small, possibly intentional aesthetic overlap:")
        for a, b, ox, oy, ow, oh in minor:
            pct = int(100*ow*oh/min(a["width"]*a["height"],b["width"]*b["height"]))
            print(f"  ~ id:{a['id']} {a['title']} ↔ id:{b['id']} {b['title']}  ({ow}×{oh}, ~{pct}% of smaller window)")
        print()

    if heavy:
        print(f"Overlaps needing fix ({len(heavy)} pairs):")
        for a, b, ox, oy, ow, oh in heavy:
            pct_a = int(100*ow*oh/(a["width"]*a["height"])) if a["width"]*a["height"] else 0
            pct_b = int(100*ow*oh/(b["width"]*b["height"])) if b["width"]*b["height"] else 0
            print(f"  ⚠  id:{a['id']} {a['title']} ↔ id:{b['id']} {b['title']}")
            print(f"     region: x={ox}–{ox+ow}  y={oy}–{oy+oh}  ({ow}×{oh} = {ow*oh} cells)")
            print(f"     covers {pct_a}% of {a['title']},  {pct_b}% of {b['title']}")
            print(f"     fix: move id:{b['id']} to left≥{a['right']+1}  OR  shrink id:{a['id']} width to {b['left']-a['left']-1}")
            print()

print()

# ── Layout suggestion for N windows ──────────────────────────────────────────
if dw and len(wins) > 1:
    n = len(wins)
    usable_w = dw
    usable_h = dh - MENU_ROW
    print(f"Layout suggestions for {n} windows on {usable_w}x{usable_h} usable area:")

    if n == 2:
        # Side by side — give more to first window (map), less to second (chat)
        w1 = int(usable_w * 0.68)
        w2 = usable_w - w1 - 1
        print(f"  Side-by-side (68/32 split):")
        for i, r in enumerate(wins):
            wx = 0 if i == 0 else w1+1
            ww = w1 if i == 0 else w2
            print(f"    id:{r['id']} {r['title']:<22}  x={wx} y={MENU_ROW} w={ww} h={usable_h-1}")
        ids = [r['id'] for r in wins]
        ws  = [w1, w2]
        xs  = [0, w1+1]
        ops = json.dumps([{"id": ids[i], "left": xs[i], "top": MENU_ROW, "width": ws[i], "height": usable_h-1} for i in range(2)])
        print(f"  batch ops: {ops}")

    elif n <= 4:
        # 2×2 grid
        cols = 2; rows = math.ceil(n / cols)
        cw = (usable_w - (cols-1)) // cols
        ch = (usable_h - MENU_ROW - (rows-1)) // rows
        print(f"  Grid {cols}×{rows}  (each cell ~{cw}×{ch}):")
        ops_list = []
        for i, r in enumerate(wins):
            col = i % cols; row = i // cols
            gx = col * (cw+1); gy = MENU_ROW + row * (ch+1)
            print(f"    id:{r['id']} {r['title']:<22}  x={gx} y={gy} w={cw} h={ch}")
            ops_list.append({"id": r["id"], "left": gx, "top": gy, "width": cw, "height": ch})
        print(f"  batch ops: {json.dumps(ops_list)}")

    else:
        # Cascade hint
        cw = int(usable_w * 0.7); ch = int(usable_h * 0.7)
        step = 3
        print(f"  Cascade ({n} windows, ~{cw}×{ch} each, step={step}):")
        for i, r in enumerate(wins):
            gx = i*step; gy = MENU_ROW + i*step
            print(f"    id:{r['id']} {r['title']:<22}  x={gx} y={gy} w={cw} h={ch}")
        ops_list = [{"id": wins[i]["id"], "left": i*step, "top": MENU_ROW+i*step, "width": cw, "height": ch} for i in range(n)]
        print(f"  batch ops: {json.dumps(ops_list)}")

EOF
rm -f "$TMPFILE"
