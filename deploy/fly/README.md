# deploy/fly — Disposable Fly.io Testbed

WibWob-DOS running on a disposable Fly.io machine. Public control API,
no auth, hourly reset. For remote agent testing, not production.

**Live:** https://wibwob-dos.fly.dev

## Files

| File | What |
|------|------|
| `fly.toml` | Fly config (also mirrored at repo root — Fly requires it there) |
| `Dockerfile` | bun + tmux + figlet + ttyd, `--ignore-scripts` |
| `entrypoint.sh` | tmux start → health wait → workspace restore → arrange → screenshot logger |
| `agent-welcome-workspace.json` | 6-window welcome layout baked into image |
| `agent-readme.txt` | Served at `/readme` — agent onboarding cheatsheet |
| `OPSEC.md` | Full security posture + red team findings |

## Deploy

```bash
fly auth login
fly deploy              # from repo root
```

## Reset

```bash
fly machine restart --app wibwob-dos     # manual
# or: GitHub Actions cron runs every hour (needs FLY_API_TOKEN secret)
```

## Key URLs

| URL | What |
|-----|------|
| `/health` | Alive check + reset countdown + readme link |
| `/readme` | Plain text agent cheatsheet |
| `/screenshot/text` | Current TUI as text |
| `/screenshots/list` | All persistent frames (60s interval) |
| `/screenshots/latest` | Most recent frame |
| `/journal/read` | Persistent append-only notes |
| `/openapi.json` | Full API spec |
| `:7681` | ttyd web terminal (read-only TUI in browser) |

## OPSEC — Read Before Changing Anything

### ⛔ NEVER do these

- **`fly secrets set OPENROUTER_API_KEY=...`** — env vars are readable via the editor endpoint (`/view/editor/open` + `/windows/text`). Any secret you set is public.
- **`fly secrets set` anything** — same reason. Zero secrets on this instance.
- **Remove `--readonly` from ttyd** — without it, anyone in the browser can type into the TUI.
- **Bind to a custom domain with SEO** — crawlers will index the API responses.

### ✅ Safe to do

- `fly deploy` — rebuilds from scratch, clean slate
- `fly machine restart` — fresh process, same image
- Change `WIBWOB_RESET_INTERVAL_MINS` in fly.toml — adjusts the countdown shown in `/health`
- Edit `agent-readme.txt` or `agent-welcome-workspace.json` — cosmetic
- Add to `.dockerignore` — reduce image size

### Known attack surface (red team verified)

The control API was designed for localhost. Exposing it publicly means:

1. **Any file readable** — `/view/editor/open` with `filePath=/etc/passwd` works
2. **Filesystem browsable** — file manager command opens a browser
3. **Editor can write to disk** — open → write → save chain
4. **RCE via reload** — write code + `microapps.reload` = arbitrary execution
5. **All env vars readable** — `/proc/self/environ` via editor

This is acceptable because: no secrets set, hourly reset, ephemeral filesystem,
isolated Firecracker VM, no lateral movement. See `OPSEC.md` for full analysis.

### Hardening roadmap (if graduating beyond testbed)

1. Bearer token auth via Fly secret + middleware
2. Path jail on all `filePath` parameters
3. Command allowlist (block `finder.*`, `microapps.reload`, FX commands)
4. Non-root container user with read-only app directory
5. CORS headers restricting cross-origin access
