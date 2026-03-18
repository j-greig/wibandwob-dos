# e053-vps-next-actions

status: active
updated_at: 2026-03-18
owner: agent
scope: docker-smoke + vps-smoke

## rules
- Use this as the single task ledger for current smoke hardening.
- Only statuses: `todo`, `doing`, `done`, `blocked`.
- Update status in-place when completed.
- Keep notes terse and machine-parseable.

## tasks

- [x] T01 status:done pri:P0 area:docker-smoke
  title: Robust API readiness taxonomy
  done_when:
  - readiness step distinguishes tunnel failure vs app-not-ready
  - log contains failureType enum
  notes:
  - enum: tunnel_refused | app_not_ready | selector_ambiguous | command_error

- [x] T02 status:done pri:P0 area:docker-smoke
  title: Auto-remediate app readiness failure
  done_when:
  - if health timeout: restart tmux app session once and retry
  - report records remediation_attempted true/false

- [x] T03 status:done pri:P0 area:docker-smoke
  title: Dynamic local tunnel ports
  done_when:
  - no hardcoded local tunnel ports
  - collision-safe tunnel startup

- [x] T04 status:done pri:P0 area:cli
  title: Fix duplicate instance rows in unscoped CLI health
  done_when:
  - `wibwob health` no longer shows duplicate same-pid/same-instance rows
  - scoped `-i` behavior unchanged

- [x] T05 status:done pri:P1 area:smoke-reporting
  title: Severity-native gating report
  done_when:
  - critical/informational counts always emitted
  - exit code non-zero on critical failures

- [x] T06 status:done pri:P1 area:persistence
  title: Keep functional persistence assertion
  done_when:
  - save workspace pre-restart
  - load named workspace post-restart with new instanceId

- [x] T07 status:done pri:P1 area:vps-fly
  title: Fly adapter target wiring
  blocked_by:
  - Fly auth/token in environment
  done_when:
  - smoke can target real Fly app endpoint
  - quality metrics captured for Fly run
  notes:
  - app target restored: `wibwob-dos` (`https://wibwob-dos.fly.dev`)
  - loopback-bind incident resolved (`control-api` now binds configured host)

- [ ] T08 status:blocked pri:P1 area:coordination
  title: Competing edits guardrail
  blocked_by:
  - parallel agent touching same skill folder
  done_when:
  - task ownership/claim protocol agreed (one writer per folder)

- [ ] T09 status:todo pri:P2 area:ecosystem
  title: Keep npm-global native deps mitigation documented
  done_when:
  - smoke docs mention `--ignore-scripts --omit=optional`
  note:
  - soft blocker only; already mitigated

- [ ] T10 status:todo pri:P2 area:packaging
  title: Published npm path deferred
  done_when:
  - explicitly documented as non-blocking for current eval loop
  note:
  - local tgz path acceptable for now

## evidence
- docker smoke clean run: `scratch/captures/docker-vps-smoke-20260318-221034/` (0 fails)
- api readiness note now includes: `failureType` + `remediationAttempted`
- dynamic ports observed: ssh `2850`, tunnel `19101`
- cli duplicate rows resolved in smoke (`cli_instances_duplicates_note` pass)

## blocker-triage

hard_blockers:
- B02 competing_edits_risk severity:hard impact:churn/conflicts next:claim_folder_ownership

resolved_blockers:
- B01 fly_target_missing resolved_by:fly_external_smoke_20260318-224339

soft_blockers:
- S01 npm_global_native_deps severity:soft impact:intermittent_installs mitigation:use_ignore_scripts_and_omit_optional
- S02 published_npm_path_missing severity:soft impact:none_for_current_loop mitigation:local_tgz_ok
