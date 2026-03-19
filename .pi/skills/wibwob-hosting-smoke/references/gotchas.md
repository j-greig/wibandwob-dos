# Hosting Smoke Gotchas

## 1) Duplicate instance rows in `wibwob instances`

Compatibility aliases can produce duplicate rows during migration windows.

Mitigation:
- derive `instanceId` from `/health`
- target with `-i <instanceId>`
- keep duplicate-row checks informational unless targeting breaks

## 2) API reachability differs by adapter

Runtime can be healthy but unreachable on a non-canonical path.

Mitigation:
- define canonical API path per adapter (tunnel/proxy/local)
- perform readiness assertions only through canonical path
- for Fly, external proof endpoints are `https://<app>.fly.dev/health` and `https://<app>.fly.dev/help`

Resolved incident note (2026-03-18):
- control API was effectively loopback-only because `ControlApiService.startHttpOnly()` hardcoded `hostname: "127.0.0.1"`.
- fixed by binding Bun server to configured runtime host (`this.identity.host`), then redeploying.
- after fix, `/health` and `/help` are externally reachable (allowing for cold-start delay when min machines = 0).

## 3) Font/inventory drift

`figlet.open` may pass while full font inventory differs across hosts.

Mitigation:
- include explicit font inventory checks
- treat large drops as regressions

## 4) False PASS from shell pipelines

Pipelines can mask failures.

Mitigation:
- use `bash -o pipefail -lc ...`
- use `jq -e` for assertions

## 4b) Misreading 429s during restore

Rate limiting can be enabled+enforced by default; 429 may be expected under probe load.

Mitigation:
- set restore mode explicitly (`WIBWOB_RL_ENFORCE=false` for monitor-only)
- confirm mode via `/runtime/inspection` before classifying failures
- treat unexpected 429s as config mismatch first, outage second

## 5) Restart invalidates transport assumptions

After restart, tunnel/proxy/session identity may shift.

Mitigation:
- rebuild transport
- re-resolve API base and `instanceId`

Crash-loop signature to watch:
- repeated `health check failed` + `workspace load failed`
- process exits with code `7`
- machine reaches max restart count

Escalation trigger (handoff to runtime/code owner):
- if this signature repeats twice in one hour, stop prompt tweaks and request runtime fix cycle.

## 6) npm-global path confusion

Package install path can accidentally be treated as mutable runtime root.

Mitigation:
- force `WIBWOB_DATA_DIR`
- assert runtime files live under data root
- assert no mutable writes in install tree

## 7) External microapps coupled to core registry

If discovery pathing is wrong, teams think core edits are required.

Mitigation:
- use external microapp discovery paths (`.wibwob/microapps` / configured paths)
- validate command/menu exposure
- fail smoke if core edits are required

## 8) npm-global install fails on native deps (`canvas`, `pkg-config`, ABI drift)

Local/global install smoke can fail before CLI checks because transitive native modules may not have matching prebuilds.

Mitigation:
- for packaging smoke, prefer `npm install -g <tgz> --ignore-scripts --omit=optional` unless native-path validation is the explicit target
- keep a separate "native deps required" smoke profile if needed
- record raw install errors in `raw.log` for reproducibility

## 9) Dashboard-only history is fragile

Browser dashboard is a view, not the source of truth.

Status: **mitigated in skill guidance** (persistent-history contract added to `SKILL.md`), but keep monitoring compliance in future runs.

Mitigation:
- always persist run history to files: `results.tsv`, `results.json`, `experiments.jsonl`, `changelog.md`
- keep a durable session note (`SESSION_LOG.md`) summarizing baseline/best/latest
- treat dashboard refresh failures as non-blocking if file logs are intact

## 10) Runtime hardening ledger status (external owner)

Tracked in: `.tmp/e053-vps-next-actions.md` (owner: other agent).

As of latest ledger update, these are **done in runtime**:
- readiness taxonomy with `failureType` enum (`tunnel_refused | app_not_ready | selector_ambiguous | command_error`)
- health-gated tunnel/app readiness distinction
- auto-remediation on readiness timeout (`remediation_attempted` recorded)
- dynamic local tunnel ports (collision-safe startup)
- duplicate CLI instance-row issue resolved

Remaining blockers relevant to this skill loop:
- Fly target wiring for real-run scoring (`FLY_APP_NAME` + auth)
- coordination guardrail when multiple agents edit the same folder
