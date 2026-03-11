# WibWobDOS Modules

## Directory layout

```
modules/              ← public modules (tracked in this repo)
modules-private/      ← your private modules (git submodule → your own private repo)
```

## Public modules

Add modules directly under `modules/`. They're tracked in the main repo and
visible to everyone.

## Microapp Authoring

Canonical doc:

- `docs/module-authoring.md`

For microapps, the current canonical authoring surface is:

- manifest: `module.json`
- entry: `index.ts`
- host/types import:
  `../../src/services/microapp-sdk.js`

Current rule:

- import shared module-author types and helpers from `microapp-sdk.js`
- do not locally redefine `MicroappHost`, `MicroappWindowHandle`, or shared
  layout types
- prefer host capabilities and SDK helpers over direct imports into `src/`
  internals when an SDK path exists

Start from:

- `modules/hello-world/` for the minimal scaffold
- `modules/wibwob-poetry-clock/` for a real microapp using richer behavior
- `modules/dream-forecast/` for a richer multi-panel module that stays on the public SDK path
- `bash scripts/scaffold-microapp.sh modules/<name> <app-id> "<Title>"` for a
  fresh scaffold generated against the current SDK path

This is still phase-1 SDK work, so some modules still depend on internal
services directly. The direction is to shrink those direct imports over time by
projecting stable capabilities through the host.

## Private modules

`modules-private/` is a **git submodule** — it points to a separate private
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
rm -rf .git/modules/modules-private

# Add your own private repo
git submodule add https://github.com/YOU/your-private-modules.git modules-private
git commit -m "chore: use my own private modules"
```

Or just delete `modules-private/` entirely if you don't need it — the app
builds fine without it.

### Editing workflow

**⚠️ Do NOT edit files directly in `modules-private/` from this repo.**
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
