# E004 Origin Context

## Why This Epic Exists

E004 was created after real browser regressions were observed while validating `symbient.life` in the native TUI browser:

1. API/browser mode propagation drift caused images to be skipped in flows that should render them.
2. Rendering budget and truncation behavior could hide leading page text in image modes.
3. Long, image-heavy pages exposed inconsistent outcomes between text-only copy output and on-screen browser rendering.
4. Manual validation uncovered issues quickly, but repeatability and regression safety were weak.

## What This Epic Intends To Fix

- Lock deterministic render-mode semantics.
- Add lazy/progressive image loading for better first-view UX.
- Add automated known-site smoke loops that verify browse/copy/screenshot behavior with artifacts.

## Related Issues

- Epic: #49
- Features: #50, #51, #52

