/**
 * host-window-registry.ts — Declarative registry for host window types.
 *
 * Instead of 30+ private openXxxWindow() methods in app-controller.ts,
 * host windows are registered here with their factory, deps, and options.
 * The controller dispatches through this registry via openHostWindow().
 *
 * This is the host-side equivalent of microapp command registration.
 * Microapps register commands via host.registerCommand().
 * Host windows register via this registry.
 */

import type { WindowRecord } from "./types.js";

/** Dependencies injected from the controller into window factories. */
export interface HostWindowDeps {
  screen: any;
  windowManager: any;
  overlays: any;
  content: any;
  backrooms: any;
  editor: any;
  geometry: any;
  workspace: any;
  runtimeNode: any;
  state: any;
  runtimeCommands: any;
  runtimeInspection: any;
  runtimeWindows: any;
  runtimeWorkspace: any;
  invalidation: any;
  commands: any;
  scrambleBrain: any;
}

export interface HostWindowEntry {
  /** Unique window type key (matches AppType) */
  appType: string;
  /** Factory that creates the window. Receives deps + optional restore args. */
  factory: (deps: HostWindowDeps, restore?: Record<string, unknown>) => void;
  /** If false, focusOrCreate brings existing to front instead of creating new. Default: false */
  multiInstance?: boolean;
}

const registry = new Map<string, HostWindowEntry>();

/** Register a host window type. */
export function registerHostWindow(entry: HostWindowEntry): void {
  registry.set(entry.appType, entry);
}

/** Get a registered host window entry. */
export function getHostWindow(appType: string): HostWindowEntry | undefined {
  return registry.get(appType);
}

/** List all registered host window types. */
export function listHostWindows(): HostWindowEntry[] {
  return Array.from(registry.values());
}

/** Check if a host window type is registered. */
export function hasHostWindow(appType: string): boolean {
  return registry.has(appType);
}
