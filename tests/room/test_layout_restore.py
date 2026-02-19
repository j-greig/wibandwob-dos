"""Tests for layout restore functionality.

Tests the workspace JSON format validation and round-trip properties.
The actual TUI restore (WIBWOB_LAYOUT_PATH) requires a running app instance,
so we test the JSON contract and env var detection here.
"""

import json
import os
import tempfile

import pytest


# Workspace JSON format contract (from TTestPatternApp::buildWorkspaceJson)
VALID_WORKSPACE = {
    "version": 1,
    "app": "test_pattern",
    "timestamp": "2026-02-18T12:00:00",
    "screen": {"width": 120, "height": 30},
    "globals": {"patternMode": "continuous"},
    "windows": [
        {
            "id": "w1",
            "type": "test_pattern",
            "title": "Pattern Window",
            "bounds": {"x": 2, "y": 1, "w": 50, "h": 15},
            "zoomed": False,
            "props": {},
        }
    ],
    "focusedIndex": 0,
}


def validate_workspace_json(data: dict) -> list[str]:
    """Validate workspace JSON against the expected format contract.
    Returns list of error strings (empty = valid).
    """
    errors = []
    if "version" not in data:
        errors.append("Missing 'version' field")
    elif not isinstance(data["version"], int):
        errors.append(f"'version' must be int, got {type(data['version']).__name__}")

    if "windows" not in data:
        errors.append("Missing 'windows' field")
    elif not isinstance(data["windows"], list):
        errors.append(f"'windows' must be list, got {type(data['windows']).__name__}")
    else:
        for i, win in enumerate(data["windows"]):
            if "type" not in win:
                errors.append(f"Window {i}: missing 'type'")
            if "bounds" not in win:
                errors.append(f"Window {i}: missing 'bounds'")
            elif isinstance(win["bounds"], dict):
                for key in ("x", "y", "w", "h"):
                    if key not in win["bounds"]:
                        errors.append(f"Window {i}: bounds missing '{key}'")

    return errors


class TestWorkspaceFormat:
    """Test the workspace JSON format contract."""

    def test_valid_workspace(self):
        errors = validate_workspace_json(VALID_WORKSPACE)
        assert errors == []

    def test_missing_version(self):
        data = {k: v for k, v in VALID_WORKSPACE.items() if k != "version"}
        errors = validate_workspace_json(data)
        assert any("version" in e for e in errors)

    def test_missing_windows(self):
        data = {k: v for k, v in VALID_WORKSPACE.items() if k != "windows"}
        errors = validate_workspace_json(data)
        assert any("windows" in e for e in errors)

    def test_window_missing_type(self):
        data = dict(VALID_WORKSPACE)
        data["windows"] = [{"bounds": {"x": 0, "y": 0, "w": 10, "h": 10}}]
        errors = validate_workspace_json(data)
        assert any("type" in e for e in errors)

    def test_window_missing_bounds(self):
        data = dict(VALID_WORKSPACE)
        data["windows"] = [{"type": "test_pattern"}]
        errors = validate_workspace_json(data)
        assert any("bounds" in e for e in errors)

    def test_window_incomplete_bounds(self):
        data = dict(VALID_WORKSPACE)
        data["windows"] = [{"type": "test_pattern", "bounds": {"x": 0, "y": 0}}]
        errors = validate_workspace_json(data)
        assert any("w" in e or "h" in e for e in errors)


class TestWorkspaceRoundTrip:
    """Test that workspace JSON survives serialise/deserialise."""

    def test_json_round_trip(self):
        """Write workspace JSON, read it back, compare."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump(VALID_WORKSPACE, f, indent=2)
            f.flush()
            path = f.name

        try:
            with open(path) as f:
                loaded = json.load(f)
            assert loaded == VALID_WORKSPACE
        finally:
            os.unlink(path)

    def test_double_round_trip(self):
        """Write, read, write again — second write must match first."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump(VALID_WORKSPACE, f, indent=2, sort_keys=True)
            f.flush()
            path1 = f.name

        try:
            with open(path1) as f:
                loaded = json.load(f)

            with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
                json.dump(loaded, f, indent=2, sort_keys=True)
                f.flush()
                path2 = f.name

            try:
                with open(path1) as f1, open(path2) as f2:
                    assert f1.read() == f2.read()
            finally:
                os.unlink(path2)
        finally:
            os.unlink(path1)

    def test_multi_window_workspace(self):
        """Workspace with multiple windows round-trips correctly."""
        data = dict(VALID_WORKSPACE)
        data["windows"] = [
            {"id": "w1", "type": "test_pattern", "title": "P1",
             "bounds": {"x": 0, "y": 0, "w": 40, "h": 20}, "zoomed": False, "props": {}},
            {"id": "w2", "type": "gradient", "title": "G1",
             "bounds": {"x": 42, "y": 0, "w": 40, "h": 20}, "zoomed": True,
             "props": {"gradientType": "vertical"}},
        ]
        errors = validate_workspace_json(data)
        assert errors == []

        serialised = json.dumps(data, sort_keys=True)
        loaded = json.loads(serialised)
        assert loaded == data


class TestEnvVarDetection:
    """Test that WIBWOB_LAYOUT_PATH env var is detectable."""

    def test_env_var_set(self):
        os.environ["WIBWOB_LAYOUT_PATH"] = "/tmp/test.json"
        try:
            assert os.getenv("WIBWOB_LAYOUT_PATH") == "/tmp/test.json"
        finally:
            del os.environ["WIBWOB_LAYOUT_PATH"]

    def test_env_var_unset(self):
        os.environ.pop("WIBWOB_LAYOUT_PATH", None)
        assert os.getenv("WIBWOB_LAYOUT_PATH") is None

    def test_env_var_empty(self):
        os.environ["WIBWOB_LAYOUT_PATH"] = ""
        try:
            val = os.getenv("WIBWOB_LAYOUT_PATH")
            assert val == ""
            # Empty string should be treated as unset (matches C++ check)
            assert not (val and val.strip())
        finally:
            del os.environ["WIBWOB_LAYOUT_PATH"]
