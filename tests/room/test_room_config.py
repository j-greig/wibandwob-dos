"""Tests for room config parser."""

import sys
import tempfile
from pathlib import Path

import pytest

# Add tools/room to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "tools" / "room"))

from room_config import (
    RoomConfig,
    extract_section,
    parse_frontmatter,
    parse_room_config,
    validate_frontmatter,
)

VALID_CONFIG = """\
---
room_id: test-room
display_name: Test Room
instance_id: 1
ttyd_port: 7681
layout_path: workspaces/test.json
api_key_source: env
max_visitors: 2
preload_files: []
---

# Test Room

A test room for unit tests.

## System Prompt

You are a test assistant. Be helpful and concise.
Multi-line prompts work fine.

## Welcome Message

> Welcome to the test room. Type /help to get started.
"""

MINIMAL_CONFIG = """\
---
room_id: minimal
instance_id: 2
ttyd_port: 8080
---

# Minimal Room
"""


class TestParseFrontmatter:
    def test_valid(self):
        fm, body = parse_frontmatter(VALID_CONFIG)
        assert fm["room_id"] == "test-room"
        assert fm["instance_id"] == 1
        assert "# Test Room" in body

    def test_no_frontmatter(self):
        with pytest.raises(ValueError, match="No YAML frontmatter"):
            parse_frontmatter("# Just markdown\nNo frontmatter here.")

    def test_empty_frontmatter(self):
        with pytest.raises(ValueError, match="must be a YAML mapping"):
            parse_frontmatter("---\n---\n# Empty")

    def test_minimal(self):
        fm, body = parse_frontmatter(MINIMAL_CONFIG)
        assert fm["room_id"] == "minimal"
        assert fm["ttyd_port"] == 8080


class TestExtractSection:
    def test_system_prompt(self):
        _, body = parse_frontmatter(VALID_CONFIG)
        prompt = extract_section(body, "System Prompt")
        assert "test assistant" in prompt
        assert "Multi-line prompts" in prompt

    def test_welcome_message(self):
        _, body = parse_frontmatter(VALID_CONFIG)
        msg = extract_section(body, "Welcome Message")
        assert "Welcome to the test room" in msg

    def test_missing_section(self):
        _, body = parse_frontmatter(VALID_CONFIG)
        assert extract_section(body, "Nonexistent Section") == ""

    def test_section_stops_at_next_heading(self):
        _, body = parse_frontmatter(VALID_CONFIG)
        prompt = extract_section(body, "System Prompt")
        assert "Welcome to the test room" not in prompt


class TestValidateFrontmatter:
    def test_valid(self):
        fm, _ = parse_frontmatter(VALID_CONFIG)
        errors = validate_frontmatter(fm)
        assert errors == []

    def test_missing_required(self):
        errors = validate_frontmatter({"room_id": "test"})
        assert any("Missing required" in e for e in errors)
        assert any("instance_id" in e for e in errors)

    def test_wrong_type(self):
        fm = {"room_id": "test", "instance_id": "not-an-int", "ttyd_port": 7681}
        errors = validate_frontmatter(fm)
        assert any("instance_id" in e and "int" in e for e in errors)

    def test_bad_api_key_source(self):
        fm = {
            "room_id": "test",
            "instance_id": 1,
            "ttyd_port": 7681,
            "api_key_source": "magic",
        }
        errors = validate_frontmatter(fm)
        assert any("api_key_source" in e for e in errors)

    def test_port_out_of_range(self):
        fm = {"room_id": "test", "instance_id": 1, "ttyd_port": 80}
        errors = validate_frontmatter(fm)
        assert any("ttyd_port" in e for e in errors)

    def test_port_high_end(self):
        fm = {"room_id": "test", "instance_id": 1, "ttyd_port": 70000}
        errors = validate_frontmatter(fm)
        assert any("ttyd_port" in e for e in errors)

    def test_max_visitors_zero(self):
        fm = {"room_id": "test", "instance_id": 1, "ttyd_port": 7681, "max_visitors": 0}
        errors = validate_frontmatter(fm)
        assert any("max_visitors" in e for e in errors)


class TestParseRoomConfig:
    def test_full_config(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False) as f:
            f.write(VALID_CONFIG)
            f.flush()
            config = parse_room_config(Path(f.name), check_files=False)

        assert config.room_id == "test-room"
        assert config.display_name == "Test Room"
        assert config.instance_id == 1
        assert config.ttyd_port == 7681
        assert config.api_key_source == "env"
        assert config.max_visitors == 2
        assert "test assistant" in config.system_prompt
        assert "Welcome to the test room" in config.welcome_message

    def test_minimal_config(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False) as f:
            f.write(MINIMAL_CONFIG)
            f.flush()
            config = parse_room_config(Path(f.name), check_files=False)

        assert config.room_id == "minimal"
        assert config.display_name == "minimal"  # falls back to room_id
        assert config.system_prompt == ""
        assert config.welcome_message == ""

    def test_invalid_config_raises(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False) as f:
            f.write("---\nroom_id: test\n---\n# Bad\n")
            f.flush()
            with pytest.raises(ValueError, match="Missing required"):
                parse_room_config(Path(f.name), check_files=False)

    def test_no_frontmatter_raises(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False) as f:
            f.write("# No frontmatter\nJust markdown.")
            f.flush()
            with pytest.raises(ValueError, match="No YAML frontmatter"):
                parse_room_config(Path(f.name), check_files=False)


class TestValidateScript:
    def test_example_config_validates(self):
        """The shipped example.md must parse without error."""
        example = Path(__file__).parent.parent.parent / "rooms" / "example.md"
        if not example.exists():
            pytest.skip("rooms/example.md not found")
        config = parse_room_config(example, check_files=False)
        assert config.room_id == "scramble-demo"
        assert config.instance_id == 1
        assert len(config.system_prompt) > 0
        assert len(config.welcome_message) > 0
