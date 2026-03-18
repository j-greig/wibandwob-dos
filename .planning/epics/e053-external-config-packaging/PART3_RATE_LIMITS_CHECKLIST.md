# E053 Part 3 — Core Rate Limiting (CLI + API)

Status: proposed
Owner: NEXT_AGENT

## Strategy (core-level, smart, configurable)

Implement **one shared in-process throttling service** with two gates:

1. **HTTP ingress gate** (Control API)
   - Protects all API endpoints (`/commands/run`, `/state`, `/screenshot/*`, etc.)
   - Applies to both direct API callers and `wibwob` CLI (since CLI routes through API)

2. **Command execution gate** (RuntimeCommandService)
   - Protects command execution regardless of caller surface (API, agent, internal automation)
   - Prevents bypass by calling command services directly

Use **token bucket + concurrency caps + weighted costs**:
- token bucket: smooth limits over time
- concurrency caps: hard ceiling on in-flight expensive work
- weighted costs: expensive endpoints/commands consume more budget

Return deterministic overload responses:
- HTTP: `429` + `Retry-After`
- command layer: `{ ok:false, error:"rate_limited", retryAfterMs, limitKey }`

---

## Config model (easy knobs, env-overridable)

Add runtime config block (single source of truth):

```json
{
  "rateLimit": {
    "enabled": true,
    "ingress": {
      "windowMs": 1000,
      "burst": 30,
      "refillPerSec": 15,
      "maxConcurrent": 8
    },
    "command": {
      "windowMs": 1000,
      "burst": 20,
      "refillPerSec": 10,
      "maxConcurrent": 4
    },
    "costs": {
      "default": 1,
      "state.sync": 2,
      "screenshot.text": 3,
      "screenshot.ansi": 4,
      "commands.run": 2
    },
    "trust": {
      "localSocketMultiplier": 1.5,
      "localhostMultiplier": 1.2,
      "remoteMultiplier": 1.0
    }
  }
}
```

Env overrides (examples):
- `WIBWOB_RL_ENABLED=1`
- `WIBWOB_RL_INGRESS_BURST=40`
- `WIBWOB_RL_COMMAND_MAX_CONCURRENT=6`

Rule: defaults in code, overrides via config/env, no magic constants in handlers.

---

## Tickoff Checklist

### 0) Architecture + placement
- [x] Add `RateLimitService` under `src/application/` (shared owner)
- [~] Add typed config schema + resolver for `rateLimit` block (env-based resolver implemented; config-file layer pending)
- [x] Wire service into app composition root once (single instance)

### 1) Ingress gate (Control API)
- [x] Add pre-handler check in `ControlApiService` request path
- [ ] Key by caller identity (unix socket/local/remote) + endpoint group
- [x] Apply endpoint costs (`/screenshot/*` > `/health`)
- [x] Return `429` + `Retry-After` + stable JSON error body

### 2) Command gate (RuntimeCommandService)
- [x] Add limiter check before command dispatch
- [ ] Key by `source` + `command id`
- [x] Add per-command cost map with default fallback
- [x] Enforce command concurrency cap

### 3) Surface parity
- [ ] Ensure CLI traffic is naturally covered via ingress gate
- [ ] Ensure agent/internal calls are covered via command gate
- [ ] Verify no command-execution bypass path remains unguarded

### 4) Observability + inspection
- [x] Expose limiter stats in `/runtime/inspection` (drops, accepts, queue depth)
- [ ] Add lightweight counters to `/runtime/stats`
- [ ] Log limited events with compact structured records

### 5) Tests
- [ ] Unit: token bucket refill/burst/concurrency behavior
- [ ] Unit: weighted cost accounting
- [ ] Integration: 429 behavior under request flood
- [ ] Integration: command-layer limiting when API gate is bypassed
- [ ] Integration: config/env overrides alter limits correctly

### 6) Operational profiles (2GB VPS-safe defaults)
- [ ] Add profile presets: `dev`, `default`, `vps-small`
- [ ] `vps-small` lowers burst + concurrency for `/state` + `/screenshot`
- [ ] Document recommended env for 2GB VPS deployment

### 7) Rollout safety
- [ ] Start with monitor mode (`enforce=false`, emit would-limit metrics)
- [ ] Flip to enforce mode after smoke validation
- [ ] Add emergency kill-switch env (`WIBWOB_RL_ENABLED=0`)

---

## Acceptance Criteria (binary)

- [ ] AC-1: API flood receives deterministic 429s before process instability
- [ ] AC-2: Command flood from non-HTTP surfaces is also limited
- [ ] AC-3: Limits are adjustable without code edits (config/env)
- [ ] AC-4: Runtime inspection clearly reports active limits and drop stats
- [ ] AC-5: `vps-small` profile runs stably on 2GB RAM under synthetic load
