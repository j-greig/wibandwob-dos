from __future__ import annotations

import re
from pathlib import Path


def test_state_response_builders_include_required_theme_fields() -> None:
    source = Path("tools/api_server/main.py").read_text(encoding="utf-8")

    constructors = re.findall(r"AppStateModel\((.*?)\n\s*\)", source, flags=re.S)
    assert constructors, "Expected AppStateModel constructors in main.py"

    for ctor in constructors:
        assert "theme_mode=" in ctor
        assert "theme_variant=" in ctor


def test_state_endpoint_includes_theme_fields() -> None:
    """Theme fields must be in the state response.

    NOTE: No mcp_tools.py exists. State is served by GET /state via controller.py.
    """
    source = Path("tools/api_server/controller.py").read_text(encoding="utf-8")
    assert "theme_mode" in source, "theme_mode missing from controller state handling"
    assert "theme_variant" in source, "theme_variant missing from controller state handling"
