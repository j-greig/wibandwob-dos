# wibwob-dos — Hetzner deployment

## Architecture

```
Browser → Cloudflare → Caddy :443 → token-proxy :8080 → ttyd :7681 → bun run src/app.ts
```

Each browser connection gets an independent TUI session. Hard 30-min timeout via `timeout 1800`. Idle disconnect after 5 min via ttyd `--timeout 300`.

## Setup

### 1. DNS
Point `dos.wibandwob.com` at your Hetzner VPS IP in Cloudflare. Enable proxy (orange cloud). SSL mode: **Full (strict)** recommended — or **Flexible** if you skip HTTPS on origin.

### 2. Environment
Create `/etc/wibwob.env` on the VPS (keep out of repo):
```
ADMIN_SECRET=your-long-random-secret-here
```

### 3. Deploy
```bash
git clone https://github.com/j-greig/wibandwob-dos /opt/wibwob-dos
cd /opt/wibwob-dos/deploy
docker compose --env-file /etc/wibwob.env up -d --build
```

### 4. Generate a share link
```bash
curl -s -X POST https://dos.wibandwob.com/admin/token \
  -H "x-admin-secret: YOUR_ADMIN_SECRET" | python3 -m json.tool
```

Returns:
```json
{
  "token": "a3f9c1e2b4d87f6a",
  "url": "https://dos.wibandwob.com/s/a3f9c1e2b4d87f6a",
  "expiresAt": "2026-03-03T16:30:00.000Z"
}
```

Share the URL. It works for 30 min, then returns 410 Gone.

## Updating
```bash
cd /opt/wibwob-dos
git pull
cd deploy && docker compose --env-file /etc/wibwob.env up -d --build
```

## Notes
- Port 8099 (control API) is NOT exposed externally — internal Docker network only
- ttyd `--max-clients 20` — adjust as needed
- Logs: `docker compose logs -f`
- Cloudflare SSL: if using Flexible mode, remove the HTTPS block in Caddyfile and listen on :80 only
