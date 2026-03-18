# Render deployment (minimal Fly-port)

Goal: replicate Fly disposable testbed behavior on Render with minimal changes.

## Files

- `deploy/render/Dockerfile`
- `deploy/render/entrypoint.sh`
- `deploy/render/render.yaml` (blueprint)

## Quick setup (Render dashboard)

### Preferred path (Docker)

1. Create new **Web Service** from this repo (or use blueprint from `render.yaml`).
2. Environment: **Docker**.
3. Dockerfile path: `deploy/render/Dockerfile`.
4. Ensure service has a disk mounted at `/var/data` (optional but recommended).
5. Deploy.

### Alternate path (Node runtime) — experimental / often fails

Node runtime can fail with `No open ports detected` because this app expects a PTY-backed TUI process.

If you hit that symptom, switch to Docker path immediately.

- Build command: `bun install --ignore-scripts`
- Start command: `WIBWOB_INSTANCE_LABEL=render-disposable WIBWOB_CONTROL_HOST=0.0.0.0 CONTROL_API_PORT=$PORT bun run src/app.ts`
- Health check path: `/health`

Render provides `$PORT`; app must bind `0.0.0.0:$PORT`.

## Proof endpoints

- `/health`
- `/help`
- `/state`

## Live deployment log (2026-03-18)

- Render service id: `srv-d6tj7gdm5p6s73be44f0`
- URL: `https://wibandwob-dos.onrender.com`
- Build signal observed:
  - `794 packages installed`
  - `Build successful`
  - Deploy phase started (`WEB_CONCURRENCY=1` auto-set)

Pending verification checklist after deploy settles:

1. `GET /health` returns JSON
2. `GET /help` returns JSON
3. `GET /runtime/inspection` returns rate-limit snapshot

## Notes

- Workspace bootstrap is seeded from `deploy/fly/agent-welcome-workspace.json` to reduce drift.
- Native deps are skipped during install (`--ignore-scripts`) as in Fly path.
- Render free tier has no SSH; use HTTP endpoints + Render logs for triage.
- This is a disposable/operator testbed profile, not hardened production.
