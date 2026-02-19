# SPK02 — Donut Animation Path Bug

**tl;dr**: "New Animation" shows blank screen because `donut.txt` loaded with relative path — file is at `app/donut.txt` but CWD is project root when launched via `./build/app/test_pattern`.

**status**: not-started
**severity**: low (cosmetic, pre-existing)
**file**: `app/test_pattern_app.cpp:1515`

---

## Bug

```cpp
TFrameAnimationWindow* window = new TFrameAnimationWindow(bounds, "", "donut.txt");
```

`donut.txt` exists at `app/donut.txt`. When launched from project root (`./build/app/test_pattern`), CWD is project root, so `donut.txt` resolves to nothing. Blank window.

## Fix Options

1. **Change path to `app/donut.txt`** — works when launched from project root, breaks if launched from `app/`
2. **Use `path_search.h`** — the project already has path resolution (`app/path_search.h`) used by the browser view. Use the same pattern to search for `donut.txt` in known locations
3. **Embed as resource** — compile the animation data into the binary. Overkill for one file

## Recommendation

Option 2. Match existing pattern from `path_search.h`. Quick fix, consistent with codebase.

## Test

After fix: `File > New Animation` should show rotating 3D donut, not blank window.
