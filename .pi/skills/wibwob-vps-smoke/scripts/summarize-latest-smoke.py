#!/usr/bin/env python3
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[4]
print("[DEPRECATED] .pi/skills/wibwob-vps-smoke is a compatibility shim.", flush=True)
print("[DEPRECATED] Delegating summary to hosting smoke skill.", flush=True)

script = root / ".pi" / "skills" / "wibwob-hosting-smoke" / "scripts" / "summarize-latest-smoke.py"
raise SystemExit(subprocess.call(["python3", str(script)]))
