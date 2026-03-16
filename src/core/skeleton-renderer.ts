/** A single cell in the webcam ASCII grid. Shared with webcam-renderer. */
export interface WebcamCell {
  ch: string;
  color?: string;
}

/** 33-point normalised pose — each coord is 0.0–1.0 of canvas size */
export type NormalisedLandmarks = [number, number][];

/** Standard MediaPipe pose topology — same as webcam-renderer's POSE_CONNECTIONS */
export const POSE_CONNECTIONS: [number, number][] = [
  [11, 12],
  [11, 13], [13, 15],
  [12, 14], [14, 16],
  [11, 23], [12, 24],
  [23, 24],
  [23, 25], [25, 27],
  [24, 26], [26, 28],
  [0, 11], [0, 12],
];

const FALLBACK_LANDMARK: [number, number] = [0.5, 0.5];

function makePreset(points: Record<number, [number, number]>): NormalisedLandmarks {
  const out: NormalisedLandmarks = Array.from({ length: 33 }, () => [...FALLBACK_LANDMARK] as [number, number]);
  for (const [index, point] of Object.entries(points)) {
    out[Number(index)] = [point[0], point[1]];
  }
  return out;
}

const IDLE_LANDMARKS = makePreset({
  0: [0.1, 0.18],
  11: [0.03, 0.34], 12: [0.17, 0.34],
  13: [0.01, 0.5], 14: [0.19, 0.5],
  15: [0, 0.66], 16: [0.2, 0.66],
  23: [0.05, 0.62], 24: [0.15, 0.62],
  25: [0.05, 0.79], 26: [0.15, 0.79],
  27: [0.05, 0.96], 28: [0.15, 0.96],
});

/**
 * Named pose presets. All coords normalised 0-1.
 * Key landmarks (MediaPipe indices):
 *   0=nose, 11=leftShoulder, 12=rightShoulder,
 *   13=leftElbow, 14=rightElbow, 15=leftWrist, 16=rightWrist,
 *   23=leftHip, 24=rightHip, 25=leftKnee, 26=rightKnee,
 *   27=leftAnkle, 28=rightAnkle
 * Fill unused landmarks (1-10, 17-22, 29-32) with [0.5, 0.5].
 */
export const POSE_PRESETS: Record<string, NormalisedLandmarks> = {
  // ── IDLE — subtle weight shift A→B→A ──────────────────────────────────────
  "idle":   IDLE_LANDMARKS,
  "idle-b": makePreset({            // slight lean right, arms relax
    0:  [0.11, 0.18],
    11: [0.04, 0.35], 12: [0.18, 0.34],
    13: [0.02, 0.52], 14: [0.21, 0.5],
    15: [0.01, 0.68], 16: [0.22, 0.67],
    23: [0.06, 0.63], 24: [0.16, 0.62],
    25: [0.06, 0.8],  26: [0.14, 0.8],
    27: [0.06, 0.97], 28: [0.14, 0.97],
  }),

  // ── ARMS-RAISED — reach up A→B→C (lift → full → slight apart) ────────────
  "arms-raised": makePreset({       // A: arms lifting, elbows still low
    0:  [0.1, 0.16],
    11: [0.03, 0.34], 12: [0.17, 0.34],
    13: [0.0,  0.26], 14: [0.21, 0.26],
    15: [0.0,  0.14], 16: [0.25, 0.14],
    23: [0.05, 0.62], 24: [0.15, 0.62],
    25: [0.05, 0.79], 26: [0.15, 0.79],
    27: [0.05, 0.96], 28: [0.15, 0.96],
  }),
  "arms-raised-b": makePreset({     // B: fully overhead, slightly wide
    0:  [0.1, 0.15],
    11: [0.02, 0.33], 12: [0.18, 0.33],
    13: [0.0,  0.18], 14: [0.22, 0.18],
    15: [0.0,  0.04], 16: [0.26, 0.04],
    23: [0.05, 0.61], 24: [0.15, 0.61],
    25: [0.05, 0.78], 26: [0.15, 0.78],
    27: [0.05, 0.95], 28: [0.15, 0.95],
  }),
  "arms-raised-c": makePreset({     // C: arms wide like a V — celebratory
    0:  [0.1, 0.15],
    11: [0.02, 0.33], 12: [0.18, 0.33],
    13: [-0.04, 0.2], 14: [0.26, 0.2],
    15: [-0.06, 0.08],16: [0.3,  0.08],
    23: [0.05, 0.61], 24: [0.15, 0.61],
    25: [0.05, 0.78], 26: [0.15, 0.78],
    27: [0.05, 0.95], 28: [0.15, 0.95],
  }),

  // ── STEP-LEFT — 3-frame weight transfer A→B→C ────────────────────────────
  "step-left": makePreset({         // A: beginning to shift
    0:  [0.1, 0.18],
    11: [0.03, 0.34], 12: [0.17, 0.34],
    13: [0.01, 0.5],  14: [0.2,  0.48],
    15: [0.0,  0.66], 16: [0.22, 0.62],
    23: [0.04, 0.62], 24: [0.16, 0.62],
    25: [0.0,  0.8],  26: [0.18, 0.78],
    27: [0.0,  0.88], 28: [0.2,  0.96],
  }),
  "step-left-b": makePreset({       // B: full weight left, right foot lifted
    0:  [0.08, 0.18],
    11: [0.01, 0.34], 12: [0.15, 0.34],
    13: [-0.01,0.5],  14: [0.18, 0.46],
    15: [-0.02,0.66], 16: [0.2,  0.6],
    23: [0.02, 0.62], 24: [0.13, 0.62],
    25: [0.0,  0.8],  26: [0.16, 0.72],
    27: [0.0,  0.97], 28: [0.18, 0.82],
  }),
  "step-left-c": makePreset({       // C: landing, arms counter-swing
    0:  [0.09, 0.18],
    11: [0.02, 0.34], 12: [0.16, 0.34],
    13: [0.04, 0.5],  14: [0.17, 0.5],
    15: [0.05, 0.66], 16: [0.18, 0.64],
    23: [0.03, 0.62], 24: [0.14, 0.62],
    25: [0.02, 0.79], 26: [0.15, 0.79],
    27: [0.01, 0.96], 28: [0.16, 0.96],
  }),

  // ── JUMP — 3-frame arc: crouch → peak → land ─────────────────────────────
  "jump": makePreset({              // A: crouch / wind-up
    0:  [0.1, 0.22],
    11: [0.03, 0.38], 12: [0.17, 0.38],
    13: [0.02, 0.5],  14: [0.19, 0.5],
    15: [0.02, 0.6],  16: [0.2,  0.6],
    23: [0.06, 0.64], 24: [0.15, 0.64],
    25: [0.07, 0.75], 26: [0.14, 0.75],
    27: [0.07, 0.85], 28: [0.14, 0.85],
  }),
  "jump-b": makePreset({            // B: peak — arms out wide, legs tucked
    0:  [0.1, 0.12],
    11: [0.02, 0.28], 12: [0.18, 0.28],
    13: [-0.02,0.32], 14: [0.26, 0.32],
    15: [-0.04,0.4],  16: [0.3,  0.4],
    23: [0.05, 0.52], 24: [0.15, 0.52],
    25: [0.03, 0.64], 26: [0.18, 0.64],
    27: [0.03, 0.74], 28: [0.18, 0.74],
  }),
  "jump-c": makePreset({            // C: landing — knees absorbing, arms down
    0:  [0.1, 0.2],
    11: [0.03, 0.36], 12: [0.17, 0.36],
    13: [0.01, 0.48], 14: [0.2,  0.48],
    15: [0.01, 0.58], 16: [0.21, 0.58],
    23: [0.05, 0.62], 24: [0.15, 0.62],
    25: [0.04, 0.73], 26: [0.16, 0.73],
    27: [0.04, 0.88], 28: [0.16, 0.88],
  }),

  // ── WAVE — 3-frame wrist rock: low → mid → high ──────────────────────────
  "wave": makePreset({              // A: arm raised, wrist low
    0:  [0.1, 0.18],
    11: [0.03, 0.34], 12: [0.17, 0.34],
    13: [0.01, 0.5],  14: [0.2,  0.26],
    15: [0.0,  0.66], 16: [0.22, 0.14],
    23: [0.05, 0.62], 24: [0.15, 0.62],
    25: [0.05, 0.79], 26: [0.15, 0.79],
    27: [0.05, 0.96], 28: [0.15, 0.96],
  }),
  "wave-b": makePreset({            // B: wrist out — peak wave
    0:  [0.1, 0.18],
    11: [0.03, 0.34], 12: [0.17, 0.34],
    13: [0.01, 0.5],  14: [0.21, 0.24],
    15: [0.0,  0.66], 16: [0.28, 0.12],
    23: [0.05, 0.62], 24: [0.15, 0.62],
    25: [0.05, 0.79], 26: [0.15, 0.79],
    27: [0.05, 0.96], 28: [0.15, 0.96],
  }),
  "wave-c": makePreset({            // C: wrist back in — completing the wave
    0:  [0.1, 0.18],
    11: [0.03, 0.34], 12: [0.17, 0.34],
    13: [0.01, 0.5],  14: [0.2,  0.24],
    15: [0.0,  0.66], 16: [0.24, 0.16],
    23: [0.05, 0.62], 24: [0.15, 0.62],
    25: [0.05, 0.79], 26: [0.15, 0.79],
    27: [0.05, 0.96], 28: [0.15, 0.96],
  }),
};

/**
 * Build a 33-point normalised landmark array from a named preset.
 * Returns IDLE_LANDMARKS if preset is unknown.
 */
export function landmarksFromPreset(preset: string): NormalisedLandmarks {
  const key = preset.trim().toLowerCase();
  const landmarks = POSE_PRESETS[key] ?? IDLE_LANDMARKS;
  return landmarks.map(([x, y]) => [x, y]);
}

function setCell(grid: WebcamCell[][], ry: number, rx: number, ch: string, color?: string): void {
  if (ry >= 0 && ry < grid.length && rx >= 0 && rx < (grid[ry]?.length ?? 0)) {
    grid[ry][rx] = { ch, color };
  }
}

function drawLine(
  grid: WebcamCell[][],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: string,
): void {
  if (!Number.isFinite(x0 + y0 + x1 + y1)) return; // NaN/Infinity guard
  let x = x0;
  let y = y0;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let maxIter = dx + dy + 2; // safety cap

  while (maxIter-- > 0) {
    setCell(grid, y, x, "·", color);
    if (x === x1 && y === y1) break;
    const e2 = err * 2;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

function projectLandmark(
  x: number,
  y: number,
  offsetX: number,
  offsetY: number,
  canvasW: number,
  canvasH: number,
): [number, number] {
  const px = offsetX + Math.round(Math.max(0, Math.min(1, x)) * Math.max(0, canvasW - 1));
  const py = offsetY + Math.round(Math.max(0, Math.min(1, y)) * Math.max(0, canvasH - 1));
  return [px, py];
}

/**
 * Paint a stick-figure skeleton onto an existing WebcamCell grid.
 * landmarks: 33 [x,y] pairs, normalised 0-1.
 * offsetX/Y: canvas position of this dancer (0-based).
 * canvasW/H: full grid dimensions (used for coordinate projection).
 * color: blessed colour name (e.g. "cyan", "yellow", "green").
 */
export function renderSkeletonAt(
  grid: WebcamCell[][],
  landmarks: NormalisedLandmarks,
  offsetX: number,
  offsetY: number,
  canvasW: number,
  canvasH: number,
  color: string,
): void {
  const points = landmarks.map(([x, y]) => projectLandmark(x, y, offsetX, offsetY, canvasW, canvasH));
  const visibleJoints = new Set<number>([0]);
  for (const [a, b] of POSE_CONNECTIONS) {
    visibleJoints.add(a);
    visibleJoints.add(b);
  }

  for (const [a, b] of POSE_CONNECTIONS) {
    const p0 = points[a];
    const p1 = points[b];
    if (!p0 || !p1) continue;
    drawLine(grid, p0[0], p0[1], p1[0], p1[1], color);
  }

  points.forEach(([x, y], i) => {
    if (!visibleJoints.has(i)) return;
    setCell(grid, y, x, i === 0 ? "◉" : "○", color);
  });
}
