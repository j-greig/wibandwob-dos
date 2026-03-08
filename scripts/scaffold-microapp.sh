#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 3 || $# -gt 4 ]]; then
  echo "Usage: bash scripts/scaffold-microapp.sh <module-dir> <app-id> <title> [menu-order]" >&2
  echo "Example: bash scripts/scaffold-microapp.sh modules/standing-wave symbient.standing-wave \"Standing Wave\" 120" >&2
  exit 1
fi

MODULE_DIR="$1"
APP_ID="$2"
TITLE="$3"
MENU_ORDER="${4:-120}"

if [[ -e "$MODULE_DIR" ]]; then
  echo "Refusing to overwrite existing path: $MODULE_DIR" >&2
  exit 1
fi

MODULE_NAME="$(basename "$MODULE_DIR")"
PALETTE_LABEL="Open ${TITLE}"
ESC_TITLE="${TITLE//\\/\\\\}"
ESC_TITLE="${ESC_TITLE//\"/\\\"}"
ESC_APP_ID="${APP_ID//\\/\\\\}"
ESC_APP_ID="${ESC_APP_ID//\"/\\\"}"
ESC_MODULE_NAME="${MODULE_NAME//\\/\\\\}"
ESC_MODULE_NAME="${ESC_MODULE_NAME//\"/\\\"}"
ESC_PALETTE_LABEL="${PALETTE_LABEL//\\/\\\\}"
ESC_PALETTE_LABEL="${ESC_PALETTE_LABEL//\"/\\\"}"

mkdir -p "$MODULE_DIR"

cat > "$MODULE_DIR/module.json" <<EOF
{
  "name": "${ESC_MODULE_NAME}",
  "version": "0.1.0",
  "description": "${ESC_TITLE} microapp",
  "type": "microapp",
  "entry": "index.ts",
  "microapp": {
    "id": "${ESC_APP_ID}",
    "title": "${ESC_TITLE}",
    "description": "${ESC_TITLE} microapp scaffold.",
    "multiInstance": false,
    "persist": false,
    "menu": [
      { "category": "applications", "order": ${MENU_ORDER}, "label": "${ESC_TITLE}" }
    ],
    "palette": { "order": ${MENU_ORDER}, "label": "${ESC_PALETTE_LABEL}" },
    "agent": true,
    "api": true
  }
}
EOF

cat > "$MODULE_DIR/index.ts" <<EOF
import blessed from "blessed";
import type { MicroappHost } from "../../src/services/microapp-sdk.js";

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "${ESC_TITLE}",
    description: "Open the ${ESC_TITLE} microapp scaffold.",
    menu: [{ category: "applications", order: ${MENU_ORDER}, label: "${ESC_TITLE}" }],
    palette: { order: ${MENU_ORDER}, label: "Open ${ESC_TITLE}" },
    action: () => {
      const win = host.createWindow({ title: "${ESC_TITLE}", width: 56, height: 14 });

      const content = blessed.box({
        parent: win.body,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        tags: true,
        content: [
          "{bold}${ESC_TITLE}{/bold}",
          "",
          "Microapp scaffold loaded.",
          "",
          "Next steps:",
          "  1. Replace this box tree with real UI",
          "  2. Add describeState fields agents can use",
          "  3. Add snapshot support if persist:true",
        ].join("\n"),
        style: host.theme().body,
      });

      win.describeState(() => ({
        summary: "${ESC_TITLE} scaffold",
        contentPreview: "Microapp scaffold loaded.",
      }));

      win.captureText(() => content.getContent());
      win.onRestyle(() => {
        content.style = host.theme().body;
      });
      win.onCleanup(() => {});
      win.focus();
    },
  });
}
EOF

echo "Created:"
echo "  $MODULE_DIR/module.json"
echo "  $MODULE_DIR/index.ts"
echo
echo "Next:"
echo "  1. Edit the scaffold"
echo "  2. Run: bun run typecheck"
echo "  3. Restart or, after runtime work lands, reload the module"
