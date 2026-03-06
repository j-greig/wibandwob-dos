#!/bin/bash
# world-chat-status — quick summary of active world chat channels and transport
PORT=${CONTROL_API_PORT:-8099}

TMPFILE=$(mktemp)
curl -s "http://127.0.0.1:$PORT/world-chat/channels" > "$TMPFILE"
python3 - "$TMPFILE" << 'EOF'
import sys, json
data = json.load(open(sys.argv[1]))
t = data.get("transport", {})
kind = t.get("kind", "?")
conn = "●" if t.get("connected") else "○"
nick = t.get("nick", "")
server = t.get("server", "")
print(f"Transport: {kind}{conn}  nick:{nick}  server:{server}")
print()
for ch in data.get("channels", []):
    msgs = ch.get("messages", [])
    chat = [m for m in msgs if m.get("kind") == "chat"]
    participants = ch.get("participants", [])
    last = chat[-1] if chat else None
    last_str = f'<{last["sender"]}> {last["text"][:40]}' if last else "(no messages)"
    print(f"  {ch['id']}")
    print(f"    participants: {', '.join(participants) or '(none)'}")
    print(f"    messages: {len(msgs)} total, {len(chat)} chat")
    print(f"    last: {last_str}")
    print()
EOF
rm -f "$TMPFILE"
