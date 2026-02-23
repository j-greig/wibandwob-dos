#!/usr/bin/env python3

from __future__ import annotations

import re
import sys
from pathlib import Path


STATELESS_TYPES = {
    "terminal",
    "browser",
    "scramble",
    "quadra",
    "snake",
    "rogue",
    "deep_signal",
    "app_launcher",
    "wibwob",
    "orbit",
    "torus",
    "cube",
    "life",
    "blocks",
    "score",
    "ascii",
    "animated_gradient",
    "monster_cam",
    "monster_verse",
    "monster_portal",
    "paint",
    "micropolis_ascii",
    "mycelium",
    "verse",
    "text_editor",
    "test_pattern",
    "gradient",
}


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError:
        print(f"Missing file: {path}", file=sys.stderr)
        raise


def extract_registry_types(text: str) -> list[str]:
    start = text.find("k_specs[]")
    if start == -1:
        return []
    brace_start = text.find("{", start)
    if brace_start == -1:
        return []
    end = text.find("};", brace_start)
    if end == -1:
        end = len(text)
    block = text[brace_start:end]
    pattern = re.compile(r"\{\s*\"([^\"]+)\"\s*,")
    return pattern.findall(block)


def extract_section(text: str, start_token: str, end_tokens: list[str]) -> str:
    start = text.find(start_token)
    if start == -1:
        return ""
    end = len(text)
    for token in end_tokens:
        idx = text.find(token, start + len(start_token))
        if idx != -1:
            end = min(end, idx)
    return text[start:end]


def extract_type_conditions(section: str) -> set[str]:
    return set(re.findall(r"type\s*==\s*\"([^\"]+)\"", section))


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    registry_path = root / "app" / "window_type_registry.cpp"
    app_path = root / "app" / "test_pattern_app.cpp"

    registry_text = read_text(registry_path)
    app_text = read_text(app_path)

    registry_types = extract_registry_types(registry_text)

    build_section = extract_section(
        app_text,
        "std::string TTestPatternApp::buildWorkspaceJson",
        ["void TTestPatternApp::saveWorkspace"],
    )
    restore_section = extract_section(
        app_text,
        "bool TTestPatternApp::loadWorkspaceFromFile",
        ["void TTestPatternApp::loadWorkspace", "bool TTestPatternApp::openWorkspacePath"],
    )

    save_types = extract_type_conditions(build_section)
    restore_types = extract_type_conditions(restore_section)

    type_width = max(len("TYPE"), *(len(t) for t in registry_types)) if registry_types else len("TYPE")
    reg_width = len("REGISTRY")
    save_width = len("SAVE")
    restore_width = len("RESTORE")

    header = (
        f"{'TYPE':<{type_width}}  "
        f"{'REGISTRY':<{reg_width}}  "
        f"{'SAVE':<{save_width}}  "
        f"{'RESTORE':<{restore_width}}  "
        "STATUS"
    )
    print(header)

    has_gap = False
    for type_name in registry_types:
        reg_cell = "✅"
        if type_name in STATELESS_TYPES:
            save_cell = "—"
            restore_cell = "—"
            status = "stateless"
        else:
            save_ok = type_name in save_types
            restore_ok = type_name in restore_types
            save_cell = "✅" if save_ok else "❌"
            restore_cell = "✅" if restore_ok else "❌"
            status = "ok" if save_ok and restore_ok else "GAP"
            if status == "GAP":
                has_gap = True

        print(
            f"{type_name:<{type_width}}  "
            f"{reg_cell:<{reg_width}}  "
            f"{save_cell:<{save_width}}  "
            f"{restore_cell:<{restore_width}}  "
            f"{status}"
        )

    return 1 if has_gap else 0


if __name__ == "__main__":
    sys.exit(main())
