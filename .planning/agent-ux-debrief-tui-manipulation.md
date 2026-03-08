---
type: debrief
status: active
tags: [agent-ux, api, tui, e021]
tldr: "AX audit — live session debrief on TUI manipulation via control API. Covers mismatches between docs and reality, false failures, and weak patterns."
---

# Agent UX Debrief: TUI Manipulation via Control API

Session: 2026-03-08  
Context: Attempting to clear 15 windows and lay out 3 on a 180x45 hosted desktop
via `https://dos.wibandwob.com/api`

---

## Bugs I hit and how I fixed them

### 1. `/state` window shape mismatch (silent wrong reads)

**What I did wrong:**
```python
r = w.get('rect', {})
x, y, ww, wh = r.get('x',0), r.get('y',0), r.get('w',0), r.get('h',0)
```

**Actual shape** (from `json.dumps(window, indent=2)`):
```json
{
  "id": 3,
  "left": 92,
  "top": 11,
  "width": 85,
  "height": 29,
  ...
}
```

Fields are `left/top/width/height` at the **top level**, not nested under `rect`.
My minimap showed `@0,0 0x0` for every window even when moves had worked.
The moves were succeeding all along. I was just reading the wrong fields.

**Fix:** read `w.get('left')`, `w.get('top')`, `w.get('width')`, `w.get('height')`.

**AX impact:** HIGH — caused me to believe layout wasn't working for several turns,
attempted repeated corrections, re-closed windows unnecessarily.

**Doc gap:** `references/api.md` shows `/state` shape as `rect: {x,y,w,h}` — WRONG.
Should show the actual flat `left/top/width/height` fields.

---

### 2. `app` key missing from `/state` (KeyError)

**What I did:**
```python
d['app']['sessionId']
```

**Error:** `KeyError: 'app'`

**Reality:** `/state` response does not always have an `app` top-level key, or the
structure differs from what's documented. `sessionId` is in `/health`, not `/state`.
`deployProfile` is also only in `/health`.

**Fix:** use `.get('app', {})` defensively, and use `/health` for sessionId/profile.

**AX impact:** MEDIUM — caused script crash, had to debug inline.

---

### 3. `window.close` wrong command ID

**What I tried:**
```bash
POST /commands/run {"id":"window.close","args":{"windowId":N}}
```

**Result:** silently did nothing (no error, no close).

**What actually works:**
```bash
POST /windows/close {"id":N}
```

Window close is a dedicated endpoint, not a registry command.

**AX impact:** MEDIUM — opened 13 close calls that did nothing, then had to
retry via the correct endpoint. One extra window (id=18) appeared in the gap,
suggesting a race or duplicate open.

---

### 4. `windows/batch` op format uncertainty

**Docs say:**
```json
{"ops":[{"id":N,"x":X,"y":Y,"w":W,"h":H}]}
```

**I also tried:**
```json
{"ops":[{"action":"move","id":N,"x":X,"y":Y}]}
```

Both returned `{"ok":true,"results":[true,...]}`. Neither was verifiable because
of the minimap read bug (#1). Unclear which format is actually canonical.

**AX gap:** No dry-run or echo mode. `ok:true` from batch with no visible effect is
indistinguishable from "worked but you're reading state wrong" vs "silently no-op'd".

---

### 5. `deployProfile` not in `/state`

Tried to read `deployProfile` from `/state` for minimap display.
It's only in `/health`. `/state` `app` object contains theme and sessionId only.

**Fix:** call `/health` separately if you need the profile name.

---

## Patterns that worked well

- `POST /windows/close {"id":N}` — reliable, fast, correct
- `POST /windows/move {"id":N,"left":X,"top":Y}` — works, correct field names
- `POST /windows/resize {"id":N,"width":W,"height":H}` — works
- Dumping one full window with `json.dumps(d['windows'][0], indent=2)` to discover
  the real field shape — this unblocked everything

---

## AX weaknesses identified

### W1. No canonical field-name reference that's actually correct
`references/api.md` has the wrong shape for `/state` windows.
Agents will write `rect.x` every time until this is fixed.

### W2. `ok:true` is not proof of effect
Move/resize/close all return `ok:true` even when the terminal has no active
browser session or when the op silently no-ops. There's no way to verify effect
without re-reading state — and re-reading state can mislead if you're parsing
it wrong (see W1).

### W3. No minimap script for the hosted public API
`scripts/minimap.sh` in the skill works locally. No equivalent for
`https://dos.wibandwob.com/api`. An agent operating the hosted instance
has to hand-write the state-reading python every time.

### W4. Profile and session info split across two endpoints
`/health` → sessionId, deployProfile, instanceLabel  
`/state` → theme, windows, focus  
Agents have to call both to get a full picture. Should be one call.

### W5. Window close is not in `/commands/list`
`window.close` doesn't exist as a registry command. Agents doing
`--list` discovery will not find it and will try `commands/run` patterns.
The dedicated `POST /windows/close` endpoint is invisible to command discovery.

### W6. Batch layout op format is ambiguous
Does `windows/batch` want `{action,id,x,y,w,h}` or flat `{id,x,y,w,h}`?
The docs say one thing, the API might accept both or neither.
Needs a concrete verified example in the skill.

---

## Fixes to make

| Priority | Fix |
|---|---|
| HIGH | Correct `/state` window shape in `references/api.md` (left/top/width/height, not rect.x/y/w/h) |
| HIGH | Add correct minimap one-liner to `SKILL.md` using real field names |
| MEDIUM | Add `/health` call to minimap pattern — deployProfile is there, not /state |
| MEDIUM | Document `POST /windows/close` explicitly in api.md as non-registry endpoint |
| LOW | Clarify batch op format with a verified working example |
| LOW | Note that `ok:true` requires state re-read to confirm effect |
