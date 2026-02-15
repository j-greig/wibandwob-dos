from __future__ import annotations

from pathlib import Path


def test_no_hardcoded_command_list_in_migrated_api_paths() -> None:
    main_source = Path("tools/api_server/main.py").read_text(encoding="utf-8")
    controller_source = Path("tools/api_server/controller.py").read_text(encoding="utf-8")

    # /capabilities should come from controller.get_capabilities(), not literal list.
    assert "commands=[" not in main_source

    # exec_command path should go through IPC exec_command, not command-by-command switch.
    assert 'if name == "cascade"' not in controller_source
    assert 'elif name == "tile"' not in controller_source
    assert 'send_cmd("exec_command", payload)' in controller_source
