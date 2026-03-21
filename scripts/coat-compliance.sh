#!/usr/bin/env bash
# scripts/coat-compliance.sh — COAT Runtime Compliance Checker
#
# Checks that every WibWob-DOS command produces observable API state change.
# Complements the static check-coat.ts with a live runtime gate.
#
# Usage:
#   scripts/coat-compliance.sh [--port <port>] [--json] [--fix-hints] [--update-baseline]
#
# Exit codes:
#   0 — fully compliant (no regressions vs baseline)
#   1 — regressions detected (new failures not in baseline)
#   2 — no WibWob instance running (skip, not fail)
#
# Baseline: coat-compliance.baseline.json at repo root.
#   First run: writes baseline from current state and exits 0.
#   Subsequent runs: gates on regressions (new failures only).
#   --update-baseline: re-records all current failures as known debt.
#
# Command skip annotations (used when catalog lacks requiresInput/destructive):
#   Destructive patterns: .close, .clear, .clear-all, .delete, .reset
#   Requires-args patterns: .write, .navigate, .send, .say, .set, .save,
#     .load_named, .search, .focus, .move, .resize, .export, fx.*, text.*,
#     canvas.*, document.*, finder.*, overlay.select/confirm/cancel,
#     backrooms.picker.*, primer.picker.*, editor.picker.*, markdown.picker.*,
#     primer.open, editor.open, markdown.open, web-reader.navigate,
#     workspace.save, ghostty.shader.set, agent.send, window.set_chrome,
#     window.close, window.focus, window.move, window.resize

set -eo pipefail

# ── Configuration ────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BASELINE_FILE="$REPO_ROOT/coat-compliance.baseline.json"

PORT="${WW_PORT:-8099}"
OUTPUT_JSON=false
FIX_HINTS=false
UPDATE_BASELINE=false

# ── Argument parsing ──────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --port)            PORT="$2"; shift 2 ;;
    --instance)        shift 2 ;;  # accepted, not used (single-instance default)
    --json)            OUTPUT_JSON=true; shift ;;
    --fix-hints)       FIX_HINTS=true; shift ;;
    --update-baseline) UPDATE_BASELINE=true; shift ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

BASE_URL="http://127.0.0.1:$PORT"
CHECKED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# ── Helpers ───────────────────────────────────────────────────────────────────
http_status() {
  # curl always writes http_code to stdout (including "000" on connection failure)
  # || true prevents set -e from aborting on curl non-zero exit
  curl -s -o /dev/null -w "%{http_code}" --max-time 3 "$@" 2>/dev/null || true
}

http_get() {
  curl -s --max-time 3 "$@" 2>/dev/null || true
}

http_post_json() {
  local url="$1"
  local data="$2"
  curl -s --max-time 3 -X POST \
    -H "Content-Type: application/json" \
    -d "$data" \
    "$url" 2>/dev/null || true
}

# Returns 0 if instance is healthy, 1 if not
instance_healthy() {
  local s
  s=$(http_status "$BASE_URL/health")
  [[ "$s" == "200" ]]
}

# Portable millisecond sleep using bc
sleep_ms() {
  sleep "$(echo "scale=3; $1/1000" | bc)"
}

# Safe array append that works in bash 3.2
arr_append() {
  eval "${1}+=(\"\$2\")"
}

# Check if a value is in an array (bash 3.2 compatible)
# Usage: arr_contains "value" "${arr[@]}"
arr_contains() {
  local needle="$1"; shift
  local item
  for item in "$@"; do
    [[ "$item" == "$needle" ]] && return 0
  done
  return 1
}

# ── Phase 1: Prerequisite — running instance ──────────────────────────────────
health_status=$(http_status "$BASE_URL/health")
if [[ "$health_status" != "200" ]]; then
  echo "❌ No WibWob instance responding on port $PORT (HTTP $health_status)" >&2
  echo "   Run: bash scripts/ensure-running.sh" >&2
  exit 2
fi

instance_id=$(http_get "$BASE_URL/health" | jq -r '.id // "unknown"' 2>/dev/null || echo "unknown")

if [[ "$OUTPUT_JSON" == "false" ]]; then
  echo ""
  echo "COAT Runtime Compliance Report"
  echo "Instance: $instance_id  Port: $PORT  Checked: $CHECKED_AT"
  echo ""
fi

# ── Phase 2: Capability gap assertions (G1–G3) ────────────────────────────────
# Reported only — not yet gating (spk-api-capability-gaps closes them)

gap_pass=0
gap_fail=0
gap_failures=()

# G1: Error surface
g1_status=$(http_status "$BASE_URL/errors/recent")
if [[ "$g1_status" == "200" ]]; then
  g1_result="PASS"; ((gap_pass++)) || true
else
  g1_result="FAIL:$g1_status"; ((gap_fail++)) || true; gap_failures+=("G1")
fi

# G2: State stream (SSE)
g2_status=$(http_status "$BASE_URL/state/stream")
if [[ "$g2_status" == "200" ]]; then
  g2_result="PASS"; ((gap_pass++)) || true
else
  g2_result="FAIL:$g2_status"; ((gap_fail++)) || true; gap_failures+=("G2")
fi

# G3: Symbolic window refs
g3_status=$(http_status -X POST -H "Content-Type: application/json" \
  -d '{}' "$BASE_URL/windows/by-title/test/command")
if [[ "$g3_status" == "200" ]]; then
  g3_result="PASS"; ((gap_pass++)) || true
else
  g3_result="FAIL:$g3_status"; ((gap_fail++)) || true; gap_failures+=("G3")
fi

if [[ "$OUTPUT_JSON" == "false" ]]; then
  echo "Capability Gaps  (reported only — not yet gating)"
  # G1
  if [[ "$g1_result" == "PASS" ]]; then
    echo "  ✅ G1  GET  $BASE_URL/errors/recent"
  else
    echo "  ❌ G1  GET  $BASE_URL/errors/recent  →  HTTP ${g1_result#FAIL:}"
  fi
  # G2
  if [[ "$g2_result" == "PASS" ]]; then
    echo "  ✅ G2  GET  $BASE_URL/state/stream (SSE)"
  else
    echo "  ❌ G2  GET  $BASE_URL/state/stream (SSE)  →  HTTP ${g2_result#FAIL:}"
  fi
  # G3
  if [[ "$g3_result" == "PASS" ]]; then
    echo "  ✅ G3  POST $BASE_URL/windows/by-title/*/command"
  else
    echo "  ❌ G3  POST $BASE_URL/windows/by-title/*/command  →  HTTP ${g3_result#FAIL:}"
  fi
  echo "  Gap score: $gap_pass/3"
  echo ""
fi

# ── Skip-pattern matching for Phase 3 ────────────────────────────────────────
# Returns 0 (true) = skip, 1 (false) = testable
should_skip_command() {
  local id="$1"
  # Destructive
  case "$id" in
    *.close|*.clear|desktop.clear-all|window.close)          return 0 ;;
    *.delete|*.reset)                                         return 0 ;;
  esac
  # Requires specific args (by suffix pattern)
  case "$id" in
    *.write|*.navigate|*.send|*.say|*.load_named|*.search)   return 0 ;;
    *.sort_by|*.move|*.resize|*.focus|*.set_chrome|*.export) return 0 ;;
    *.bookmark_path|*.go_to_bookmark|*.new_folder|*.edit)     return 0 ;;
    *.save|*.open_external|*.share|*.export_listing)          return 0 ;;
    *.yank_contents)                                          return 0 ;;
  esac
  # Namespace-level skips
  case "$id" in
    fx.*|text.*|canvas.*|document.*|finder.*)                return 0 ;;
    *.picker.*)                                              return 0 ;;
    overlay.select|overlay.confirm|overlay.cancel)           return 0 ;;
  esac
  # Specific arg-requiring or externally-dependent commands
  case "$id" in
    primer.open|editor.open|markdown.open|web-reader.navigate) return 0 ;;
    workspace.save|workspace.load_named|ghostty.shader.set)    return 0 ;;
    theme.set|agent.send|scramble.say)                         return 0 ;;
    window.focus|window.move|window.resize|window.export_text) return 0 ;;
    window.set_chrome|window.close|editor.write)               return 0 ;;
    canvas.load|canvas.export)                                 return 0 ;;
    # External process deps — launch Chrome, camera, real shell
    web-reader.open|monster-cam.open|microapp.wibwob.monster-cam.open) return 0 ;;
    microapp.wibwob.terminal.open)                                       return 0 ;;
    # Instance-terminating (skip unconditionally)
    app.quit|window.close_focused)                             return 0 ;;
    # Heavy filesystem-scanning — cause TUI CPU spike / instance unresponsiveness
    primer.browse|primer.list|backrooms.open|backrooms_logs.open) return 0 ;;
    # These open pickers/overlays that need an existing context window
    primer.picker.open|editor.picker.open|markdown.picker.open) return 0 ;;
  esac
  return 1
}

# State fingerprint: openWindowCount + focusedWindowId + window details
state_fingerprint() {
  echo "$1" | jq -c '
    {
      openWindowCount: .screen.openWindowCount,
      focusedWindowId: .focus.windowId,
      windows: (.windows | sort_by(.id) | map({id: .id, details: .details}))
    }
  ' 2>/dev/null || echo "{}"
}

# ── Phase 3: Command round-trip check ─────────────────────────────────────────
commands_json=$(http_get "$BASE_URL/commands/list?includeUnavailable=1")
if [[ -z "$commands_json" ]]; then
  echo "❌ Failed to fetch command list" >&2
  exit 2
fi

rt_passed=()
rt_failed=()
rt_skipped=()

if [[ "$OUTPUT_JSON" == "false" ]]; then
  echo "Command Round-Trips"
fi

# Clean slate before round-trip tests — close any windows opened during gap probes
# (desktop.clear-all is skipped in the round-trip loop but we use it here as setup)
http_post_json "$BASE_URL/commands/run" '{"id":"desktop.clear-all","args":{"all":true}}' > /dev/null || true
sleep_ms 300

# Read command IDs (bash 3.2-compatible, no mapfile)
while IFS= read -r cmd_id; do
  [[ -z "$cmd_id" ]] && continue

  if should_skip_command "$cmd_id"; then
    rt_skipped+=("$cmd_id")
    continue
  fi

  # Guard: abort loop if instance becomes unresponsive
  if ! instance_healthy; then
    echo "  ⚠️  Instance unresponsive — aborting round-trip loop early" >&2
    break
  fi

  # Snapshot before
  state_before=$(http_get "$BASE_URL/state")
  fp_before=$(state_fingerprint "$state_before")

  # Execute command
  http_post_json "$BASE_URL/commands/run" "{\"id\":\"$cmd_id\"}" > /dev/null

  # Wait 300ms for synchronous state update
  sleep_ms 300

  # Snapshot after
  state_after=$(http_get "$BASE_URL/state")
  fp_after=$(state_fingerprint "$state_after")

  if [[ "$fp_before" != "$fp_after" ]]; then
    rt_passed+=("$cmd_id")
    if [[ "$OUTPUT_JSON" == "false" ]]; then
      echo "  ✅  $cmd_id"
    fi
  else
    rt_failed+=("$cmd_id")
    if [[ "$OUTPUT_JSON" == "false" ]]; then
      echo "  ❌  $cmd_id  →  no observable state change"
      if [[ "$FIX_HINTS" == "true" ]]; then
        echo "      hint: ensure the command registers describeState() or changes window count/focus"
      fi
    fi
  fi

done < <(echo "$commands_json" | jq -r '.commands[].id' 2>/dev/null)

rt_testable=$(( ${#rt_passed[@]} + ${#rt_failed[@]} ))
if [[ "$OUTPUT_JSON" == "false" ]]; then
  echo "  Round-trip score: ${#rt_passed[@]}/$rt_testable  (${#rt_skipped[@]} skipped)"
  echo ""
fi

# ── Phase 4: State observability check ───────────────────────────────────────
# Every open window must have a non-trivial describeState() (more than appType alone).
final_state=$(http_get "$BASE_URL/state")

obs_passed=()
obs_failed=()
obs_failed_types=()

if [[ "$OUTPUT_JSON" == "false" ]]; then
  echo "State Observability"
fi

while IFS= read -r win_id; do
  [[ -z "$win_id" ]] && continue

  win_details=$(echo "$final_state" | \
    jq -c --argjson wid "$win_id" '.windows[] | select(.id == $wid) | .details' 2>/dev/null \
    || echo "{}")
  app_type=$(echo "$win_details" | jq -r '.appType // "unknown"' 2>/dev/null || echo "unknown")
  key_count=$(echo "$win_details" | jq 'keys | length' 2>/dev/null || echo "0")

  if [[ "$key_count" -gt 1 ]]; then
    obs_passed+=("$app_type:$win_id")
    if [[ "$OUTPUT_JSON" == "false" ]]; then
      echo "  ✅  $app_type (ID: $win_id)"
    fi
  else
    obs_failed+=("$app_type:$win_id")
    obs_failed_types+=("$app_type")
    if [[ "$OUTPUT_JSON" == "false" ]]; then
      echo "  ❌  $app_type (ID: $win_id)  →  describeState: {}"
      if [[ "$FIX_HINTS" == "true" ]]; then
        echo "      hint: add win.describeState(() => ({ appType, summary: '...' })) to this window"
      fi
    fi
  fi

done < <(echo "$final_state" | jq -r '.windows[].id' 2>/dev/null)

obs_total=$(( ${#obs_passed[@]} + ${#obs_failed[@]} ))
if [[ "$OUTPUT_JSON" == "false" ]]; then
  echo "  Observability score: ${#obs_passed[@]}/$obs_total"
  echo ""
fi

# ── Phase 5: Baseline comparison and exit decision ────────────────────────────

is_first_run=false
if [[ ! -f "$BASELINE_FILE" ]] || [[ "$UPDATE_BASELINE" == "true" ]]; then
  is_first_run=true
fi

if [[ "$is_first_run" == "true" ]]; then
  # Serialize gap failures to JSON array
  gap_json="[]"
  for gid in "${gap_failures[@]+"${gap_failures[@]}"}"; do
    gap_json=$(echo "$gap_json" | jq --arg v "$gid" '. + [$v]')
  done

  # Serialize round-trip failures
  rt_json="[]"
  for cmd_id in "${rt_failed[@]+"${rt_failed[@]}"}"; do
    rt_json=$(echo "$rt_json" | jq --arg v "$cmd_id" '. + [$v]')
  done

  # Serialize observability failures (by appType)
  obs_json="[]"
  for app_type in "${obs_failed_types[@]+"${obs_failed_types[@]}"}"; do
    obs_json=$(echo "$obs_json" | jq --arg v "$app_type" '. + [$v]')
  done

  jq -n \
    --arg ts "$CHECKED_AT" \
    --argjson gaps "$gap_json" \
    --argjson rt "$rt_json" \
    --argjson obs "$obs_json" \
    '{
      generatedAt: $ts,
      note: "Known failures at baseline time — only NEW failures beyond these will gate the build",
      knownFailures: {
        gaps: $gaps,
        roundTrips: $rt,
        observability: $obs
      }
    }' > "$BASELINE_FILE"

  if [[ "$OUTPUT_JSON" == "false" ]]; then
    if [[ "$UPDATE_BASELINE" == "true" ]]; then
      echo "✏️  Baseline updated: $BASELINE_FILE"
    else
      echo "📝 First run — baseline written: $BASELINE_FILE"
      echo "   Commit this file to track regressions from here forward."
    fi
    echo ""
  fi
  exit 0
fi

# ── Compare against existing baseline ────────────────────────────────────────
regressions=()
improvements=()
existing_debt=()

# Gap comparisons
for gid in "${gap_failures[@]+"${gap_failures[@]}"}"; do
  if jq -e --arg v "$gid" '.knownFailures.gaps | index($v) != null' "$BASELINE_FILE" > /dev/null 2>&1; then
    existing_debt+=("gap:$gid")
  else
    regressions+=("gap:$gid")
  fi
done

# Gap improvements (was failing, now passing)
while IFS= read -r known_gap; do
  [[ -z "$known_gap" ]] && continue
  if ! arr_contains "$known_gap" "${gap_failures[@]+"${gap_failures[@]}"}"; then
    improvements+=("gap:$known_gap")
  fi
done < <(jq -r '.knownFailures.gaps[]' "$BASELINE_FILE" 2>/dev/null || true)

# Round-trip comparisons
for cmd_id in "${rt_failed[@]+"${rt_failed[@]}"}"; do
  if jq -e --arg v "$cmd_id" '.knownFailures.roundTrips | index($v) != null' "$BASELINE_FILE" > /dev/null 2>&1; then
    existing_debt+=("rt:$cmd_id")
  else
    regressions+=("rt:$cmd_id")
  fi
done

# Round-trip improvements
while IFS= read -r known_rt; do
  [[ -z "$known_rt" ]] && continue
  if ! arr_contains "$known_rt" "${rt_failed[@]+"${rt_failed[@]}"}"; then
    improvements+=("rt:$known_rt")
  fi
done < <(jq -r '.knownFailures.roundTrips[]' "$BASELINE_FILE" 2>/dev/null || true)

# Observability comparisons
for app_type in "${obs_failed_types[@]+"${obs_failed_types[@]}"}"; do
  if jq -e --arg v "$app_type" '.knownFailures.observability | index($v) != null' "$BASELINE_FILE" > /dev/null 2>&1; then
    existing_debt+=("obs:$app_type")
  else
    regressions+=("obs:$app_type")
  fi
done

# Observability improvements
while IFS= read -r known_obs; do
  [[ -z "$known_obs" ]] && continue
  if ! arr_contains "$known_obs" "${obs_failed_types[@]+"${obs_failed_types[@]}"}"; then
    improvements+=("obs:$known_obs")
  fi
done < <(jq -r '.knownFailures.observability[]' "$BASELINE_FILE" 2>/dev/null || true)

# ── Summary ───────────────────────────────────────────────────────────────────
total_score=$(( gap_pass + ${#rt_passed[@]} + ${#obs_passed[@]} ))
total_possible=$(( 3 + rt_testable + obs_total ))
pct=0
if [[ "$total_possible" -gt 0 ]]; then
  pct=$(( total_score * 100 / total_possible ))
fi

if [[ "$OUTPUT_JSON" == "true" ]]; then
  # Build JSON arrays for output
  reg_json="[]"
  for item in "${regressions[@]+"${regressions[@]}"}"; do
    reg_json=$(echo "$reg_json" | jq --arg v "$item" '. + [$v]')
  done
  imp_json="[]"
  for item in "${improvements[@]+"${improvements[@]}"}"; do
    imp_json=$(echo "$imp_json" | jq --arg v "$item" '. + [$v]')
  done
  debt_json="[]"
  for item in "${existing_debt[@]+"${existing_debt[@]}"}"; do
    debt_json=$(echo "$debt_json" | jq --arg v "$item" '. + [$v]')
  done
  gf_json="[]"
  for item in "${gap_failures[@]+"${gap_failures[@]}"}"; do
    gf_json=$(echo "$gf_json" | jq --arg v "$item" '. + [$v]')
  done
  rf_json="[]"
  for item in "${rt_failed[@]+"${rt_failed[@]}"}"; do
    rf_json=$(echo "$rf_json" | jq --arg v "$item" '. + [$v]')
  done
  of_json="[]"
  for item in "${obs_failed_types[@]+"${obs_failed_types[@]}"}"; do
    of_json=$(echo "$of_json" | jq --arg v "$item" '. + [$v]')
  done

  jq -n \
    --arg instance "$instance_id" \
    --argjson port "$PORT" \
    --arg checkedAt "$CHECKED_AT" \
    --argjson gapPass "$gap_pass" \
    --argjson rtPass "${#rt_passed[@]}" \
    --argjson rtTotal "$rt_testable" \
    --argjson rtSkipped "${#rt_skipped[@]}" \
    --argjson obsPass "${#obs_passed[@]}" \
    --argjson obsTotal "$obs_total" \
    --argjson score "$total_score" \
    --argjson possible "$total_possible" \
    --argjson pct "$pct" \
    --argjson regressions "$reg_json" \
    --argjson improvements "$imp_json" \
    --argjson existingDebt "$debt_json" \
    --argjson gapFailures "$gf_json" \
    --argjson rtFailed "$rf_json" \
    --argjson obsFailed "$of_json" \
    '{
      instance: $instance,
      port: $port,
      checkedAt: $checkedAt,
      gaps:          { pass: $gapPass,  total: 3,         failures: $gapFailures },
      roundTrips:    { pass: $rtPass,   total: $rtTotal,  skipped: $rtSkipped, failures: $rtFailed },
      observability: { pass: $obsPass,  total: $obsTotal, failures: $obsFailed },
      score:         { value: $score,   possible: $possible, pct: $pct },
      regressions:   $regressions,
      improvements:  $improvements,
      existingDebt:  $existingDebt,
      exit: (if ($regressions | length) > 0 then 1 else 0 end)
    }'
else
  echo "──────────────────────────────────────────────"
  echo "OVERALL: $total_score/$total_possible  (${pct}%)"

  if [[ "${#improvements[@]}" -gt 0 ]]; then
    echo ""
    echo "🎉 Improvements (remove from baseline):"
    for item in "${improvements[@]+"${improvements[@]}"}"; do
      echo "   $item"
    done
  fi

  if [[ "${#existing_debt[@]}" -gt 0 ]]; then
    echo ""
    echo "⚠️  Existing debt (in baseline — not gating):"
    for item in "${existing_debt[@]+"${existing_debt[@]}"}"; do
      echo "   $item"
    done
  fi

  if [[ "${#regressions[@]}" -gt 0 ]]; then
    echo ""
    echo "🔴 REGRESSIONS (new failures — gates the build):"
    for item in "${regressions[@]+"${regressions[@]}"}"; do
      echo "   $item"
    done
    echo ""
    echo "EXIT: 1"
    echo "  Run --update-baseline to accept these as new debt (requires justification commit)."
  else
    echo ""
    echo "EXIT: 0  ✅ No regressions"
  fi
fi

# ── Exit ──────────────────────────────────────────────────────────────────────
if [[ "${#regressions[@]}" -gt 0 ]]; then
  exit 1
fi
exit 0
