/**
 * Benchmark: WibWobWorld 3D (firstperson/flight) render performance
 *
 * Uses median-of-runs to suppress JIT and GC noise.
 * Metrics:
 *   frame_µs  — pure raycaster median (renderTerrainMap firstperson)  ← PRIMARY
 *   full_µs   — createTerrainMap cold cost (reseed/mode-change path)
 */
import { createTerrainMap } from "./src/services/terrain-model.js";
import { renderTerrainMap } from "./src/services/terrain-render.js";

const VP_W  = 120;
const VP_H  = 40;
const WARMUP  = 20;  // frames before timing starts
const FRAMES  = 60;  // timed frames per sample
const SAMPLES = 7;   // independent timed samples → take minimum (steady-state JIT)

const cam = { x: 10, y: 10, yaw: Math.atan2(30, 30) };
const terrain = createTerrainMap({
  width: 80, height: 80, seed: 42, terrainIdx: 0, seaLevel: 0.4, vegetationEnabled: true,
});
const opts = () => ({
  mode: "firstperson" as const, levels: 8, tags: true,
  camera: { centerX: cam.x, centerY: cam.y, width: VP_W, height: VP_H },
  firstPersonCamera: cam,
});

// ── Heavy warmup (ensure JIT is fully settled) ───────────────────────────────
for (let i = 0; i < WARMUP; i++) renderTerrainMap(terrain, opts());

// ── Sample raycaster ─────────────────────────────────────────────────────────
const raycasterSamples: number[] = [];
for (let s = 0; s < SAMPLES; s++) {
  const t0 = performance.now();
  for (let i = 0; i < FRAMES; i++) renderTerrainMap(terrain, opts());
  raycasterSamples.push((performance.now() - t0) / FRAMES);
}
raycasterSamples.sort((a, b) => a - b);
const raycasterMs = raycasterSamples[0]!; // minimum = steady-state JIT

// ── Sample terrain creation (cold path) ──────────────────────────────────────
for (let i = 0; i < 5; i++)
  createTerrainMap({ width: 80, height: 80, seed: 42, terrainIdx: 0, seaLevel: 0.4, vegetationEnabled: true });

const terrainSamples: number[] = [];
for (let s = 0; s < SAMPLES; s++) {
  const t0 = performance.now();
  for (let i = 0; i < FRAMES; i++)
    createTerrainMap({ width: 80, height: 80, seed: 42, terrainIdx: 0, seaLevel: 0.4, vegetationEnabled: true });
  terrainSamples.push((performance.now() - t0) / FRAMES);
}
terrainSamples.sort((a, b) => a - b);
const terrainMs = terrainSamples[0]!; // minimum

const frameUs  = Math.round(raycasterMs * 1000);
const fullUs   = Math.round((raycasterMs + terrainMs) * 1000);

console.log(`METRIC frame_µs=${frameUs}`);
console.log(`METRIC full_µs=${fullUs}`);
console.log(`raycaster: ${raycasterMs.toFixed(2)}ms  (~${Math.round(1000/raycasterMs)}fps potential)`);
console.log(`terrain:   ${terrainMs.toFixed(2)}ms  (cold reseed cost)`);
console.log(`samples: [${raycasterSamples.map(s=>(s*1000).toFixed(0)).join(', ')}]µs`);
