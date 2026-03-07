---
Status: not-started
Type: epic
Epic: e023-capability-aware-command-registry
---

<human-prompt>
"What do you think would be a great canon best practice way to do the Docker safe list of apps? Think about the config files, the settings files, the workspace, JSON files. Always we're configuring and manipulating the app already. Maybe ask Codex to compile a report and rank its list of suggestions of how to do it. Might be non-docker other instance of the TUI app in future even."
</human-prompt>

# E023 - Capability-Aware Command Registry

## Concept
E023 makes command availability explicit and environment-aware: each command declares requirements, and the registry becomes the single runtime gate for visibility and execution. When a requirement is unmet, the command is hidden from menu/palette/API/agent listing by default and guarded at execution. This solves Docker-safe deployment and generalizes to any runtime context (local dev, CI, kiosk, VPS, alternate TUI instances) without forked command catalogs.

## Scope

### In
- Add capability requirements to command definitions (`requires?: CapabilityKey[]`).
- Add `CapabilityService` to probe runtime prerequisites and expose a canonical snapshot.
- Make `CommandRegistry` the only gate for availability (`list` filter + `run` guard).
- Expose capabilities in `GET /state` and support `GET /commands/list?includeUnavailable=1`.
- Add deployment profile overlay (`WIBWOB_DEPLOY_PROFILE`) merged with probe results.
- Fix current crash-prone dependency flows: Backrooms spawn error path, Chrome dependency precheck, Monster Cam graceful unmet-dependency behavior.

### Out
- Build-time split catalogs per deployment target.
- Surface-local ad-hoc filtering in menu/palette/API/agent code.
- Replacing existing command IDs or altering command ownership boundaries.
- Non-command feature work unrelated to capability gating.

## Design: Chosen Approach (Option 1 + Option 2)

### Root-cause summary
- Command availability is static metadata only today (`APP_COMMANDS` has no requirements field).
- Registry snapshots commands at startup with no environment gating.
- All surfaces consume the same ungated set, so all leak unavailable commands.
- Desktop state has no canonical capability model, so agents cannot reason about absences.
- Dependency handling is inconsistent and sometimes unsafe (`figlet` fallback text, Chrome runtime failure, Monster Cam silent falsey behavior, Backrooms spawn error risk).

### TypeScript sketches

```ts
// src/services/capability-service.ts
export type CapabilityKey =
  | "bin.figlet"
  | "bin.chrome"
  | "bin.python3"
  | "path.backrooms.repo"
  | "path.monster_cam.venv"
  | "env.pi.oauth"
  | "microapp.poetry_clock.sentient";

export interface CapabilityStatus {
  ok: boolean;
  reason?: string;
  source: "probe" | "profile-force-on" | "profile-force-off";
  checkedAt: string;
}

export interface CapabilitySnapshot {
  [key: CapabilityKey]: CapabilityStatus;
}

export interface CapabilityService {
  probe(): CapabilitySnapshot;
  snapshot(): CapabilitySnapshot;
  reason(key: CapabilityKey): string | undefined;
  isAvailable(requirements?: CapabilityKey[]): { ok: boolean; missing: CapabilityKey[] };
}
```

```ts
// src/core/command-catalog.ts
export interface AppCommandDefinition {
  id: string;
  label: string;
  // ...existing fields...
  requires?: CapabilityKey[];
}

// examples
{ id: "chrome.open", requires: ["bin.chrome"] }
{ id: "backrooms.run", requires: ["path.backrooms.repo"] }
{ id: "monster_cam.open", requires: ["path.monster_cam.venv"] }
```

```ts
// src/core/command-registry.ts
list(surface?: CommandSurface, opts?: { includeUnavailable?: boolean }): CommandListItem[] {
  const allCommands = this.buildList(surface);
  if (opts?.includeUnavailable) return allCommands;
  return allCommands.filter((cmd) => cmd.available);
}

run(id: string, args?: Record<string, unknown>): CommandRunResult {
  const cmd = this.lookup(id);
  if (!cmd) return { ok: false, error: `Unknown command: ${id}` };
  const gate = this.capabilities.isAvailable(cmd.requires);
  if (!gate.ok) {
    return {
      ok: false,
      error: `Command unavailable: ${cmd.id} (missing: ${gate.missing.join(", ")})`
    };
  }
  return this.execute(cmd, args);
}
```

```ts
// src/core/types.ts + src/services/state-service.ts
interface DesktopStateApp {
  // existing fields...
  capabilities?: Record<string, {
    ok: boolean;
    reason?: string;
    source?: "probe" | "profile-force-on" | "profile-force-off";
    checkedAt?: string;
  }>;
}
```

```ts
// src/services/capability-service.ts
interface CapabilityProfilePolicy {
  forceOff?: CapabilityKey[];
  forceOn?: CapabilityKey[];
}

// Resolve profile from env var (name -> JSON file path map), then merge:
// 1) probe result
// 2) forceOn
// 3) forceOff (highest priority)
const profileName = process.env.WIBWOB_DEPLOY_PROFILE;
```

## Ranked Options

| Rank | Option | Summary |
| --- | --- | --- |
| 1 | Option 1: CapabilityService + `requires` in catalog + registry single gate | Best canon fit. One source for requirements (`command-catalog.ts`), one evaluator (`CapabilityService`), one gate (`CommandRegistry`) consumed by all surfaces. This eliminates drift and keeps command ownership intact. Cost: modest cross-file updates (`command-catalog`, `command-registry`, `app-controller`, `state-service`, `control-api`, type surface). |
| 2 | Option 2: Deployment profile overlay (complements Option 1) | Adds deterministic policy control for CI/kiosk/Docker/alt deployments using `WIBWOB_DEPLOY_PROFILE` and policy JSON (`forceOff`/`forceOn`). Useful when probe timing is undesirable or capabilities are intentionally disabled. Must remain an overlay on top of live probing, not a separate gating path; `forceOff` must always win. |
| 3 | Option 3: Run-time guard only (no list filtering) | Prevents some crashes by blocking execution, but keeps unavailable commands visible everywhere, producing noisy UX and wasted agent/tool calls. Better than current state for safety, but fails the “hidden from all surfaces” requirement. |
| 4 | Option 4: Build-time catalogs per target | Would pre-bake different command lists for Docker/local/etc., but violates single-source-of-truth and creates ongoing drift risk across targets. Also incompatible with dynamic/mixed environments where capabilities can differ at runtime. |
| 5 | Option 5: Surface-local filters | Worst canon alignment. Menu/palette/API/agent each implement their own checks, creating parallel helpers, inconsistent behavior, and debugging ambiguity. High maintenance and guaranteed drift. |

## Known Capability Requirements

| Command ID | `requires` keys | Probe checks |
| --- | --- | --- |
| `monster_cam.open` | `path.monster_cam.venv`, `bin.python3` | Verify `assets/mediapipe-venv/bin/python` exists and is executable; fallback check `python3` on `PATH` if policy allows degraded mode. |
| `backrooms.open` | `path.backrooms.repo` | Verify resolved Backrooms workspace path from `BackroomsService.resolveBackroomsPath()` exists/readable. |
| `backrooms.run` | `path.backrooms.repo` | Same as `backrooms.open`, plus run guard before launch/spawn. |
| `chrome.open` | `bin.chrome` | Verify Chrome executable discovery path used by `ChromeBrowserService` resolves to an existing executable before window open. |
| `microapp.wibwob.poetry-clock.set-mode` (`mode=sentient`, `voice=liminal|terrain`) | `microapp.poetry_clock.sentient`, `env.pi.oauth` | Verify sentient prerequisites (OAuth/session token env presence used by agent stack). Keep clock-only mode available without these keys. |
| `figlet.open` | `bin.figlet` | Probe `figlet` executable availability (`spawnSync("figlet", ["-v"])` or equivalent). |

Notes:
- `microapp.wibwob.poetry-clock.open` should remain available in clock mode; capability gating applies to sentient mode entrypoints and mode switching.
- Capability keys are intentionally deployment-agnostic and can be reused by dynamic module commands.

## Stories

### S00 - CapabilityService + CapabilityKey + probes
Goal:
- Add canonical capability model and probe layer.

Acceptance Criteria:
- `CapabilityKey` union exists and covers at least the known keys in this epic.
- `CapabilityService` probes and caches snapshot at boot; exposes `snapshot()` and `reason(key)`.
- Probe results are deterministic and include reason strings on failures.
- Verification:
  - `bun run typecheck`
  - `curl -s http://127.0.0.1:8099/state | jq '.app.capabilities'`

Files:
- `src/services/capability-service.ts` (new)
- `src/core/app-controller.ts`
- `src/core/types.ts`
- `src/services/state-service.ts`

### S01 - Add `requires` to command definitions
Goal:
- Encode capability requirements in the command source of truth.

Acceptance Criteria:
- `AppCommandDefinition` supports `requires?: CapabilityKey[]`.
- Known dependency-sensitive built-in commands are annotated (`chrome.open`, `monster_cam.open`, `backrooms.open`, `backrooms.run`, `figlet.open`).
- Dynamic command path supports optional `requires` metadata.
- Verification:
  - `bun run typecheck`
  - `curl -s 'http://127.0.0.1:8099/commands/list?includeUnavailable=1' | jq '.commands[] | select(.id=="chrome.open" or .id=="monster_cam.open")'`

Files:
- `src/core/command-catalog.ts`
- `src/core/command-registry.ts`
- `src/services/module-loader.ts`

### S02 - Registry gating (`list` + `run`) and canonical availability sets
Goal:
- Make registry the single gate for command visibility and execution.

Acceptance Criteria:
- `CommandRegistry.list()` returns only available commands by default.
- `CommandRegistry.list({ includeUnavailable: true })` includes both `availableCommands` and `allCommands` view fields (or equivalent explicit availability flag per command).
- `CommandRegistry.run()` rejects unavailable commands with clear missing-capability reasons.
- Menu, palette, API, and agent list surfaces all consume the gated list path.
- Verification:
  - `bun run typecheck`
  - `curl -s http://127.0.0.1:8099/commands/list | jq '.commands | map(.id)'`
  - `curl -s 'http://127.0.0.1:8099/commands/list?includeUnavailable=1' | jq '.commands | map({id, available, missingCapabilities})'`
  - `curl -s -X POST http://127.0.0.1:8099/commands/run -H 'content-type: application/json' -d '{"id":"chrome.open"}'`

Files:
- `src/core/command-registry.ts`
- `src/core/app-controller.ts`
- `src/services/agent-tools.ts`

### S03 - API/state visibility for capabilities + unavailable commands
Goal:
- Expose capability truth to users and agents while keeping default list clean.

Acceptance Criteria:
- `GET /state` includes `app.capabilities` map with `ok` + `reason` (and source metadata if present).
- `GET /commands/list` defaults to available commands only.
- `GET /commands/list?includeUnavailable=1` includes unavailable commands with reason/missing capability detail.
- OpenAPI/help docs updated for new query parameter and response fields.
- Verification:
  - `bun run typecheck`
  - `curl -s http://127.0.0.1:8099/state | jq '.app.capabilities'`
  - `curl -s 'http://127.0.0.1:8099/commands/list?includeUnavailable=1' | jq '.commands[] | select(.available==false)'`

Files:
- `src/services/control-api.ts`
- `src/core/types.ts`
- `src/services/state-service.ts`

### S04 - Deployment profile overlay (`WIBWOB_DEPLOY_PROFILE`)
Goal:
- Add deterministic deployment policy override without forking catalogs.

Acceptance Criteria:
- `WIBWOB_DEPLOY_PROFILE` resolves a policy JSON profile.
- Policy supports `forceOff` and `forceOn` arrays of `CapabilityKey`.
- Merge order is enforced: probe -> forceOn -> forceOff.
- Policy effects are visible in `/state.app.capabilities` and command list gating.
- Verification:
  - `WIBWOB_DEPLOY_PROFILE=docker-safe bun run dev:world` (or equivalent start command)
  - `curl -s http://127.0.0.1:8099/state | jq '.app.capabilities'`
  - `curl -s http://127.0.0.1:8099/commands/list | jq '.commands | map(.id)'`

Files:
- `src/services/capability-service.ts`
- `src/core/app-controller.ts`
- `src/services/control-api.ts`
- `.config/capability-profiles/*.json` (new, path to confirm)

### S05 - Crash/UX fixes for known dependency-risk commands
Goal:
- Ensure unmet dependencies fail safely and coherently with capability model.

Acceptance Criteria:
- Backrooms child process launch path has explicit `error` handler; no uncaught spawn failures.
- Chrome command checks capability before browser launch attempt and returns guard error when unavailable.
- Monster Cam reports unmet venv/capability clearly and does not fail silently.
- Figlet behavior aligns with registry gating (hidden when unavailable unless explicitly requested via includeUnavailable).
- Verification:
  - `bun run typecheck`
  - `bun test src/tests/workspace-apptype-roundtrip.test.ts` (or nearest command-registry/control-api smoke)
  - `curl -s -X POST http://127.0.0.1:8099/commands/run -H 'content-type: application/json' -d '{"id":"backrooms.run","args":{"theme":"liminal fluorescent maze"}}'`

Files:
- `src/core/app-controller.ts`
- `src/services/backrooms-service.ts`
- `src/services/chrome-browser-service.ts`
- `src/services/monster-cam-service.ts`
- `src/services/monster-cam-worker.ts`
- `src/services/figlet-service.ts`

## Open Questions
- If dependencies are installed while app is running, should probes be static-at-boot, periodic, or manual refresh (`/capabilities/reprobe`)?
- During workspace restore, what is the canonical behavior when a persisted `appType` is now unavailable: skip silently, placeholder window, or deferred retry state?
- Should deployment profile JSON live in-repo (versioned defaults) or per-deploy host directory (operator-owned policy), and how are both merged?
- What naming convention should `CapabilityKey` enforce (`bin.*`, `env.*`, `path.*`, `service.*`) to avoid drift between built-in and microapp keys?
- Should `includeUnavailable=1` be allowed on all surfaces equally, or API-only for diagnostic mode?

## Invariants to Preserve
- Single source of truth per concern: requirements declared on commands in `src/core/command-catalog.ts` (and dynamic command registration), not duplicated in each surface.
- One control/API path per user-visible surface: registry-gated output feeds menu, palette, `/commands/list`, and agent tools consistently.
- Services own logic, windows own wiring: capability probing and policy merge live in service layer, not window factories.
- State is semantic and agent-usable: capability availability and reasons are exposed in typed `DesktopState` instead of inferred from UI errors.
- No parallel helpers: avoid per-surface or per-feature ad-hoc dependency checks once registry gating is in place.
