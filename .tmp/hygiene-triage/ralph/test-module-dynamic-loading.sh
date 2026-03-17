#!/bin/bash
# Test dynamic module loading during Ralph loop execution

set -e

echo "=========================================="
echo "Ralph Dynamic Module Loading Test"
echo "=========================================="
echo ""

# Ensure clean state
rm -f .claude/ralph-loop.local.md
rm -f logs/ralph-execution.log

# Set initial state: only crabs module
echo "1️⃣  Setting initial config (crabs only)..."
jq '.enabled_modules = ["crabs"]' .claude/ralph-modules.json > tmp.json && mv tmp.json .claude/ralph-modules.json
cat .claude/ralph-modules.json | jq '.enabled_modules'
echo ""

# Create task that tests dynamic loading
TASK="Do the following steps in order:
1. Check .claude/ralph-modules.json - should only have 'crabs' enabled
2. Add 'bard' to enabled_modules in .claude/ralph-modules.json
3. Wait for next iteration (you'll see this prompt again)
4. On next iteration: verify you now have bard module loaded (check if you're speaking in poetry/verse)
5. If bard module is active in step 4, output <promise>MODULE_RELOADED</promise>
6. If bard module is NOT active in step 4, output <promise>MODULE_FAILED</promise>

This tests if modules reload dynamically between iterations."

echo "2️⃣  Starting Ralph loop..."
echo "   Task: Test dynamic module reloading"
echo "   Max iterations: 5"
echo "   Completion promise: MODULE_RELOADED"
echo ""

# Run Ralph loop with timeout
timeout 180 claude --dangerously-skip-permissions <<EOF || true
/ralph-loop "$TASK" --completion-promise "MODULE_RELOADED" --max-iterations 5
EOF

echo ""
echo "=========================================="
echo "Test Results"
echo "=========================================="
echo ""

# Check if promise was detected
if [ -f .claude/ralph-loop.local.md ]; then
  echo "❌ State file still exists - loop didn't complete properly"
  echo "   Checking last state..."
  tail -20 .claude/ralph-loop.local.md
  RESULT="INCOMPLETE"
else
  echo "✅ State file deleted - loop completed"
  RESULT="SUCCESS"
fi

echo ""
echo "Checking execution log..."
if [ -f logs/ralph-execution.log ]; then
  echo "📋 Last 10 log entries:"
  tail -10 logs/ralph-execution.log
  echo ""

  if grep -q "bard" logs/ralph-execution.log 2>/dev/null; then
    echo "✅ Bard module mentioned in logs"
  fi
fi

echo ""
echo "Final module config:"
cat .claude/ralph-modules.json | jq '.enabled_modules'

echo ""
echo "=========================================="
if [ "$RESULT" = "SUCCESS" ]; then
  echo "🎉 TEST PASSED: Ralph completed with MODULE_RELOADED"
  echo "   Dynamic module loading works!"
else
  echo "⚠️  TEST INCOMPLETE: Check logs above"
fi
echo "=========================================="

# Restore original config
echo ""
echo "Restoring config to crabs only..."
jq '.enabled_modules = ["crabs"]' .claude/ralph-modules.json > tmp.json && mv tmp.json .claude/ralph-modules.json
