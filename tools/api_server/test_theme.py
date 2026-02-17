#!/usr/bin/env python3
"""
Theme integration tests for E005

Tests theme state storage, get_state response, and reset functionality.
Requires TUI app running with IPC socket.
"""

import socket
import json
import time


def send_ipc_command(cmd: str, sock_path: str = "/tmp/test_pattern_app.sock") -> str:
    """Send IPC command and return response"""
    s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    try:
        s.connect(sock_path)
        s.sendall((cmd + "\n").encode("utf-8"))
        data = s.recv(4096)
        return data.decode("utf-8", errors="ignore").strip()
    finally:
        s.close()


def test_get_state_has_theme_fields():
    """AC-1, AC-2: get_state returns theme_mode and theme_variant fields"""
    print("\n=== Test: get_state has theme fields ===")
    
    response = send_ipc_command("cmd:get_state")
    print(f"Response: {response[:200]}...")
    
    try:
        state = json.loads(response)
        assert "theme_mode" in state, "theme_mode field missing from get_state"
        assert "theme_variant" in state, "theme_variant field missing from get_state"
        
        print(f"✓ theme_mode: {state['theme_mode']}")
        print(f"✓ theme_variant: {state['theme_variant']}")
        print("PASS: get_state has theme fields")
        return True
    except json.JSONDecodeError as e:
        print(f"FAIL: Invalid JSON response: {e}")
        return False
    except AssertionError as e:
        print(f"FAIL: {e}")
        return False


def test_set_theme_mode():
    """AC-1: set_theme_mode stores mode and get_state reflects it"""
    print("\n=== Test: set_theme_mode ===")
    
    # Set to dark using command registry path
    response = send_ipc_command("cmd:exec_command name=set_theme_mode mode=dark")
    print(f"set_theme_mode dark response: {response}")
    assert response == "ok", f"Expected 'ok', got '{response}'"
    
    time.sleep(0.1)  # Brief delay for state to stabilize
    
    # Verify via get_state
    response = send_ipc_command("cmd:get_state")
    state = json.loads(response)
    
    if state.get("theme_mode") == "dark":
        print(f"✓ theme_mode is 'dark' after set_theme_mode dark")
        print("PASS: set_theme_mode works")
        return True
    else:
        print(f"FAIL: theme_mode is '{state.get('theme_mode')}', expected 'dark'")
        return False


def test_set_theme_variant():
    """AC-2: set_theme_variant stores variant and get_state reflects it"""
    print("\n=== Test: set_theme_variant ===")
    
    # Set to dark_pastel using command registry path
    response = send_ipc_command("cmd:exec_command name=set_theme_variant variant=dark_pastel")
    print(f"set_theme_variant dark_pastel response: {response}")
    assert response == "ok", f"Expected 'ok', got '{response}'"
    
    time.sleep(0.1)
    
    # Verify via get_state
    response = send_ipc_command("cmd:get_state")
    state = json.loads(response)
    
    if state.get("theme_variant") == "dark_pastel":
        print(f"✓ theme_variant is 'dark_pastel' after set_theme_variant dark_pastel")
        print("PASS: set_theme_variant works")
        return True
    else:
        print(f"FAIL: theme_variant is '{state.get('theme_variant')}', expected 'dark_pastel'")
        return False


def test_reset_theme():
    """AC-4: reset_theme restores monochrome/light defaults"""
    print("\n=== Test: reset_theme ===")
    
    # First set to dark + dark_pastel using command registry path
    send_ipc_command("cmd:exec_command name=set_theme_mode mode=dark")
    send_ipc_command("cmd:exec_command name=set_theme_variant variant=dark_pastel")
    time.sleep(0.1)
    
    # Reset using command registry path
    response = send_ipc_command("cmd:exec_command name=reset_theme")
    print(f"reset_theme response: {response}")
    assert response == "ok", f"Expected 'ok', got '{response}'"
    
    time.sleep(0.1)
    
    # Verify defaults restored
    response = send_ipc_command("cmd:get_state")
    state = json.loads(response)
    
    mode_ok = state.get("theme_mode") == "light"
    variant_ok = state.get("theme_variant") == "monochrome"
    
    if mode_ok and variant_ok:
        print(f"✓ theme_mode reset to 'light'")
        print(f"✓ theme_variant reset to 'monochrome'")
        print("PASS: reset_theme works")
        return True
    else:
        print(f"FAIL: Expected light/monochrome, got {state.get('theme_mode')}/{state.get('theme_variant')}")
        return False


def test_invalid_mode():
    """Test that invalid mode values are rejected"""
    print("\n=== Test: invalid mode rejection ===")
    
    response = send_ipc_command("cmd:exec_command name=set_theme_mode mode=invalid")
    
    if response.startswith("err"):
        print(f"✓ Invalid mode rejected: {response}")
        print("PASS: invalid mode rejection")
        return True
    else:
        print(f"FAIL: Expected error, got '{response}'")
        return False


def test_invalid_variant():
    """Test that invalid variant values are rejected"""
    print("\n=== Test: invalid variant rejection ===")
    
    response = send_ipc_command("cmd:exec_command name=set_theme_variant variant=invalid")
    
    if response.startswith("err"):
        print(f"✓ Invalid variant rejected: {response}")
        print("PASS: invalid variant rejection")
        return True
    else:
        print(f"FAIL: Expected error, got '{response}'")
        return False


def test_snapshot_roundtrip():
    """AC-5: Theme state survives snapshot round-trip"""
    print("\n=== Test: snapshot round-trip with theme ===")
    
    import os
    import tempfile
    
    # Set theme to dark + dark_pastel using command registry path
    send_ipc_command("cmd:exec_command name=set_theme_mode mode=dark")
    send_ipc_command("cmd:exec_command name=set_theme_variant variant=dark_pastel")
    time.sleep(0.1)
    
    # Export state - use secure temporary file
    fd, export_path = tempfile.mkstemp(suffix=".json", prefix="wibwob_test_")
    os.close(fd)  # Close fd, we'll use the path
    
    try:
        export_resp = send_ipc_command(f"cmd:export_state path={export_path}")
        print(f"export_state response: {export_resp}")
        
        if not export_resp.startswith("ok"):
            print(f"FAIL: Export failed: {export_resp}")
            return False
        
        if not os.path.exists(export_path):
            print(f"FAIL: Export file not created: {export_path}")
            return False
        
        # Read exported file to verify theme fields present
        with open(export_path, 'r') as f:
            exported_data = json.load(f)
        
        print(f"Exported theme_mode: {exported_data.get('theme_mode')}")
        print(f"Exported theme_variant: {exported_data.get('theme_variant')}")
        
        if exported_data.get('theme_mode') != 'dark' or exported_data.get('theme_variant') != 'dark_pastel':
            print(f"FAIL: Exported theme fields incorrect")
            return False
        
        # Reset theme to defaults using command registry path
        send_ipc_command("cmd:exec_command name=reset_theme")
        time.sleep(0.1)
        
        # Verify reset
        state = json.loads(send_ipc_command("cmd:get_state"))
        if state.get('theme_mode') != 'light' or state.get('theme_variant') != 'monochrome':
            print("FAIL: Theme not reset before import")
            return False
        
        # Import state
        import_resp = send_ipc_command(f"cmd:import_state path={export_path}")
        print(f"import_state response: {import_resp}")
        time.sleep(0.1)
        
        # Verify theme restored
        state = json.loads(send_ipc_command("cmd:get_state"))
        
        mode_ok = state.get('theme_mode') == 'dark'
        variant_ok = state.get('theme_variant') == 'dark_pastel'
        
        if mode_ok and variant_ok:
            print(f"✓ theme_mode restored to 'dark' after import")
            print(f"✓ theme_variant restored to 'dark_pastel' after import")
            print("PASS: snapshot round-trip preserves theme")
            return True
        else:
            print(f"FAIL: Theme not restored: {state.get('theme_mode')}/{state.get('theme_variant')}")
            return False
    finally:
        # Ensure cleanup even if test fails
        if os.path.exists(export_path):
            os.unlink(export_path)


def main():
    print("=" * 60)
    print("E005 Theme Integration Tests")
    print("=" * 60)
    print("\nPrerequisite: TUI app must be running with IPC socket")
    print("Start with: ./build/app/test_pattern")
    
    tests = [
        test_get_state_has_theme_fields,
        test_set_theme_mode,
        test_set_theme_variant,
        test_reset_theme,
        test_invalid_mode,
        test_invalid_variant,
        test_snapshot_roundtrip,
    ]
    
    results = []
    for test in tests:
        try:
            passed = test()
            results.append((test.__name__, passed))
        except Exception as e:
            print(f"EXCEPTION in {test.__name__}: {e}")
            import traceback
            traceback.print_exc()
            results.append((test.__name__, False))
    
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    
    for name, passed in results:
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"{status}: {name}")
    
    passed_count = sum(1 for _, p in results if p)
    total_count = len(results)
    
    print(f"\n{passed_count}/{total_count} tests passed")
    
    if passed_count == total_count:
        print("\n🎉 All tests passed!")
        return 0
    else:
        print(f"\n❌ {total_count - passed_count} test(s) failed")
        return 1


if __name__ == "__main__":
    exit(main())
