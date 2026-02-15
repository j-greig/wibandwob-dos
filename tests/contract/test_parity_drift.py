from __future__ import annotations

import re
from pathlib import Path


MENU_SYMBOL_TO_REGISTRY_NAME = {
    "cmCascade": "cascade",
    "cmTile": "tile",
    "cmCloseAll": "close_all",
    "cmSaveWorkspace": "save_workspace",
    "cmOpenWorkspace": "open_workspace",
    "cmScreenshot": "screenshot",
}


def test_menu_vs_capabilities_parity() -> None:
    menu_src = Path("app/test_pattern_app.cpp").read_text(encoding="utf-8")
    registry_src = Path("app/command_registry.cpp").read_text(encoding="utf-8")

    for menu_symbol in MENU_SYMBOL_TO_REGISTRY_NAME:
        assert f"case {menu_symbol}:" in menu_src, f"Missing menu command handler: {menu_symbol}"

    registry_names = set(re.findall(r'\{"([a-z_]+)"\s*,\s*"[^"]+"\s*,\s*(?:true|false)\}', registry_src))
    missing = set(MENU_SYMBOL_TO_REGISTRY_NAME.values()) - registry_names
    assert not missing, f"Registry missing migrated menu commands: {sorted(missing)}"
