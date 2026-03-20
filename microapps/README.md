# WibWobDOS Modules

## Directory layout

```
microapps/              ← public modules (tracked in this repo)
microapps-private/      ← your private modules (git submodule → your own private repo)
```

## Public modules

Add modules directly under `microapps/`. They're tracked in the main repo and
visible to everyone.

## Microapp Authoring

Canonical docs:

- Quick start: `.agents/microapp-dev/quick-start.md`
- Full guide: `.agents/guides/microapp.md`
- SDK reference: `.agents/microapp-dev/sdk-reference.md`
- Examples by tier: `.agents/microapp-dev/examples-by-tier.md`
- Persistence: `.agents/microapp-dev/persistence.md`
- Pitfalls: `.agents/microapp-dev/pitfalls.md`

Import types and helpers from `../../src/services/microapp-sdk.js`.
Do not import directly from `src/core/*` — if something is missing,
add the re-export to `microapp-sdk.ts`.

Start from:

- `microapps/demo-hello-world/` — minimal static module
- `microapps/demo-heartbeat/` — animated with timers
- `microapps/demo-wibwob-poetry-clock/` — persistent, AI-integrated
- `bash scripts/scaffold-microapp.sh microapps/<name> <app-id> "<Title>"` — fresh scaffold

## Private modules

`microapps-private/` is a **git submodule** — it points to a separate private
repo that only you (or your team) can access. Use it for:

- **Your own art / primers** you don't want to publish
- **Custom prompts / personalities**
- **Client work / proprietary content**
- **Anything you want to keep out of the public repo**

The WibWob-DOS default ships with this pointing to our private content, but
**you should replace it with your own repo**:

```bash
# Remove the default submodule
git submodule deinit modules-private
git rm modules-private
rm -rf .git/microapps/modules-private

# Add your own private repo
git submodule add https://github.com/YOU/your-private-modules.git modules-private
git commit -m "chore: use my own private modules"
```

Or just delete `microapps-private/` entirely if you don't need it — the app
builds fine without it.

### Editing workflow

**⚠️ Do NOT edit files directly in `microapps-private/` from this repo.**
Changes won't be committed to the private repo and will get overwritten on
the next `git submodule update`.

```bash
# 1. Work in the standalone private repo
cd ~/Repos/your-private-modules
# ... edit, add, commit, push ...

# 2. Update the submodule ref in wibandwob-dos
cd ~/Repos/wibandwob-dos
git submodule update --remote modules-private
git add modules-private
git commit -m "chore: bump modules-private"
```

### First-time clone

```bash
git clone --recurse-submodules https://github.com/j-greig/wibandwob-dos.git
```

Or after a regular clone:
```bash
git submodule update --init --recursive
```

Note: if you don't have access to the private repo, the submodule will be
empty. The public app still builds and runs fine without it.
