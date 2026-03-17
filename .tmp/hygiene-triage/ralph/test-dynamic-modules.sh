#!/bin/bash
# Test dynamic module loading

echo "=========================================="
echo "Testing Dynamic Module Loading"
echo "=========================================="
echo ""

echo "1️⃣  Initial state: Only 'crabs' module enabled"
cat .claude/ralph-modules.json | jq '.enabled_modules'
echo ""

echo "📋 Loading prompt with current modules..."
PROMPT1=$(.claude/skills/ralph-wiggum/scripts/load-ralph-prompt.sh 2>/dev/null)
echo ""

if echo "$PROMPT1" | grep -q "crabs"; then
  echo "✅ Crabs module loaded"
else
  echo "❌ Crabs module NOT loaded"
fi

if echo "$PROMPT1" | grep -q "architect"; then
  echo "❌ Architect module loaded (shouldn't be!)"
else
  echo "✅ Architect module NOT loaded (correct)"
fi

echo ""
echo "=========================================="
echo ""

echo "2️⃣  Adding 'architect' module dynamically..."
jq '.enabled_modules += ["architect"]' .claude/ralph-modules.json > tmp.json && mv tmp.json .claude/ralph-modules.json
cat .claude/ralph-modules.json | jq '.enabled_modules'
echo ""

echo "📋 Reloading prompt (simulating next iteration)..."
PROMPT2=$(.claude/skills/ralph-wiggum/scripts/load-ralph-prompt.sh 2>/dev/null)
echo ""

if echo "$PROMPT2" | grep -q "crabs"; then
  echo "✅ Crabs module still loaded"
else
  echo "❌ Crabs module NOT loaded"
fi

if echo "$PROMPT2" | grep -q "architect"; then
  echo "✅ Architect module NOW loaded (dynamic loading works!)"
else
  echo "❌ Architect module NOT loaded (dynamic loading broken!)"
fi

echo ""
echo "=========================================="
echo ""

if echo "$PROMPT2" | grep -q "architect"; then
  echo "🎉 SUCCESS: Modules reload dynamically on each iteration!"
else
  echo "💀 FAILED: Modules are frozen (not reloading)"
fi

echo ""
echo "Restoring original config..."
jq '.enabled_modules = ["crabs"]' .claude/ralph-modules.json > tmp.json && mv tmp.json .claude/ralph-modules.json
echo "✅ Config restored"
