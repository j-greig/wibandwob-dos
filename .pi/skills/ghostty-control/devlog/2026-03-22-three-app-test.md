# Three-App Interaction Test — 2026-03-22

Testing ghostty-control scripts + API against 3 live microapps after fixing figlet bugs.

---

## App 1: Figlet Banner

**Opened via:** `menu-click.sh "Core Apps" "Figlet Banner"` → overlay prompt appeared → `POST /overlay/set-text {"text":"GHOST"}` → `click-cell.sh 75 36` to click OK.

**Autosize fix verified:** Window opened at width=56 (toolbar minimum). Before the fix, short text like "HI" would create a ~24-wide window with clipped title and squished toolbar. Now `+- Banner: HI ... x -+` renders fully.

**Font picker interaction:** Clicked `[F] Font` button via `click-cell.sh 36 2`. Font picker opened with list + preview pane. Preview correctly renders figlet text in the selected font (impossible → "HI" visible in preview).

**captureText fix verified:** `GET /screenshot/text?id=1` returns `Font picker · Preview · impossible\n\n<rendered figlet>` when picker is open. Before the fix, it returned the main viewer content (stale).

**Pain: escape didn't close font picker.** Sent `send key "escape"` twice — picker stayed open. The blessed list inside the picker may need focus before escape works. Workaround: close window via API and reopen. Add to gotchas.

**Pain: `write` command during picker doesn't update preview.** `figlet.write {"text":"BOOP"}` updated `currentText` but the picker preview still showed "HI". Minor edge case — picker and write are independent code paths.

---

## App 2: Runtime Inspector

**Opened via:** `menu-click.sh "Core Apps" "Runtime Inspector"` — worked first try.

**Read via:** `GET /screenshot/text?id=2` — returned full inspector dashboard with identity, desktop stats, health metrics, agent status. Clean text export.

**Observed:** 3 windows shown in DESKTOP section, focus on Terminal (id=3), menu closed, no overlay active. FPS 3.0, frame time 420ms, RSS 441/512MB. All data matches live state.

**No interaction needed** — the inspector is read-only. The text capture is excellent for agent state introspection.

---

## App 3: Terminal

**Opened via:** `menu-click.sh "Core Apps" "Terminal"` — failed silently (two rapid menu clicks). Opened via API fallback: `POST /commands/run {"id":"microapp.wibwob.terminal.open"}`.

**Interacted via:** `POST /windows/input {"id":3, "input":"echo HELLO FROM THE GHOSTTY CONTROL SKILL\r"}` — command executed, output captured via `GET /screenshot/text?id=3`.

**Pain: rapid sequential menu-click.sh calls can fail.** The second `menu-click.sh` ran before the first menu fully closed. The menu click landed on the wrong target. Need a delay between menu operations, or detect if a menu is still open before clicking.

---

## Script reliability summary

| Script | Calls | Successes | Notes |
|---|---|---|---|
| `menu-click.sh` | 4 | 3 | Failed once on rapid sequential calls |
| `click-cell.sh` | 3 | 3 | OK button + Font button both hit |
| `send-to-terminal.sh` | 2 | 2 | bun run dev started cleanly |
| `calibrate.sh` | ~8 (via other scripts) | 8 | Auto-detect port solid |
| `ghostty-windows.sh` | 2 | 2 | Clean output |

## New pains discovered

1. **Escape doesn't close font picker** — blessed list may need explicit focus before key events reach it
2. **Rapid menu-click.sh calls fail** — need inter-operation delay or menu-open detection
3. **`write` during picker doesn't update preview** — minor, picker and write are independent paths
