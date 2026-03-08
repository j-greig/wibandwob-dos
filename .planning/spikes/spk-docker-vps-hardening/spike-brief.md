---
id: spk-docker-vps-hardening
title: Docker VPS Hardening
status: not-started
---

# Spike: Docker VPS Hardening

**Goal:** Close the 4 known security/reliability gaps in the Hetzner VPS deployment
documented in `deploy/HANDOVER.md` (2026-03-03).

**Live deploy:** `dos.wibandwob.com` · VPS `89.167.18.207` · SSH port `2849`

---

## Known Issues to Fix

### H1 — Sessions run as root (HIGH)
**Problem:** `session.sh` runs `bun run src/app.ts` as root inside the container.
Anyone with the ttyd URL has a root shell.
**Files:** `deploy/Dockerfile`, `deploy/session.sh`
**Fix:** Add non-root `wibwob` user in Dockerfile; run session as that user.
`Dockerfile.smoke` already does this correctly — port the pattern to `Dockerfile`.

### H2 — Token proxy WS bridging incomplete (MEDIUM)
**Problem:** `deploy/token-proxy.ts` generates share links but WS forwarding is
empty — Caddy bypasses it entirely and goes straight to ttyd. Share links don't work.
**Files:** `deploy/token-proxy.ts`, `deploy/docker-compose.yml`, `deploy/Caddyfile`
**Fix:** Implement proper Bun WS proxy in token-proxy.ts. Pattern: HTTP requests
get token-gated; WebSocket upgrades get forwarded to `http://ttyd:7681`. Or use
nginx upstream proxy for WS (simpler).

### H3 — Basic auth password hash committed (MEDIUM)
**Problem:** bcrypt hash is in `deploy/Caddyfile` in the repo. Anyone with repo
access can brute-force the password offline.
**Files:** `deploy/Caddyfile`
**Fix:** Move the hash to `/etc/wibwob.env` on the VPS (already exists for
`ADMIN_SECRET`). Reference via Caddy env var: `{env.WIBWOB_BASIC_AUTH_HASH}`.

### H4 — Resize race on first paint (LOW)
**Problem:** blessed initialises before ttyd sends terminal dimensions via WebSocket.
First render is blank/wrong for ~5-10s. Current mitigation: `sleep 0.5` in session.sh.
**Files:** `deploy/session.sh`, `src/app.ts`
**Fix (proper):** Implement `waitForTerminalReady()` in `src/app.ts` — wait for
SIGWINCH before calling `screen.render()`. Codex wrote the exact implementation
in `.codex-logs/` (see HANDOVER.md for filename pattern).
**Fix (interim):** Bump sleep from 0.5s to 2s in session.sh.

---

## File Map

| File | Role |
|------|------|
| `deploy/Dockerfile` | Main prod image — needs non-root user (H1) |
| `deploy/Dockerfile.smoke` | Smoke image — already has non-root `wibwob` user (reference impl for H1) |
| `deploy/docker-compose.yml` | Service wiring — may need ttyd user env fix (H1) |
| `deploy/session.sh` | Per-tab session launcher — runs as root (H1), sleep band-aid (H4) |
| `deploy/token-proxy.ts` | Share link server — WS forwarding empty (H2) |
| `deploy/Caddyfile` | Reverse proxy config — hash hardcoded (H3) |
| `deploy/smoke-entrypoint.sh` | Smoke container entrypoint — reference for H1 pattern |
| `deploy/HANDOVER.md` | Original incident log with all context |
| `config/capability-profiles/docker-safe.json` | Capability gating (not a security issue — working correctly) |

---

## Suggested Order

1. H1 (root sessions) — highest risk, clear pattern in Dockerfile.smoke
2. H3 (hash in repo) — 10-min fix, should not wait
3. H4 interim (sleep 0.5→2s) — ship immediately while proper fix is scoped
4. H4 proper (waitForTerminalReady) — find the codex log, implement
5. H2 (WS proxy) — most complex, do last

---

## Done

- [ ] H1 — non-root user in Dockerfile
- [ ] H2 — WS proxy in token-proxy.ts
- [ ] H3 — hash out of Caddyfile, into env
- [ ] H4 interim — sleep 0.5→2s
- [ ] H4 proper — waitForTerminalReady in app.ts
