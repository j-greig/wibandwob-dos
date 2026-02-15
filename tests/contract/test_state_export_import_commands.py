from __future__ import annotations

from pathlib import Path


def test_state_export_import_command_paths_exist() -> None:
    ipc_source = Path("app/api_ipc.cpp").read_text(encoding="utf-8")
    controller_source = Path("tools/api_server/controller.py").read_text(encoding="utf-8")
    main_source = Path("tools/api_server/main.py").read_text(encoding="utf-8")

    assert 'cmd == "export_state"' in ipc_source
    assert 'cmd == "import_state"' in ipc_source
    assert 'send_cmd("export_state"' in controller_source
    assert 'send_cmd("import_state"' in controller_source
    assert '@app.post("/state/export")' in main_source
    assert '@app.post("/state/import")' in main_source
