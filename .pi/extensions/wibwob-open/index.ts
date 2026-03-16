/**
 * wibwob-open — Route file/directory opens to WibWob-DOS if running.
 *
 * Registers a `wibwob_open` tool. If WibWob-DOS is alive on port 8099,
 * files open in the editor and directories navigate the file browser.
 * Falls back to macOS `open` if WibWob-DOS isn't running.
 */
import { Type } from "@sinclair/typebox";

export default function register(pi: any) {
  pi.registerTool({
    name: "wibwob_open",
    description:
      "Open a file or directory in WibWob-DOS (if running) or the system default. " +
      "Files open in the editor, directories open in the file browser.",
    parameters: Type.Object({
      path: Type.String({ description: "Absolute path to file or directory" }),
    }),
    execute: async (args: { path: string }) => {
      const filePath = args.path;

      // Check if WibWob-DOS is running
      let wibwobAlive = false;
      try {
        const res = await fetch("http://127.0.0.1:8099/health", {
          signal: AbortSignal.timeout(2000),
        });
        wibwobAlive = res.ok;
      } catch {
        wibwobAlive = false;
      }

      if (wibwobAlive) {
        // Determine if file or directory
        const fs = await import("node:fs");
        const isDir = fs.existsSync(filePath) && fs.statSync(filePath).isDirectory();

        const commandId = isDir ? "finder.open" : "editor.open";
        const cmdArgs = isDir ? {} : { filePath };

        try {
          const res = await fetch("http://127.0.0.1:8099/commands/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: commandId, args: cmdArgs }),
            signal: AbortSignal.timeout(5000),
          });
          const data = await res.json();
          return `Opened in WibWob-DOS (${commandId}): ${filePath}\n${JSON.stringify(data)}`;
        } catch (err) {
          return `WibWob-DOS alive but command failed: ${err}. Falling back to system open.`;
        }
      }

      // Fallback: system open
      const { execSync } = await import("node:child_process");
      try {
        execSync(`open ${JSON.stringify(filePath)}`);
        return `Opened with system default: ${filePath}`;
      } catch (err) {
        return `Failed to open: ${err}`;
      }
    },
  });
}
