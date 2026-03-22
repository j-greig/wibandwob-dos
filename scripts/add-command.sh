#!/usr/bin/env bash
# @name    add-command
# @desc    Scaffold all 4 wiring points for a new WibWob-DOS command
# add-command.sh — Generate command wiring stubs across the 4 required files.
#
# Usage:
#   bash scripts/add-command.sh <group.verb> "<label>" [--api] [--no-api]
#
# Example:
#   bash scripts/add-command.sh desktop.screenshot "Take Screenshot" --api
#
# Touches:
#   1. src/core/command-catalog.ts  — command definition + AppMenuActions entry
#   2. src/domain/command-definition.ts  — group registration (if new)
#   3. src/core/app-controller.ts   — action implementation stub
#   4. src/services/control-api.ts  — API endpoint stub (if --api)
#
# After running:
#   bun run typecheck
#   bash scripts/restart.sh
#   bash scripts/doc-sync.sh

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# ── Args ─────────────────────────────────────────────────────────────
if [[ $# -lt 2 ]]; then
  echo "Usage: bash scripts/add-command.sh <id> \"<label>\" [--group <group>] [--api]" >&2
  echo "  id:      command id (e.g. desktop.screenshot)" >&2
  echo "  label:   human-readable label (e.g. \"Take Screenshot\")" >&2
  echo "  --group: AppCommandGroup value (default: focus). Run script to see available groups." >&2
  echo "  --api:   generate API endpoint stub" >&2
  exit 1
fi

FULL_ID="$1"
LABEL="$2"
ADD_API=false
GROUP="focus"  # default group

shift 2
while [[ $# -gt 0 ]]; do
  case "$1" in
    --api)    ADD_API=true; shift ;;
    --no-api) ADD_API=false; shift ;;
    --group)  GROUP="$2"; shift 2 ;;
    *)        shift ;;
  esac
done

# ── Derive names ──────────────────────────────────────────────────────
VERB="${FULL_ID#*.}"
# camelCase action key from the full command id: desktop.screenshot → desktopScreenshot
ID_PREFIX="${FULL_ID%%.*}"
VERB_CAP="$(echo "$VERB" | python3 -c 'import sys; s=sys.stdin.read().strip(); print(s[0].upper()+s[1:])')"
ACTION_KEY="${ID_PREFIX}${VERB_CAP}"
# Convert dots to slashes for API path: desktop.screenshot → /desktop/screenshot
API_PATH="/${FULL_ID//.//}"

echo "┌─ Scaffolding command: $FULL_ID"
echo "│  label:      $LABEL"
echo "│  actionKey:  $ACTION_KEY"
echo "│  api:        $ADD_API"
echo "│  api path:   $API_PATH"
echo "└─"

# ── 1. command-catalog.ts ─────────────────────────────────────────────
CATALOG="$ROOT/src/core/command-catalog.ts"
echo
echo "── 1. $CATALOG ─────────────────────────────────"
echo "   → Add AppMenuActions entry + command definition stub"
cat <<EOF

-- ACTION KEY (add to AppMenuActions interface) --
  ${ACTION_KEY}: (args?: Record<string, unknown>) => unknown;

-- COMMAND DEFINITION (add to COMMANDS array) --
  {
    id: "${FULL_ID}",
    label: "${LABEL}",
    description: "TODO: describe ${FULL_ID}.",
    group: "${GROUP}",
    actionKey: "${ACTION_KEY}",
    palettePlacement: { order: 500 },
    api: ${ADD_API},
    agent: ${ADD_API},
  },
EOF

# ── 2. command-definition.ts ──────────────────────────────────────────
CMDDEF="$ROOT/src/domain/command-definition.ts"
echo "── 2. $CMDDEF ─────────────────────────────────"
# Extract existing groups from the AppCommandGroup type definition
EXISTING_GROUPS=$(awk '/AppCommandGroup =/{found=1} found && /\| "/{gsub(/.*\| "|".*$/,""); print}' "$CMDDEF" | sort -u | tr '\n' ' ')
echo "   Available groups: $EXISTING_GROUPS"
if echo " $EXISTING_GROUPS " | grep -q " $GROUP "; then
  echo "   ✓ Group \"$GROUP\" already exists — no change needed"
else
  echo "   ⚠️  Group \"$GROUP\" is NEW — add it to AppCommandGroup union type:"
  echo '       | "'"$GROUP"'"'
fi

# ── 3. app-controller.ts ─────────────────────────────────────────────
CONTROLLER="$ROOT/src/core/app-controller.ts"
echo
echo "── 3. $CONTROLLER ─────────────────────────────────"
echo "   → Add action implementation stub near other ${GROUP}.* actions:"
cat <<EOF

-- ACTION STUB (add to the actions object) --
      ${ACTION_KEY}: (args) => {
        // TODO: implement ${FULL_ID}
        void args;
        return { ok: true };
      },
EOF

# ── 4. control-api.ts (if --api) ──────────────────────────────────────
if [[ "$ADD_API" == "true" ]]; then
  APIFILE="$ROOT/src/services/control-api.ts"
  echo
  echo "── 4. $APIFILE ─────────────────────────────────"
  echo "   → Add to ENDPOINT_TABLE + add route handler:"
  cat <<EOF

-- ENDPOINT_TABLE entry --
  { method: "POST", path: "${API_PATH}", body: { /* args */ }, description: "${LABEL}" },

-- ROUTE HANDLER --
    if (request.method === "POST" && url.pathname === "${API_PATH}") {
      const result = this.runApiCommand("${FULL_ID}", body as Record<string, unknown>);
      return Response.json(result, { status: result.ok ? 200 : 400 });
    }
EOF
fi

echo
echo "── Next steps ───────────────────────────────────────────────────"
echo "   1. Apply the stubs above to the 4 files"
echo "   2. bun run typecheck"
echo "   3. bash scripts/restart.sh"
echo "   4. bash scripts/doc-sync.sh   (regenerate stale outputs)"
