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

## 3) Figlet font parity drift (fixed pattern)

`figlet.open` may work while full font inventory differs between environments. This can produce missing-style regressions (e.g. `starwars`) even when basic figlet works.

Mitigation / fix:
- sync full local figlet pack into `deploy/figlet-fonts-extra/`:
  - `bash scripts/devops/sync-figlet-font-pack.sh`
- copy that pack in Docker image build (`deploy/Dockerfile.ssh-smoke`):
  - `COPY deploy/figlet-fonts-extra/*.flf /usr/share/figlet/`
- ensure runtime catalogue only advertises installed fonts (avoid metadata-only ghosts)
- smoke gate should assert strong minimum font count (e.g. `>= 500`) not merely `> 0`

Verification:
- `wibwob ... cmd figlet.fonts` count is high and stable
- targeted spot checks (e.g. `starwars`) open successfully in TUI
- composed multi-font layout shows `render_fail_count=0` in `/screenshot/text`

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
