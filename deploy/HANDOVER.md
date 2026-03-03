# Deploy Handover — 3 March 2026

## What we built today

A Docker deployment of wibwob-dos on a Hetzner VPS, accessible via browser at
https://dos.wibandwob.com — a blessed TUI running inside ttyd, wrapped in Caddy.

Stack: Bun + blessed → ttyd :7681 → Caddy :443 (tls internal) → Cloudflare → browser

## It works

- Go to https://dos.wibandwob.com
- Login: user `wibwob` / password `wibwob123` (change this)
- Takes ~5–10 seconds to render — this is the blessed/ttyd resize race (see below)
- Each browser tab gets an independent TUI session
- Hard 30-min session timeout via `timeout 1800` in session.sh

## SSH into VPS

```
ssh -p 2849 root@89.167.18.207
cd /opt/wibwob-dos/deploy
docker compose logs -f          # watch live logs
docker compose up -d --build    # redeploy after git pull
```

## Things that broke today and why

| Problem | Cause | Fix |
|---------|-------|-----|
| Grey screen initially | `--timeout` flag not in ttyd 1.7.7 — mangled the whole command, ran in readonly mode | Removed `--timeout` flag |
| 502 Bad Gateway | Token proxy WS handler was empty — never forwarded WS to ttyd | Bypassed token proxy entirely for now |
| 521 Connection refused | Cloudflare SSL mode is Full — expects :443, Caddy was :80 only | Added `tls internal` to Caddyfile |
| ADMIN_SECRET missing | docker compose wasn't loading the env file | Added `env_file: /etc/wibwob.env` to compose |
| Still grey | blessed initialises before ttyd sends terminal dimensions | 0.5s sleep in session.sh — just needs patience (~10s) |

## Security issues — FIX BEFORE SHARING WIDELY

1. **Sessions run as root** — anyone with the URL has a root shell in the container.
   Fix: add non-root user to Dockerfile, run session as that user.
   
2. **unshare is a band-aid** — we added `unshare --mount --pid --fork` to session.sh
   to create a namespace, but it's not a proper sandbox.
   Fix: proper non-root user + `--read-only` Docker filesystem + dropped capabilities.

3. **Basic auth password is in the repo** — the bcrypt hash is committed.
   Fix: generate a new hash with `docker exec deploy-caddy-1 caddy hash-password --plaintext YOURPASS`
   and update the Caddyfile on the server.

4. **Token proxy is bypassed** — share links don't work yet.
   Fix: the token-proxy.ts WS handler is incomplete. WebSocket needs to be proxied
   through to ttyd, not just HTTP. Easiest fix: use nginx upstream proxy for WS,
   or implement proper Bun WS bridging.

## Tomorrow's tasks (priority order)

1. Fix security: add non-root user to Dockerfile, drop capabilities
2. Fix grey screen race properly: implement `waitForTerminalReady()` in src/app.ts
   (codex wrote the exact code — see `.codex-logs/2026-03-03/codex-the-app-runs-fine-locally-but--*.log`)
3. Fix token proxy WS bridging so share links work again
4. Bump sleep in session.sh from 0.5s to 2s as interim fix for resize race
5. Change basic auth password

## Architecture reminder

```
Browser
  → Cloudflare (TLS termination, dos.wibandwob.com)
    → VPS :443
      → Caddy (tls internal, basic_auth)
        → ttyd :7681 (one process per browser tab)
          → session.sh (unshare + timeout 1800)
            → bun run src/app.ts (blessed TUI)
```

Control API (port 8099) is NOT exposed externally — internal Docker network only.
Token proxy service is running but bypassed — Caddy goes straight to ttyd.
