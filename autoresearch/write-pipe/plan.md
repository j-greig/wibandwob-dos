# F5 Write Pipe — Autoresearch Plan

> **Rule 1:** `wibwob` is the command surface. No curl, no `ww-*` aliases.
>
> **Rule 2:** No new API endpoints. Write dispatches through `/commands/run`.
> No new SDK methods. Use `registerCommand`.
>
> **Rule 3:** COAT — one dispatch path. If it works from CLI it works from
> API, agent, menu, palette. No surface-specific logic.

## Phase 1: Read Alias (trivial)

Add `wibwob read <id>` as alias for `wibwob screenshot <id>`.
Enables pipe testing from phase 3 onward.

```bash
wibwob read 3                      # same as wibwob screenshot 3
wibwob read 3 | head -5            # unix composability
```

One line in the CLI switch: `case "read": return cmdScreenshot(cleanArgs[1]);`

## Phase 2: Figlet Write Command

Add `write` command to `microapps/figlet-banner/index.ts`:

```typescript
host.registerCommand({
  id: "write",
  label: "Write to Figlet",
  description: "Update text on an existing figlet window. Args: text, windowId",
  direct: true,
  action: (args) => {
    const text = args?.text as string;
    const windowId = args?.windowId as number;
    // find the window, update its text, re-render
  },
});
```

Challenge: the `write` command needs to find and update an *existing* window,
not create a new one. The microapp needs to track open windows by ID.

## Phase 3: CLI Write Subcommand

Add `wibwob write <id>` to `src/cli/wibwob.ts`:

```
1. Read stdin to string
2. GET /state → find window by id → get appType
3. Try commands in order:
   - microapp.<appType>.write --text <stdin> --windowId <id>
   - microapp.<appType>.send --message <stdin>
   - microapp.<appType>.create --body <stdin>
4. If none found: exit 1 "app does not support write"
```

## Phase 4: Fallback Verification

Test that journal (falls back to `create`) and chatroom (falls back to
`send`) work without adding write commands to those microapps.

## Phase 5: Pipe Composition

Test the full pipe:
```bash
echo "HELLO" | wibwob write 3           # stdin → figlet
wibwob read 3 | wibwob write 7          # figlet → journal
wibwob read 3 | grep "pattern" | wibwob write 7  # with unix tools
```

## Key Design Decisions

1. **Window tracking in microapps** — figlet.write needs to find window
   by ID and update it. Currently `openBanner()` creates a closure with
   `currentText` but no way to reach it from outside. Options:
   - (a) Store windows in a Map keyed by ID in the module scope
   - (b) Use `describeState()` to find the window, dispatch an event
   - (c) The command handler receives window context from the host
   
   Option (a) is simplest. Keep a `Map<number, { setText: (t: string) => void }>`.

2. **Stdin reading** — Bun can read stdin synchronously via
   `readFileSync("/dev/stdin")` or `await Bun.stdin.text()`.
   Use the async version to avoid blocking.

3. **Text encoding** — stdin may contain ANSI escapes from `wibwob read`.
   The write handler should strip ANSI when the target is text-only (figlet)
   but preserve it when the target can handle it (terminal).
