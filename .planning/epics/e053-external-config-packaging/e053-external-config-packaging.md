# WibWob-DOS External Config, Discovery & Packaging — PRD / Spec

Implementation-oriented spec for a **deterministic config + discovery layer** that works across local, npm, Docker, VPS, and multi-instance environments.

---

## Implementation Progress (reconciled 2026-03-18)

- [x] Runtime data root + layered resolution (`DATA_ROOT`)
- [x] Two-level instance identity (`instanceId` + UI `instanceDisplayId`)
- [x] Instance-scoped core runtime paths wired via `runtime-node`
- [x] `state-service.ts` writing to instance-scoped state path
- [x] Migration of socket/discovery consumers (`control-api`, `wibwob` CLI, stale cleanup)
- [~] Legacy compatibility retained but bounded (still present as temporary aliases/fallbacks)
- [ ] Full removal of scratch-first runtime path assumptions
- [ ] Integration tests for multi-instance isolation
- [~] Core rate-limiting slice started (ingress + command gates wired, tuning/tests pending)

Execution sequences:
- `PART2_EXECUTION_CHECKLIST.md` (path/discovery migration)
- `PART3_RATE_LIMITS_CHECKLIST.md` (core rate limiting across surfaces)
- `AGENTIC_DOCKER_VPS_SMOKE_GUIDE.md` (Docker/VPS smoke operations + gotchas)

---

## 0. Goals

Support:

* local dev (repo)
* npm global install
* Docker/container
* VPS hosted runtime
* browser/ttyd sessions
* multiple Runtime Nodes per machine

Preserve:

* runtime-centric architecture
* canonical instance identity
* small, opinionated defaults
* agent-friendly inspection and control

---

## 1. Core Concepts

### 1.1 Immutable vs Mutable

Immutable (image/package):

* built-in microapps
* built-in themes
* default registry
* default config

Mutable (runtime-owned):

* workspaces
* exports
* logs
* instance metadata
* external microapps
* external themes
* user/project config

Rule: never write mutable state into package/image paths.

---

### 1.2 Runtime Data Root

Canonical mutable root.

Resolution order:

1. `WIBWOB_DATA_DIR` (env)
2. project `.wibwob/`
3. `~/.wibwob/`
4. OS temp dir (fallback)

Structure:

```
<data_root>/
  config.json
  registry.json
  microapps/
  themes/
  instances/
    {instance_id}/
      workspaces/
      exports/
      logs/
```

---

### 1.3 Instance Identity

```
instance_id: string
```

Rules:

* unique per Runtime Node
* not derived from port
* stable for lifecycle of instance

Optional:

* `instanceLabel` (display only)

---

### 1.4 Config Layers

Order (low → high):

1. defaults (code)
2. global (`~/.wibwob/`)
3. project (`.wibwob/`)
4. env / CLI

Merge:

```
final = merge(default, global, project, env)
```

---

### 1.5 Provenance

All resolved values carry source:

```
{ value, source }
```

Sources:

* builtin
* global
* project
* env
* runtime

---

### 1.6 Determinism

Resolution must be deterministic:

* stable path order
* stable merge precedence
* no unordered iteration

---

## 2. Config Schema (v1 minimal)

```json
{
  "theme": "string",
  "workspace": {
    "autoLoad": "string",
    "saveOnQuit": true
  },
  "microapps": {
    "paths": ["string"],
    "registry": {
      "id": "core|beta|internal|disabled"
    }
  },
  "api": {
    "port": 8099
  }
}
```

Constraints:

* minimal only
* no speculative options

---

## 3. Discovery

### 3.1 Microapps

Sources:

* built-in (package)
* `<data_root>/microapps`
* project `.wibwob/microapps`
* additional configured paths

Validation:

* valid `microapp.json`
* unique id
* loadable entry

Tier:

```
tier = override ?? default ?? "beta"
```

No auto-promotion to `core`.

---

### 3.2 Themes

Sources:

* built-in
* `<data_root>/themes`
* project `.wibwob/themes`

Validation required.

---

### 3.3 Registry

* default registry remains in code
* external `registry.json` overrides/extends
* never replace defaults

---

## 4. Config & Discovery Service

Location:

```
src/runtime/config/
```

Responsibilities:

* load config layers
* resolve paths
* merge configs
* track provenance
* validate inputs
* expose runtime-safe API

Consumers:

* microapp loader
* theme resolver
* workspace service
* runtime inspector

---

## 5. Validation

Validate:

* config schema
* microapp manifests
* theme structure
* duplicate ids
* invalid tiers
* path existence

Behaviour:

* fail fast for critical errors
* isolate non-critical failures
* log clearly

---

## 6. Runtime Integration

Must:

* feed into runtime state
* be accessible via application services
* be inspectable

Expose via inspection:

* effective config
* provenance
* discovered microapps
* enable/disable reasons

---

## 7. Resource Constraints (v1)

Support soft limits for:

* windows
* concurrent microapps
* export size/count
* workspace size
* log retention

v1: observe + warn (no enforcement)

---

## 8. Export Lifecycle

Exports are:

* instance-scoped
* ephemeral by default
* subject to cleanup (TTL or size)

Future: explicit persistence promotion

---

## 9. Namespacing & Collisions

* all ids unique per runtime node
* collisions:

  * fail fast OR
  * namespace by source (future)
* never silently override

---

## 10. Trust / Source Types

Sources:

* builtin
* global
* project
* external

No enforcement in v1; must be visible in provenance.

---

## 11. Mutation Model

v1:

* config/discovery loads at startup

Future:

* explicit reload command
* runtime mutation APIs

---

## 12. Docker / VPS Compatibility

Requirements:

* no writes to image paths
* support mounted `<data_root>`
* work under ttyd/browser sessions
* compatible with reverse proxy
* control API internal-only

Do not assume:

* single instance
* localhost-only
* writable cwd

---

## 13. NPM Packaging & Release Workflow

### 13.1 Packaging Positioning

NPM global install is an important delivery mode, but it is **not** the primary driver of architecture.

Sequence:

1. runtime/config/discovery seams become stable
2. mutable data moves out of repo/package assumptions
3. packaging becomes a thin delivery layer

Do not let packaging force bad path assumptions or local-only design.

### 13.2 Immediate Preparation (do now)

Prepare the repo for future packaging by:

* choosing a stable package name
* choosing a stable CLI command name
* removing assumptions that repo root is the writable app root
* keeping built-in assets separate from mutable runtime-owned assets
* ensuring new code uses runtime/config/discovery services rather than ad hoc repo-relative paths
* preserving deployment compatibility with Docker/VPS/browser-hosted modes

These changes are architectural hygiene and should happen before publishing.

### 13.3 Deferred Packaging Work (do later)

After the first runtime/config/discovery slice is stable:

* add final `bin` wiring
* verify dist output layout
* add npm publish workflow
* add global-install smoke test
* finalise end-user install docs
* trim package contents if needed

### 13.4 CLI Packaging Contract

```json
"bin": { "wibwob": "./dist/cli/wibwob.js" }
```

Requirements:

* works without repo checkout
* config resolution works outside source tree
* mutable data always goes to `<data_root>`
* built-in defaults remain available from package install

### 13.5 Release / Verification Workflow

Before publish or tagged release, verify:

* package builds cleanly
* CLI launches from installed package
* no writes occur inside install/package paths
* config resolution works with only `~/.wibwob/` or `WIBWOB_DATA_DIR`
* project `.wibwob/` overrides still work
* Docker/VPS/browser-hosted deployment still works
* external microapps and themes still load correctly
* runtime identity remains `instance_id`-based, not port-based

### 13.6 Package Content Rules

Package should include:

* built-in microapps
* built-in themes
* default registry
* default config
* CLI/runtime code

Package should exclude mutable runtime-owned data.

## 14. Scaffold

```
--project → .wibwob/microapps
--global → ~/.wibwob/microapps
```

---

## 15. Observability

Runtime must expose:

* structured logs
* errors
* config resolution output
* discovery results

---

## 16. Non-Goals

Not in v1:

* runtime registry/orchestration
* service discovery network
* permission model
* plugin marketplace

---

## 17. Success Criteria

Works in:

* repo dev
* npm global
* Docker
* VPS

And:

* external microapps load
* config merges predictably
* instance identity stable
* runtime inspectable
* no mutable state in package/image paths

---

## 18. Failure Conditions

* hardcoded local paths
* config replaces defaults
* ports used as identity
* Docker/VPS broken
* hidden behaviour

---

## 19. Implementation Order

1. config/discovery service
2. runtime data root
3. discovery integration (microapps/themes)
4. validation
5. inspection exposure
6. scaffold updates
7. npm packaging preparation
8. npm packaging / release workflow

### 19.1 Packaging Workflow Rule

Do light packaging preparation early.

Do actual npm delivery only after:

* config/discovery is stable
* mutable/runtime-owned paths are clean
* Docker/VPS compatibility is preserved
* install-from-package smoke tests pass

## Final Principle

This is a **deterministic discovery and resolution layer over a shared runtime**, designed for:

* humans
* agents
* local and hosted environments

Keep it:

* small
* explicit
* inspectable
* predictable
