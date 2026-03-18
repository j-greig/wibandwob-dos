# Docker/VPS Smoke Gotchas

## 1) Duplicate instance rows in `wibwob instances`

During migration windows, compatibility aliases can produce duplicate rows for one logical instance.

Mitigation:
- target CLI checks with `-i <instanceId>` from `/health`
- keep a separate informational duplicate check

## 2) API host reachability mismatch

Container-local API can be healthy while host direct port checks fail.

Mitigation:
- use SSH tunnels for canonical smoke API checks

## 3) Figlet font parity drift

`figlet.open` may work while full font inventory differs between environments.

Mitigation:
- always run explicit `figlet.fonts` inventory check
- treat large font-count drops as deployment regressions

## 4) False PASS from shell pipelines

Pipelines with `head`/`jq` can hide command failures if `pipefail` is not enforced.

Mitigation:
- execute checks with `bash -o pipefail -lc ...`
- prefer `jq -e` for assertions

## 5) Restart invalidates tunnel/process assumptions

After container restart, API tunnel and target instance identity can change.

Mitigation:
- rebuild tunnel after restart
- re-resolve API base and instanceId before post-restart assertions
