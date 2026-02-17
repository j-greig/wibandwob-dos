from __future__ import annotations

import os
import socket
import base64
from typing import Dict, Optional


def _resolve_sock_path() -> str:
    """Resolve IPC socket path.

    Priority: TV_IPC_SOCK (explicit) > WIBWOB_INSTANCE (derived) > legacy default.
    """
    explicit = os.environ.get("TV_IPC_SOCK")
    if explicit:
        return explicit
    instance = os.environ.get("WIBWOB_INSTANCE")
    if instance:
        return f"/tmp/wibwob_{instance}.sock"
    return "/tmp/test_pattern_app.sock"


SOCK_PATH = _resolve_sock_path()


def send_cmd(cmd: str, kv: Optional[Dict[str, str]] = None) -> str:
    path = SOCK_PATH

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
    s.connect(path)
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
        data = s.recv(4096)

        # Parse response and show meaningful summary
        response = data.decode("utf-8", errors="ignore").strip()
        if response == "ok":
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
            print(f"[IPC] ✓ {cmd} → {response[:60]}")

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
