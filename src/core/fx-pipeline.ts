/**
 * fx-pipeline.ts — FX script execution and smear text-surface pipeline.
 *
 * Extracted from app-controller.ts (E043 Phase 1).
 * Pure-ish functions that resolve sources, run external FX scripts,
 * and open the result in a viewer window.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { REPO_ROOT } from "./config.js";
import { safeReadFile } from "./safe-fs.js";
import { measurePlainTextContent, measurePrimerContent, type ContentMeasurement } from "../services/content-measurement.js";
import type { WindowKind, WindowRecord } from "./types.js";
import type { WindowManager } from "./window-manager.js";
import type { OverlayManager } from "./overlay-manager.js";

// ── Types ────────────────────────────────────────────────────────────────────

export interface FxPipelineDeps {
  windowManager: WindowManager;
  overlays: OverlayManager;
  openTextViewer: (
    title: string,
    content: string,
    kind: "primer" | "reader",
    filePath?: string,
    options?: { contentMeasurement?: ContentMeasurement },
  ) => WindowRecord | undefined;
  openPrimer: (filePath: string) => WindowRecord | undefined;
}

export type SmearResult =
  | {
      ok: true;
      filePath: string;
      windowId?: number;
      sourcePath: string;
      kind: "primer" | "reader";
      mode: string;
    }
  | { ok: false; error: string };

export type FxRunResult =
  | { ok: true; filePath: string; windowId?: number }
  | { ok: false; error: string };

// ── Source resolution ────────────────────────────────────────────────────────

export function resolveSmearSource(
  windowManager: WindowManager,
  args?: Record<string, unknown>,
): {
  sourcePath: string;
  outputKind: "primer" | "reader";
  sourceKind: WindowKind;
} | { error: string } {
  const explicitFilePath =
    typeof args?.filePath === "string" && args.filePath.trim()
      ? args.filePath.trim()
      : undefined;
  const openAs =
    args?.openAs === "primer" || args?.openAs === "reader"
      ? args.openAs
      : undefined;

  if (explicitFilePath) {
    return {
      sourcePath: explicitFilePath,
      outputKind: openAs ?? "reader",
      sourceKind: openAs ?? "reader",
    };
  }

  const focused = windowManager.getFocusedWindow();
  if (!focused) {
    return { error: "No focused window and no filePath provided." };
  }
  if (!focused.filePath) {
    return { error: "Focused window is not file-backed. Pass filePath explicitly." };
  }
  if (focused.kind !== "primer" && focused.kind !== "reader" && focused.kind !== "editor") {
    return { error: `Focused window kind "${focused.kind}" is not smearable.` };
  }
  return {
    sourcePath: focused.filePath,
    outputKind: openAs ?? (focused.kind === "primer" ? "primer" : "reader"),
    sourceKind: focused.kind,
  };
}

// ── FX script runner ─────────────────────────────────────────────────────────

export function runFxScript(
  deps: FxPipelineDeps,
  fx: "glitch" | "shear" | "breed" | "flip",
  args?: Record<string, unknown>,
): FxRunResult {
  const { execSync } = require("node:child_process");
  const outDir = path.join(REPO_ROOT, "scratch", "generated", "fx");
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = Date.now();
  const outPath = path.join(outDir, `${fx}-${stamp}.txt`);

  try {
    let cmd: string;
    const fxDir = path.join(REPO_ROOT, "scripts", "fx");

    switch (fx) {
      case "glitch": {
        const filePath = String(args?.filePath ?? "");
        if (!filePath) return { ok: false, error: "fx.glitch requires filePath" };
        const intensity = Number(args?.intensity ?? 0.5);
        const seed = args?.seed != null ? Number(args.seed) : Math.floor(Math.random() * 10000);
        cmd = `cat "${filePath}" | "${fxDir}/glitch" ${intensity} ${seed} > "${outPath}"`;
        break;
      }
      case "shear": {
        const filePath = String(args?.filePath ?? "");
        if (!filePath) return { ok: false, error: "fx.shear requires filePath" };
        const skew = Number(args?.skew ?? 2);
        cmd = `cat "${filePath}" | "${fxDir}/shear" ${skew} > "${outPath}"`;
        break;
      }
      case "breed": {
        const file1 = String(args?.file1 ?? "");
        const file2 = String(args?.file2 ?? "");
        if (!file1 || !file2) return { ok: false, error: "fx.breed requires file1 and file2" };
        const mode = String(args?.mode ?? "xor");
        const bias = Number(args?.bias ?? 0.5);
        const seed = args?.seed != null ? Number(args.seed) : 42;
        cmd = `python3 "${fxDir}/breed" "${file1}" "${file2}" --mode ${mode} --bias ${bias} --seed ${seed} --out "${outPath}"`;
        break;
      }
      case "flip": {
        const filePath = String(args?.filePath ?? "");
        if (!filePath) return { ok: false, error: "fx.flip requires filePath" };
        const direction = String(args?.direction ?? "v");
        cmd = `cat "${filePath}" | "${fxDir}/flip" ${direction} > "${outPath}"`;
        break;
      }
    }

    execSync(cmd, { timeout: 10000 });

    if (!fs.existsSync(outPath) || fs.statSync(outPath).size === 0) {
      return { ok: false, error: `FX ${fx} produced no output` };
    }

    const win = deps.openPrimer(outPath);
    return { ok: true, filePath: outPath, windowId: win?.id };
  } catch (err: unknown) {
    return { ok: false, error: `FX ${fx} failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// ── Smear pipeline ───────────────────────────────────────────────────────────

export function smearTextSurface(
  deps: FxPipelineDeps,
  args?: Record<string, unknown>,
): SmearResult {
  const resolved = resolveSmearSource(deps.windowManager, args);
  if ("error" in resolved) {
    deps.overlays.flash(resolved.error);
    return { ok: false, error: resolved.error };
  }

  const { sourcePath, outputKind } = resolved;
  if (!fs.existsSync(sourcePath)) {
    const error = `File not found: ${sourcePath}`;
    deps.overlays.flash(error);
    return { ok: false, error };
  }

  const scriptPath = path.join(REPO_ROOT, "scripts", "smear.py");
  if (!fs.existsSync(scriptPath)) {
    const error = `Smear script not found: ${scriptPath}`;
    deps.overlays.flash(error);
    return { ok: false, error };
  }

  const allowedModes = new Set(["wipe", "shear", "glitch", "stretch", "frames"]);
  const mode =
    typeof args?.mode === "string" && allowedModes.has(args.mode)
      ? args.mode
      : "wipe";

  const generatedDir = path.join(REPO_ROOT, "scratch", "generated", "smear");
  fs.mkdirSync(generatedDir, { recursive: true });
  const slug = path.basename(sourcePath, path.extname(sourcePath)).replace(/[^a-zA-Z0-9_-]/g, "_");
  const outputPath =
    typeof args?.outPath === "string" && args.outPath.trim()
      ? args.outPath.trim()
      : path.join(generatedDir, `${slug}-${mode}-${Date.now()}.txt`);

  const cmdArgs = [scriptPath, sourcePath, "--mode", mode, "--out", outputPath];
  const numericArg = (name: string) =>
    typeof args?.[name] === "number" && Number.isFinite(args[name] as number)
      ? String(args[name])
      : undefined;

  const maybeWidth = numericArg("width");
  const maybeAt = numericArg("at");
  const maybeTile = numericArg("tile");
  const maybeSkew = numericArg("skew");
  const maybeSeed = numericArg("seed");
  const maybeIntensity = numericArg("intensity");
  const maybeFrom = numericArg("from");
  const maybeTo = numericArg("to");
  const maybeSteps = numericArg("steps");
  const maybeOutdir =
    typeof args?.outdir === "string" && args.outdir.trim()
      ? args.outdir.trim()
      : undefined;

  if (maybeWidth) cmdArgs.push("--width", maybeWidth);
  if (maybeAt) cmdArgs.push("--at", maybeAt);
  if (maybeTile) cmdArgs.push("--tile", maybeTile);
  if (maybeSkew) cmdArgs.push("--skew", maybeSkew);
  if (maybeSeed) cmdArgs.push("--seed", maybeSeed);
  if (maybeIntensity) cmdArgs.push("--intensity", maybeIntensity);
  if (maybeFrom) cmdArgs.push("--from", maybeFrom);
  if (maybeTo) cmdArgs.push("--to", maybeTo);
  if (maybeSteps) cmdArgs.push("--steps", maybeSteps);
  if (maybeOutdir) cmdArgs.push("--outdir", maybeOutdir);

  try {
    execFileSync("python3", cmdArgs, {
      cwd: REPO_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
    });
  } catch (error) {
    const stderr =
      error instanceof Error && "stderr" in error && typeof error.stderr === "string"
        ? error.stderr.trim()
        : error instanceof Error
          ? error.message
          : String(error);
    const message = `Smear failed: ${stderr || "unknown error"}`;
    deps.overlays.flash(message);
    return { ok: false, error: message };
  }

  if (!fs.existsSync(outputPath)) {
    const error = `Smear output missing: ${outputPath}`;
    deps.overlays.flash(error);
    return { ok: false, error };
  }

  const title = path.basename(outputPath);
  const rawContent = safeReadFile(outputPath) ?? "";
  const opened = outputKind === "primer"
    ? deps.openTextViewer(
        title,
        rawContent,
        "primer",
        outputPath,
        { contentMeasurement: measurePrimerContent(rawContent).measurement },
      )
    : deps.openTextViewer(
        title,
        rawContent,
        "reader",
        outputPath,
        { contentMeasurement: measurePlainTextContent(rawContent).measurement },
      );

  deps.overlays.flash(`Smeared ${path.basename(sourcePath)} → ${path.basename(outputPath)}`);
  return {
    ok: true,
    filePath: outputPath,
    windowId: opened?.id,
    sourcePath,
    kind: outputKind,
    mode,
  };
}
