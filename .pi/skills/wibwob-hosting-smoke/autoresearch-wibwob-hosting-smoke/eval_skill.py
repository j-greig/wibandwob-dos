#!/usr/bin/env python3
import json, re, sys
from pathlib import Path

path = Path(sys.argv[1])
text = path.read_text()

checks = [
    ("adapter_model", bool(re.search(r"Adapter model", text, re.I)) and all(k in text for k in ["docker-vps", "flyio", "npm-global"])),
    ("canonical_dispatcher_command", "bash .pi/skills/wibwob-hosting-smoke/scripts/run-smoke.sh <adapter>" in text),
    ("binary_gates_discipline", bool(re.search(r"Binary (acceptance )?gates", text, re.I)) and "pass/fail" in text.lower()),
    ("external_microapp_no_core_edits", bool(re.search(r"without (editing|modifying) `?src/core/\*`?", text, re.I))),
    ("artifact_expectations", all(k in text for k in ["checks.jsonl", "report.md", "summarize-latest-smoke.py"])),
    ("adapter_missing_is_fail", bool(re.search(r"adapter runner.*FAIL|missing.*FAIL", text, re.I))),
    ("fly_and_npm_prereqs", "FLY_APP_NAME" in text and ("npm pack" in text or "local tgz" in text.lower())),
    ("no_legacy_skill_path", ".pi/skills/wibwob-vps-smoke" not in text),
    ("severity_policy", bool(re.search(r"Critical|Informational", text, re.I))),
    ("persistent_history_mentions", all(k in text for k in ["results.tsv", "results.json", "experiments.jsonl", "SESSION_LOG.md"])),
    ("failure_taxonomy_enum", all(k in text for k in ["tunnel_refused", "app_not_ready", "selector_ambiguous", "command_error"])),
    ("remediation_event_contract", "remediation_attempted" in text),
    ("dynamic_tunnel_ports_guidance", bool(re.search(r"dynamic local tunnel port|collision-safe tunnel|avoid.*19099|19100", text, re.I))),
]

score = sum(1 for _, ok in checks if ok)
max_score = len(checks)
failed = [name for name, ok in checks if not ok]

print(json.dumps({
    "score": score,
    "max_score": max_score,
    "pass_rate": round(100.0 * score / max_score, 1),
    "failed": failed,
}, indent=2))
