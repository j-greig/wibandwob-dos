from __future__ import annotations

import os
import socket
import base64
from typing import Dict, Optional


def resolve_sock_path() -> str:
    """Resolve IPC socket path.

    Priority:
    1. WIBWOB_INSTANCE env var → /tmp/wibwob_{instance}.sock
    2. Auto-discover: find any live /tmp/wibwob_*.sock
    3. Fallback: /tmp/wwdos.sock
    """
    instance = os.environ.get("WIBWOB_INSTANCE")
    if instance:
        return f"/tmp/wibwob_{instance}.sock"

    # Auto-discover: find any live wibwob socket
    import glob
    candidates = glob.glob("/tmp/wibwob_*.sock")
    for sock in candidates:
        try:
            s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            s.settimeout(0.5)
            s.connect(sock)
            s.close()
            return sock
        except (ConnectionRefusedError, OSError):
            continue

    return "/tmp/wwdos.sock"


_SOCK_PATH_CACHE: Optional[str] = None


def get_sock_path() -> str:
    """Lazy-resolve and cache the socket path."""
    global _SOCK_PATH_CACHE
    if _SOCK_PATH_CACHE is None:
        _SOCK_PATH_CACHE = resolve_sock_path()
    return _SOCK_PATH_CACHE


def reset_sock_path():
    """Force re-discovery (e.g. after connection failure)."""
    global _SOCK_PATH_CACHE
    _SOCK_PATH_CACHE = None


def send_cmd(cmd: str, kv: Optional[Dict[str, str]] = None) -> str:
    path = get_sock_path()

    # Build human-readable summary for logging
    params_summary = []
    for k, v in (kv or {}).items():
        if k == "content":
            # Truncate long content for readability
            preview = v[:50].replace("\n", "\\n")
            if len(v) > 50:
                preview += f"... ({len(v)} chars total)"
            params_summary.append(f"{k}='{preview}'")
        elif k == "type":
            params_summary.append(f"{k}={v}")
        elif k in ("id", "x", "y", "w", "h", "width", "height", "gradient", "font"):
            params_summary.append(f"{k}={v}")
        elif k == "path":
            # Show just filename for paths
            filename = os.path.basename(v) if v else "?"
            params_summary.append(f"{k}={filename}")
        else:
            params_summary.append(f"{k}={v[:30]}")

    params_str = ", ".join(params_summary) if params_summary else "(no params)"
    print(f"[IPC] → {cmd}({params_str})")

    s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    s.settimeout(5.0)  # 5 second timeout
    s.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, 65536)
    try:
        s.connect(path)
    except (FileNotFoundError, ConnectionRefusedError) as e:
        s.close()
        # Force re-discovery next call (socket may have moved or come up)
        reset_sock_path()
        print(f"[IPC] ✗ socket unavailable: {e}")
        return None
    try:
        parts = [f"cmd:{cmd}"]
        for k, v in (kv or {}).items():
            # Base64 encode values that might contain newlines or special chars
            # Special handling for "content" parameter which often has multiline text
            if k == "content" and ("\n" in v or "\r" in v or " " in v):
                # Base64 encode and add marker prefix
                encoded = base64.b64encode(v.encode("utf-8")).decode("ascii")
                parts.append(f"{k}=base64:{encoded}")
            else:
                # Escape spaces in other values
                escaped = v.replace(" ", "%20").replace("\n", "%0A").replace("\r", "%0D")
                parts.append(f"{k}={escaped}")
        line = " ".join(parts) + "\n"
        s.sendall(line.encode("utf-8"))
        chunks = []
        while True:
            chunk = s.recv(65536)
            if not chunk:
                break
            chunks.append(chunk)
        data = b"".join(chunks)

        # Parse response and show meaningful summary
        response = data.decode("utf-8", errors="ignore").strip()
        if response.startswith("err"):
            print(f"[IPC] ✗ {cmd} FAILED: {response}")
        elif response == "ok":
            print(f"[IPC] ✓ {cmd} succeeded")
        elif response.startswith("{"):
            # JSON response - try to parse and show key info
            try:
                import json
                resp_data = json.loads(response)
                if "windows" in resp_data:
                    win_count = len(resp_data["windows"])
                    print(f"[IPC] ✓ {cmd} → {win_count} windows")
                elif "width" in resp_data and "height" in resp_data:
                    print(f"[IPC] ✓ {cmd} → {resp_data['width']}×{resp_data['height']}")
                elif "id" in resp_data:
                    print(f"[IPC] ✓ {cmd} → id={resp_data['id']}")
                else:
                    print(f"[IPC] ✓ {cmd} → JSON ({len(response)} bytes)")
            except:
                print(f"[IPC] ✓ {cmd} → {response[:60]}")
        else:
            print(f"[IPC] ✓ {cmd} → {response[:80]}")

        return response
    except socket.timeout:
        print(f"[IPC] ERROR: Timeout waiting for response!")
        raise
    except Exception as e:
        print(f"[IPC] ERROR: {e}")
        raise
    finally:
        s.close()
        print(f"[IPC] Socket closed")
