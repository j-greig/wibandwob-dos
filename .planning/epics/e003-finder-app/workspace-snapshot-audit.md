---
Status: not-started
Type: follow-on
GitHub issue: —
PR: —
Created: 2025-03-02
---

# Workspace Snapshot Save/Restore Audit

## Bug Found

Backrooms Log Browser (appType "backrooms-log-browser", frame kind "browser")
was silently restored as a Primer Browser because the restore switch only
checked for "farjs-file-manager" and fell through everything else to the
primer browser default.

Fixed in this commit for backrooms-log-browser. But the same pattern exists
for other window types.

## Root Cause

Multiple window types share the same frame `kind` (especially "browser"),
but `restoreWindowSnapshot()` uses a permissive fallback instead of
exhaustive dispatch on `payload.appType`. New window types that reuse an
existing kind silently get the wrong restore.

## Same Bug (saved but restores as WRONG window)

| appType                  | Frame kind | Restore behaviour          | Fix needed |
|--------------------------|-----------|----------------------------|------------|
| chrome-browser           | browser   | Falls through to primer browser | Add explicit branch |
| backrooms-primer-picker  | browser   | Falls through to primer browser | Add explicit branch |

## Never Restored (saved but no restore case at all)

| appType              | Frame kind  | Fix needed |
|----------------------|------------|------------|
| wibwob-agent         | chat       | Add case "chat" with appType dispatch |
| wibwob-chat-v2       | chat       | Add case "chat" with appType dispatch |
| monster-cam          | monster-cam | Add case "monster-cam" |

## Fragile

- `primer-browser` only restores correctly because it is the catch-all
  fallback, not an explicit branch. Should be made explicit.
- File manager restore reads `searchQuery`, `viewMode`, `sortField` etc
  but the browser serialize case in `serializeWindowSnapshot` does not
  write them. The file manager's `describeState()` returns them, but the
  serialize code only captures `currentPath`, `filterValue`, `selectedIndex`,
  `appType`. The extra fields survive by accident because describeState
  returns them and they get spread — verify this is actually working.

## Where to Fix

All changes are in `src/core/workspace-snapshots.ts`:

### Save side (serializeWindowSnapshot, ~line 30)

The `case "browser"` block captures state. It should capture all fields
that each browser appType needs. Currently only captures the primer browser
fields. For chrome-browser, capture `currentUrl`. For backrooms-primer-picker,
check what state it needs.

The `case "chat"` block (~line 54) already serializes correctly.
The missing piece is the restore side.

### Restore side (restoreWindowSnapshot, ~line 145)

The `case "browser"` block needs exhaustive appType switching:

```typescript
case "browser":
  switch (payload.appType) {
    case "farjs-file-manager":
      actions.openFileManagerWindow({ ... });
      break;
    case "backrooms-log-browser":
      actions.openBackroomsLogBrowserWindow();
      break;
    case "chrome-browser":
      actions.openChromeBrowserWindow({ url: payload.currentUrl });
      break;
    case "backrooms-primer-picker":
      // needs new restore action
      break;
    case "primer-browser":
    default:
      actions.openPrimerBrowserWindow({ ... });
      break;
  }
```

Add new cases for chat and monster-cam:

```typescript
case "chat":
  // dispatch on payload.appType: "wibwob-agent" vs "wibwob-chat-v2"
  // needs new restore actions in WorkspaceRestoreActions interface
  break;
case "monster-cam":
  actions.openMonsterCamWindow();
  break;
```

### Restore actions interface (~line 90)

Add to `WorkspaceRestoreActions`:

- `openChromeBrowserWindow: (restore?: { url?: string }) => void`
- `openMonsterCamWindow: () => void`
- Chat restore actions (TBD based on what state chat windows need)

### App controller wiring (~line 937)

Wire new actions in `getRestoreActions()` to the corresponding
private methods on AppController.

## Defensive Pattern for Future

Option A (minimal): Remove the permissive fallback. Unknown appTypes
should log a warning and skip, not silently create the wrong window.

Option B (proper): Create a snapshot registry mapping (kind, appType) to
paired serialize/restore handlers. Adding a new window type requires
registering both sides or the compiler complains.

## Tests to Add

- Round-trip snapshot test for each browser appType
- Round-trip snapshot test for chat windows
- Test that unknown browser appType does NOT create a primer browser
- Test that file manager extra fields survive save/restore
