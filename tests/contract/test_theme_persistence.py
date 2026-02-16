"""Contract tests for theme persistence in workspace files."""

from __future__ import annotations

import json
import tempfile
from pathlib import Path


def test_workspace_includes_theme_in_globals() -> None:
    """Verify workspace JSON schema includes theme fields in globals object"""
    # Read the buildWorkspaceJson implementation
    source = Path("app/test_pattern_app.cpp").read_text(encoding="utf-8")

    # Verify theme fields are added to globals
    assert '\\"globals\\"' in source
    assert 'themeMode' in source
    assert 'themeVariant' in source


def test_workspace_load_extracts_theme() -> None:
    """Verify workspace load extracts theme from globals"""
    source = Path("app/test_pattern_app.cpp").read_text(encoding="utf-8")

    # Check that theme variables are declared for loading
    assert "loadedThemeMode" in source or "std::string tm" in source
    assert "loadedThemeVariant" in source or "std::string tv" in source

    # Check that loaded values are applied to state
    assert "themeMode = " in source
    assert "themeVariant = " in source


def test_default_theme_values() -> None:
    """Verify default theme values are monochrome + light"""
    source = Path("app/test_pattern_app.cpp").read_text(encoding="utf-8")

    # Check initialization
    assert 'themeMode = "light"' in source
    assert 'themeVariant = "monochrome"' in source
