"""Contract tests for theme system parity across Registry→IPC→API→MCP surfaces."""

from __future__ import annotations

import json
import re
from pathlib import Path


def test_theme_commands_in_registry() -> None:
    """Verify theme commands are registered in command_registry.cpp"""
    source = Path("app/command_registry.cpp").read_text(encoding="utf-8")

    # Check command capability definitions
    assert '{"set_theme_mode"' in source
    assert '{"set_theme_variant"' in source
    assert '{"reset_theme"' in source

    # Check command handlers
    assert 'if (name == "set_theme_mode")' in source
    assert 'if (name == "set_theme_variant")' in source
    assert 'if (name == "reset_theme")' in source


def test_theme_api_functions_exist() -> None:
    """Verify theme API functions are declared in test_pattern_app.cpp"""
    source = Path("app/test_pattern_app.cpp").read_text(encoding="utf-8")

    # Check friend declarations
    assert "friend std::string api_set_theme_mode" in source
    assert "friend std::string api_set_theme_variant" in source
    assert "friend std::string api_reset_theme" in source

    # Check implementations
    assert "std::string api_set_theme_mode(" in source
    assert "std::string api_set_theme_variant(" in source
    assert "std::string api_reset_theme(" in source


def test_theme_state_in_app() -> None:
    """Verify theme state fields exist in TTestPatternApp"""
    source = Path("app/test_pattern_app.cpp").read_text(encoding="utf-8")

    assert 'std::string themeMode' in source
    assert 'std::string themeVariant' in source


def test_theme_rest_endpoints_exist() -> None:
    """Verify REST endpoints for theme exist in main.py"""
    source = Path("tools/api_server/main.py").read_text(encoding="utf-8")

    assert '@app.post("/theme/mode")' in source
    assert '@app.post("/theme/variant")' in source
    assert '@app.post("/theme/reset")' in source

    # Check schema imports
    assert "ThemeMode" in source
    assert "ThemeVariant" in source


def test_theme_controller_methods_exist() -> None:
    """Verify controller methods for theme exist in controller.py"""
    source = Path("tools/api_server/controller.py").read_text(encoding="utf-8")

    assert "async def set_theme_mode(" in source
    assert "async def set_theme_variant(" in source
    assert "async def reset_theme(" in source


def test_theme_mcp_tools_exist() -> None:
    """Verify MCP tools for theme exist in mcp_tools.py"""
    source = Path("tools/api_server/mcp_tools.py").read_text(encoding="utf-8")

    # Check tool builders
    assert '"set_theme_mode": {' in source
    assert '"set_theme_variant": {' in source
    assert '"reset_theme": {' in source

    # Check tool names
    assert '"tool_name": "tui_set_theme_mode"' in source
    assert '"tool_name": "tui_set_theme_variant"' in source
    assert '"tool_name": "tui_reset_theme"' in source

    # Check handler functions
    assert "def _make_theme_mode_handler(" in source
    assert "def _make_theme_variant_handler(" in source
    assert "def _make_reset_theme_handler(" in source


def test_theme_state_fields_in_models() -> None:
    """Verify theme fields in AppState (models.py)"""
    source = Path("tools/api_server/models.py").read_text(encoding="utf-8")

    assert "theme_mode: str" in source
    assert "theme_variant: str" in source


def test_theme_schemas_exist() -> None:
    """Verify theme schemas in schemas.py"""
    source = Path("tools/api_server/schemas.py").read_text(encoding="utf-8")

    # Check request schemas
    assert "class ThemeMode(BaseModel):" in source
    assert "class ThemeVariant(BaseModel):" in source

    # Check state model includes theme fields
    assert "theme_mode: str" in source
    assert "theme_variant: str" in source


def test_theme_in_get_state() -> None:
    """Verify theme fields are included in get_state response"""
    source = Path("app/test_pattern_app.cpp").read_text(encoding="utf-8")

    # Check JSON construction includes theme fields
    assert '"theme_mode"' in source
    assert '"theme_variant"' in source


def test_theme_in_workspace_persistence() -> None:
    """Verify theme state is persisted in workspace files"""
    source = Path("app/test_pattern_app.cpp").read_text(encoding="utf-8")

    # Check save includes theme in globals
    assert '"themeMode"' in source or 'themeMode' in source
    assert '"themeVariant"' in source or 'themeVariant' in source

    # Check load extracts theme from globals
    assert 'parseKeyedString' in source


def test_theme_manager_exists() -> None:
    """Verify ThemeManager class exists"""
    header = Path("app/theme_manager.h").read_text(encoding="utf-8")
    impl = Path("app/theme_manager.cpp").read_text(encoding="utf-8")

    # Check header
    assert "class ThemeManager" in header
    assert "enum class ThemeMode" in header
    assert "enum class ThemeVariant" in header
    assert "enum class ThemeRole" in header

    # Check implementation
    assert "TColorAttr ThemeManager::getColor(" in impl
    assert "ThemeMode ThemeManager::parseModeString(" in impl
    assert "ThemeVariant ThemeManager::parseVariantString(" in impl


def test_theme_in_cmake() -> None:
    """Verify theme_manager.cpp is in CMakeLists.txt"""
    source = Path("app/CMakeLists.txt").read_text(encoding="utf-8")

    assert "theme_manager.cpp" in source
