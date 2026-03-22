# Ghostty Control Smoke Test — 2026-03-22

## Context
Testing SKILL.md end-to-end against live WibWob-DOS instance `ae7` (port 8100, 127×43 screen).

---

## Commands Run

### 1. `wibwob ls` — discover instances
**Result:** ✅ Success  
Found 3 instances: `ae7` (running, canonical), two `main` instances stuck in `starting`.  
`ae7`: pid 50473, port 8100, screen 127×43, uptime 3m.

### 2. `wibwob -i ae7 health` — health check
**Result:** ✅ Success  
Returns full JSON with instanceId, pid, port, screen dims, uptime.

### 3. AppleScript — get window geometry
```bash
osascript -e 'tell application "System Events" to tell process "Ghostty" to {position of window 1, size of window 1}'
```
**Result:** ✅ `1275, 394, 1148, 895`  
No TCC prompt — already authorized.

### 4. Coord calibration (manual calc)
- cell_w = 1148 / 127 = 9.04 px
- cell_h = (895 - 28) / 43 = 20.16 px

**Pain:** The SKILL.md calibration section is clear, but the 28px title bar offset is a magic number. If Ghostty changes tab bar height or user has a different config, this silently breaks. No way to query it programmatically. [DOUBT IT WILL CHANGE SURELY A MACOS STANDARD?]

### 5. Click "Core Apps" menu — first attempt (col 37)
```applescript
send mouse position x (37.0 * cw + cw/2.0) y (0.5 * ch) to t
send mouse button left button action press to t
send mouse button left button action release to t
```
**Result:** ❌ Menu did NOT open  
**Why:** Miscounted the column. Eyeballed "Core Apps" at col 33-41, targeted col 37.

**Pain:** Column counting from screenshot output is error-prone when done manually. The screenshot has leading spaces and variable-width menu labels. Should always use programmatic string search (`.find()`) instead of eyeballing.

### 6. Find exact column with Python
```python
line.find('Core Apps')  # → col 31, midpoint col 35
```
**Result:** ✅ Found at col 31, midpoint 35.

### 7. Click "Core Apps" menu — second attempt (col 35)
Same AppleScript but with col 35 and added `delay 0.5` after `activate`.
**Result:** ✅ Menu opened! Showed 5 items: Command Lab, Figlet Banner, Runtime Inspector, Terminal, World Chatroom.

**Lesson:** The `delay 0.5` after `activate` matters — Ghostty needs time to actually foreground before mouse events land correctly. SKILL.md doesn't emphasize this enough.

### 8. `send key "escape"` — close menu
```applescript
send key "escape" to focused terminal of selected tab of front window
```
**Result:** ✅ Menu closed cleanly.

### 9. `screencapture -x -D 1 /tmp/ghostty-test-*.png` — visual proof
**Result:** ✅ Saved. No issues.

### 10. `wibwob -i ae7 windows` — readback
**Result:** ✅ Empty array `[]` — clean desktop, no windows open.

### 11. `wibwob -i ae7 screenshot` — text screenshot
**Result:** ✅ Clean output, menu bar visible, no ANSI noise.

---

## Pain Points Summary

| # | Pain | Severity | Notes |
|---|------|----------|-------|
| 1 | 28px title bar offset is a magic number | Medium | Could break with Ghostty config changes (tab bar, etc.) |
| 2 | Manual column counting from screenshots is unreliable | High | First click attempt failed because of this. Always use `.find()` on the screenshot text |
| 3 | `activate` needs a delay before mouse events | Medium | Without `delay 0.5`, clicks can land before window is truly focused |
| 4 | Two `main` instances stuck in `starting` | Low | Not ghostty-control's problem, but clutters `wibwob ls` output |
| 5 | `cat -A` doesn't work on macOS (used BSD cat) | Trivial | Use `od -c` or `python3` instead for inspecting whitespace |

---

## Session 2 — Menu Item Clicks, Quit/Restart Loop, Overlay API

### 12. Clicking blessed menu items — single click fails
**Result:** ❌ Single click on menu items (Figlet Banner, Quit) does NOT work.  
The click dismisses the menu without selecting. Tried various coords, tight position+click coupling, hover-then-click — all fail with single click.

### 13. Double-click on menu items — works!
**Result:** ✅ Two clicks with 0.2s gap and `send mouse position` before each click.  
Pattern: position → press → release → delay 0.2 → position → press → release.  
**This is the reliable pattern for blessed menu items.**

### 14. `send key "enter"` — works
**Result:** ✅ Valid key name in Ghostty's AppleScript dictionary.  
Previously tried `"return"` which fails with "Unknown key name".  
Previously tried `"down"` which also fails — arrow keys may have different names or not be supported.

### 15. `input text "cmd\n"` — `\n` does NOT send enter
**Pain:** The `\n` in `input text` is treated as literal characters or ignored, not as a newline/enter keypress.  
**Fix:** Use `input text "cmd" to t` followed by `send key "enter" to t`.

### 16. `focus terminal t` — wrong syntax
**Result:** ❌ Error: "Can't make terminal id ... into type integer"  
**Fix:** Use `focus t` — the variable is already a terminal reference.

### 17. Clearing stray input before typing — essential pattern
**Pain:** If the human typed something into the terminal before the script runs, the `input text` gets concatenated with existing text, causing garbled commands (e.g. "bun run devbun run dev").  
**Fix:** Always send Ctrl+C then Ctrl+U before `input text`:
```applescript
send key "c" modifiers "control" to t   -- cancel running process
delay 0.3
send key "u" modifiers "control" to t   -- clear the line
delay 0.2
input text "the command" to t
delay 0.1
send key "enter" to t
```

### 18. Full Quit + Restart loop — works end-to-end
1. Click File menu (single click on menu bar ✅)
2. Double-click Quit menu item ✅
3. Instance goes down ✅
4. Focus terminal by cwd, clear line, send `bun run dev` + enter ✅
5. New instance starts ✅

### 19. overlay/set-text API — added and working
Added `POST /overlay/set-text` endpoint to set/clear text in value/path overlay inputs.  
- `overlay-manager.ts` — added `setText` to `ActiveOverlay` interface, implemented in `openValuePrompt` and `openPathPrompt`
- `command-catalog.ts` — added `overlay.set-text` command
- `app-controller.ts` — added `overlaySetText` handler
- `control-api.ts` — added route + endpoint docs
- Tested: clear → verify empty → set "SCRAMBLE" → verify ✅

### 20. `wibwob screenshot` strips ANSI — can't see menu highlights
**Pain:** Text screenshot doesn't show which menu item is highlighted/active (inverse colors stripped).  
**Workaround:** Use `screencapture -x -D 1` for visual proof of hover state.

## Pain Points Summary (Updated)

| # | Pain | Severity | Notes |
|---|------|----------|-------|
| 1 | 28px title bar offset is a magic number | Medium | Could break with config changes |
| 2 | Manual column counting unreliable | High | Always use `.find()` on screenshot |
| 3 | `activate` needs delay before mouse events | Medium | Without delay, clicks can miss |
| 4 | **Single click on blessed menu items fails** | **High** | **Must double-click with 0.2s gap** |
| 5 | **`\n` in `input text` doesn't send enter** | **High** | **Use `send key "enter"` instead** |
| 6 | **`focus terminal t` wrong syntax** | Medium | **Use `focus t`** |
| 7 | **Stray terminal input causes garbled commands** | **High** | **Always Ctrl+C + Ctrl+U first** |
| 8 | `wibwob screenshot` strips ANSI/highlights | Medium | Use screencapture for visual proof |
| 9 | `send key "return"` / `"down"` — unknown key names | Medium | Use `"enter"`, arrow keys may not work |

## What Worked Well
- The calibration formula from SKILL.md is correct once you have accurate col numbers
- `wibwob screenshot` → Python `.find()` → AppleScript click is a reliable pattern
- press/release mouse button pattern works cleanly
- `send key "escape"` just works
- `wibwob health/screenshot/windows` readback loop is solid
