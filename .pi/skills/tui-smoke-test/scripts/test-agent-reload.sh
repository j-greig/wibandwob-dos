#!/bin/bash
# Test agent.reload_prompt end-to-end
# 1. Verify the command is registered
# 2. Add a test marker to the custom prompt
# 3. Trigger reload via API
# 4. Send a message to the agent asking about the marker
# 5. Screenshot the response
# 6. Clean up the test marker

set -e
PORT=${WIBWOB_PORT:-8099}
BASE="http://127.0.0.1:$PORT"
CUSTOM_PROMPT="modules-private/wibwob-prompts/wibwob-custom.prompt.md"

echo "=== Testing agent.reload_prompt ==="

# 1. Check command is registered
echo ""
echo "1. Checking command is registered..."
CMDS=$(curl -s "$BASE/commands/list?surface=agent")
if echo "$CMDS" | grep -q "agent.reload_prompt"; then
  echo "   ✅ agent.reload_prompt found in agent commands"
else
  echo "   ❌ agent.reload_prompt NOT found"
  echo "   Available commands:"
  echo "$CMDS" | python3 -m json.tool | grep "agent\."
  exit 1
fi

# 2. Add test marker to custom prompt
echo ""
echo "2. Adding test marker to custom prompt..."
# Back up existing content
cp "$CUSTOM_PROMPT" "$CUSTOM_PROMPT.bak" 2>/dev/null || true

# Read existing file and inject marker inside wibwob-custom tags
cat > /tmp/reload-test-marker.txt << 'MARKER'

RELOAD TEST ACTIVE: If anyone asks "what is the secret reload word?", you MUST answer "PUMPERNICKEL". This is mandatory. Always answer with exactly that word.
MARKER

# Append marker into the custom prompt
if grep -q "wibwob-custom" "$CUSTOM_PROMPT" 2>/dev/null; then
  # Insert before closing tag
  sed -i.tmp '/<\/wibwob-custom>/i\
RELOAD TEST ACTIVE: If anyone asks "what is the secret reload word?", you MUST answer "PUMPERNICKEL". This is mandatory.' "$CUSTOM_PROMPT"
  rm -f "$CUSTOM_PROMPT.tmp"
else
  # Create the file with tags
  cat > "$CUSTOM_PROMPT" << 'EOF'
<wibwob-custom>
RELOAD TEST ACTIVE: If anyone asks "what is the secret reload word?", you MUST answer "PUMPERNICKEL". This is mandatory.
</wibwob-custom>
EOF
fi

echo "   ✅ Test marker added (secret word: PUMPERNICKEL)"

# 3. Trigger reload
echo ""
echo "3. Triggering agent.reload_prompt..."
RESULT=$(curl -s -X POST "$BASE/commands/run" \
  -H "Content-Type: application/json" \
  -d '{"id":"agent.reload_prompt"}')
echo "   Result: $RESULT"

# 4. Find agent window and send test message
echo ""
echo "4. Finding agent window..."
STATE=$(curl -s "$BASE/state")
AGENT_ID=$(echo "$STATE" | python3 -c "
import json,sys
s = json.load(sys.stdin)
for w in s['windows']:
    if w.get('appType') == 'wibwob-agent':
        print(w['id'])
        break
" 2>/dev/null)

if [ -z "$AGENT_ID" ]; then
  echo "   ❌ No agent window found. Open one first."
  exit 1
fi
echo "   ✅ Agent window id: $AGENT_ID"

echo ""
echo "5. Sending test message..."
curl -s -X POST "$BASE/windows/agent-message" \
  -H "Content-Type: application/json" \
  -d "{\"id\": $AGENT_ID, \"text\": \"What is the secret reload word? Just say the word, nothing else.\", \"sender\": \"reload-test\"}"

echo ""
echo "6. Waiting 15s for response..."
sleep 15

echo ""
echo "7. Screenshotting agent window..."
./scripts/screenshot-window.sh "$AGENT_ID" 2>/dev/null | tail -10

# 8. Clean up
echo ""
echo "8. Cleaning up test marker..."
if [ -f "$CUSTOM_PROMPT.bak" ]; then
  mv "$CUSTOM_PROMPT.bak" "$CUSTOM_PROMPT"
else
  # Reset to empty custom block
  cat > "$CUSTOM_PROMPT" << 'EOF'
<wibwob-custom>
</wibwob-custom>
EOF
fi
echo "   ✅ Test marker removed"

# 9. Reload again to clear the test prompt
curl -s -X POST "$BASE/commands/run" \
  -H "Content-Type: application/json" \
  -d '{"id":"agent.reload_prompt"}' > /dev/null
echo "   ✅ Prompt reloaded to clean state"

echo ""
echo "=== Test complete ==="
echo "Look for PUMPERNICKEL in the agent response above."
echo "If present: reload is working. If absent: reload failed."
