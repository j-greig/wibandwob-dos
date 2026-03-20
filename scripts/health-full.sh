#!/usr/bin/env bash
set -e

echo "▶ typecheck..."
bun run typecheck

echo "▶ tests..."
bun run test

echo "▶ COAT..."
bun run check-coat

echo "▶ circular deps (madge)..."
CYCLES=$(node_modules/.bin/madge --circular --extensions ts src/ 2>&1 | grep -c "^[0-9])" || true)
[ "$CYCLES" = "0" ] && echo "  ✅ no circular deps" || (echo "  ❌ $CYCLES circular dep(s) found"; node_modules/.bin/madge --circular --extensions ts src/; exit 1)

echo "▶ dead exports (knip)..."
node_modules/.bin/knip --reporter compact

echo ""
echo "✅ health-full clean"
