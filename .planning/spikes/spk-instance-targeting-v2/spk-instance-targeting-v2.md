---
title: "Instance targeting v2 — desktops have names, not port numbers"
status: open
prior_art: spk-multi-instance-clarity (done, shipped Phase 1)
branch: TBD
---

# Spike: Instance Targeting v2

## TL;DR

A running WibWob-DOS is a DESKTOP, not a process. Desktops should have
human names and be addressed by name. The transport (socket, port, SSH)
resolves from the name. Today everything falls back to port 8099 and
agents constantly hit the wrong instance. Fix the default resolution,
clean up dead sockets, and establish a naming convention that works
locally and over the network.

## Supporting Research

| Doc | What |
|-----|------|
| [research/research-notes.md](research/research-notes.md) | Current CLI architecture, resolveBase, port fallback code |
| [research/philosophy-notes.md](research/philosophy-notes.md) | First principles from PHILOSOPHY.md, Unix models, "desktop" vocabulary |
| [research/wibmux-prior-test.md](research/wibmux-prior-test.md) | WibMux prototype proving filesystem-as-registry works |
| [research/addressing-precedents.md](research/addressing-precedents.md) | 40 years of naming conventions in computing |

---

## The Problem

Multiple instances of WibWob-DOS run simultaneously. The CLI and agents
do not know which one the human is looking at. Commands go to the wrong
desktop. Nobody notices until something fails silently. This happens
EVERY session.

Root causes (detail in research/research-notes.md):
1. CLI defaults to port 8099, ignoring sockets that already exist
2. Second instance silently lands on 8100, CLI never finds it
3. Dead sockets from crashed instances clutter the registry
4. Worktrees have separate socket pools, adding confusion
5. No agent doc mandates discovery before first command

## The COAT Frame

From PHILOSOPHY.md: the runtime owns four seams (command, inspection,
window, workspace). TUI, CLI, API, and agents are thin adapters.

Instance targeting is BELOW the seams. It is a transport concern.
The COAT test: "Would this work if I deleted the TUI and only had
the API?" Yes. Desktop names, socket resolution, and remote registries
are all transport. The seams remain instance-agnostic.

This belongs in `src/adapters/` (currently empty, scaffolded for exactly
this kind of concern).

## The Core Insight

An instance is a DESKTOP. Not a process, not a port, not a socket.
A desktop with windows, state, a theme, an identity.

The LEXICON should define:
- **desktop** — a running WibWob-DOS with its own windows and state
- **desktop name** — human-readable identifier, set at startup
- **desktop registry** — mechanism for discovering available desktops
- **transport** — how the CLI connects (socket, port, SSH tunnel)

The name is the address. The transport resolves from the name.

---

## Addressing Options

Three options for the CLI syntax, each with different tradeoffs for
local use, remote VPS, and cognitive load.

### Option 1: Bare name (simplest local, weakest remote)

    wibwob main health
    wibwob cinema windows
    wibwob vps/gallery state

First positional arg is the desktop name if it does not match a known
command. Slash separates remote host from desktop.

Pros: minimal syntax, no special characters
Cons: ambiguous — is `wibwob plasma` a desktop name or the `plasma` command?
      Would need a reserved-word list or "command takes priority" rule.
      The slash for remote looks like a filesystem path, could confuse.

### Option 2: @ prefix (email/SSH convention)

    wibwob @main health
    wibwob @cinema windows
    wibwob @vps:gallery state

@ means "at this desktop". Colon separates host from desktop name,
following scp/X11 DISPLAY convention.

Pros: unambiguous (@ is never a command name), 40 years of muscle memory,
      reads naturally ("wibwob at main, health"), scales to remote
Cons: the @ could feel email-ish or GitHub-ish (mentions), though
      SSH also uses @ and that is closer to what we mean.
      Colon for remote is well-established (scp, git, X11) but some
      might read `@vps:gallery` as "user vps, host gallery" by analogy
      with email. Needs clear docs.

### Option 3: Double-dash flag (current, explicit)

    wibwob --desktop main health
    wibwob --desktop vps:gallery state

Keeps the flag convention from the existing `--instance` flag but
renames it to `--desktop` for clarity.

Pros: completely unambiguous, familiar CLI flag pattern, easy to parse
Cons: verbose, easy to forget, agents will omit it (the current problem),
      does not feel like an address — feels like plumbing

### Hybrid recommendation

Support ALL THREE, with @ as the documented convention:

    wibwob @main health              (preferred — concise, unambiguous)
    wibwob --desktop main health     (explicit — for scripts, backward compat)
    WIBWOB_DESKTOP=main wibwob ...   (env var — for agent sessions)

The @ prefix is parsed early in the CLI before command dispatch.
`--desktop` is an alias for the same resolution. Env var is the
agent-friendly version (set once, forget).

---

## Resolution Chain

When the CLI starts, it resolves a desktop to a transport endpoint:

    1. Explicit: @name or --desktop or $WIBWOB_DESKTOP
       -> scan scratch/instances/<name>.sock
       -> if alive, use socket
       -> if dead, error "desktop <name> not running"

    2. Remote: @host:name or --desktop host:name
       -> look up host in ~/.wibwob/remotes.json
       -> SSH tunnel to remote scratch/instances/<name>.sock
       -> same socket protocol, different transport

    3. No target specified (the common case today):
       -> scan ALL sockets in scratch/instances/
       -> if exactly 1 alive: use it (zero ambiguity)
       -> if multiple alive: use "main" if exists, else error with list
       -> if 0 alive: fall back to port 8099 (backward compat)

Step 3 is the critical fix. Today it skips straight to port 8099.

---

## Remote Future (VPS with 10 desktops)

The same pattern works. A VPS runs multiple desktops, each with a name
and a socket. A local config file maps host aliases to SSH targets:

    ~/.wibwob/remotes.json
    {
      "vps": { "host": "james@vps.example.com", "scratch": "/opt/wibwob/scratch" },
      "studio": { "host": "james@studio.local", "scratch": "~/wibwob/scratch" }
    }

    wibwob @vps:gallery windows      SSH to vps, socket gallery.sock
    wibwob @vps:cinema cmd plasma.open
    wibwob @vps instances            list all desktops on vps

The remote protocol is just SSH + the same socket convention. No custom
networking, no new ports to open, no service discovery protocol. SSH is
the transport. Filesystem is the registry. Names are the addresses.

This means a VPS only needs: SSH access + WibWob-DOS installed + desktops
started with names. No additional infrastructure.

---

## Sticky Desktop — "set it and forget it"

Typing `@main` on every command is cruft. You want to set your target
once and have every subsequent command go there. Precedents:

| Tool | Set command | Scope | How it works |
|------|-----------|-------|-------------|
| kubectl | `use-context prod` | persistent (~/.kube/config) | every kubectl hits prod |
| git | `checkout main` | repo state | every git command is on main |
| AWS CLI | `export AWS_PROFILE=staging` | shell session | env var |
| nvm | `nvm use 18` | shell session | shell function + env |
| Docker | `docker context use remote` | persistent | every docker hits remote |
| direnv | `.envrc` file in directory | directory scope | walk in = activated |

### Proposed: .wibwob-desktop file

Like `.nvmrc` or `.python-version`. A file in the project root containing
just the desktop name:

    ~/Repos/wibandwob-dos/.wibwob-desktop          -> main
    ~/Repos/wibwob-zine-moodboard/.wibwob-desktop   -> zine
    ~/Repos/wibwob-vps-gallery/.wibwob-desktop       -> vps:gallery

The CLI walks up from CWD looking for this file. Walk into a directory
and you are targeting that project's desktop. No flag, no env var.

### Full resolution order

    1. @name or --desktop flag      (explicit, wins always)
    2. $WIBWOB_DESKTOP env var      (shell session scope)
    3. .wibwob-desktop file         (directory scope, walk up from CWD)
    4. Scan sockets, use sole alive (auto-detect)
    5. Port 8099 fallback           (backward compat)

### Setting it

    wibwob use main                 writes .wibwob-desktop in project root
    wibwob use vps:gallery          writes .wibwob-desktop with remote target
    export WIBWOB_DESKTOP=main      shell session override (no file needed)

The `wibwob use` command is the equivalent of `kubectl use-context` or
`nvm use`. One command, then forget about it.

---

## Desktop Stories — Scenarios That Must Feel Right

### Story 1: Solo developer, one desktop

James runs `bun run dev` in the main repo. One WibWob desktop starts.
He opens a second terminal tab to run CLI commands.

    $ wibwob windows
    [just works — only one desktop alive, auto-detected]

No flags, no config, no thinking about desktops. It just works.

### Story 2: Worktree spike, two desktops

James has the main repo running (desktop "main") and a worktree spike
running (desktop "zine"). He switches between terminal tabs.

    ~/Repos/wibandwob-dos$ wibwob windows
    [hits "main" — .wibwob-desktop says "main"]

    ~/Repos/wibwob-zine-moodboard$ wibwob windows
    [hits "zine" — .wibwob-desktop says "zine"]

Each directory knows its desktop. No flags needed. Walk into the
directory and you are targeting the right one.

### Story 3: Agent session on a spike

An agent spawns in the zine worktree. The environment has
WIBWOB_DESKTOP=zine (set by the agent launcher). Every wibwob
command the agent runs hits the zine desktop.

    agent$ wibwob health
    {"instanceId":"xav", "desktop":"zine", ...}

    agent$ wibwob cmd microapp.wibwob.zine.open
    [opens on the zine desktop, not on main]

The agent never thinks about targeting. It was set for them.

### Story 4: Two agents, two desktops

Agent A works on the main desktop. Agent B works on the zine desktop.
Both run in parallel. Each has WIBWOB_DESKTOP set in their environment.
They never interfere with each other.

### Story 5: Remote VPS with art exhibition

James has a VPS running 3 desktops: gallery, cinema, lobby. From
his local machine:

    $ wibwob @vps:gallery windows
    [SSH tunnel, shows gallery windows]

    $ wibwob @vps:cinema cmd plasma.open --mood aurora
    [opens plasma on the cinema desktop]

    $ wibwob @vps instances
    gallery   pid=1234  up=3d
    cinema    pid=5678  up=3d
    lobby     pid=9012  up=3d

Same CLI, same commands, different transport. The @ tells you it is
remote. The colon tells you which desktop on that host.

### Story 6: Live art show, human controls from phone

James SSHs to the VPS from his phone (Blink terminal). He wants to
change the gallery layout:

    $ wibwob use vps:gallery
    $ wibwob cmd desktop.tile
    $ wibwob cmd theme.set --name phosphor

He set the target once. Three commands, no repeated addressing.
The .wibwob-desktop file is on the VPS in the project directory.

### Story 7: Confusion — what am I connected to?

James has been working for an hour and forgets which desktop he is
targeting. He runs health:

    $ wibwob health
    desktop: main
    pid: 12345
    port: 8099
    uptime: 1h
    ⚠ 2 desktops running:
      main    pid=12345  port=8099  ← you are here
      zine    pid=67890  port=8100

The warning tells him there are others. The arrow tells him which
one he is on. He can switch with `wibwob use zine`.

### Story 8: Stale desktop after crash

James's terminal crashed yesterday. The old desktop process died but
the socket file is still there. He starts fresh:

    $ bun run dev
    [startup probes scratch/instances/*.sock]
    [finds main.sock — dead — deletes it]
    [creates new main.sock]
    ✓ desktop "main" ready

No manual cleanup. Dead sockets cleaned on startup automatically.

---

## Implementation Plan (ranked by bang-for-buck)

### Phase 1: Fix the defaults (half a day)

Ship as one PR. Addresses 90% of the confusion.

| Task | Lines | Risk |
|------|-------|------|
| C: Dead socket cleanup on startup | ~10 | Zero |
| A: Socket-first resolveBase | ~30 | Low (port fallback remains) |
| B: Health warns on multi-instance | ~5 | Zero |
| @ prefix parsing in CLI | ~15 | Low |
| Rename --instance to --desktop (keep alias) | ~5 | Zero |

**Key files:**
- `src/cli/wibwob.ts:36-60` (resolveBase)
- `src/services/control-api.ts:195-270` (startup, socket creation)
- `src/core/config.ts` (SCRATCH_BASE)

### Phase 2: Agent context (separate PR)

Inject desktop identity into agent sessions so they know from turn 1.

- Set `WIBWOB_DESKTOP` in agent environment on spawn
- `before_agent_start` hook adds desktop name to system prompt
- ops.md updated with discovery-first discipline

### Phase 3: Remote desktops (future epic)

- `~/.wibwob/remotes.json` config
- SSH tunnel helper in CLI
- `wibwob @host:name` resolution
- `wibwob @host instances` remote discovery

---

## LEXICON Entries (to add)

**desktop** — a running WibWob-DOS instance with its own windows, state,
theme, and identity. Addressed by name. The process and transport are
implementation details.

**desktop name** — human-readable identifier for a desktop. Set at startup
via `WIBWOB_DESKTOP=cinema` or `--desktop cinema`. Used for socket
filenames, CLI targeting, agent context. Replaces "instance label".

**desktop registry** — the mechanism for discovering available desktops.
Local: filesystem (`scratch/instances/*.sock`). Remote: config file +
SSH. The registry IS the filesystem.

**transport** — how the CLI connects to a desktop. Unix socket (local),
HTTP port (fallback), SSH tunnel (remote). Resolved from desktop name,
never specified directly by the user.

---

## Open Questions

1. Should `@` require quoting in zsh/bash? No — @ is not a special shell
   character when not at the start of an array expansion. `wibwob @main`
   works unquoted in both shells.

2. What happens if no desktop has a name? Random 3-char IDs (pfk, xav)
   become the socket name. `wibwob @pfk` works but is not ergonomic.
   Startup should WARN if no WIBWOB_DESKTOP is set.

3. Should `wibwob` without any args show running desktops? Could be a
   nice default instead of showing help. Like `docker ps`.

4. How does this interact with worktrees? Each worktree has its own
   `scratch/instances/`. The CLI uses SCRATCH_BASE from config.ts which
   is relative to CWD. This means `wibwob` from different directories
   sees different socket pools. Is this correct (isolation) or confusing?
   Probably correct — each worktree is a separate project context.
