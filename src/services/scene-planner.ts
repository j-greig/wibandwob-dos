/**
 * Scene Planner — diff desired scene state against live desktop state.
 *
 * Given a target SceneDefinition and the current DesktopState, produces
 * an ordered list of operations (close, open, move/resize, theme change)
 * that transition the desktop to the desired state.
 *
 * The planner matches existing windows to scene roles by appType + content.
 * Unmatched existing windows get closed. Unmatched scene windows get opened.
 * Matched windows get moved/resized if their geometry differs.
 */

import type { DesktopState, DesktopWindowState } from "../core/types.js";
import type { SceneDefinition, SceneWindow } from "./timeline-types.js";
import type { ResolvedRect } from "./scene-layout.js";
import { resolveLayout, type DesktopBounds } from "./scene-layout.js";

// ---------------------------------------------------------------------------
// Operation types — what the runner executes
// ---------------------------------------------------------------------------

export interface OpClose {
  type: "close";
  windowId: number;
}

export interface OpOpen {
  type: "open";
  role: string;
  window: SceneWindow;
  rect: ResolvedRect;
}

export interface OpMove {
  type: "move";
  windowId: number;
  role: string;
  rect: ResolvedRect;
}

export interface OpTheme {
  type: "theme";
  name: string;
}

export interface OpCommand {
  type: "command";
  id: string;
  args?: Record<string, unknown>;
}

export type SceneOp = OpClose | OpOpen | OpMove | OpTheme | OpCommand;

// ---------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------

export interface PlanOptions {
  /** Roles to never close (e.g. "agent"). */
  protect?: string[];
}

/**
 * Role-to-window matching.
 * For primers: match by file path.
 * For figlets: match by appType "figlet-banner".
 * For generic: match by appType.
 */
function matchWindowToRole(
  win: DesktopWindowState,
  sceneWin: SceneWindow,
): boolean {
  const open = sceneWin.open;
  switch (open.type) {
    case "primer":
      return win.appType === "primer-viewer" && !!win.filePath?.endsWith(open.file);
    case "figlet":
      return win.appType === "figlet-banner";
    case "art":
      return win.appType === "generative-art";
    case "pattern":
      return win.appType === "pattern-animation";
    case "contour":
      return win.appType === "contour-studio";
    case "companion":
      return win.appType === "companion-widget";
    case "command":
      return false; // commands don't match existing windows
  }
}

/**
 * Plan the transition from current desktop state to a target scene.
 *
 * Execution order: theme → close → open → move/resize
 */
export function planSceneTransition(
  current: DesktopState,
  scene: SceneDefinition,
  bounds: DesktopBounds,
  opts?: PlanOptions,
): SceneOp[] {
  const ops: SceneOp[] = [];
  const protectedRoles = new Set(opts?.protect ?? ["agent"]);

  // Track which current windows are claimed by scene roles
  const claimed = new Set<number>();
  // Track which scene windows matched an existing window
  const matched = new Map<string, { windowId: number; sceneWin: SceneWindow }>();

  // Phase 1: match scene windows to existing windows
  for (const sceneWin of scene.windows) {
    for (const win of current.windows) {
      if (claimed.has(win.id)) continue;
      if (matchWindowToRole(win, sceneWin)) {
        claimed.add(win.id);
        matched.set(sceneWin.role, { windowId: win.id, sceneWin });
        break;
      }
    }
  }

  // Phase 2: theme change
  if (scene.theme && scene.theme !== current.app.theme) {
    ops.push({ type: "theme", name: scene.theme });
  }

  // Phase 3: close unclaimed windows (except protected)
  for (const win of current.windows) {
    if (claimed.has(win.id)) continue;
    // Protect agent windows and any explicitly listed appType or kind.
    // protect: ["agent"] matches kind="agent" (chat window).
    // protect: ["wibwob-agent"] or protect: ["chat"] also work.
    const isProtected =
      win.appType === "wibwob-agent" ||
      protectedRoles.has(win.appType ?? "") ||
      protectedRoles.has(win.kind ?? "");
    if (!isProtected) {
      ops.push({ type: "close", windowId: win.id });
    }
  }

  // Phase 4: open unmatched scene windows, move/resize matched ones
  for (const sceneWin of scene.windows) {
    const rect = resolveLayout(sceneWin.layout, bounds);
    const match = matched.get(sceneWin.role);

    if (match) {
      // Check if geometry changed
      const w = current.windows.find((win) => win.id === match.windowId);
      if (w && (w.left !== rect.x || w.top !== rect.y || w.width !== rect.w || w.height !== rect.h)) {
        ops.push({ type: "move", windowId: match.windowId, role: sceneWin.role, rect });
      }
    } else {
      ops.push({ type: "open", role: sceneWin.role, window: sceneWin, rect });
    }
  }

  return ops;
}
