/**
 * host-window-registry.ts — Declarative registry for host window types.
 *
 * Instead of 30+ private openXxxWindow() methods in app-controller.ts,
 * host windows register here. The controller dispatches via openHostWindow().
 */

import type * as blessed from "blessed";
import type { WindowManager } from "./window-manager.js";
import type { WindowRecord } from "./types.js";
import type { OverlayManager } from "./overlay-manager.js";
import type { ContentService } from "../services/content-service.js";
import type { BackroomsService } from "../services/backrooms-service.js";
import type { EditorCoordinator } from "./editor-coordinator.js";
import type { DesktopGeometryService } from "./desktop-geometry.js";
import type { RuntimeNodeDescriptor } from "../runtime/runtime-node.js";
import type { RuntimeCommandService } from "../application/runtime-command-service.js";
import type { RuntimeInspectionService } from "../application/runtime-inspection-service.js";
import type { RuntimeWindowService } from "../application/runtime-window-service.js";
import type { RuntimeWorkspaceService } from "../application/runtime-workspace-service.js";
import type { RenderScheduler } from "./render-scheduler.js";
import type { CommandRegistry } from "./command-registry.js";
import type { ScrambleBrain } from "../services/scramble-brain.js";

/** Standard deps available to all host window factories. */
export interface HostWindowDeps {
  screen: blessed.Widgets.Screen;
  windowManager: WindowManager;
  overlays: OverlayManager;
  content: ContentService;
  backrooms: BackroomsService;
  editor: EditorCoordinator;
  geometry: DesktopGeometryService;
  runtimeNode: RuntimeNodeDescriptor;
  runtimeCommands: RuntimeCommandService;
  runtimeInspection: RuntimeInspectionService;
  runtimeWindows: RuntimeWindowService;
  runtimeWorkspace: RuntimeWorkspaceService;
  invalidation: RenderScheduler;
  commands: CommandRegistry;
  scrambleBrain: ScrambleBrain;
  onStateChanged: () => void;
  openTextViewer: (title: string, content: string, kind: "primer" | "reader", filePath?: string) => void;
  openFile: (filePath: string) => void;
  flash: (msg: string) => void;
}

export interface HostWindowEntry {
  appType: string;
  factory: (deps: HostWindowDeps, restore?: Record<string, unknown>) => void;
  multiInstance?: boolean;
}

const registry = new Map<string, HostWindowEntry>();

export function registerHostWindow(entry: HostWindowEntry): void {
  registry.set(entry.appType, entry);
}

export function getHostWindow(appType: string): HostWindowEntry | undefined {
  return registry.get(appType);
}

export function listHostWindows(): HostWindowEntry[] {
  return Array.from(registry.values());
}

export function hasHostWindow(appType: string): boolean {
  return registry.has(appType);
}

/**
 * Open a registered host window, reusing an existing instance if singleton.
 *
 * This is the primary dispatch function — replaces 30+ `this.openXxxWindow()`
 * methods in app-controller. Returns the new or focused WindowRecord.
 */
export function openRegisteredWindow(
  appType: string,
  deps: HostWindowDeps,
  restore?: Record<string, unknown>,
): WindowRecord | undefined {
  const entry = registry.get(appType);
  if (!entry) return undefined;

  // Singleton: focus existing window if present
  if (!entry.multiInstance) {
    const existing = findWindowByAppType(deps.windowManager, appType);
    if (existing) {
      existing.focus();
      return existing;
    }
  }

  // Create new window
  const countBefore = deps.windowManager.getWindows().length;
  entry.factory(deps, restore);
  const windows = deps.windowManager.getWindows();
  if (windows.length > countBefore) {
    return windows[windows.length - 1];
  }
  return undefined;
}

/** Find an existing window by its appType (from describeState). */
function findWindowByAppType(wm: WindowManager, appType: string): WindowRecord | undefined {
  return [...wm.getWindows()]
    .reverse()
    .find((w) => w.describeState?.().appType === appType);
}
