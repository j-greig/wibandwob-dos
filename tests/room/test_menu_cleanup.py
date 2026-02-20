"""Tests for E009 menu system cleanup.

Validates command ID uniqueness and menu structural integrity
by parsing the C++ source directly (static analysis).
"""
import re
from pathlib import Path

APP_CPP = Path(__file__).resolve().parents[2] / "app" / "test_pattern_app.cpp"
SCRAMBLE_H = Path(__file__).resolve().parents[2] / "app" / "scramble_view.h"
WINDOW_REG_CPP = Path(__file__).resolve().parents[2] / "app" / "window_type_registry.cpp"


def _parse_command_ids():
    """Extract all cmXxx = NNN constants from source files."""
    pattern = re.compile(r"const\s+ushort\s+(cm\w+)\s*=\s*(\d+)\s*;")
    ids = {}
    for src in [APP_CPP, SCRAMBLE_H]:
        if not src.exists():
            continue
        for line in src.read_text().splitlines():
            m = pattern.search(line)
            if m:
                name, val = m.group(1), int(m.group(2))
                ids[name] = val
    return ids


def _parse_menu_items():
    """Extract menu item labels from initMenuBar() in source."""
    src = APP_CPP.read_text()
    # Find initMenuBar function
    start = src.find("TTestPatternApp::initMenuBar")
    if start == -1:
        return []
    # Find next function definition (initStatusLine follows initMenuBar)
    end = src.find("\nTStatusLine*", start)
    if end == -1:
        end = src.find("\nvoid ", start + 100)
    menu_src = src[start:end] if end != -1 else src[start:start + 5000]
    # Extract TMenuItem labels
    pattern = re.compile(r'new TMenuItem\("([^"]+)"')
    return pattern.findall(menu_src)


def _parse_menu_accelerators():
    """Extract per-menu accelerator keys from initMenuBar()."""
    src = APP_CPP.read_text()
    start = src.find("TTestPatternApp::initMenuBar")
    if start == -1:
        return {}
    end = src.find("\nTStatusLine*", start)
    if end == -1:
        end = src.find("\nvoid ", start + 100)
    menu_src = src[start:end] if end != -1 else src[start:start + 5000]

    menus = {}
    current_menu = None
    for line in menu_src.splitlines():
        # Detect submenu headers
        sm = re.search(r'new TSubMenu\("~(\w)~(\w+)"', line)
        if sm:
            current_menu = sm.group(2).strip()
            menus[current_menu] = []
            continue
        # Detect menu items with accelerators
        mi = re.search(r'new TMenuItem\("([^"]+)"', line)
        if mi and current_menu:
            label = mi.group(1)
            # Find the tilde-marked accelerator
            acc = re.search(r"~(\w)~", label)
            if acc:
                menus[current_menu].append((acc.group(1).upper(), label))
    return menus


# --- Tests ---


def test_no_command_id_collisions():
    """AC: No command ID collisions in cmXxx constants."""
    ids = _parse_command_ids()
    # Build reverse map: value -> list of names
    by_value = {}
    for name, val in ids.items():
        by_value.setdefault(val, []).append(name)
    # cmScrambleCat is an intentional alias for cmScrambleToggle
    aliases = {"cmScrambleCat"}
    collisions = {
        v: names
        for v, names in by_value.items()
        if len(names) > 1 and not all(n in aliases for n in names[1:])
    }
    assert not collisions, f"Command ID collisions found: {collisions}"


def test_dead_ends_removed():
    """AC: Dead-end menu items removed (Mechs, Zoom, placeholders)."""
    items = _parse_menu_items()
    removed = [
        "New ~M~echs Grid",
        "Zoom ~I~n",
        "Zoom ~O~ut",
        "~A~ctual Size",
        "~F~ull Screen",
        "~A~NSI Editor",
        "Animation ~S~tudio",
        "Glitch Se~t~tings",
        "Test A",
        "Test B",
        "Test C",
        "Background ~C~olor",
    ]
    for dead in removed:
        matches = [i for i in items if dead in i]
        assert not matches, f"Dead-end menu item still present: {dead}"


def test_help_menu_has_keyboard_shortcuts():
    """AC: Keyboard Shortcuts added to Help menu."""
    items = _parse_menu_items()
    assert any("eyboard Shortcuts" in i for i in items), \
        "Keyboard Shortcuts not found in menu"


def test_help_menu_has_api_key_help():
    """AC: API Key Help added to Help menu."""
    items = _parse_menu_items()
    assert any("Key Help" in i for i in items), \
        "API Key Help not found in menu"


def test_no_accelerator_collisions_per_menu():
    """AC: Menu accelerator keys are unique within each menu."""
    menus = _parse_menu_accelerators()
    for menu_name, accs in menus.items():
        seen = {}
        for key, label in accs:
            if key in seen:
                assert False, (
                    f"Accelerator '{key}' collision in {menu_name} menu: "
                    f"'{seen[key]}' vs '{label}'"
                )
            seen[key] = label


def test_text_editor_has_register_window():
    """AC: text_editor handler calls registerWindow()."""
    src = APP_CPP.read_text()
    # Find the cmTextEditor case block
    idx = src.find("case cmTextEditor:")
    assert idx != -1, "cmTextEditor handler not found"
    # Check the next ~10 lines for registerWindow
    block = src[idx : idx + 300]
    assert "registerWindow(" in block, \
        "registerWindow() not called in cmTextEditor handler"


def test_text_editor_create_window_title_is_forwarded():
    """AC: create_window title propagates to text_editor window constructor."""
    app_src = APP_CPP.read_text()
    reg_src = WINDOW_REG_CPP.read_text()
    assert "void api_spawn_text_editor(" in app_src
    assert "const std::string& title" in app_src
    assert 'createTextEditorWindow(r,' in app_src
    assert '"Text Editor"' in app_src
    assert 'title.c_str()' in app_src
    assert 'const auto it = kv.find("title");' in reg_src
    assert 'api_spawn_text_editor(app, opt_bounds(kv, r), title);' in reg_src
