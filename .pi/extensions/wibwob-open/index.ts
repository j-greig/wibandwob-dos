/**
 * wibwob-open — Route file/directory opens to WibWob-DOS if running.
 *
 * Registers a `wibwob_open` tool that uses the WibWob Router for smart
 * file-type → command mapping and instance discovery via unix sockets.
 * Falls back to system `open` if WibWob-DOS isn't running.
 *
 * @see lib/wibwob-router.ts — shared routing logic
 * @see .planning/epics/e046-deep-linking-into-wibwobdos/e046-brief.md
 */
import { Type } from "@sinclair/typebox";

export default function register(pi: any) {
  pi.registerTool({
    name: "wibwob_open",
    description:
      "Open a file or directory in WibWob-DOS (if running) or the system default. " +
      "Files route to the right app: .md → markdown viewer, code → editor, " +
      "directories → file browser. Supports app hint override.",
    parameters: Type.Object({
      path: Type.String({ description: "Absolute path to file or directory" }),
      app: Type.Optional(
        Type.Union([
          Type.Literal("editor"),
          Type.Literal("finder"),
          Type.Literal("markdown"),
          Type.Literal("primer"),
        ], { description: "Force a specific WibWob-DOS app instead of auto-detecting from extension" }),
      ),
      line: Type.Optional(
        Type.Number({ description: "Line number to jump to (editor only)" }),
      ),
    }),
    execute: async (args: { path: string; app?: string; line?: number }) => {
      let route: any, discoverInstance: any, dispatch: any;
      try {
        const mod = await import("../../../lib/wibwob-router.js");
        route = mod.route; discoverInstance = mod.discoverInstance; dispatch = mod.dispatch;
      } catch {
        // Router not available — fall through to system open below
      }

      const result = route ? route({
        path: args.path,
        app: args.app as "editor" | "finder" | "markdown" | "primer" | undefined,
        line: args.line,
      }) : null;

      if (!result && route) {
        return `Cannot route: ${args.path}`;
      }

      // Discover WibWob-DOS instance (sockets first, then port scan)
      const pathMod = await import("node:path");
      const url = await import("node:url");
      const __dirname = pathMod.dirname(url.fileURLToPath(import.meta.url));
      const projectRoot = pathMod.resolve(__dirname, "../../..");
      const instance = await discoverInstance(projectRoot);

      if (instance && result && dispatch) {
        const ok = await dispatch(instance, result);
        if (ok) {
          const cmds = result.commands.map((c: { id: string }) => c.id).join(" → ");
          return `Opened in WibWob-DOS (${cmds}): ${args.path}`;
        }
        // Dispatch failed — fall through to system open
      }

      // Fallback: system open
      const { execSync } = await import("node:child_process");
      try {
        if (process.platform === "darwin") {
          execSync(`open ${JSON.stringify(args.path)}`);
        } else {
          execSync(`xdg-open ${JSON.stringify(args.path)} 2>/dev/null`);
        }
        return `Opened with system default: ${args.path}`;
      } catch (err) {
        return `Failed to open: ${err}`;
      }
    },
  });
}
