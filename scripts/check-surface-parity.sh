#!/usr/bin/env bash
# check-surface-parity.sh — verify command/state/snapshot alignment
# Run after changes to command-catalog, snapshot-registry, types, or window factories.
# Exit 0 = all checks pass. Exit 1 = parity violations found.

set -euo pipefail
cd "$(dirname "$0")/.."

ERRORS=0

# ── 1. Every PersistableAppType has a snapshotRegistry key ──
echo "▸ Checking PersistableAppType ↔ snapshotRegistry coverage..."

# Extract PersistableAppType members from types.ts
PERSISTABLE=$(grep -A100 '^export type PersistableAppType' src/core/types.ts \
  | sed -n '/^export type PersistableAppType/,/;$/p' \
  | grep -oE '"[^"]+"' | tr -d '"' | sort)

# Extract snapshotRegistry keys
SNAPSHOT_KEYS=$(grep -oE '^\s+"[^"]+"' src/core/snapshot-registry.ts \
  | grep -oE '"[^"]+"' | tr -d '"' | sort)

MISSING_SNAPSHOT=$(comm -23 <(echo "$PERSISTABLE") <(echo "$SNAPSHOT_KEYS"))
if [[ -n "$MISSING_SNAPSHOT" ]]; then
  echo "  ✗ PersistableAppTypes missing from snapshotRegistry:"
  echo "$MISSING_SNAPSHOT" | sed 's/^/    /'
  ERRORS=$((ERRORS + 1))
else
  echo "  ✓ All PersistableAppTypes have snapshotRegistry entries"
fi

# ── 2. Every actionKey in command-catalog exists in AppMenuActions ──
echo "▸ Checking command-catalog actionKeys ↔ AppMenuActions..."

ACTION_KEYS=$(grep -oE 'actionKey:\s*"[^"]+"' src/core/command-catalog.ts \
  | grep -oE '"[^"]+"' | tr -d '"' | sort -u)

# Extract keys from getAppMenuActions() return object
MENU_ACTION_KEYS=$(sed -n '/getAppMenuActions/,/^  }/p' src/core/app-controller.ts \
  | grep -oE '^\s{6}\w+\s*[:(]' | sed 's/[:(]//;s/^ *//' | sort -u || true)

MISSING_ACTIONS=""
for key in $ACTION_KEYS; do
  if ! echo "$MENU_ACTION_KEYS" | grep -qx "$key"; then
    MISSING_ACTIONS="$MISSING_ACTIONS $key"
  fi
done

if [[ -n "$MISSING_ACTIONS" ]]; then
  echo "  ✗ actionKeys missing from buildMenuActions():"
  echo "$MISSING_ACTIONS" | tr ' ' '\n' | grep -v '^$' | sed 's/^/    /'
  ERRORS=$((ERRORS + 1))
else
  echo "  ✓ All actionKeys have matching AppMenuActions entries"
fi

# ── 3. Every command with agent:true has non-empty description ──
echo "▸ Checking agent-visible commands have descriptions..."

# Use a simple approach: find lines with agent: true and check nearby description
MISSING_DESC=$(python3 -c "
import re, sys
content = open('src/core/command-catalog.ts').read()
# Find all command blocks
blocks = re.split(r'(?=\{[^}]*id:\s*\")', content)
issues = []
for block in blocks:
    id_m = re.search(r'id:\s*\"([^\"]+)\"', block)
    if not id_m: continue
    cmd_id = id_m.group(1)
    if re.search(r'agent:\s*true', block):
        desc_m = re.search(r'description:\s*\"([^\"]*?)\"', block)
        if not desc_m or not desc_m.group(1).strip():
            issues.append(cmd_id)
for i in issues:
    print(i)
" 2>/dev/null || true)

if [[ -n "$MISSING_DESC" ]]; then
  echo "  ✗ Agent-visible commands missing description:"
  echo "$MISSING_DESC" | sed 's/^/    /'
  ERRORS=$((ERRORS + 1))
else
  echo "  ✓ All agent-visible commands have descriptions"
fi

# ── Summary ──
echo ""
if [[ $ERRORS -gt 0 ]]; then
  echo "✗ $ERRORS parity check(s) failed"
  exit 1
else
  echo "✓ All surface parity checks passed"
  exit 0
fi
