#!/usr/bin/env python3
import socket
import sys
import time


def send_line(sock: socket.socket, line: str) -> None:
    sock.sendall((line + "\r\n").encode("utf-8"))


def main() -> int:
    host = sys.argv[1] if len(sys.argv) > 1 else "127.0.0.1"
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 7668
    channel = sys.argv[3] if len(sys.argv) > 3 else "#world-ridge-overlook"
    messages = [
        ("bot-a", "ridge team checking in"),
        ("bot-b", "copy, i can see the overlook"),
        ("bot-c", "holding position near the tower"),
    ]

    for nick, text in messages:
        sock = socket.create_connection((host, port), timeout=5)
        send_line(sock, f"NICK {nick}")
        send_line(sock, f"USER {nick} 0 * :{nick}")
        time.sleep(0.15)
        send_line(sock, f"JOIN {channel}")
        time.sleep(0.15)
        send_line(sock, f"PRIVMSG {channel} :{text}")
        time.sleep(0.15)
        send_line(sock, "QUIT")
        sock.close()
        print(f"{nick}: {text}")
        time.sleep(0.1)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
