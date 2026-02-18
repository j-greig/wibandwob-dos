"""Room config parser for WibWob-DOS teleport rooms.

Room configs are markdown files with YAML frontmatter.
Settings live in frontmatter, rich content in markdown sections.
"""

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import yaml


REQUIRED_FIELDS = {"room_id", "instance_id", "ttyd_port"}
FIELD_TYPES = {
    "room_id": str,
    "display_name": str,
    "instance_id": int,
    "ttyd_port": int,
    "layout_path": str,
    "api_key_source": str,
    "max_visitors": int,
    "preload_files": list,
    # Multiplayer fields (E008)
    "multiplayer": bool,
    "partykit_room": str,
    "partykit_server": str,
    "max_players": int,
}
VALID_API_KEY_SOURCES = {"env", "host_config", "visitor_dialog"}


@dataclass
class RoomConfig:
    """Parsed room configuration."""

    room_id: str
    instance_id: int
    ttyd_port: int
    display_name: str = ""
    layout_path: str = ""
    api_key_source: str = "env"
    max_visitors: int = 1
    preload_files: list = field(default_factory=list)
    system_prompt: str = ""
    welcome_message: str = ""
    raw_markdown: str = ""
    source_path: Optional[Path] = None
    # Multiplayer fields (E008) — absent/False = single-player
    multiplayer: bool = False
    partykit_room: str = ""
    partykit_server: str = ""
    max_players: int = 2


def parse_frontmatter(text: str) -> tuple[dict, str]:
    """Extract YAML frontmatter and remaining markdown body."""
    match = re.match(r"^---\s*\n(.*?)^---\s*\n(.*)$", text, re.DOTALL | re.MULTILINE)
    if not match:
        raise ValueError("No YAML frontmatter found (expected --- delimiters)")
    fm_text, body = match.group(1), match.group(2)
    fm = yaml.safe_load(fm_text)
    if not isinstance(fm, dict):
        raise ValueError("Frontmatter must be a YAML mapping")
    return fm, body


def extract_section(body: str, heading: str) -> str:
    """Extract content under a ## heading, stopping at next ## or end."""
    pattern = rf"^##\s+{re.escape(heading)}\s*\n(.*?)(?=^##\s|\Z)"
    match = re.search(pattern, body, re.MULTILINE | re.DOTALL)
    if not match:
        return ""
    return match.group(1).strip()


def validate_frontmatter(fm: dict, source_path: Optional[Path] = None) -> list[str]:
    """Validate frontmatter fields. Returns list of error strings."""
    errors = []

    missing = REQUIRED_FIELDS - set(fm.keys())
    if missing:
        errors.append(f"Missing required fields: {', '.join(sorted(missing))}")

    for key, expected_type in FIELD_TYPES.items():
        if key in fm and not isinstance(fm[key], expected_type):
            errors.append(
                f"Field '{key}' must be {expected_type.__name__}, "
                f"got {type(fm[key]).__name__}"
            )

    if "api_key_source" in fm and fm["api_key_source"] not in VALID_API_KEY_SOURCES:
        errors.append(
            f"api_key_source must be one of {VALID_API_KEY_SOURCES}, "
            f"got '{fm['api_key_source']}'"
        )

    if "ttyd_port" in fm and isinstance(fm["ttyd_port"], int):
        if not (1024 <= fm["ttyd_port"] <= 65535):
            errors.append(f"ttyd_port must be 1024-65535, got {fm['ttyd_port']}")

    if "max_visitors" in fm and isinstance(fm["max_visitors"], int):
        if fm["max_visitors"] < 1:
            errors.append(f"max_visitors must be >= 1, got {fm['max_visitors']}")

    if source_path and "preload_files" in fm:
        base = source_path.parent.parent  # rooms/ -> project root
        for f in fm.get("preload_files", []):
            if not (base / f).exists():
                errors.append(f"Preload file not found: {f}")

    # Multiplayer validation: if multiplayer:true, require partykit_room + partykit_server
    if fm.get("multiplayer") is True:
        if not fm.get("partykit_room"):
            errors.append("multiplayer:true requires 'partykit_room' field")
        if not fm.get("partykit_server"):
            errors.append("multiplayer:true requires 'partykit_server' field")
        if "max_players" in fm and isinstance(fm["max_players"], int):
            if fm["max_players"] < 2:
                errors.append(f"max_players must be >= 2 for multiplayer rooms, got {fm['max_players']}")

    return errors


def parse_room_config(path: Path, check_files: bool = True) -> RoomConfig:
    """Parse a room config file. Raises ValueError on invalid config."""
    text = path.read_text(encoding="utf-8")
    fm, body = parse_frontmatter(text)

    errors = validate_frontmatter(fm, path if check_files else None)
    if errors:
        raise ValueError(f"Invalid room config {path}:\n" + "\n".join(f"  - {e}" for e in errors))

    return RoomConfig(
        room_id=fm["room_id"],
        instance_id=fm["instance_id"],
        ttyd_port=fm["ttyd_port"],
        display_name=fm.get("display_name", fm["room_id"]),
        layout_path=fm.get("layout_path", ""),
        api_key_source=fm.get("api_key_source", "env"),
        max_visitors=fm.get("max_visitors", 1),
        preload_files=fm.get("preload_files", []),
        system_prompt=extract_section(body, "System Prompt"),
        welcome_message=extract_section(body, "Welcome Message"),
        raw_markdown=body,
        source_path=path,
        multiplayer=bool(fm.get("multiplayer", False)),
        partykit_room=fm.get("partykit_room", ""),
        partykit_server=fm.get("partykit_server", ""),
        max_players=fm.get("max_players", 2),
    )
