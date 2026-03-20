#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
CAPTURES = ROOT / "scratch" / "captures"

PREFIXES = ["docker-vps-smoke-", "fly-smoke-", "npm-global-smoke-"]

candidates = []
for prefix in PREFIXES:
    for run in CAPTURES.glob(f"{prefix}*"):
        if (run / "checks.jsonl").exists():
            candidates.append(run)

if not candidates:
    print("No smoke runs with checks.jsonl found.")
    raise SystemExit(1)

latest = sorted(candidates, key=lambda p: p.stat().st_mtime)[-1]
jsonl = latest / "checks.jsonl"
report = latest / "report.md"
raw = latest / "raw.log"

rows = []
for line in jsonl.read_text().splitlines():
    line = line.strip()
    if not line:
        continue
    try:
        rows.append(json.loads(line))
    except json.JSONDecodeError:
        pass

passes = [r for r in rows if r.get("status") == "PASS"]
fails = [r for r in rows if r.get("status") == "FAIL"]

print(f"Latest run: {latest}")
print(f"Report: {report}")
print(f"Raw log: {raw}")
print(f"Checks: {len(rows)}  pass={len(passes)}  fail={len(fails)}")

if fails:
    print("\nFailed checks:")
    for f in fails:
        print(f"- {f.get('check')}: {f.get('note')}")
else:
    print("\nNo failed checks.")
