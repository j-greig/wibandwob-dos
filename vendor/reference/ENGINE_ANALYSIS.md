# Asciicker Engine Analysis For TypeScript Port

This document analyzes the core Asciicker rendering/data pipeline for a TypeScript rewrite. It is based on the engine sources in `/tmp/asciicker/`, especially:

- `render.cpp` / `render.h`
- `terrain.cpp` / `terrain.h`
- `sprite.cpp` / `sprite.h`
- `world.cpp` / `world.h`
- `water.cpp`
- `matrix.h`
- `game.cpp` lines 1-200 for general engine context

The important architectural point is that Asciicker is not a tile renderer. It is a software rasterizer with:

- a world-space terrain mesh made from heightfield triangles
- a sample/depth buffer in screen space
- a post-pass that converts samples into terminal cells
- a separate sprite atlas system and mesh system that both feed the same sample buffer

## 1. Projection System (`render.cpp`)

### Matrix construction

The core camera matrix is built in [`render.cpp:2768-2805`] from `yaw`, `zoom`, `HEIGHT_SCALE`, `HEIGHT_CELLS`, and `VISUAL_CELLS`.

Key lines:

- `sin30` / `cos30`: [`render.cpp:2768-2769`]
- `ds = 2*zoom/VISUAL_CELLS`: [`render.cpp:2693`]
- transform rows: [`render.cpp:2789-2800`]
- translation: [`render.cpp:2804-2805`]

The matrix storage is column-major, confirmed by [`matrix.h:159-164`]:

```cpp
mv[0] = m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12] * v[3];
mv[1] = m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13] * v[3];
```

The camera matrix is:

```cpp
tm[0]  = +cosyaw * ds;
tm[1]  = -sinyaw * sin30 * ds;
tm[4]  = +sinyaw * ds;
tm[5]  = +cosyaw * sin30 * ds;
tm[9]  = +cos30 / HEIGHT_SCALE * ds * HEIGHT_CELLS;
tm[12] = dw*0.5 - (pos[0] * tm[0] * HEIGHT_CELLS + pos[1] * tm[4] * HEIGHT_CELLS + pos[2] * tm[8]) + scene_shift[0]*2;
tm[13] = dh*0.5 - (pos[0] * tm[1] * HEIGHT_CELLS + pos[1] * tm[5] * HEIGHT_CELLS + pos[2] * tm[9]) + scene_shift[1]*2;
```

Because `tm[8] = 0`, `z` affects only screen Y, not screen X. This is the isometric/axonometric projection.

### Why `sin30` / `cos30` gives the isometric angle

The horizontal world basis vectors are:

- X axis projects to `( cos(yaw)*ds, -sin(yaw)*sin30*ds )`
- Y axis projects to `( sin(yaw)*ds,  cos(yaw)*sin30*ds )`

The vertical world axis projects to:

- Z axis projects to `( 0, cos30/HEIGHT_SCALE * ds * HEIGHT_CELLS )`

`sin30 = 0.5` compresses ground-plane Y contribution on screen Y. `cos30 ~= 0.866` controls how much vertical elevation moves the point vertically on screen. This is the classic 30 degree isometric skew: the ground plane is flattened by `sin(30deg)`, while height rises by `cos(30deg)`.

### How `HEIGHT_SCALE`, `HEIGHT_CELLS`, `VISUAL_CELLS` relate

Definitions are in [`terrain.h:8-10`]:

- `HEIGHT_SCALE = 16`
- `HEIGHT_CELLS = 4`
- `VISUAL_CELLS = 8`

Meaning:

- One terrain patch stores `HEIGHT_CELLS + 1 = 5` height vertices per side.
- One terrain patch stores `VISUAL_CELLS = 8` material cells per side.
- The physical patch width is 8 world visual cells, but only 4 height quads, so each height quad spans `VISUAL_CELLS / HEIGHT_CELLS = 2` visual cells.
- `HEIGHT_SCALE = 16` means 16 Z units equal one projected visual cell of height.

This exact terrain-to-render relationship appears in:

- vertex grid: [`terrain.cpp:93-96`]
- sample interpolation scale `sxy = VISUAL_CELLS / HEIGHT_CELLS`: [`terrain.cpp:1450`]
- patch vertex placement: [`render.cpp:1572-1577`]

### The `ds = 2*zoom/VISUAL_CELLS` factor

Defined at [`render.cpp:2693`]:

```cpp
float ds = 2*zoom / VISUAL_CELLS;
```

Interpretation:

- `zoom` is desired screen width in terminal cells for one patch width.
- The renderer rasterizes into a doubled sample grid, so the patch spans roughly `2*zoom` sample columns.
- Dividing by `VISUAL_CELLS` converts that patch-scale to per-world-visual-cell scale.

So `ds` is “screen samples per world visual cell”.

### Exact world-to-screen mapping

There are two coordinate systems to keep straight:

1. Gameplay/world object coordinates use `x,y` in “height-cell units”. Sprites convert by `w_pos = { pos[0] * HEIGHT_CELLS, pos[1] * HEIGHT_CELLS, pos[2] }` at [`render.cpp:1185`].
2. Terrain patch callbacks give `x,y` in visual-cell coordinates, then premultiply by `HEIGHT_CELLS` to match the same projection space: [`render.cpp:1572-1577`].

For a premultiplied world point `(X, Y, Z)` where `X` and `Y` are already multiplied by `HEIGHT_CELLS`:

```ts
sx = tm[0] * X + tm[4] * Y + tm[8] * Z + tm[12]
sy = tm[1] * X + tm[5] * Y + tm[9] * Z + tm[13]
```

Because `tm[8] = 0`, the exact formulas are:

```ts
sx = cosYaw * ds * X + sinYaw * ds * Y + cx
sy = -sinYaw * sin30 * ds * X
   +  cosYaw * sin30 * ds * Y
   +  cos30 / HEIGHT_SCALE * ds * HEIGHT_CELLS * Z
   + cy
```

with:

```ts
cx = dw * 0.5 - (cameraX * HEIGHT_CELLS * cosYaw * ds + cameraY * HEIGHT_CELLS * sinYaw * ds) + sceneShiftX * 2
cy = dh * 0.5 - (
  cameraX * HEIGHT_CELLS * (-sinYaw * sin30 * ds) +
  cameraY * HEIGHT_CELLS * ( cosYaw * sin30 * ds) +
  cameraZ * (cos30 / HEIGHT_SCALE * ds * HEIGHT_CELLS)
) + sceneShiftY * 2
```

If you want formulas from non-premultiplied gameplay world coordinates `(x, y, z)`:

```ts
const X = x * HEIGHT_CELLS;
const Y = y * HEIGHT_CELLS;
const Z = z;

const sx =
  dw * 0.5 +
  ds * HEIGHT_CELLS * (cosYaw * (x - cameraX) + sinYaw * (y - cameraY)) +
  sceneShiftX * 2;

const sy =
  dh * 0.5 +
  ds * HEIGHT_CELLS * (
    -sinYaw * sin30 * (x - cameraX) +
     cosYaw * sin30 * (y - cameraY) +
     cos30 / HEIGHT_SCALE * (z - cameraZ)
  ) +
  sceneShiftY * 2;
```

### TypeScript pseudocode

```ts
const HEIGHT_SCALE = 16;
const HEIGHT_CELLS = 4;
const VISUAL_CELLS = 8;

function buildProjection(
  zoom: number,
  yawDeg: number,
  camera: { x: number; y: number; z: number },
  dw: number,
  dh: number,
  sceneShift: { x: number; y: number },
) {
  const ds = (2 * zoom) / VISUAL_CELLS;
  const sin30 = Math.sin(Math.PI / 6);
  const cos30 = Math.cos(Math.PI / 6);
  const a = yawDeg * Math.PI / 180;
  const sinYaw = Math.sin(a);
  const cosYaw = Math.cos(a);

  return {
    m00: cosYaw * ds,
    m01: -sinYaw * sin30 * ds,
    m10: sinYaw * ds,
    m11: cosYaw * sin30 * ds,
    mzY: (cos30 / HEIGHT_SCALE) * ds * HEIGHT_CELLS,
    tx:
      dw * 0.5 -
      (camera.x * HEIGHT_CELLS * cosYaw * ds +
       camera.y * HEIGHT_CELLS * sinYaw * ds) +
      sceneShift.x * 2,
    ty:
      dh * 0.5 -
      (camera.x * HEIGHT_CELLS * (-sinYaw * sin30 * ds) +
       camera.y * HEIGHT_CELLS * ( cosYaw * sin30 * ds) +
       camera.z * ((cos30 / HEIGHT_SCALE) * ds * HEIGHT_CELLS)) +
      sceneShift.y * 2,
  };
}

function projectWorld(
  proj: ReturnType<typeof buildProjection>,
  x: number,
  y: number,
  z: number,
) {
  const X = x * HEIGHT_CELLS;
  const Y = y * HEIGHT_CELLS;
  return {
    sx: proj.m00 * X + proj.m10 * Y + proj.tx,
    sy: proj.m01 * X + proj.m11 * Y + proj.mzY * z + proj.ty,
  };
}
```

## 2. Triangle Rasterization (`render.cpp`)

### `Rasterize()` is a barycentric software rasterizer

`Rasterize()` starts at [`render.cpp:315`]. It takes 3 vertices `v[i] = {x, y, z, flags}` and rasterizes triangle coverage into the sample buffer.

Important behavior:

- signed doubled area: [`render.cpp:324-332`]
- bounding-box clipping: [`render.cpp:345-349`]
- barycentrics at pixel centers: [`render.cpp:327-328`, `359-364`]
- top-left edge rule / edge pairing: [`render.cpp:369-375`]
- interpolated depth: [`render.cpp:379-387`]
- optional backface pass for double-sided triangles: [`render.cpp:392-403`]

The exact screen-space barycentrics are:

```ts
function bcP(a: Vec2i, b: Vec2i, p: Vec2i) {
  return (b.x - a.x) * (2 * p.y + 1 - 2 * a.y)
       - (b.y - a.y) * (2 * p.x + 1 - 2 * a.x);
}
```

Normalized barycentrics:

```ts
const normalizer = (1 - Number.EPSILON) / area;
const w0 = bc0 * normalizer;
const w1 = bc1 * normalizer;
const w2 = bc2 * normalizer;
const z = w0 * v0.z + w1 * v1.z + w2 * v2.z;
```

### How terrain patches become triangles

Patch rendering begins at [`render.cpp:1396`]. The projected patch vertex grid is stored in:

```cpp
int xyzf[HEIGHT_CELLS + 1][HEIGHT_CELLS + 1][4];
```

at [`render.cpp:1567-1568`].

Each element is:

- `[0]`: screen x
- `[1]`: screen y
- `[2]`: depth/height
- `[3]`: clip flags

The vertex grid is `5x5`, because `HEIGHT_CELLS=4`.

### Each quad becomes 2 triangles

The patch loop is [`render.cpp:1769-1873`]. For each height quad `(dx,dy)`:

- it reads the diagonal bit from `diag`
- if set, it uses the `\` split
- otherwise it uses the `/` split

This matches the same split logic used for ray intersection in [`terrain.cpp:1808-1849`] and sampling in [`terrain.cpp:1468-1484`].

Example for `diag & 1` in normal rendering:

- lower triangle: [`render.cpp:1797-1801`]
  - vertices `{ xyzf[dy][dx], xyzf[dy][dx+1], xyzf[dy+1][dx] }`
- upper triangle: [`render.cpp:1820-1824`]
  - vertices `{ xyzf[dy+1][dx+1], xyzf[dy+1][dx], xyzf[dy][dx+1] }`

For `diag == 0`:

- lower triangle: [`render.cpp:1845-1849`]
- upper triangle: [`render.cpp:1869-1873`]

### Depth test

The sample struct is defined after `Rasterize()` at [`render.cpp:426+`], with the key field:

- `float height;`

Every shader path compares the incoming `z` against `s->height`. For terrain:

- `if (s->height < z)` in [`render.cpp:1402`]

For meshes:

- `if (s->height < z)` in [`render.cpp:717`]

So depth is “larger Z wins”, not conventional “smaller depth wins”.

### Why this eliminates cracks/gaps

The engine avoids terrain cracks for two reasons:

1. Adjacent patches share border height vertices during patch creation, copying edge/corner values from neighbors: [`terrain.cpp:964-999`].
2. Each quad is rasterized as two triangles with an explicit edge pairing rule in `Rasterize()` so only one of two shared edges owns each edge sample: [`render.cpp:369-375`].

That combination means:

- adjacent patches have identical border geometry
- adjacent triangles do not double-fill or skip shared edge pixels

### TypeScript pseudocode

```ts
type Sample = { height: number; visual: number; diffuse: number; flags: number };
type Vtx = { x: number; y: number; z: number; clip: number };

function rasterizeTriangle(
  buffer: Sample[],
  w: number,
  h: number,
  tri: [Vtx, Vtx, Vtx],
  blend: (sample: Sample, z: number, bc: [number, number, number]) => void,
  doubleSided = false,
) {
  const [v0, v1, v2] = tri;
  if ((v0.clip & v1.clip & v2.clip) !== 0) return;

  const area = 2 * ((v1.x - v0.x) * (v2.y - v0.y) - (v1.y - v0.y) * (v2.x - v0.x));
  if (area === 0) return;
  if (Math.abs(area) >= 0x10000) return;
  if (area < 0 && !doubleSided) return;

  const norm = (1 - Number.EPSILON) / area;
  const left = Math.max(0, Math.min(v0.x, v1.x, v2.x));
  const right = Math.min(w, Math.max(v0.x, v1.x, v2.x));
  const bottom = Math.max(0, Math.min(v0.y, v1.y, v2.y));
  const top = Math.min(h, Math.max(v0.y, v1.y, v2.y));

  for (let y = bottom; y < top; y++) {
    for (let x = left; x < right; x++) {
      const bc0 = bcP(v1, v2, { x, y });
      const bc1 = bcP(v2, v0, { x, y });
      const bc2 = bcP(v0, v1, { x, y });

      if (area > 0) {
        if (bc0 < 0 || bc1 < 0 || bc2 < 0) continue;
      } else {
        if (bc0 > 0 || bc1 > 0 || bc2 > 0) continue;
      }

      const sharedEdge =
        (bc0 === 0 && v1.x <= v2.x) ||
        (bc1 === 0 && v2.x <= v0.x) ||
        (bc2 === 0 && v0.x <= v1.x);
      if (sharedEdge) continue;

      const w0 = bc0 * norm;
      const w1 = bc1 * norm;
      const w2 = bc2 * norm;
      const z = w0 * v0.z + w1 * v1.z + w2 * v2.z;
      blend(buffer[y * w + x], z, [w0, w1, w2]);
    }
  }
}
```

## 3. Terrain Patch System (`terrain.cpp` / `terrain.h`)

### Patch structure

The patch layout is defined in [`terrain.cpp:92-96`] and constants in [`terrain.h:8-10`]:

- `height[5][5]` because `HEIGHT_CELLS + 1 = 5`
- `visual[8][8]` because `VISUAL_CELLS = 8`
- `diag` is a `4x4` bitfield choosing one diagonal per height quad

The comment on `visual` is important:

```cpp
// 1bit elevation, 6bit material
```

So a visual cell is not just a material id. Its high bit is used for elevated/cliff logic in the renderer.

### Heightmaps store height per vertex

Height is per grid vertex, not per cell:

- declaration: [`terrain.cpp:95`]
- border sharing with neighbors: [`terrain.cpp:964-999`]
- free edge interpolation: [`terrain.cpp:1019-1058`]

That means the ground surface is a triangle mesh, not a stepped voxel field.

### Visual maps store material per cell

Material is per visual cell:

- declaration: [`terrain.cpp:94`]
- render lookup by interpolated `u,v`: [`render.cpp:1453-1458`]

When a triangle sample lands inside a terrain triangle, the renderer computes a visual-space `(u,v)` and looks up one `visual[v * VISUAL_CELLS + u]`.

### Relationship between `5x5` height vertices and `8x8` visual cells

This is the key mixed-resolution trick.

`QueryTerrainSample()` in [`terrain.cpp:1450-1484`] maps each visual cell center back onto the coarser height mesh:

- `sxy = VISUAL_CELLS / HEIGHT_CELLS = 2.0`: [`terrain.cpp:1450`]
- visual cell center to height quad index: [`terrain.cpp:1454-1464`]
- then triangle-specific interpolation inside that quad: [`terrain.cpp:1468-1484`]

So:

- geometry is defined on 4x4 quads
- materials are defined on 8x8 subcells
- each height quad covers a 2x2 block of visual cells

### How patches tile together

Patch adjacency is explicit. When adding a patch, it copies border vertices from all 8 neighbors if present: [`terrain.cpp:964-999`].

That guarantees:

- corner heights match
- border edge heights match
- interpolated interiors start from consistent shared boundaries

For persistence, each saved patch stores just:

- integer patch position `(x,y)`
- `visual[8][8]`
- `height[5][5]`
- `diag`

in [`terrain.cpp:2837-2854`].

## 4. Material / Colour System (`render.cpp`)

### `auto_mat[32768*3]`

Defined at [`render.cpp:577-579`]:

```cpp
static uint8_t auto_mat[32 * 32 * 32 * 3];
```

This is a lookup table for every possible RGB15 value:

- 32 red levels
- 32 green levels
- 32 blue levels
- 3 outputs per input

Output triple:

- `mat[idx + 0]`: background xterm-256 colour
- `mat[idx + 1]`: foreground xterm-256 colour
- `mat[idx + 2]`: glyph

### How it works

`create_auto_mat()` at [`render.cpp:579-709`] does this:

1. Quantize each 5-bit component into a 6-level xterm cube neighborhood using `flo[]` and `rem[]`: [`render.cpp:586-613`].
2. Consider all pairs of the 8 cube corners: [`render.cpp:639-677`].
3. Find the pair whose line segment best approximates the target colour: [`render.cpp:658-675`].
4. Convert the interpolation amount `best_pr` into one of 12 shades: [`render.cpp:679-689`].
5. Emit one of the glyphs from `" ..::%"`: [`render.cpp:615`, `692-702`].

The glyph string has 6 characters, but the code uses 12 shade bins by reversing the pair order when `shd >= 6`. That is how it doubles the apparent resolution: same glyph ramp, but swapping fg/bg in the second half.

### Why this creates “doubled colour resolution”

For each RGB15 colour, the LUT approximates it as:

- a low xterm cube colour
- a high xterm cube colour
- a density glyph that mixes them spatially

For `shd < 6` it uses `(lo,bg) -> (hi,fg)` with `glyph[shd]`.
For `shd >= 6` it swaps them and uses `glyph[11-shd]`.

That gives 12 ordered blend positions out of a 6-character ramp. Visually, it is a cheap 2-colour ordered dither in one terminal cell.

### `Material::shade[4][16]`

Defined in [`render.h:16-40`]:

- `MatCell` holds `fg[3]`, `bg[3]`, `gl`, `flags`
- `Material` holds `shade[4][16]`

The renderer uses:

- first index = elevation/light variant row (`elv`)
- second index = shade bucket `0..15`

The post-pass computes:

- `elv` from neighboring elevation bits: [`render.cpp:3253-3271`]
- `shd` from average diffuse: [`render.cpp:3290`, `3414`]

Diffuse itself is computed from surface normals:

- terrain diffuse: [`render.cpp:1535-1539`]
- mesh diffuse: [`render.cpp:979-1010`]

Terrain formula:

```cpp
nl = sqrt(dzdx*dzdx + dzdy*dzdy + HEIGHT_SCALE*HEIGHT_SCALE)
df = (dzdx*light.x + dzdy*light.y + HEIGHT_SCALE*light.z) / nl
df = df * (1 - 0.5*ambient) + 0.5*ambient
diffuse = df * 255
```

Then the post-pass turns `0..255` into `0..15` with `dif / 17` or averaged equivalent: [`render.cpp:3290`, `3414`].

## 5. Cliff / Side Face Rendering

### Important correction

The terrain renderer does **not** generate explicit vertical wall triangles for cliffs. There is no terrain-side-face triangle pass in `RenderPatch()`. The only actual terrain triangles are the top surface triangles in [`render.cpp:1769-1873`].

The cliff illusion is created in two stages:

1. Terrain samples may be elevated by one `HEIGHT_SCALE` if the visual cell has bit `0x8000`: [`render.cpp:1453-1456`].
2. The post-pass inspects elevation patterns across neighboring samples and chooses `Material.shade[elv][shd]`, plus silhouette glyphs like `-` and `_`: [`render.cpp:3253-3271`, `3572-3602`].

### What “side faces” actually are here

`elv` is derived from 3 rows of elevation bits:

- `e_lo`: row above current cell pair
- `e_mi`: current row
- `e_hi`: row below

at [`render.cpp:3253-3271`].

That picks one of four material rows:

- `0`: lower
- `1`: high
- `2`: raise
- `3`: low

Then the material system can provide different glyph/background/foreground for those side/transition states.

Additionally, the post-pass compares neighboring depths:

- `minus = z_lo - z_hi`
- `under = z_pr - z_lo`

at [`render.cpp:3583-3590`], and uses:

- `'-'` (`0xC4`) for a front-facing ledge: [`render.cpp:3592-3600`]
- `'_'` (`0x5F`) for an under-edge: immediately after [`render.cpp:3602+`]

### Result

So the engine’s “3D cliff face” effect is hybrid:

- real top-surface 3D geometry from the heightfield triangles
- per-sample elevation bits to lift specific material cells
- post-pass glyph/material selection to imply side walls and ledges

That is cheaper than rasterizing explicit wall polygons, and it is the behavior to preserve in a TS port.

## 6. Water System (`water.cpp`, `render.cpp`)

### Water is a flat plane

Water is treated as a single global height `water`, not a mesh. The main render path quantizes it to screen sample increments:

- [`render.cpp:2779-2781`]

```cpp
water_i = floor(water / (HEIGHT_SCALE / (4 * ds * cos30)))
water   = water_i * (HEIGHT_SCALE / (4 * ds * cos30))
```

This snaps water movement to projection-consistent vertical steps.

### Reflection mode

Reflection state is global:

- `static bool global_refl_mode = false;` at [`render.cpp:39`]
- enabled/disabled at [`render.cpp:3172-3176`]

The reflection pass rebuilds the projection by negating the Z contribution:

- [`render.cpp:3075-3091`]

Core changes:

- `tm[9] = -tm[9]`
- `tm[10] = -tm[10]`
- translation uses mirrored camera Z `(2*water - pos[2])`

### How reflected terrain is rendered

During reflection:

- terrain vertices use `xyzf[..][..][2] = (2 * r->water) - vz`: [`render.cpp:1611-1613`, `1632-1634`, `1687-1689`]
- mesh/sprite reflected depth also mirrors around water: e.g. sprite reflected `s_pos[2]` at [`render.cpp:1238`, `1253`]

Clip planes are also rebuilt around the mirrored frustum:

- perspective path: [`render.cpp:3114-3138`]
- ortho path: [`render.cpp:3142-3168`]

`water.cpp` is only design notes, but those notes match the implementation:

- mirror equation and reflected plane concept: [`water.cpp:19-31`]

### Water surface material

The engine does not rasterize a separate water surface mesh. Instead, after downsampling the sample buffer into terminal cells, it detects cells fully below water and applies animated noise:

- submerged-cell test: [`render.cpp:3628-3655`]
- noise sampling: [`render.cpp:3657-3664`]
- colour perturbation: [`render.cpp:3666-3688`]

So visually, water is:

- a clipping plane for normal vs reflected geometry
- a reflected re-render of terrain/objects
- a final colour wobble pass for underwater cells

## 7. Sprite System (`sprite.cpp`)

### `XPCell` format

`XPCell` is defined packed in [`sprite.cpp:325-347`]:

```cpp
struct XPCell {
  uint32_t glyph;
  uint8_t fg[3];
  uint8_t bk[3];
};
```

That is exactly 10 bytes.

### `.xp` file structure

The loader manually parses gzip:

- gzip header and optional fields: [`sprite.cpp:223-279`]
- read compressed payload and strip trailer: [`sprite.cpp:281-308`]

Then it interprets the decompressed payload as:

- `int version` at word 0 (implicitly present)
- `int layers` at word 1: [`sprite.cpp:314`]
- `int width` at word 2: [`sprite.cpp:315`]
- `int height` at word 3: [`sprite.cpp:316`]

After that, each layer is:

- `width`
- `height`
- `width * height` packed `XPCell`s

The code jumps between layers as:

- `layer0 = (XPCell*)((int*)out + 4)`
- `layer1 = (XPCell*)((int*)(layer0 + cells) + 2)`
- `layer2 = (XPCell*)((int*)(layer1 + cells) + 2)`

from [`sprite.cpp:349-352`].

That `+2` is the layer-local `width,height` header in 32-bit ints.

Cells are read column-major:

- `cell = x * height + y` at [`sprite.cpp:689`]

That is critical. A TS parser that assumes row-major will be wrong.

### Layer meanings

The loader comments are explicit:

- layer 0: background specifies colour key: [`sprite.cpp:350`]
- layer 1: glyph encodes height: [`sprite.cpp:351`]
- layer 2: image map: [`sprite.cpp:352`]

During frame build:

- `c1->glyph` is decoded into `c->spare` height nibble/byte: [`sprite.cpp:716-722`]
- layer 0 background is used as transparent colour key against layer 2: [`sprite.cpp:703-714`]

### 3D positioning and projection

Sprites are inserted into the world render list in `Renderer::RenderSprite(...)` in [`render.cpp:1176-1358`].

Important details:

- world position is converted to premultiplied XY: [`render.cpp:1185`]
- same camera projection as terrain/meshes: [`render.cpp:1224-1230`, `1295-1301`]
- sample-space position is then converted to terminal-cell coordinates by `>> 1`: [`render.cpp:1235-1238`, `1306-1309`]

Sprite Z anchoring:

- normal: `floor(w_pos[2]+0.5) + HEIGHT_SCALE/2` at [`render.cpp:1309`, `1324`]
- reflection: `2*water - (...)` at [`render.cpp:1238`, `1253`]

### Animation: angles × frames × reflection

The sprite atlas model is in [`sprite.h:22-31`]:

- `angles`
- `anims`
- `frames`
- `atlas` stores `[frames][angles][2]` logically, where `2` is normal/reflection

Frame index generation is at [`sprite.cpp:826-842`]. It explicitly fills:

- all reflection sheets
- all angle rows
- all animation frame columns

So a TS port should expose sprite lookup as:

```ts
atlasIndex = anim.frame_idx[(refl * angles + angle) * anim.length + frame]
```

## 8. Mesh System (`world.cpp`)

### `.akm` is ASCII PLY

Despite the `.akm` extension, the parser requires:

- first line `ply`: [`world.cpp:3398-3404`]
- second line `format ascii 1.0`: [`world.cpp:3416-3422`]

So `.akm` is just a constrained ASCII PLY file.

### Vertex format

Accepted vertex properties are strict and ordered:

- `x`
- `y`
- `z`
- optionally `red`
- `green`
- `blue`
- `alpha`

from [`world.cpp:3492-3505`].

Vertices are stored as:

- `xyzw[4]` with `w = 1`: [`world.cpp:3575-3578`]
- `rgba[4]`: [`world.cpp:3579-3582`]

### Face format

Accepted face property:

- `property list uchar uint vertex_indices`: [`world.cpp:3478-3486`]

Accepted polygon sizes on load:

- 2, 3, 4
- `-3`, `-4` for “freestyle”

from [`world.cpp:3667-3680`].

Triangles and quads are fan-triangulated:

- `abc = { vv[0], vv[t+1], vv[t+2] }` at [`world.cpp:3709-3715`]

Lines become `Line` entries at [`world.cpp:3749-3764`].

### How faces reach the rasterizer

`QueryMesh()` enumerates every face and line, packaging:

- `coords[9]` = xyz for 3 vertices
- `colors[12]` = rgba for 3 vertices
- `visual` flags

at [`world.cpp:4308-4367`].

`Renderer::RenderMesh()` builds the view-instance matrix and calls `QueryMesh(...)`:

- [`render.cpp:1364-1377`]

Each face then goes through:

- `RenderFace(...)` at [`render.cpp:711-1032`]
- which computes a normal and diffuse lighting: [`render.cpp:979-1010`]
- then calls `Rasterize(...)`: [`render.cpp:1022`, `1030`]

So meshes and terrain converge at the same rasterizer. That is ideal for a TS port: one triangle pipeline, two producers.

## 9. Data File Formats Summary Table

| Format | Layout | TS parse notes | Gotchas |
|---|---|---|---|
| `.a3d` | Header `FileHeader { u32 sign, u32 headerSize, u32 numPatches, u32 reserved }`, then repeated `FilePatch { i32 x, i32 y, u16 visual[8][8], u16 height[5][5], u16 diag }` from [`terrain.cpp:2830-2843`], written at [`terrain.cpp:2850-2854`]. | Use `Buffer`/`DataView`. Read little-endian `AS3D` header, then fixed-size patch records. | `visual` and `height` are raw little-endian `uint16`. `visual` contains elevation in bit `0x8000`, not just material id. |
| `.akm` | ASCII PLY with exact header rules from [`world.cpp:3398-3528`]. Vertices are `x y z` or `x y z r g b a`. Faces are vertex-index lists of size 2/3/4 or negative freestyle variants from [`world.cpp:3667-3768`]. | Parse as text. `splitLines()`, validate exact header strings, then parse floats/ints. Triangulate quads and n-gons as fan triangles. | `.akm` extension is misleading; it is not binary. The parser is strict about property order and only supports ASCII 1.0. |
| `.xp` | Gzip stream, then decompressed payload begins with 4 ints: version, layers, width, height, then per-layer `int width`, `int height`, `XPCell[cells]` from [`sprite.cpp:314-352`]. `XPCell` is 10 bytes: `u32 glyph + rgb fg + rgb bg` from [`sprite.cpp:325-347`]. | In Bun, use `Bun.gunzipSync()` or `zlib.gunzipSync()`. Then parse with `DataView`. Walk layers using `cells = width*height`, and remember each layer has its own `width,height` prefix. | Cells are column-major (`cell = x * height + y`) at [`sprite.cpp:689`]. Layer 0 is colour key, layer 1 is height metadata, layer 2 is image. Extra layers are merged. |
| `palette.gz` | Gzip stream loaded in `mainmenu.cpp`. Decompressed payload is `u32 step` followed by `u32 table[]`; loader sets `xxx_step = *(u32*)out; xxx_table = (u32*)out + 1` at [`mainmenu.cpp:1035-1039`]. | Use Bun/zlib gunzip, then `const step = dv.getUint32(0, true); const table = new Uint32Array(buf.slice(4))`. | This format is not self-describing beyond `step`. Table length is implied by `size = floor(255 / step) + 1`, cube size `size^3`. Loader asserts `step == 3` at [`mainmenu.cpp:1041`]. |

### Bun / TS parsing sketches

```ts
import { gunzipSync } from "node:zlib";

function readA3D(buf: Buffer) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const sign = dv.getUint32(0, true);
  const headerSize = dv.getUint32(4, true);
  const numPatches = dv.getUint32(8, true);
  if (sign !== Buffer.from("AS3D").readUInt32LE(0)) throw new Error("bad sign");
  let off = headerSize;
  const patches = [];
  for (let i = 0; i < numPatches; i++) {
    const x = dv.getInt32(off, true); off += 4;
    const y = dv.getInt32(off, true); off += 4;
    const visual = new Uint16Array(64);
    for (let j = 0; j < 64; j++, off += 2) visual[j] = dv.getUint16(off, true);
    const height = new Uint16Array(25);
    for (let j = 0; j < 25; j++, off += 2) height[j] = dv.getUint16(off, true);
    const diag = dv.getUint16(off, true); off += 2;
    patches.push({ x, y, visual, height, diag });
  }
  return patches;
}

function readXP(gzBuf: Buffer) {
  const out = gunzipSync(gzBuf);
  const dv = new DataView(out.buffer, out.byteOffset, out.byteLength);
  const version = dv.getInt32(0, true);
  const layers = dv.getInt32(4, true);
  const width = dv.getInt32(8, true);
  const height = dv.getInt32(12, true);
  let off = 16;
  const result = [];
  for (let layer = 0; layer < layers; layer++) {
    const lw = dv.getInt32(off, true); off += 4;
    const lh = dv.getInt32(off, true); off += 4;
    const cells = [];
    for (let i = 0; i < lw * lh; i++) {
      const glyph = dv.getUint32(off, true); off += 4;
      const fg = [dv.getUint8(off++), dv.getUint8(off++), dv.getUint8(off++)] as const;
      const bg = [dv.getUint8(off++), dv.getUint8(off++), dv.getUint8(off++)] as const;
      cells.push({ glyph, fg, bg });
    }
    result.push({ width: lw, height: lh, cells });
  }
  return { version, width, height, layers: result };
}
```

## 10. Porting Strategy

### What to port first

For maximum visual impact, port in this order:

1. Projection math and terrain patch projection.
2. Triangle rasterizer with depth buffer.
3. Terrain top-surface shading/material lookup.
4. Post-pass converting 2x2 samples into terminal cells.
5. Reflection pass and water noise.
6. Sprites.
7. Meshes.

That sequence gets you from “blank screen” to “recognizable Asciicker terrain” fastest.

### Minimum viable renderer

The minimum correct renderer is:

- `buildProjection()` from section 1
- terrain patch traversal over `height[5][5] + diag`
- `Rasterize()` equivalent
- `Sample { height, visual, diffuse, flags }`
- post-pass that downsamples 2x2 samples into one terminal cell

Without the post-pass, the image will not look like Asciicker. The sample buffer is only an intermediate.

### Recommended JS/TS libraries

- gzip: Bun built-in `Bun.gunzipSync` or Node `zlib.gunzipSync`
- `.xp`: manual parser is fine; the format is simple. `rexpaintjs` may help, but manual parsing is safer because Asciicker relies on exact layer semantics and column-major traversal.
- PLY: for `.akm`, a tiny custom parser is preferable because the accepted subset is strict and small.

### Recommended TS module structure

```text
asciicker/
  formats/
    a3d.ts
    xp.ts
    akm.ts
    palette.ts
  math/
    matrix.ts
    projection.ts
    barycentric.ts
  terrain/
    terrain-types.ts
    terrain-project.ts
    terrain-raster.ts
  render/
    sample-buffer.ts
    rasterize.ts
    postpass.ts
    materials.ts
    water.ts
  sprites/
    sprite-types.ts
    sprite-project.ts
    sprite-blit.ts
  meshes/
    mesh-types.ts
    mesh-render.ts
```

### Performance considerations

- Use typed arrays for all hot paths: `Float32Array`, `Int32Array`, `Uint16Array`, `Uint8Array`.
- Store sample buffer as structure-of-arrays, not array-of-objects, if performance matters.
- Avoid per-pixel allocations. No `{x,y}` objects in raster loops.
- Precompute patch UV ranges exactly like `patch_uv` in [`render.cpp:2698-2701`].
- Reuse scratch arrays for triangle setup.
- Keep terrain patch geometry in premultiplied XY (`* HEIGHT_CELLS`) to match the original math and avoid repeated divides.

### Porting risk summary

- The largest hidden risk is not projection. It is the post-pass. That is where terrain materials, elevation, dithering, water tint, and final glyph selection happen.
- The second risk is column-major `.xp` parsing. Most generic parsers assume row-major.
- The third risk is assuming cliffs are geometry. In Asciicker terrain, they are mostly a sample/post-pass illusion built from the `visual` elevation bit and `shade[4][16]`.

If the rewrite preserves:

- the exact projection scalars
- the triangle split/diag rules
- the 2x2 sample downsampling model
- the `auto_mat` LUT behavior

then the port will look like the original engine rather than merely approximating it.
