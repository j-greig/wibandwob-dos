from __future__ import annotations

import json
from pathlib import Path

import pytest


def test_snapshot_schema_validates_example() -> None:
    jsonschema = pytest.importorskip("jsonschema")
    schema = json.loads(Path("contracts/state/v1/snapshot.schema.json").read_text(encoding="utf-8"))
    example = {
        "version": "1",
        "timestamp": "2026-02-15T04:12:00Z",
        "canvas": {"w": 120, "h": 36},
        "pattern_mode": "continuous",
        "theme_mode": "light",
        "theme_variant": "monochrome",
        "windows": [
            {
                "id": "w1",
                "type": "text_editor",
                "title": "Notes",
                "rect": {"x": 2, "y": 1, "w": 60, "h": 18},
                "z": 3,
                "focused": True,
                "props": {},
            }
        ],
    }
    jsonschema.validate(instance=example, schema=schema)
