# Autoresearch Ideas — E039 Instance Lifecycle

## COMPLETE — 100/100 ✅

F1 Clean Death, F2 Microapp Snapshots, F3 Boot Workspace, F4 wibwob attach.
All shipped in 4 experiments (10 → 40 → 70 → 90 → 100).

## Polish & Hardening

- **Test hygiene**: harness should `desktop.clear-all` before opening test windows to prevent accumulation across runs
- **COAT cleanup**: remove host-side figlet-banner handler from `snapshot-registry.ts` + `PersistableAppType` — dead code now that microapp owns its own snapshot
- **Remove contour-studio from TransientAppType** — it's no longer transient, it has a snapshot handler
- **wibwob start / wibwob restart subcommands** — replace `ensure-running.sh` and `restart.sh` script aliases
- **wibwob workspace.save / workspace.load subcommands** — replace curl in test harness
- **Orphan workspace renamed to .restored.json** — should we delete after successful restore instead?
- **Multiple orphan workspaces** — what if main and zuk both orphan? Currently only detects `orphan-<label>.json`

## Future Features

- **wibwob attach --instance zuk** — attach to alt instance
- **Blessed TTY cleanup on SIGHUP** — verify terminal escape sequences don't leak when terminal is already dead
- **Workspace diff** — compare saved vs current desktop state
- **Auto-save interval** — periodic background save (every 5 min?) so orphan workspace is always recent
- **Process supervision** — launchd/systemd plist for auto-restart (overkill for dev tool, but nice for server)
