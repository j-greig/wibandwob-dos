import type { MicroappHost } from "../../src/services/microapp-sdk.js";

/**
 * File Manager — Finder-style file browser.
 *
 * This is a host-delegated microapp: the complex window implementation lives
 * in src/windows/file-manager-window.ts (uses internal APIs like WindowManager,
 * OverlayManager, browser-utils). The microapp wrapper registers commands and
 * delegates to the host's openFileManager capability.
 *
 * Teaches: host delegation pattern, describeState, captureText on host windows.
 */
export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Open File Manager",
    description:
      "Open the Finder-style file manager. Args: path (string, optional).",
    action: (args) => {
      const startPath = args?.path as string | undefined;
      // Delegate to the host's file manager opener via the command bus
      const result = host.runCommand("finder.open", startPath ? { path: startPath } : undefined);
      return result ?? { ok: true };
    },
  });

  // The host window already has describeState.
  // Register a state reader that finds the file-manager window.
  host.registerCommand({
    id: "state",
    label: "File Manager State",
    description: "Get the current state of the file manager window.",
    action: () => {
      const windows = host.windows.listWindows();
      const fm = windows.find((w: any) => w.kind === "browser" || w.appType === "file-manager");
      if (!fm) return { error: "No file manager window open" };
      const state = host.windows.describeWindow(fm.id);
      return state ?? { error: "Cannot describe window" };
    },
    palette: false,
    menu: false,
    direct: true,
  });
}
