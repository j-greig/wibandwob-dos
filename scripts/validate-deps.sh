#!/usr/bin/env bash
# validate-deps.sh — health check for critical env assumptions
# Run at session start to surface silent failures before they waste debugging time.
#
# Checks:
#   1. Ghostty config file exists (1.3+ uses config.ghostty, older uses config)
#   2. zodToJsonSchema is not silently returning {} with Zod v4
#   3. wibwob CLI is a compiled binary vs dev wrapper (informs reload strategy)
#   4. bun version is recent enough
#   5. WibWob-DOS is running and reachable
#
# Usage:
#   bash scripts/validate-deps.sh          # print report
#   bash scripts/validate-deps.sh --strict # exit 1 on any failure

set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STRICT=false
[[ "${1:-}" == "--strict" ]] && STRICT=true

PASS=0; WARN=0; FAIL=0

ok()   { echo "  ✅ $*"; PASS=$((PASS+1)); }
warn() { echo "  ⚠️  $*"; WARN=$((WARN+1)); }
fail() { echo "  ❌ $*"; FAIL=$((FAIL+1)); }

echo "── validate-deps ─────────────────────────────────────────"

# ── 1. Ghostty config path ───────────────────────────────────
echo ""
echo "Ghostty config:"
GHOSTTY_BASE="${HOME}/Library/Application Support/com.mitchellh.ghostty"
if [[ -f "${GHOSTTY_BASE}/config.ghostty" ]]; then
  ok "config.ghostty (Ghostty 1.3+)"
elif [[ -f "${GHOSTTY_BASE}/config" ]]; then
  warn "config (pre-1.3 path) — if Ghostty >= 1.3, shader scripts may miss it"
elif [[ -f "${HOME}/.config/ghostty/config.ghostty" ]]; then
  ok "~/.config/ghostty/config.ghostty (XDG)"
elif [[ -f "${HOME}/.config/ghostty/config" ]]; then
  warn "~/.config/ghostty/config (XDG, pre-1.3)"
else
  warn "No Ghostty config found — ghostty-shader scripts will no-op silently"
fi

# ── 2. zodToJsonSchema + Zod v4 ──────────────────────────────
echo ""
echo "Zod v4 compatibility:"
ZOD_CHECK=$(cd "$REPO_ROOT" && bun -e "
import { z } from 'zod';
const schema = z.object({ name: z.string() });
const result = (schema as any).toJSONSchema?.();
if (result && typeof result === 'object' && Object.keys(result).length > 0) {
  console.log('ok');
} else {
  console.log('fail');
}
" 2>/dev/null || echo "error")
if [[ "$ZOD_CHECK" == "ok" ]]; then
  ok "Zod v4 .toJSONSchema() works"
elif [[ "$ZOD_CHECK" == "fail" ]]; then
  fail "Zod v4 .toJSONSchema() returned empty — use (schema as any).toJSONSchema?.()"
else
  warn "Could not check Zod version (bun eval failed)"
fi

# ── 3. wibwob CLI: compiled binary vs dev wrapper ────────────
echo ""
echo "wibwob CLI:"
WIBWOB_PATH="$(command -v wibwob 2>/dev/null || echo '')"
if [[ -z "$WIBWOB_PATH" ]]; then
  fail "wibwob not found in PATH — install with: bun run cli:install"
else
  # Dev wrapper starts with #!/usr/bin/env bash; compiled binary is an ELF/Mach-O
  if file "$WIBWOB_PATH" 2>/dev/null | grep -qE 'shell script|ASCII text'; then
    ok "dev wrapper at $WIBWOB_PATH (reads from source — no rebuild needed)"
  elif file "$WIBWOB_PATH" 2>/dev/null | grep -qE 'Mach-O|ELF|executable'; then
    ok "compiled binary at $WIBWOB_PATH (source changes need: bun run cli:install)"
  else
    warn "wibwob found at $WIBWOB_PATH but type unknown"
  fi
fi

# ── 4. bun version ───────────────────────────────────────────
echo ""
echo "Bun:"
BUN_VERSION=$(bun --version 2>/dev/null || echo "not found")
if [[ "$BUN_VERSION" == "not found" ]]; then
  fail "bun not found"
else
  MAJOR=$(echo "$BUN_VERSION" | cut -d. -f1)
  MINOR=$(echo "$BUN_VERSION" | cut -d. -f2)
  if [[ "$MAJOR" -ge 1 && "$MINOR" -ge 1 ]]; then
    ok "bun $BUN_VERSION"
  else
    warn "bun $BUN_VERSION — 1.1+ recommended"
  fi
fi

# ── 5. WibWob-DOS running ────────────────────────────────────
echo ""
echo "WibWob-DOS:"
HEALTH=$(curl -sf --max-time 3 http://127.0.0.1:8099/health 2>/dev/null || echo "")
if [[ -z "$HEALTH" ]]; then
  warn "Not running on :8099 — start with: bash scripts/ensure-running.sh --tmux"
else
  SCREEN_W=$(echo "$HEALTH" | bun -e "const d=await Bun.stdin.text();const h=JSON.parse(d);console.log(h.screen?.width??0)" 2>/dev/null || echo "0")
  if [[ "$SCREEN_W" -le 1 ]]; then
    warn "Running but screen is ${SCREEN_W}×? — headless/zombie instance, commands may no-op"
  else
    ok "Running, screen ${SCREEN_W}px wide"
  fi
fi

# ── Summary ──────────────────────────────────────────────────
echo ""
echo "── $PASS passed · $WARN warnings · $FAIL failed ──────────"

if $STRICT && [[ $FAIL -gt 0 ]]; then
  echo "❌ --strict: exiting on failures"
  exit 1
fi
