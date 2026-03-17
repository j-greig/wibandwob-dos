# OPSEC — Fly.io Disposable Testbed

## What's Exposed

The full WibWob-DOS control API is public at `https://wibwob-dos.fly.dev` with **zero auth**.

Anyone who finds the URL can:
- **Read all desktop state** — `/state`, `/screenshot/text`, window contents
- **Open/close/move/resize windows** — `/windows/batch`, `/view/*/open`
- **Execute any registered command** — `/commands/run` (theme changes, workspace save/load, microapp open)
- **Write to editor buffers** — `/windows/editor/write`
- **Send messages to the agent chat** — `/windows/agent-message`
- **Trigger LLM calls** via Scramble — `/scramble/say` (burns OpenRouter credits)
- **Read the OpenAPI spec** — `/openapi.json` (full self-documenting attack surface)

They **cannot**:
- Execute arbitrary shell commands (no exec endpoint)
- Read/write arbitrary filesystem paths (no file API beyond editor buffers + primer paths)
- Access Fly secrets (injected as env vars, not readable via API)
- SSH into the machine (Fly WireGuard mesh only, no public SSH)
- Pivot to other Fly apps or your account (machine isolation, scoped deploy token)
- Access the host OS, other containers, or Fly infrastructure
- Persist anything — no volumes, no mounted disk, ephemeral rootfs

## Why This Is Acceptable

- **Disposable.** Machine resets every hour (GitHub Actions cron) and on every `fly deploy`. No state accumulates.
- **No secrets at rest.** OpenRouter API key is in Fly secrets (encrypted, env-injected). Not in the image, not readable via API.
- **Spend-capped.** OpenRouter key should have a hard $5/day limit. Worst case: someone spams `/scramble/say` and burns $5.
- **No lateral movement.** The Fly machine is isolated. No Tailscale, no VPN, no connection to wibwob1 (Hetzner) or any other infra.
- **Read-only harm ceiling.** An attacker can mess up the TUI layout and burn some API credits. That's it. Machine resets in ≤1 hour.

## When This Stops Being Acceptable

Add auth when ANY of these become true:
- **Persistent state.** Volumes, databases, workspace data that survives restart.
- **Real API keys.** Production Anthropic/OpenRouter keys with no spend cap.
- **Multi-tenant.** Multiple agents with distinct identities/permissions.
- **Filesystem access.** Any endpoint that reads/writes arbitrary paths.
- **Lateral network access.** Tailscale, VPN, SSH tunnels to other infra.
- **Public demo.** URL shared widely, not just to trusted agents.

## Quick Hardening (10 min)

If needed, add a bearer token:

```bash
# 1. Set a secret
fly secrets set WIBWOB_API_TOKEN=your-random-token --app wibwob-dos

# 2. Add middleware to control-api.ts (after imports)
const API_TOKEN = process.env.WIBWOB_API_TOKEN;

// In handleRequest(), before routing:
if (API_TOKEN) {
  const auth = request.headers.get("Authorization");
  if (auth !== `Bearer ${API_TOKEN}`) {
    return new Response("Unauthorized", { status: 401 });
  }
}

# 3. Redeploy
fly deploy

# 4. Agents use:
curl -H "Authorization: Bearer your-random-token" https://wibwob-dos.fly.dev/health
```

Exemptions: `/health` could be left unauthed for Fly's health checks.

## Fly-Specific Security Model

- **No public SSH.** `fly ssh console` uses Fly's WireGuard mesh (requires `fly auth`). No port 22 exposed.
- **Machine isolation.** Each Fly machine runs in a Firecracker microVM. No container escape to host.
- **Scoped tokens.** The `FLY_API_TOKEN` in GitHub Actions is a deploy-scoped token. It can restart/deploy this app only.
- **Network isolation.** The machine has no access to other Fly apps, your Fly org's internal network, or any private services.
- **TLS termination.** Fly proxy handles HTTPS. The app binds `0.0.0.0:8099` (HTTP) inside the machine — never exposed raw.
- **Auto-stop.** `auto_stop_machines = "stop"` means the machine sleeps when idle. No compute cost, no attack surface when stopped.
- **Ephemeral rootfs.** No volumes attached. Every deploy/restart = fresh filesystem from the Docker image.

## Monitoring

```bash
fly logs --app wibwob-dos --no-tail          # recent logs
fly status --app wibwob-dos                  # machine state + health
fly checks list --app wibwob-dos             # health check status
fly machine restart --app wibwob-dos         # manual reset if compromised
```

## Summary

| Concern | Status |
|---------|--------|
| Auth | ❌ None — intentional for disposable testbed |
| Secrets at rest | ✅ None — Fly secrets only |
| Lateral movement | ✅ Impossible — isolated machine |
| Persistence | ✅ None — ephemeral rootfs |
| Spend exposure | ⚠️ $5/day cap on OpenRouter key |
| Reset frequency | ✅ Every 1 hour (cron) + every deploy |
| Escalation path | ✅ 10 min to add bearer token |
