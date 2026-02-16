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


def test_mcp_tui_get_state_includes_theme_fields() -> None:
    source = Path("tools/api_server/mcp_tools.py").read_text(encoding="utf-8")
    assert '"theme_mode": state.theme_mode' in source
    assert '"theme_variant": state.theme_variant' in source
