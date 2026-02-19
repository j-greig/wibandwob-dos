"""Tests for F06: Multiplayer room config extension (E008)."""

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "tools" / "room"))
from room_config import (
    RoomConfig,
    parse_room_config,
    validate_frontmatter,
    extract_section,
    parse_frontmatter,
)

# ── Helpers ──────────────────────────────────────────────────────────────────

VALID_MP_FRONTMATTER = {
    "room_id": "wibwob-shared",
    "instance_id": 2,
    "ttyd_port": 7682,
    "multiplayer": True,
    "partykit_room": "wibwob-shared",
    "partykit_server": "https://wibwob.test.partykit.dev",
    "max_players": 2,
}

VALID_SP_FRONTMATTER = {
    "room_id": "scramble-demo",
    "instance_id": 1,
    "ttyd_port": 7681,
}


# ── AC-1: parse multiplayer fields ────────────────────────────────────────────

class TestMultiplayerFieldsParsed:
    def test_multiplayer_true_parsed(self):
        errors = validate_frontmatter(VALID_MP_FRONTMATTER)
        assert errors == [], f"Unexpected errors: {errors}"

    def test_multiplayer_fields_in_room_config(self, tmp_path):
        md = tmp_path / "mp.md"
        md.write_text(
            "---\n"
            "room_id: wibwob-shared\n"
            "instance_id: 2\n"
            "ttyd_port: 7682\n"
            "multiplayer: true\n"
            "partykit_room: wibwob-shared\n"
            "partykit_server: https://wibwob.test.partykit.dev\n"
            "max_players: 2\n"
            "---\n\n"
            "## System Prompt\n\nYou are a symbient.\n",
            encoding="utf-8",
        )
        cfg = parse_room_config(md, check_files=False)
        assert cfg.multiplayer is True
        assert cfg.partykit_room == "wibwob-shared"
        assert cfg.partykit_server == "https://wibwob.test.partykit.dev"
        assert cfg.max_players == 2

    def test_single_player_config_unaffected(self, tmp_path):
        md = tmp_path / "sp.md"
        md.write_text(
            "---\n"
            "room_id: scramble-demo\n"
            "instance_id: 1\n"
            "ttyd_port: 7681\n"
            "---\n\n"
            "## System Prompt\n\nYou are Scramble.\n",
            encoding="utf-8",
        )
        cfg = parse_room_config(md, check_files=False)
        assert cfg.multiplayer is False
        assert cfg.partykit_room == ""
        assert cfg.partykit_server == ""
        assert cfg.max_players == 2  # default

    def test_multiplayer_example_config_parses(self):
        """rooms/multiplayer-example.md parses without errors (check_files=False)."""
        rooms_dir = Path(__file__).parent.parent.parent / "rooms"
        mp_config = rooms_dir / "multiplayer-example.md"
        assert mp_config.exists(), "multiplayer-example.md must exist"
        cfg = parse_room_config(mp_config, check_files=False)
        assert cfg.multiplayer is True
        assert cfg.partykit_room == "wibwob-shared"
        assert cfg.system_prompt != ""


# ── AC-2: orchestrator passes env vars ───────────────────────────────────────

class TestOrchestratorMultiplayerEnv:
    def _make_mp_config(self) -> RoomConfig:
        return RoomConfig(
            room_id="wibwob-shared",
            instance_id=2,
            ttyd_port=7682,
            multiplayer=True,
            partykit_room="wibwob-shared",
            partykit_server="https://wibwob.test.partykit.dev",
        )

    def _make_sp_config(self) -> RoomConfig:
        return RoomConfig(room_id="scramble-demo", instance_id=1, ttyd_port=7681)

    def test_partykit_env_vars_set_for_multiplayer(self, tmp_path):
        sys.path.insert(0, str(Path(__file__).parent.parent.parent / "tools" / "room"))
        from orchestrator import Orchestrator

        orch = Orchestrator(project_root=tmp_path)
        cfg = self._make_mp_config()

        captured_env = {}

        def fake_popen(cmd, env=None, **kwargs):
            captured_env.update(env or {})
            m = MagicMock()
            m.poll.return_value = None
            return m

        with patch("orchestrator.subprocess.Popen", side_effect=fake_popen):
            orch.spawn_room(cfg)

        assert "WIBWOB_PARTYKIT_URL" in captured_env, "WIBWOB_PARTYKIT_URL must be set for multiplayer rooms"
        assert captured_env["WIBWOB_PARTYKIT_URL"] == "https://wibwob.test.partykit.dev"
        assert "WIBWOB_PARTYKIT_ROOM" in captured_env
        assert captured_env["WIBWOB_PARTYKIT_ROOM"] == "wibwob-shared"

    def test_partykit_env_vars_absent_for_single_player(self, tmp_path):
        sys.path.insert(0, str(Path(__file__).parent.parent.parent / "tools" / "room"))
        from orchestrator import Orchestrator

        orch = Orchestrator(project_root=tmp_path)
        cfg = self._make_sp_config()

        captured_env = {}

        def fake_popen(cmd, env=None, **kwargs):
            captured_env.update(env or {})
            m = MagicMock()
            m.poll.return_value = None
            return m

        with patch("orchestrator.subprocess.Popen", side_effect=fake_popen):
            orch.spawn_room(cfg)

        assert "WIBWOB_PARTYKIT_URL" not in captured_env, "WIBWOB_PARTYKIT_URL must NOT be set for single-player rooms"
        assert "WIBWOB_PARTYKIT_ROOM" not in captured_env


# ── AC-3: validation rejects multiplayer:true without required fields ─────────

class TestMultiplayerValidation:
    def test_multiplayer_without_partykit_room_rejected(self):
        fm = {**VALID_MP_FRONTMATTER}
        del fm["partykit_room"]
        errors = validate_frontmatter(fm)
        assert any("partykit_room" in e for e in errors), f"Expected partykit_room error, got: {errors}"

    def test_multiplayer_without_partykit_server_rejected(self):
        fm = {**VALID_MP_FRONTMATTER}
        del fm["partykit_server"]
        errors = validate_frontmatter(fm)
        assert any("partykit_server" in e for e in errors), f"Expected partykit_server error, got: {errors}"

    def test_multiplayer_false_no_partykit_required(self):
        fm = {**VALID_SP_FRONTMATTER, "multiplayer": False}
        errors = validate_frontmatter(fm)
        assert errors == []

    def test_multiplayer_absent_no_partykit_required(self):
        errors = validate_frontmatter(VALID_SP_FRONTMATTER)
        assert errors == []

    def test_max_players_below_2_rejected(self):
        fm = {**VALID_MP_FRONTMATTER, "max_players": 1}
        errors = validate_frontmatter(fm)
        assert any("max_players" in e for e in errors), f"Expected max_players error, got: {errors}"

    def test_max_players_2_valid(self):
        fm = {**VALID_MP_FRONTMATTER, "max_players": 2}
        errors = validate_frontmatter(fm)
        assert errors == []

    def test_max_players_4_valid(self):
        fm = {**VALID_MP_FRONTMATTER, "max_players": 4}
        errors = validate_frontmatter(fm)
        assert errors == []
