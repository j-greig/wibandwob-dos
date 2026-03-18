#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
CAPTURES = ROOT / "scratch" / "captures"

runs = sorted(CAPTURES.glob("docker-vps-smoke-*"), key=lambda p: p.name)
runs = [r for r in runs if (r / "checks.jsonl").exists()]
if not runs:
    print("No docker-vps-smoke runs with checks.jsonl found.")
    raise SystemExit(1)

latest = runs[-1]
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

# High-signal quick flags
names = {r.get("check") for r in passes}
critical = [
    "docker_build",
    "docker_run",
    "ssh_ready",
    "api_ready",
]
missing = [c for c in critical if c not in names]
if missing:
    print("\nMissing critical PASS checks:")
    for m in missing:
        print(f"- {m}")
