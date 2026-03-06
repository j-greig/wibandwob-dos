#!/bin/bash
# overlap-check — report % of each window covered by windows above it in z-order
PORT=${CONTROL_API_PORT:-8099}

curl -s "http://127.0.0.1:$PORT/state" | python3 - << 'EOF'
import sys, json

data = json.load(sys.stdin)
wins = [w for w in data.get("windows", []) if w.get("appType") != "wibwob-agent"]

# Build list of (id, title, x, y, w, h, z)
rects = []
for i, w in enumerate(wins):
    x = w.get("left", 0); y = w.get("top", 0)
    ww = w.get("width", 0); hh = w.get("height", 0)
    rects.append((w["id"], w.get("title","?")[:22], x, y, ww, hh, i))

def overlap_area(a, b):
    ax1,ay1,ax2,ay2 = a[2], a[3], a[2]+a[4], a[3]+a[5]
    bx1,by1,bx2,by2 = b[2], b[3], b[2]+b[4], b[3]+b[5]
    ix = max(0, min(ax2,bx2) - max(ax1,bx1))
    iy = max(0, min(ay2,by2) - max(ay1,by1))
    return ix * iy

issues = []
for i, r in enumerate(rects):
    area = r[4] * r[5]
    if area == 0: continue
    covered = 0
    coverers = []
    for j, s in enumerate(rects):
        if s[6] <= r[6]: continue  # only higher z covers lower z
        ov = overlap_area(r, s)
        if ov > 0:
            covered += ov
            pct = int(100 * ov / area)
            coverers.append(f"{s[1]} ({pct}%)")
    if covered > 0:
        total_pct = min(100, int(100 * covered / area))
        issues.append((total_pct, f"  ⚠ {r[1]!s:<24} covered {total_pct:>3}% by: {', '.join(coverers)}"))

if not issues:
    print("✓ No overlaps")
else:
    print(f"Overlaps ({len(issues)} windows affected):")
    for _, line in sorted(issues, reverse=True):
        print(line)
EOF
