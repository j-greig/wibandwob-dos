/**
 * GlitchBox Window — ASCII skeleton in a generative field.
 * Agent-driven poses, no camera, works on VPS.
 *
 * AC-1: opens with animated field + idle skeleton
 * AC-2: smooth ~8-frame interpolation between poses
 * AC-3: 5 visually distinct presets
 * AC-4: field focal point drifts toward skeleton centre of mass
 * AC-5: describeState() reports currentPreset + hasPose
 * AC-6: no camera, no Python
 */

import blessed from "blessed";
import { theme } from "../core/theme/resolver.js";
import { safeSetStyle } from "../core/ui-primitives.js";
import type { BaseWindowDeps } from "./misc-windows.js";

// ── Pose definitions ────────────────────────────────────────────────────────

/** Each pose is an array of strings — the skeleton rendered line by line. */
type PoseFrame = string[];

export type GlitchBoxPreset = "idle" | "arms-raised" | "step-left" | "jump" | "wave";

const POSE_FRAMES: Record<GlitchBoxPreset, PoseFrame> = {
  idle: [
    "  O  ",
    " /|\\ ",
    "  |  ",
    " / \\ ",
  ],
  "arms-raised": [
    " \\O/ ",
    "  |  ",
    "  |  ",
    " / \\ ",
  ],
  "step-left": [
    "  O  ",
    " /|  ",
    "  |  ",
    " / | ",
  ],
  jump: [
    " \\O/ ",
    "  |  ",
    "  |  ",
    "  \\u039B  ",
  ],
  wave: [
    "  O/ ",
    " /|  ",
    "  |  ",
    " / \\ ",
  ],
};

// Fix the jump frame — use actual Λ character
POSE_FRAMES.jump[3] = "  \u039B  ";

const PRESET_NAMES: GlitchBoxPreset[] = ["idle", "arms-raised", "step-left", "jump", "wave"];

/** Compute vertical centre of mass for a pose (row index, 0-based). */
function poseCentreOfMass(pose: PoseFrame): { cx: number; cy: number } {
  let totalWeight = 0;
  let sumX = 0;
  let sumY = 0;
  for (let y = 0; y < pose.length; y++) {
    for (let x = 0; x < pose[y].length; x++) {
      if (pose[y][x] !== " ") {
        totalWeight++;
        sumX += x;
        sumY += y;
      }
    }
  }
  if (totalWeight === 0) return { cx: 2, cy: 2 };
  return { cx: sumX / totalWeight, cy: sumY / totalWeight };
}

// ── Interpolation ───────────────────────────────────────────────────────────

const INTERP_FRAMES = 8;

interface InterpolationState {
  from: PoseFrame;
  to: PoseFrame;
  frame: number;
  total: number;
}

/**
 * Blend two pose frames using character-level crossfade.
 * At progress 0 → from, at progress 1 → to.
 */
function blendPoses(from: PoseFrame, to: PoseFrame, progress: number): PoseFrame {
  const maxRows = Math.max(from.length, to.length);
  const result: string[] = [];
  for (let y = 0; y < maxRows; y++) {
    const fromRow = from[y] ?? "     ";
    const toRow = to[y] ?? "     ";
    const maxCols = Math.max(fromRow.length, toRow.length);
    let row = "";
    for (let x = 0; x < maxCols; x++) {
      const fc = fromRow[x] ?? " ";
      const tc = toRow[x] ?? " ";
      if (fc === tc) {
        row += fc;
      } else if (progress < 0.5) {
        // First half: from char unless it's space and to isn't
        row += fc !== " " ? fc : (progress > 0.25 ? tc : fc);
      } else {
        // Second half: to char unless it's space and from isn't
        row += tc !== " " ? tc : (progress < 0.75 ? fc : tc);
      }
    }
    result.push(row);
  }
  return result;
}

// ── Generative field ────────────────────────────────────────────────────────

const FIELD_CHARS = "·:·~·:·~";

function renderField(
  tick: number,
  width: number,
  height: number,
  focalX: number,
  focalY: number,
): string[] {
  const rows: string[] = [];
  for (let y = 0; y < height; y++) {
    let row = "";
    for (let x = 0; x < width; x++) {
      // Distance from focal point influences pattern density
      const dx = (x - focalX) / width;
      const dy = (y - focalY) / height;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const wave1 = Math.sin((x + tick * 0.7) / 4.0);
      const wave2 = Math.cos((y - tick * 0.5) / 3.0);
      const wave3 = Math.sin((x + y + tick * 0.3) / 5.0);
      const focal = Math.cos(dist * 8 - tick * 0.2) * 0.5;

      const value = (wave1 + wave2 + wave3 + focal + 4) / 8;
      const idx = Math.floor(value * FIELD_CHARS.length) % FIELD_CHARS.length;
      row += FIELD_CHARS[idx];
    }
    rows.push(row);
  }
  return rows;
}

// ── Composite render ────────────────────────────────────────────────────────

function compositeLayers(
  field: string[],
  skeleton: PoseFrame,
  skeletonX: number,
  skeletonY: number,
): string {
  const result = field.map((row) => [...row]);
  for (let sy = 0; sy < skeleton.length; sy++) {
    const ry = skeletonY + sy;
    if (ry < 0 || ry >= result.length) continue;
    for (let sx = 0; sx < skeleton[sy].length; sx++) {
      const rx = skeletonX + sx;
      if (rx < 0 || rx >= result[ry].length) continue;
      const ch = skeleton[sy][sx];
      if (ch !== " ") {
        result[ry][rx] = ch;
      }
    }
  }
  return result.map((row) => row.join("")).join("\n");
}

// ── Window factory ──────────────────────────────────────────────────────────

export function openGlitchBoxWindow(deps: BaseWindowDeps): void {
  const { screen, windowManager } = deps;

  const frame = windowManager.createFrame("GlitchBox", "glitchbox");

  const canvas = blessed.box({
    parent: frame.body,
    top: 0,
    left: 0,
    right: 0,
    bottom: 1,
    style: theme().body,
  });

  const statusBar = blessed.box({
    parent: frame.body,
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    style: theme().header,
    content: " GlitchBox — idle",
  });

  // ── State ───────────────────────────────────────────────────────────────
  let currentPreset: GlitchBoxPreset = "idle";
  let currentPose: PoseFrame = POSE_FRAMES.idle;
  let interp: InterpolationState | null = null;
  let tick = 0;
  let focalX = 0.5;
  let focalY = 0.5;
  let targetFocalX = 0.5;
  let targetFocalY = 0.5;

  /** Set a new pose — starts interpolation from current to target. */
  const setPose = (preset: GlitchBoxPreset) => {
    if (!POSE_FRAMES[preset]) return;
    if (preset === currentPreset && !interp) return;
    interp = {
      from: currentPose,
      to: POSE_FRAMES[preset],
      frame: 0,
      total: INTERP_FRAMES,
    };
    currentPreset = preset;

    // Update focal target based on new pose centre of mass
    const com = poseCentreOfMass(POSE_FRAMES[preset]);
    const poseW = POSE_FRAMES[preset][0]?.length ?? 5;
    const poseH = POSE_FRAMES[preset].length;
    targetFocalX = com.cx / poseW;
    targetFocalY = com.cy / poseH;

    deps.onStateChanged?.();
  };

  // ── Render loop ─────────────────────────────────────────────────────────
  const timer = setInterval(() => {
    tick++;

    // Advance interpolation
    if (interp) {
      interp.frame++;
      const progress = interp.frame / interp.total;
      currentPose = blendPoses(interp.from, interp.to, progress);
      if (interp.frame >= interp.total) {
        currentPose = interp.to;
        interp = null;
      }
    }

    // Drift focal point toward target
    focalX += (targetFocalX - focalX) * 0.05;
    focalY += (targetFocalY - focalY) * 0.05;

    const w = Math.max(10, Number(canvas.width) || 40);
    const h = Math.max(6, Number(canvas.height) || 15);

    // Render field
    const fieldFx = focalX * w;
    const fieldFy = focalY * h;
    const field = renderField(tick, w, h, fieldFx, fieldFy);

    // Centre skeleton in the canvas
    const skelW = currentPose[0]?.length ?? 5;
    const skelH = currentPose.length;
    const skelX = Math.floor((w - skelW) / 2);
    const skelY = Math.floor((h - skelH) / 2);

    const content = compositeLayers(field, currentPose, skelX, skelY);
    canvas.setContent(content);

    statusBar.setContent(` GlitchBox — ${currentPreset}${interp ? " (moving)" : ""}`);
    screen.render();
  }, 100); // ~10fps

  // ── Window hooks ────────────────────────────────────────────────────────
  frame.describeState = () => ({
    appType: "glitchbox" as const,
    summary: `GlitchBox — ${currentPreset} pose`,
    currentPreset,
    hasPose: true,
    interpolating: interp !== null,
  });

  frame.cleanup = () => {
    clearInterval(timer);
  };

  frame.focus = () => {
    windowManager.focusWindow(frame);
    canvas.focus();
  };

  frame.onRestyle = () => {
    safeSetStyle(canvas, theme().body);
    safeSetStyle(statusBar, theme().header);
  };

  frame.captureText = () => canvas.getContent();

  // Keyboard — cycle through poses with 'p'
  for (const el of [canvas, frame.body]) {
    el.key(["p"], () => {
      const idx = PRESET_NAMES.indexOf(currentPreset);
      const next = PRESET_NAMES[(idx + 1) % PRESET_NAMES.length];
      setPose(next);
    });
  }

  windowManager.registerWindow(frame);
  frame.focus();

  // Expose setPose for the controller to call
  (frame as any)._glitchboxSetPose = setPose;
}

/** Helper to set pose on an existing GlitchBox window via frame reference. */
export function glitchboxSetPose(frame: any, preset: string): boolean {
  if (typeof frame?._glitchboxSetPose === "function" && PRESET_NAMES.includes(preset as any)) {
    frame._glitchboxSetPose(preset);
    return true;
  }
  return false;
}
