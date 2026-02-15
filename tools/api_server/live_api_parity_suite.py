#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any, Dict, List, Tuple


@dataclass
class StepResult:
    name: str
    ok: bool
    detail: Dict[str, Any]


class ApiClient:
    def __init__(self, base_url: str) -> None:
        self.base_url = base_url.rstrip("/")

    def get(self, path: str) -> Tuple[int, Dict[str, Any]]:
        with urllib.request.urlopen(self.base_url + path, timeout=10) as resp:
            return resp.getcode(), json.loads(resp.read().decode())

    def post(self, path: str, payload: Dict[str, Any]) -> Tuple[int, Dict[str, Any]]:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            self.base_url + path,
            data=data,
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                return resp.getcode(), json.loads(resp.read().decode())
        except urllib.error.HTTPError as exc:
            raw = exc.read().decode()
            try:
                body = json.loads(raw)
            except Exception:
                body = {"raw": raw}
            return exc.code, body


def run_suite(base_url: str, workspace_path: str) -> Tuple[bool, List[StepResult]]:
    api = ApiClient(base_url)
    out: List[StepResult] = []

    code, health = api.get("/health")
    out.append(StepResult("health", code == 200 and health.get("ok") is True, {"status": code, "body": health}))
    if not out[-1].ok:
        return False, out

    _, st0 = api.get("/state")
    baseline = len(st0.get("windows", []))
    out.append(StepResult("baseline_state", True, {"window_count": baseline}))

    c1_code, c1 = api.post("/windows", {"type": "test_pattern"})
    c2_code, c2 = api.post("/windows", {"type": "gradient"})
    _, st1 = api.get("/state")
    create_ok = c1_code == 200 and c2_code == 200 and len(st1.get("windows", [])) >= baseline + 1
    out.append(
        StepResult(
            "create_vs_state_parity",
            create_ok,
            {
                "create_1": c1,
                "create_2": c2,
                "window_count_after_create": len(st1.get("windows", [])),
                "types_after_create": sorted({w.get("type") for w in st1.get("windows", [])}),
            },
        )
    )

    sv_code, sv = api.post("/workspace/save", {"path": workspace_path})
    out.append(StepResult("workspace_save", sv_code == 200 and sv.get("ok") is True, {"status": sv_code, "body": sv}))

    cl_code, cl = api.post("/windows/close_all", {})
    _, st2 = api.get("/state")
    close_ok = cl_code == 200 and cl.get("ok") is True and len(st2.get("windows", [])) == 0
    out.append(StepResult("close_all", close_ok, {"status": cl_code, "body": cl, "window_count_after_close": len(st2.get("windows", []))}))

    op_code, op = api.post("/workspace/open", {"path": workspace_path})
    _, st3 = api.get("/state")
    restored = len(st3.get("windows", []))
    open_ok = op_code == 200 and op.get("ok") is True and restored > 0
    out.append(
        StepResult(
            "workspace_open_restores",
            open_ok,
            {
                "status": op_code,
                "body": op,
                "window_count_after_open": restored,
                "types_after_open": sorted({w.get("type") for w in st3.get("windows", [])}),
            },
        )
    )

    overall = all(step.ok for step in out)
    return overall, out


def main() -> int:
    parser = argparse.ArgumentParser(description="Live API parity suite for create/state/save/open workflow.")
    parser.add_argument("--base-url", default="http://127.0.0.1:8089", help="API base URL")
    parser.add_argument("--workspace-path", default="workspaces/live_api_parity_suite.json", help="Workspace file path")
    args = parser.parse_args()

    ok, steps = run_suite(args.base_url, args.workspace_path)
    payload = {
        "ok": ok,
        "base_url": args.base_url,
        "workspace_path": args.workspace_path,
        "steps": [{"name": s.name, "ok": s.ok, "detail": s.detail} for s in steps],
    }
    print(json.dumps(payload, indent=2))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
