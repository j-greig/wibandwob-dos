#!/usr/bin/env python3
"""Validate a room config file."""

import sys
from pathlib import Path

from room_config import parse_room_config


def main():
    if len(sys.argv) < 2:
        print("Usage: validate_config.py <room_config.md> [--no-file-check]", file=sys.stderr)
        sys.exit(1)

    path = Path(sys.argv[1])
    check_files = "--no-file-check" not in sys.argv

    if not path.exists():
        print(f"File not found: {path}", file=sys.stderr)
        sys.exit(1)

    try:
        config = parse_room_config(path, check_files=check_files)
    except ValueError as e:
        print(f"INVALID: {e}", file=sys.stderr)
        sys.exit(1)

    print(f"OK: {config.room_id}")
    print(f"  display_name:   {config.display_name}")
    print(f"  instance_id:    {config.instance_id}")
    print(f"  ttyd_port:      {config.ttyd_port}")
    print(f"  layout_path:    {config.layout_path}")
    print(f"  api_key_source: {config.api_key_source}")
    print(f"  max_visitors:   {config.max_visitors}")
    print(f"  preload_files:  {config.preload_files}")
    print(f"  system_prompt:  {len(config.system_prompt)} chars")
    print(f"  welcome_msg:    {len(config.welcome_message)} chars")


if __name__ == "__main__":
    main()
