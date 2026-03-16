/**
 * host-window-registry.ts — Declarative registry for host window types.
 *
 * Instead of 30+ private openXxxWindow() methods in app-controller.ts,
 * host windows register here. The controller dispatches via openHostWindow().
 */

/** Standard deps available to all host window factories. */
export interface HostWindowDeps {
  screen: any;
  windowManager: any;
  overlays: any;
  content: any;
  backrooms: any;
  editor: any;
  geometry: any;
  runtimeNode: any;
  runtimeCommands: any;
  runtimeInspection: any;
  runtimeWindows: any;
  runtimeWorkspace: any;
  invalidation: any;
  commands: any;
  scrambleBrain: any;
  onStateChanged: () => void;
  openTextViewer: (title: string, content: string, kind: string, filePath?: string) => any;
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
