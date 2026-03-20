/**
 * Benchmark: WibWobWorld 3D (firstperson) render performance
 *
 * Metrics:
 *   frame_µs  — pure raycaster (renderTerrainMap firstperson) — PRIMARY
 *   full_µs   — createTerrainMap + render — full render() round-trip cost
 *
 * Lower is better.
 */
import { createTerrainMap } from "./src/services/terrain-model.js";
import { renderTerrainMap } from "./src/services/terrain-render.js";

const FRAMES = 40;
const VP_W = 120;
const VP_H = 40;

const cam = { x: 10, y: 10, yaw: Math.atan2(30, 30) };

// ── Warmup ────────────────────────────────────────────────────────────────
const terrain = createTerrainMap({ width: 80, height: 80, seed: 42, terrainIdx: 0, seaLevel: 0.4, vegetationEnabled: true });
for (let i = 0; i < 5; i++) {
  renderTerrainMap(terrain, { mode: "firstperson", levels: 8, tags: true,
    camera: { centerX: cam.x, centerY: cam.y, width: VP_W, height: VP_H },
    firstPersonCamera: cam });
}

// ── Bench 1: pure raycaster ───────────────────────────────────────────────
const t0 = performance.now();
for (let i = 0; i < FRAMES; i++) {
  renderTerrainMap(terrain, { mode: "firstperson", levels: 8, tags: true,
    camera: { centerX: cam.x, centerY: cam.y, width: VP_W, height: VP_H },
    firstPersonCamera: cam });
}
const raycasterMs = (performance.now() - t0) / FRAMES;

// ── Bench 2: full round-trip (createTerrainMap + render) ─────────────────
for (let i = 0; i < 3; i++) {
  const t = createTerrainMap({ width: 80, height: 80, seed: 42, terrainIdx: 0, seaLevel: 0.4, vegetationEnabled: true });
  renderTerrainMap(t, { mode: "firstperson", levels: 8, tags: true,
    camera: { centerX: cam.x, centerY: cam.y, width: VP_W, height: VP_H },
    firstPersonCamera: cam });
}
const t1 = performance.now();
for (let i = 0; i < FRAMES; i++) {
  const t = createTerrainMap({ width: 80, height: 80, seed: 42, terrainIdx: 0, seaLevel: 0.4, vegetationEnabled: true });
  renderTerrainMap(t, { mode: "firstperson", levels: 8, tags: true,
    camera: { centerX: cam.x, centerY: cam.y, width: VP_W, height: VP_H },
    firstPersonCamera: cam });
}
const fullMs = (performance.now() - t1) / FRAMES;

const frameUs = Math.round(raycasterMs * 1000);
const fullUs  = Math.round(fullMs * 1000);

console.log(`METRIC frame_µs=${frameUs}`);
console.log(`METRIC full_µs=${fullUs}`);
console.log(`raycaster: ${raycasterMs.toFixed(2)}ms/frame (~${Math.round(1000/raycasterMs)}fps)`);
console.log(`full:      ${fullMs.toFixed(2)}ms/frame (~${Math.round(1000/fullMs)}fps)  terrain_overhead=${fullUs - frameUs}µs`);
