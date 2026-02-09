**ASCII Image Viewer (POC)**

Quickstart
- Build (Turbo Vision UI):
  - `cmake -S . -B build -DCMAKE_BUILD_TYPE=Release && cmake --build build --target tv_ascii_view`
  - Run: `./build/tv_ascii_view path/to/image.png [cols rows]`
- Build (stdout fallback):
  - `cmake --build build --target ascii_dump`
  - Run: `./build/ascii_dump path/to/image.png [cols rows]`

Notes
- `stb_image.h` is vendored at `test-tui/stb_image.h` for PNG/JPG loading.
- Controls (UI): `+/-` zoom, `d` toggle dithering, `g` cycle glyph ramp.
- Default grid: 80×24; pass `[cols rows]` to override.
- Ramps: Blocks, Unicode, ASCII. Unicode output requires a font with coverage.

Files
- `tvision_ascii_view_poc.cpp` — single-file renderer + optional Turbo Vision view.
- `stb_image.h` — image decoder dependency.

See also
- PRD: `prds/ascii_image_viewer_prd.md` for scope, roadmap, and acceptance criteria.

