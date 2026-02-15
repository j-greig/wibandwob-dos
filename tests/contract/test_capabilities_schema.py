from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path
from typing import Dict, Optional

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import tools.api_server.controller as controller_module
from tools.api_server.controller import Controller
from tools.api_server.events import EventHub


def _registry_payload() -> Dict[str, object]:
    return {
        "version": "v1",
        "commands": [
            {
                "name": "cascade",
                "description": "Cascade all windows on desktop",
                "requires_path": False,
            },
            {
                "name": "tile",
                "description": "Tile all windows on desktop",
                "requires_path": False,
            },
            {
                "name": "close_all",
                "description": "Close all windows",
                "requires_path": False,
            },
            {
                "name": "save_workspace",
                "description": "Save current workspace",
                "requires_path": False,
            },
            {
                "name": "open_workspace",
                "description": "Open workspace from a path",
                "requires_path": True,
            },
            {
                "name": "screenshot",
                "description": "Capture screen to a text snapshot",
                "requires_path": False,
            },
        ],
    }


def _fake_send_cmd(cmd: str, kv: Optional[Dict[str, str]] = None) -> str:
    if cmd == "get_capabilities":
        return json.dumps(_registry_payload())
    return "ok"


def test_registry_capabilities_payload_validates(monkeypatch: pytest.MonkeyPatch) -> None:
    jsonschema = pytest.importorskip("jsonschema")
    monkeypatch.setattr(controller_module, "send_cmd", _fake_send_cmd)

    controller = Controller(EventHub())
    payload = asyncio.run(controller.get_registry_capabilities())

    schema_path = Path("contracts/protocol/v1/capabilities.schema.json")
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    jsonschema.validate(instance=payload, schema=schema)
