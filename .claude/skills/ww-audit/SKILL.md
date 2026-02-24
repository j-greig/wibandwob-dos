---
name: ww-audit
description: >
  Post-implementation parity audit for WibWobDOS. Checks that a window type
  (or the whole system) has full coverage across: registry slug, workspace save
  props, workspace restore, API state props, and screenshot truth. Also supports
  workspace-diff mode (live state vs saved JSON) and a full system gap matrix.
  Use after implementing any new window type, after E013-style parity work, or
  whenever "did this actually work?" is the question.
triggers:
  - /ww-audit
  - /audit
  - /sensecheck
  - "audit <type>"
  - "parity check"
  - "did workspace save work"
  - "check registry gaps"
usage: |
  /ww-audit                        # full system: registry + props + screenshot
  /ww-audit <type>                 # single type: registry + save/restore + props
  /ww-audit workspace              # live state vs last saved workspace JSON
  /ww-audit screenshot             # tmux capture + API state side by side
  /ww-audit props                  # all open windows — show props from /state
---

# ww-audit skill

## What this skill does

Runs one or more checks to answer: **"does this window type / workspace / layout
actually work end-to-end?"**

Covers the four failure modes surfaced in `local-dev-friction-20260223.md`:
1. Registry gap — type has no slug → saves as `test_pattern` fallback silently
2. Props gap — type in registry but `props: {}` on save → restore opens wrong file
3. State gap — C++ emits fields in JSON but Python `_sync_state` drops them
4. Visual gap — layout looks right in JSON but wrong on screen (masonry-as-stack bug)

---

## Mode 1 — Single type audit: `/ww-audit <type>`

Run when: you've just added a new window type, fixed props serialisation, or
added a registry slug.

### Steps

**1. Registry check**
```bash
grep -n '"<type>"' app/window_type_registry.cpp
```
Expect: one entry in `k_specs[]` with slug + spawn fn + match fn.
Fail signal: no output → type saves as `test_pattern`.

**2. Open a window of that type via API**
```bash
curl -s -X POST http://127.0.0.1:8089/menu/command \
  -H 'Content-Type: application/json' \
  -d '{"command": "open_<type>", "args": {}}'
```
Or for `frame_player`:
```bash
curl -s -X POST http://127.0.0.1:8089/gallery/arrange \
  -H 'Content-Type: application/json' \
  -d '{"filenames": ["cat-in-space.txt"], "algorithm": "masonry"}'
```

**3. Check /state props**
```bash
curl -s http://127.0.0.1:8089/state | python3 -c "
import json, sys
d = json.load(sys.stdin)
for w in d['windows']:
    if w.get('type') == '<type>':
        print(f\"  id={w['id']} props={json.dumps(w.get('props', {}))}\")
"
```
Fail signal: `props={}` when you expect `path` or other fields.
Note: props come from C++ JSON via `_sync_state` in `controller.py` — if empty,
check that `_sync_state` isn't hardcoding `props={}`.

**4. Save workspace and check props**
```bash
curl -s -X POST http://127.0.0.1:8089/workspace/save \
  -H 'Content-Type: application/json' \
  -d '{"path": "workspaces/audit-<type>.json"}' && \
python3 -c "
import json
ws = json.load(open('workspaces/audit-<type>.json'))
for w in ws['windows']:
    if w.get('type') == '<type>':
        print(f\"  {w['id']} props={json.dumps(w.get('props', {}))}\")
"
```
Fail signal: `props={}` in saved JSON → restore will be lossy.

**5. Round-trip restore**
```bash
# Clear, restore, check windows came back
curl -s -X POST http://127.0.0.1:8089/gallery/clear \
  -H 'Content-Type: application/json' -d '{}'
sleep 0.5
curl -s -X POST http://127.0.0.1:8089/workspace/open \
  -H 'Content-Type: application/json' \
  -d '{"path": "workspaces/audit-<type>.json"}'
sleep 1.0
curl -s http://127.0.0.1:8089/state | python3 -c "
import json, sys
d = json.load(sys.stdin)
wins = [w for w in d['windows'] if w.get('type') == '<type>']
print(f'{len(wins)} <type> windows restored')
for w in wins: print(f'  {w[\"id\"]} @ {w.get(\"x\")},{w.get(\"y\")} props={json.dumps(w.get(\"props\",{}))}')
"
```
Fail signal: 0 windows, or windows at wrong position, or props empty after restore.

**6. Screenshot**
```bash
tmux capture-pane -t wibwob -p -S - | head -40
```
Fail signal: window missing, clipped, at wrong position, or visually wrong content.

### Pass criteria
- [ ] Registry entry exists with correct slug
- [ ] `/state` shows non-empty props for the type
- [ ] Saved JSON has non-empty props
- [ ] Restore brings back correct window count at correct positions
- [ ] Screenshot matches expected visual

---

## Mode 2 — Workspace diff: `/ww-audit workspace`

Compares current live windows (from `/state`) against the last saved workspace JSON.

```python
import json
from urllib import request as ureq

with ureq.urlopen("http://127.0.0.1:8089/state", timeout=5) as r:
    live = json.load(r)['windows']

saved = json.load(open("workspaces/last_workspace.json"))['windows']

live_types  = [(w['type'], w.get('props', {})) for w in live]
saved_types = [(w['type'], w.get('props', {})) for w in saved]

print(f"Live: {len(live)} windows  Saved: {len(saved)} windows")
print()

for i, (s, l) in enumerate(zip(saved_types, live_types)):
    match = "✅" if s[0] == l[0] else "❌"
    print(f"  w{i+1} {match} saved={s[0]} live={l[0]}")
    if s[1] != l[1]:
        print(f"       props mismatch: saved={s[1]} live={l[1]}")

if len(saved) != len(live):
    print(f"\n⚠️  window count mismatch: {len(saved)} saved vs {len(live)} live")
```

Fail signals: type mismatch, props mismatch, count mismatch.

---

## Mode 3 — Full registry gap matrix: `/ww-audit`

Runs the complete gap audit from E013 — checks every registered type against save/restore coverage.

```bash
python3 - << 'EOF'
import subprocess, json, re

# 1. Get registered types from C++ source
reg = subprocess.check_output(
    ["grep", "-o", '"[a-z_]*"', "app/window_type_registry.cpp"]
).decode().split()
registered = sorted(set(r.strip('"') for r in reg if len(r) > 3))

# 2. Get types with props serialisation (buildWorkspaceJson)
cpp = open("app/wwdos_app.cpp").read()
serialised = re.findall(r'type == "([a-z_]+)"', cpp)

# 3. Get types with restore cases (loadWorkspaceFromFile)
restore_pos = cpp.find("loadWorkspaceFromFile")
restore_section = cpp[restore_pos:restore_pos+3000]
restorable = re.findall(r'type == "([a-z_]+)"', restore_section)

print(f"{'TYPE':<20} {'REGISTRY':<10} {'PROPS SAVE':<12} {'RESTORE':<10}")
print("-" * 55)
all_types = sorted(set(registered + serialised + restorable))
for t in all_types:
    r = "✅" if t in registered else "❌"
    s = "✅" if t in serialised else "—"
    rs = "✅" if t in restorable else "—"
    flag = " ⚠️" if t in registered and t not in serialised else ""
    print(f"  {t:<20} {r:<10} {s:<12} {rs:<10}{flag}")
EOF
```

---

## Mode 4 — Screenshot + state side by side: `/ww-audit screenshot`

```bash
echo "=== SCREEN ===" && \
tmux capture-pane -t wibwob -p | head -30 && \
echo "" && echo "=== STATE ===" && \
curl -s http://127.0.0.1:8089/state | python3 -c "
import json, sys
d = json.load(sys.stdin)
print(f\"canvas: {d['canvas']['width']}x{d['canvas']['height']}\")
for w in d['windows']:
    b = w.get('bounds', {})
    print(f\"  {w['id']:4} {w['type']:18} @ {b.get('x',w.get('x','?'))},{b.get('y',w.get('y','?'))} props={json.dumps(w.get('props',{}))}\")
"
```

---

## Known gaps to check for specific types (as of 2026-02-23)

| Type | Registry | Props save | Restore | Notes |
|------|----------|------------|---------|-------|
| `frame_player` | ✅ | ✅ path | ✅ | done E013 |
| `gallery` | ✅ | ❌ tab, search | ❌ | tab index + lastSearchText not serialised |
| `text_view` | ✅ | ⚠️ path in registry but TTextFileView path | partial | check carefully |
| `terminal` | ✅ | — (stateless) | via registry | acceptable |
| `browser` | ✅ | — (stateless) | via registry | URL not saved |
| `quadra/snake/rogue/deep_signal` | ✅ | — (stateless) | via registry | done E013 |
| `scramble` | ✅ | — | — | no spawn fn, command-only |

---

## Friction patterns to watch for

From `local-dev-friction-20260223.md`:

- **Silent registry fallback**: `windowTypeName()` falls back to `specs.front().type`
  (`test_pattern`) when no match. No warning. Always check the saved JSON `type` field.
- **`_sync_state` drops props**: `controller.py _sync_state` may hardcode `props={}`.
  Check it's reading props from C++ JSON, not overwriting.
- **props={} in save ≠ props={} in state**: C++ may emit fields, Python may drop them,
  or C++ may not emit them at all. Check both `/state` and the JSON file.
- **Restore uses `continue`**: `frame_player` restore uses `continue` to skip the
  registry lookup path. Any new type added to the if-chain must also `continue` or
  the registry will try to spawn a second window.
