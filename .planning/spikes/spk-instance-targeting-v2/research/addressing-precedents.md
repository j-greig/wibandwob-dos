# Addressing Precedents — What @ means and where it comes from

## The @ symbol in computing (pre-2000 canon)

### 1. Email (1971) — user@host
Ray Tomlinson chose @ for ARPANET email. It means "at" — the user
is AT this host. `james@greig.cc` = james at greig.cc.

The delimiter is `:` or `/` for subpath:
    user@host
    user@host:path       (scp, git SSH)
    user@host/resource   (less common)

### 2. SSH (1995) — user@host
Same pattern. `ssh james@vps.example.com` means connect to james
AT this host. The @ separates identity from location.

### 3. Git remotes (2005) — git@github.com:user/repo
Same @ pattern over SSH transport. The remote is named (`origin`,
`upstream`) and resolved to a URL. You work with names, not URLs.

### 4. IRC (1988) — channels and servers
    /join #channel               (local)
    /connect irc.server.net      (remote)
    /msg nick@server message     (cross-server)

### 5. X11 Display (1984) — host:display.screen
    DISPLAY=:0           (local, display 0)
    DISPLAY=vps:0        (remote, display 0 on host "vps")
    DISPLAY=vps:0.1      (remote, display 0, screen 1)

Colon separates host from display number. This is the closest
precedent to WibWob's problem — multiple displays (desktops) on
multiple hosts.

### 6. Plan 9 (1992) — /net/host/service
Plan 9 from Bell Labs made EVERYTHING a filesystem path:
    /net/tcp/clone         (open a TCP connection)
    /srv/factotum          (auth service)
    /mnt/remote/path       (mounted remote filesystem)

No special syntax. The namespace IS the address space.

### 7. Docker (2013) — container:path
    docker exec -it myapp bash
    docker cp myapp:/var/log/app.log .

Name-based targeting. `myapp` is resolved from the container registry
(a filesystem of metadata). Same as WibMux labels and WibWob sockets.

### 8. Kubernetes (2014) — context/namespace/resource
    kubectl --context=prod get pods
    kubectl -n staging exec myapp -- bash

Contexts are named clusters. Namespaces are named scopes within.
Resources are named within namespaces. Three-level addressing.

## Delimiter conventions (what means what)

| Delimiter | Convention | Examples |
|-----------|-----------|---------|
| `@` | identity AT location | email, SSH, git |
| `:` | host COLON subpath | scp, X11 DISPLAY, git SSH |
| `/` | hierarchical path | URLs, Plan 9, filesystems |
| `.` | dotted hierarchy | DNS, Java packages |
| `#` | channel/fragment | IRC, URLs |

## What fits WibWob-DOS

The addressing problem has two levels:
1. WHERE is the desktop? (local machine, VPS, shared server)
2. WHICH desktop? (main, cinema, gallery)

### Pattern: @location:desktop

    wibwob @main health              local desktop "main"
    wibwob @cinema windows           local desktop "cinema"
    wibwob @vps:gallery state        remote host "vps", desktop "gallery"
    wibwob @vps:cinema cmd plasma.open

This follows email/SSH for the remote part (@ = at this host)
and X11 for the sub-selection (: = which display/desktop).

### Resolution chain

    @main           -> scratch/instances/main.sock (local filesystem)
    @cinema         -> scratch/instances/cinema.sock (local filesystem)
    @vps:gallery    -> ~/.wibwob/remotes/vps -> SSH tunnel -> remote sock

### Shorthand rules

    wibwob health           -> probe local sockets, use the one alive
    wibwob @main health     -> explicit local desktop
    wibwob @vps health      -> default desktop on remote host
    wibwob @vps:X health    -> specific desktop on remote host

## What NOT to do

### Don't use ports in the address
Ports are transport plumbing. `wibwob --port 8100` is like typing an
IP address instead of a hostname. The name should resolve the transport.

### Don't use random IDs as addresses
"pfk", "xav", "h7f" are instance IDs for internal use (log correlation,
socket filenames when no label is set). They are not human addresses.

### Don't invent a new syntax
@ and : are 40+ years of muscle memory. Use them.

## Summary

    @desktop          local (filesystem registry)
    @host:desktop     remote (SSH + filesystem registry)

Same gesture, same semantics, local or remote. The filesystem is the
registry. Names are the addresses. Transport is resolved, not specified.
