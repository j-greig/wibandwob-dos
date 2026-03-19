# Render deployment (minimal Fly-port)

Goal: replicate Fly disposable testbed behavior on Render with minimal changes.

## Files

- `deploy/render/Dockerfile`
- `deploy/render/entrypoint.sh`
- `render.yaml` (repo-root Blueprint; preferred)
- `deploy/render/render.yaml` (legacy copy)

## Canonical path (use this)

### A) Blueprint (recommended)

1. Push branch with repo-root `render.yaml`.
2. Render → **New → Blueprint**.
3. Select repo + branch.
4. Deploy.

### B) Manual Docker service (if needed)

- Environment: **Docker**
- Branch: `epic/e053-external-config-packaging` (or branch containing `deploy/render/*`)
- Root directory: blank
- Dockerfile path: `deploy/render/Dockerfile`
- Health check path: `/health`

## Do not use Node runtime for visual smoke

Node mode can boot API but produce a 1×1 headless screen (`/screenshot/text` returns `T`).
For visual/screenshot gates, use Docker + `deploy/render/entrypoint.sh` (tmux 288×80).

## Failure signatures → exact fix

- `Root directory "render.yaml" does not exist` or command prefixes like `deploy/render/render.yaml/ $ ...`
  - Fix: Root directory must be blank (or `.`), never a file path.

- `error: invalid local: resolve : lstat /opt/render/project/src/epic: no such file or directory`
  - Fix: branch name accidentally placed in Docker path/context; keep branch only in Branch field.

- `.../deploy/render: no such file or directory` while building
  - Fix: service is on `main` (or wrong branch); switch to branch containing `deploy/render/`.

## Proof endpoints

- `/health`
- `/help`
- `/runtime/inspection`
- `/screenshot/text`

## Verified state (2026-03-19)

Service: `https://wibandwob-dos.onrender.com`

- `/health` → `ok: true`, `host: 0.0.0.0`, `port: 10000`, `screen: 288×80`
- `/screenshot/text` → full desktop dump (~23KB), not single-char output

## Notes

- Workspace bootstrap is seeded from `deploy/fly/agent-welcome-workspace.json` to reduce drift.
- Native deps are skipped during install (`--ignore-scripts`) as in Fly path.
- Render free tier has no SSH; use HTTP endpoints + Render logs for triage.
- This is a disposable/operator testbed profile, not hardened production.
