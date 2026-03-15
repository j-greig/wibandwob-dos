#!/usr/bin/env bash
# Static surface parity checks — run before commit or in CI.
# Catches contract drift that typecheck alone cannot.
set -euo pipefail

FAIL=0
SRC="src"

echo "=== Surface Parity Checks ==="
echo

# 1. Every command with agent:true must have a non-empty description
echo "1. Agent-visible commands with empty descriptions..."
# Find agent:true commands, check the description field nearby
MISSING_DESC=$(grep -B10 'agent:\s*true' "$SRC/core/command-catalog.ts" \
  | grep -B8 'agent:\s*true' \
  | grep 'description:\s*""' || true)
if [ -n "$MISSING_DESC" ]; then
  echo "   FAIL: commands with agent:true have empty descriptions:"
  echo "$MISSING_DESC"
  FAIL=1
else
  echo "   OK"
fi

# 2. Every describeState should return a known appType
echo "2. describeState appType values vs registered types..."
# Extract all appType string literals from describeState blocks
DESCRIBED_TYPES=$(grep -A3 'describeState.*=.*()' "$SRC"/windows/*.ts "$SRC"/services/microapp-loader.ts 2>/dev/null \
  | grep 'appType:.*"' \
  | sed 's/.*appType:[[:space:]]*"\([^"]*\)".*/\1/' \
  | sort -u)

# Extract PersistableAppType and TransientAppType from types.ts
REGISTERED_TYPES=$(grep '^\s*|' "$SRC/core/types.ts" \
  | sed 's/.*"\([^"]*\)".*/\1/' \
  | sort -u)

UNREGISTERED=""
for t in $DESCRIBED_TYPES; do
  if ! echo "$REGISTERED_TYPES" | grep -qx "$t"; then
    # Could be a dynamic/microapp type — skip those
    if [[ "$t" != *"."* ]]; then
      UNREGISTERED="$UNREGISTERED $t"
    fi
  fi
done
if [ -n "$UNREGISTERED" ]; then
  echo "   WARN: appTypes in describeState not found in types.ts:$UNREGISTERED"
  # Warning only — dynamic types are valid
else
  echo "   OK"
fi

# 3. Every registerWindow call should have a preceding describeState
echo "3. registerWindow calls without describeState..."
MISSING_DS=0
for f in "$SRC"/windows/*.ts "$SRC"/services/microapp-loader.ts; do
  [ -f "$f" ] || continue
  REG_COUNT=$(grep -c 'registerWindow(' "$f" 2>/dev/null || echo 0)
  DS_COUNT=$(grep -c 'describeState' "$f" 2>/dev/null || echo 0)
  if [ "$REG_COUNT" -gt 0 ] && [ "$DS_COUNT" -eq 0 ]; then
    echo "   FAIL: $(basename "$f") has $REG_COUNT registerWindow calls but no describeState"
    FAIL=1
    MISSING_DS=1
  fi
done
if [ "$MISSING_DS" -eq 0 ]; then
  echo "   OK"
fi

# 4. No direct getLastWindow in restore-related code
echo "4. getLastWindow in restore paths..."
RESTORE_GETLAST=$(grep -n 'getLastWindow' "$SRC/core/workspace-snapshots.ts" "$SRC/core/snapshot-registry.ts" 2>/dev/null || true)
if [ -n "$RESTORE_GETLAST" ]; then
  echo "   FAIL: getLastWindow still in restore code:"
  echo "$RESTORE_GETLAST"
  FAIL=1
else
  echo "   OK"
fi

# 5. syncState() should not exist (replaced by syncLiveState/persistState)
echo "5. Stale syncState() calls..."
STALE_SYNC=$(grep -rn 'this\.syncState()' "$SRC/core/app-controller.ts" 2>/dev/null || true)
if [ -n "$STALE_SYNC" ]; then
  echo "   FAIL: syncState() still called (should be syncLiveState or persistState):"
  echo "$STALE_SYNC"
  FAIL=1
else
  echo "   OK"
fi

echo
if [ "$FAIL" -eq 1 ]; then
  echo "PARITY CHECKS FAILED"
  exit 1
else
  echo "ALL PARITY CHECKS PASSED"
fi
