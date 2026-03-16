# Instance Addressing — First Principles

## The Unix model we should learn from

Unix has three precedents for "talk to one of several running services":

### 1. Named pipes / Unix sockets (local)
How: `connect("/var/run/docker.sock")`
Discovery: filesystem IS the registry. `ls /var/run/*.sock`
Targeting: path = identity. No ambiguity.
Examples: Docker, PostgreSQL, systemd, X11

### 2. SSH + named sessions (remote)
How: `ssh host` then target by name
Discovery: `tmux ls`, `screen -ls`
Targeting: `tmux attach -t <name>`
Key insight: the SESSION has a human name, the TRANSPORT is just SSH

### 3. DNS + port (network services)
How: `curl http://host:port`
Discovery: DNS, mDNS/Bonjour, consul, etcd
Targeting: hostname:port
Examples: web servers, databases, microservices

## What WibWob-DOS is

From PHILOSOPHY.md: "a terminal-native platform for microapps" that is
"dual-operated — designed to be controlled by both humans and symbients
through peer interfaces."

An instance of WibWob-DOS is a DESKTOP. Not a process, not a port, not
a socket. A desktop with windows, state, an identity, a theme. The process
and the transport are implementation details.

## The naming problem

Right now instances are identified by:
- A random 3-char ID ("pfk", "xav") — meaningless to humans
- An optional label ("main") — set by env var, often missing
- A port number (8099) — infrastructure detail, not identity
- A socket path ("/scratch/instances/main.sock") — infrastructure detail

The human thinks: "the one I am looking at right now"
The agent thinks: "whatever port 8099 responds"
Neither of these is an ADDRESS.

## What feels right (Unix influence + COAT)

### A desktop has a NAME, not a port

Like tmux sessions. You do not `tmux attach -p 12345`. You do
`tmux attach -t main`. The name is the address. The transport resolves it.

    wibwob --desktop main health
    wibwob --desktop cinema state
    wibwob --desktop vps-gallery windows

Or shorter:
    wibwob @main health
    wibwob @cinema state

### Discovery is filesystem (local) or registry (remote)

Local: `scratch/instances/<name>.sock` — filesystem IS the registry.
Already exists. Already works. Just needs to be the DEFAULT path.

Remote (VPS): a lightweight registry file or mDNS-like discovery.
Could be as simple as:
    ~/.wibwob/remotes.json
    { "vps": "ssh://james@vps.example.com" }

Then: `wibwob @vps:gallery windows`

### The COAT test

"Would this work if I deleted the TUI and only had the API?"

YES. Desktop names, socket-first resolution, and remote registries are
all transport-layer. The COAT seams (command, inspection, window, workspace)
remain instance-agnostic. Same commands, different desktop.

## Vocabulary proposal (for LEXICON.md)

**desktop** (noun)
A running WibWob-DOS instance with its own windows, state, theme, and
identity. Addressed by name. Transport (socket, port, SSH tunnel) is
resolved from the name.

**desktop name** (noun)
The human-readable identifier for a desktop. Set at startup via
`WIBWOB_DESKTOP=cinema` or `--desktop cinema`. Used for socket filenames,
CLI targeting, agent context. Replaces "instance label" in most contexts.

**desktop registry** (noun)
The mechanism for discovering available desktops. Local: filesystem
(`scratch/instances/*.sock`). Remote: config file or service discovery.

**transport** (noun)
How the CLI/agent connects to a desktop. Unix socket (local), HTTP port
(local fallback), SSH tunnel (remote). Resolved from desktop name, never
specified directly by the user.

## What this means for the VPS future

10 instances on a VPS, each with a name:

    vps:gallery     — art exhibition layout
    vps:cinema      — video playback desktop  
    vps:workshop    — development desktop
    vps:lobby       — public entry point

From the local machine:
    wibwob @vps:gallery windows
    wibwob @vps:cinema cmd plasma.open

Transport: SSH tunnel to VPS, then unix socket to named desktop.
The user never thinks about ports.

## Summary

- Desktop = the thing. Name = the address. Socket = the transport.
- Filesystem is the local registry (already true, just not default)
- Ports are a fallback, never the primary address
- Remote is just a registry hop then the same socket model
- LEXICON.md needs: desktop, desktop name, desktop registry, transport
