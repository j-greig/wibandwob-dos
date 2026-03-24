/**
 * Ghostty shader control — thin wrapper over the ghostty-shader.sh script.
 * Owns the script path, parsing, and display-name formatting.
 */
import { execSync } from "node:child_process";
import { resolve } from "node:path";

const SCRIPT = resolve(process.cwd(), ".pi/skills/wibwobdos-control/scripts/ghostty-shader.sh");

function run(args: string): string {
  return execSync(`bash "${SCRIPT}" ${args}`, {
    timeout: 5000, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}

export function shaderSet(name: string): { ok: true; shader: string; action: string; output: string } | { ok: false; error: string } {
  if (!name) return { ok: false, error: "Missing shader name" };
  const action = name === "off" ? "off" : "on";
  const args = action === "on" ? `on ${name}` : "off";
  try {
    const output = run(args);
    return { ok: true, shader: name, action, output };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function shaderList(): string[] {
  try {
    return run("list").split(/\s+/).filter(Boolean);
  } catch {
    return [];
  }
}

export function shaderStatus(): { active: string | null; output: string } {
  try {
    const output = run("status");
    const match = output.match(/custom-shader\s*=\s*.*\/([^/]+)\.glsl/);
    return { active: match ? match[1] : null, output };
  } catch {
    return { active: null, output: "" };
  }
}

/** wibwob-cell-grid → Cell Grid */
export function shaderLabel(name: string): string {
  return name
    .replace(/^wibwob-/, "")
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
