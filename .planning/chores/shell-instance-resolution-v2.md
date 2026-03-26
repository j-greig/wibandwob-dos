# Instance Management Design v2

> Spec for `chore/shell-instance-resolution-v2`.
>
> Purpose: replace fragmented shell-side instance guessing with one machine-safe resolver, while explicitly avoiding runtime symlink registration.
>
> Created: 2026-03-26 · Platform: macOS + Linux

---

## Problem

Shell scripts need a stable, shared way to resolve the target WibWob-DOS instance.

Today they do not have one. They variously:

- hardcode `8099` or `8100`
- read the stale runtime manifest
- scrape human-oriented CLI output
- walk dead or moved directories
- guess and silently target the wrong instance when more than one is alive

The core discovery logic already exists in TypeScript. `src/cli/instance-discovery.ts` knows how to:

- walk `.wibwob/instances/*/control.sock`
- check PID liveness
- read discovery metadata
- resolve by label / display id / instance id

The immediate fix is not to invent a second runtime-discovery mechanism. The immediate fix is to expose the existing discovery logic through one machine-safe CLI interface and make shell scripts use that.

---

## Decision

v1 uses a CLI resolver, not runtime symlinks.

This is a deliberate simplification.

- One source of truth: TypeScript instance discovery
- One shell bridge: `wibwob resolve`
- No `run/default.sock`
- No `run/labels/*.sock`
- No startup/shutdown alias registration
- No default-rotation logic
- No label-alias collision rules

Symlink aliases may be revisited later as a performance optimization. They are not part of this design.

---

## Why this is the simpler correct design

The rejected v1 alternative was to add a second mechanism:

- app startup writes label/default symlinks
- app shutdown rotates them
- shell reads those symlinks

That approach has real cost:

- new lifecycle logic in control API startup/shutdown
- default ownership semantics to define and maintain
- duplicate-label collision policy
- stale-link cleanup after crashes
- another discovery surface to keep consistent with CLI discovery

The CLI-resolver design avoids all of that. Shell scripts ask the existing discovery layer what the target is. The answer is either:

- a unix socket path for local instance control, or
- an HTTP URL for deploy / remote / explicit env override cases

The only new interface is a machine-safe CLI command.

---

## Existing failure inventory

The failure inventory from v1 still stands:

- scripts already sourcing `runtime-env.sh` inherit stale manifest behavior
- some scripts parse `wibwob health` as if it were line-oriented text
- some scripts still walk old `scratch/instances/` paths
- many scripts hardcode local TCP ports

The important change is the remedy:

- not symlink registration
- not more shell-side port scanning
- not more manifest logic
- instead: all shell paths converge on `wibwob resolve`

---

## Public interface to add

Add a dedicated machine-safe resolver command:

```bash
wibwob resolve
wibwob resolve -i <selector>
wibwob resolve --json
wibwob resolve -i main --json
```

This command exists specifically so shell scripts never need to parse:

- `wibwob instances`
- `wibwob health`
- summary text
- ad hoc stdout/stderr combinations

### Resolver output contract

Plain mode:

- stdout: only the resolved target
- target is either `/path/to/control.sock` or `http://127.0.0.1:8099`
- stderr: human diagnostics only on failure
- stdout must be empty on failure
- exit code: non-zero on ambiguity or no resolution

JSON mode:

```json
{
  "kind": "unix",
  "target": "/Users/james/Repos/wibandwob-dos/.wibwob/instances/1296c01b/control.sock",
  "instanceId": "1296c01b",
  "instanceLabel": "main",
  "instanceDisplayId": "129",
  "port": 8099
}
```

HTTP result example:

```json
{
  "kind": "http",
  "target": "http://127.0.0.1:8099",
  "instanceId": null,
  "instanceLabel": null,
  "instanceDisplayId": null,
  "port": 8099
}
```

Rules:

- `kind` is exactly `"unix"` or `"http"`
- `target` is the machine-consumable target string
- unix results should include instance identity fields when known
- HTTP env-based results may leave identity fields `null`
- JSON mode must emit no partial JSON on failure
- output shape is stable and documented

---

## Resolution precedence

This precedence is the contract. Do not improvise beyond it.

1. `WIBWOB_API`
2. explicit selector: `-i/--instance` or `WIBWOB_INSTANCE`
3. `CONTROL_API_PORT`
4. local socket discovery via shared TypeScript resolver
5. fail if unresolved or ambiguous

### Semantics

`WIBWOB_API`

- strongest explicit override
- used for remote targets, deploy targets, tunnels, or caller-forced URLs

explicit selector

- if `-i/--instance` is provided, it wins over `WIBWOB_INSTANCE`
- selector is matched against:
  - label
  - instance label
  - display id
  - full instance id
- if selector does not resolve, fail clearly

`CONTROL_API_PORT`

- only used after explicit URL/env selector paths
- intended for deploy/container contexts where local socket use is not the integration path
- returns `http://127.0.0.1:${CONTROL_API_PORT}`

local socket discovery

- use the existing TypeScript discovery logic
- ignore dead sockets / stale pid sidecars
- if exactly one viable instance exists, return it
- if more than one viable instance exists, fail and require explicit selection

failure

- never guess between multiple live instances
- never silently fall back to `8099` after a failed selector lookup
- never require shell code to inspect human-formatted output

### Ambiguity UX

Hard error on ambiguity is the correct design. The original problem is scripts silently hitting the wrong instance. Adding `--first` or `--any` puts silent selection back into the contract under a different name, and callers will depend on it in contexts that do care.

The compromise is useful stderr:

```text
# No instances:
No WibWob-DOS instances running.
Start one with: bun run dev

# Multiple instances:
Multiple instances running: dev, c37, main
Use: wibwob resolve -i <label>
Or: export WIBWOB_INSTANCE=<label>
```

This preserves correctness while giving immediate orientation — the operator knows what's alive and what to type next.

---

## Shell contract

`scripts/lib/runtime-env.sh` becomes the single shell-facing resolution layer.

It must provide:

- `ww_resolve_api`
- `ww_curl`
- `ww_health_json`
- `ww_state_json`
- `ww_runtime_inspection_json`

### `ww_resolve_api`

Behavior:

- if `WIBWOB_API` is set, prints it and returns
- else if `WIBWOB_INSTANCE` is set, runs `wibwob resolve -i "$WIBWOB_INSTANCE"`
- else if `CONTROL_API_PORT` is set, prints `http://127.0.0.1:${CONTROL_API_PORT}` and returns
- else runs `wibwob resolve`
- prints only the target
- returns non-zero on ambiguity / failure

Important:

- `runtime-env.sh` must stop reading `control-manifest.json`
- it must stop inferring `8099` as a local default for multi-instance local usage
- it must not replicate selector matching or instance scanning in shell

### `ww_curl`

`ww_curl` owns resolution internally. Callers never pass targets or branch on transport.

Signature:

```bash
ww_curl /health
ww_curl /state
ww_curl -X POST /commands/run -H 'Content-Type: application/json' -d '{...}'
```

Contract:

- exactly one API path argument is required
- the API path argument must start with `/`
- if no such argument exists, `ww_curl` exits non-zero with a short usage error
- all non-path arguments pass through to `curl` unchanged

Internally it calls `ww_resolve_api` once per invocation, then dispatches:

- socket target → `curl --unix-socket "$target" "http://localhost$path" "$@"`
- HTTP target → `curl "${target}${path}" "$@"`

The first positional argument starting with `/` is the API path. Everything else passes through to `curl`.

All migrated shell scripts should route API calls through `ww_curl` instead of open-coding socket-vs-http branching. This is the main simplification the design buys — migrated scripts stop thinking about transport.

---

## Implementation shape

### Phase 1 — constants and cleanup

Export shared constants from `src/core/config.ts`:

| Constant | Value | Currently duplicated in |
|---|---|---|
| `INSTANCE_SOCKET_FILE` | `"control.sock"` | `wibwob.ts` (×2), `instance-discovery.ts`, `app-controller.ts`, `control-api.ts` |
| `INSTANCE_PID_FILE` | `"control.pid"` | `instance-discovery.ts`, `app-controller.ts`, `control-api.ts` |
| `INSTANCE_DISCOVERY_FILE` | `"discovery.json"` | `instance-discovery.ts`, `app-controller.ts` (×2), `control-api.ts` |

Update all consumers to import from `src/core/config.ts`. Remove local filename constants from CLI/discovery/control-api codepaths.

Goal:

- one filename contract
- less path drift
- no behavior change yet

### Phase 2 — add `wibwob resolve`

Implement a dedicated resolver command in the CLI.

Requirements:

- reuse `instance-discovery.ts`
- do not parse `wibwob instances` internally
- support plain output and `--json`
- support `-i/--instance`
- deterministic exit behavior

Recommended exit semantics:

- `0`: resolved successfully
- `1`: no resolvable target
- `2`: ambiguous target, explicit selector required

Diagnostics should be clear and short. Example:

```text
Multiple instances running: dev, main
Use: wibwob resolve -i <label>
```

### Phase 3 — rewrite `runtime-env.sh`

Replace manifest-based resolution with resolver-first logic.

Requirements:

- preserve `WIBWOB_API`
- preserve `WIBWOB_INSTANCE`
- honor `CONTROL_API_PORT`
- call `wibwob resolve` when envs do not fully resolve the target
- add one curl helper for socket/http dispatch

The shell layer should become thinner, not smarter.

### Phase 4 — migrate broken scripts

Priority order:

1. actively broken parse scripts
2. scripts already sourcing `runtime-env.sh`
3. scripts with hardcoded local ports
4. scripts walking stale instance paths
5. scripts and docs still referencing `WW_API`

Migration rule:

- if a script is local-control-facing, make it use `runtime-env.sh` + `ww_curl`
- if a script is explicitly deploy/remote-facing, leave direct TCP semantics where contextually correct

Do not force deploy smoke scripts into local-socket assumptions.

#### Full script inventory

These tables are the authoritative migration inventory for shell-side instance resolution. Keep the categories current; do not maintain separate numeric counts.

**Already sourcing `runtime-env.sh` — fix runtime-env.sh and these inherit it**

| Script |
|---|
| `scripts/lib/runtime-env.sh` |
| `scripts/minimap.sh` |
| `scripts/reload-microapp.sh` |
| `scripts/screenshot-window.sh` |
| `scripts/testing/blocking-flow-check.sh` |
| `scripts/testing/cli-parity-check.sh` |
| `scripts/testing/live-api-test-suite.sh` |
| `scripts/testing/runtime-parity-check.sh` |

**Broken parse — actively failing with multi-instance**

| Script | Bug |
|---|---|
| `.pi/skills/ghostty-control/scripts/wait-for.sh` | `awk '/^port:/'` returns empty on JSON → hangs |
| `.pi/skills/ghostty-control/scripts/calibrate.sh` | same awk bug |
| `.pi/skills/ghostty-control/scripts/restart-wibwob.sh` | same awk/grep bug |

**Stale path — `scratch/instances/` moved to `.wibwob/instances/`**

| Script |
|---|
| `scripts/experimental/dvd-screensaver.sh` |
| `scripts/experimental/dvd-screensaver-v2.sh` |
| `scripts/experimental/dvd-screensaver-v3.sh` |
| `scripts/experimental/dvd-wib-to-wob.sh` |

**Hardcoded port — silently wrong on multi-instance**

| Script | Port |
|---|---|
| `.pi/skills/wibwobdos-control/scripts/open.sh` | 8099 |
| `.pi/skills/wibwobdos-control/scripts/screenshot.sh` | 8099 |
| `.pi/skills/wibwobdos-control/scripts/state.sh` | 8099 |
| `.pi/skills/wibwobdos-control/scripts/send.sh` | 8099 |
| `.pi/skills/wibwobdos-control/scripts/export.sh` | 8099 |
| `.pi/skills/wibwobdos-control/scripts/discord.sh` | 8099 |
| `.pi/skills/wibwobdos-control/scripts/ghostty-shader.sh` | 8099 |
| `.pi/skills/wibwobdos-control/scripts/connect.sh` | 8099 |
| `.pi/skills/discord-tui-share/share.sh` | 8099 |
| `.pi/skills/wibwobdos-cinema/scripts/wibwob-record.sh` | 8099 |
| `.pi/skills/wibwobdos-cinema/scripts/example-choreography.sh` | 8099 |
| `.pi/skills/vj-timeline/scripts/replay-scpt.sh` | 8099 |
| `.pi/skills/vj-timeline/scripts/smear-animate.sh` | 8099 |
| `.pi/skills/wibwob-hosting-smoke/scripts/docker-vps-smoke.sh` | 8099 |
| `scripts/experimental/theme-rave.sh` | 8100 |
| `scripts/experimental/spell-storm.sh` | 8100 |
| `scripts/experimental/heartbeat.sh` | 8100 |
| `scripts/experimental/zine-flipbook.sh` | 8100 |
| `scripts/experimental/contour-drift.sh` | 8100 |
| `scripts/experimental/ghostty-menu-click-smoke.sh` | 8099 |
| `scripts/fx/diagonal-trail.sh` | 8099 |
| `scripts/coat-compliance.sh` | 8099 |
| `scripts/docker-smoke.sh` | 8099 |
| `scripts/lib/process-manager.sh` | 8099 |
| `scripts/testing/overlap-check.sh` | 8099 |
| `scripts/testing/layout-sweep.sh` | 8099 |
| `scripts/validate-deps.sh` | 8099 |
| `scripts/validate-microapp.sh` | 8099 |

**Leave alone — context-appropriate**

| Script | Reason |
|---|---|
| `.pi/skills/ghostty-control/scripts/open-instance.sh` | polls 8099–8110 to find freshly spawned instance — intentional |
| `.pi/skills/wibwob-hosting-smoke/scripts/docker-human-view.sh` | deploy context, TCP correct |
| `.pi/skills/wibwob-hosting-smoke/scripts/fly-smoke.sh` | deploy context, TCP correct |
| `autoresearch.checks.sh` | lints for hardcoded ports — meta |
| `scripts/ghostty-capture.sh` | already uses wibwob CLI |
| `scripts/ghostty-send.sh` | already uses wibwob CLI |
| `scripts/ghostty-window-id.sh` | already uses wibwob CLI |

**Migrate as part of `WW_API` retirement**

| Script | Notes |
|---|---|
| `scripts/testing/ci-cli-test.sh` | uses `WW_API` — migrate to `WIBWOB_API` when `WW_API` is retired in Phase 5 |

### Phase 5 — manifest deprecation

Once shell consumers are migrated:

- remove manifest reads from shell resolution
- remove manifest reads from CLI resolution
- remove `WW_API` support from shell and CLI resolution
- migrate remaining `WW_API` references in scripts/docs to `WIBWOB_API`
- remove manifest writes only after no required consumer remains

The manifest should not remain in the resolution critical path.

---

## Shutdown hygiene

Instance resolution is only half the lifecycle story. The other half is process termination.

Current quit behavior is good enough to remove the top-level PID file and stop the control API, but it is not obviously sufficient to guarantee per-window cleanup before `process.exit(0)`.

Why this matters:

- many windows register `frame.cleanup` handlers
- those cleanup handlers stop timers, unsubscribe listeners, or kill child processes
- `window.close()` runs `record.cleanup?.()`
- `app.quit` currently does not clearly route through “close every window, then stop services, then exit”

That means a user-visible quit can still leave behind orphaned child processes even if the main Bun process exits.

Examples of cleanup-bearing or child-process-bearing surfaces already in tree:

- monster cam worker process
- music player / ffplay subprocesses
- browser helper subprocesses
- file-manager search processes
- interval/timer driven windows that rely on cleanup

### Required hardening

Add one bounded shutdown path for all exit modes:

- `app.quit`
- `SIGINT`
- `SIGTERM`
- terminal hangup / `SIGHUP`
- any scripted stop path intended to be graceful

That shutdown path should:

1. guard against re-entry
2. close menus / overlays that might interfere with orderly teardown
3. close all open windows through `windowManager.closeWindow(...)` so `frame.cleanup` runs
4. stop control API transport and remove socket / pid sidecars
5. stop runtime stats and other app-owned background services
6. destroy Blessed screen / shell chrome
7. exit the process only after the bounded cleanup sequence completes
8. if cleanup stalls, force exit after a short timeout rather than hanging forever

Design rule:

- graceful quit should be the normal path
- `wibwob clean` / force-kill scripts remain fallback recovery tools, not the primary lifecycle mechanism

### Impacted scripts and commands

These scripts are directly affected because they currently assume a quit or stop operation may leave behind stale state:

- `scripts/lib/process-manager.sh`
- `scripts/ensure-running.sh`
- `scripts/restart.sh`
- `scripts/attach.sh`
- `scripts/clean-instances.sh`
- `wibwob clean`

Expected outcome after hardening:

- `ensure-running.sh` sees fewer “port stuck / API dead” cases
- `restart.sh` relies less on escalation and less on stale-port heuristics
- `clean-instances.sh` and `wibwob clean` become exception handlers, not routine hygiene
- attach/start flows see fewer zombie or half-dead instances after a normal quit

---

## Explicit non-goals

Not in v1:

- runtime symlink alias directories
- `run/default.sock`
- `run/labels/<label>.sock`
- startup-time alias publication
- shutdown-time default rotation
- label alias collision policy
- human discovery via `ls ~/.wibwob/run/labels/`

These are deferred because they add complexity without being necessary to restore correctness.

---

## Acceptance criteria

AC-1: Single local instance resolves to its unix socket.

Test:

```bash
wibwob resolve
```

Expected:

- exit `0`
- stdout is a socket path

AC-2: Two local instances with no selector fail loudly.

Test:

```bash
wibwob resolve
```

Expected:

- exit `2`
- stderr instructs the caller to use `-i`

AC-3: Two local instances with selector resolve deterministically.

Test:

```bash
wibwob resolve -i main --json
```

Expected:

- exit `0`
- JSON `kind` is `"unix"`
- JSON target points to the `main` instance socket

AC-4: `WIBWOB_INSTANCE=main` causes runtime-env-backed scripts to target `main`.

Test:

- run one migrated shell script against two live instances

Expected:

- visible effect occurs on `main`, not the other instance

AC-5: `WIBWOB_API` bypasses local discovery.

Test:

```bash
WIBWOB_API=http://127.0.0.1:19099 wibwob resolve
```

Expected:

- exit `0`
- stdout is exactly that URL

AC-6: `CONTROL_API_PORT` works for deploy/container contexts.

Test:

```bash
CONTROL_API_PORT=8099 wibwob resolve
```

Expected:

- exit `0`
- stdout is `http://127.0.0.1:8099`

AC-8: Dead sockets are ignored.

Test:

- leave stale pid/socket sidecars in instance storage

Expected:

- resolver does not return stale targets

AC-9: Polling scripts stop scraping `wibwob health` text.

Test:

- inspect migrated scripts
- run the known broken polling flows

Expected:

- no awk/grep dependency on human health output

AC-10: Manifest removal does not break shell resolution.

Test:

- remove manifest from the runtime path after migration

Expected:

- migrated scripts still resolve instances correctly

AC-11: Normal quit runs window cleanup before process exit.

Test:

- open windows that register cleanup or spawn subprocesses
- quit the app through `app.quit`

Expected:

- main Bun process exits
- no child worker/player/browser helper processes remain from that instance
- no stale control socket / PID sidecars remain

AC-12: Signal-based quit uses the same bounded shutdown path.

Test:

- start the app via `bun run dev` or `bun run start`
- send `SIGINT` and `SIGTERM` in separate runs

Expected:

- same cleanup behavior as `app.quit`
- no orphaned instance sidecars from a normal signal stop

AC-13: Cleanup scripts are fallback-only after a normal quit.

Test:

- quit a live instance normally
- run `wibwob clean`

Expected:

- reports clean or near-clean state
- does not need to kill leftover child processes from that instance

---

## Evidence required before merge

Minimum evidence:

- `wibwob resolve --json` output from a single-instance case
- one ambiguity failure with two live instances and no selector
- one success case with `-i main`
- one runtime-env-backed script visually verified against the intended instance
- one normal quit case showing no leftover sidecars
- one normal quit case with a cleanup-bearing window type showing no orphan child process

Visual verification matters. API success alone is not proof that the correct instance was targeted.

---

## Assumptions

- `wibwob` is available anywhere local socket discovery is expected to work
- deploy contexts without local CLI/socket access rely on env-based HTTP resolution
- one CLI subprocess per shell invocation is acceptable for v1
- `WIBWOB_API` is the only supported explicit URL override after migration
- if subprocess cost later becomes a practical bottleneck, symlink aliases can be reconsidered separately

---

## Summary

The design principle is simple:

- local instance truth lives in TypeScript discovery
- shell scripts do not rediscover instances themselves
- shell scripts ask the CLI resolver
- ambiguity is an error, not a heuristic
- correctness comes first
- extra runtime alias machinery is deferred until there is evidence it is needed
