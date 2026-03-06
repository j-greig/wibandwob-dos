#!/bin/bash
# dev-irc-bot-burst-active — fire bot burst to whichever channel the app has joined
# Usage: bash scripts/dev-irc-bot-burst-active.sh [host] [port]
PORT=${CONTROL_API_PORT:-8099}
IRC_HOST=${1:-127.0.0.1}
IRC_PORT=${2:-6667}

CHANNEL=$(curl -s "http://127.0.0.1:$PORT/world-chat/channels" | python3 -c "
import sys,json
d=json.load(sys.stdin)
chans = [c['id'] for c in d.get('channels',[]) if c.get('participants')]
print(chans[0] if chans else '')
" 2>/dev/null)

if [ -z "$CHANNEL" ]; then
  echo "No active channel found — join a chatspot first"
  exit 1
fi

echo "Bursting to: $CHANNEL"
python3 scripts/dev-irc-bot-burst.py "$IRC_HOST" "$IRC_PORT" "$CHANNEL"
