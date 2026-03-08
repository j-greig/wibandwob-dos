/**
 * Module Observatory — live runtime dashboard.
 *
 * Tree view of module hierarchy, sparklines of window/command counts,
 * reload button per module. Polls /modules/list every 2s.
 */

import type { MicroappHost } from "#sdk";

interface ModuleEntry {
  name: string;
  version: string;
  status: string;
  loadedAt: string | null;
  commands: string[];
  windowIds: number[];
}

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Module Observatory",
    menu: [{ category: "applications", order: 50, label: "Module Observatory" }],
    palette: { order: 170 },
    action: () => {
      const win = host.createWindow({
        title: "Module Observatory",
        width: 72,
        height: 24,
      });

      let modules: ModuleEntry[] = [];
      let selected = 0;
      const cmdHistory: number[] = [];
      const winHistory: number[] = [];

      // Tree rendering
      function renderTree(): string {
        if (modules.length === 0) return "  (no modules loaded)";
        const lines: string[] = [];
        for (let i = 0; i < modules.length; i++) {
          const m = modules[i];
          const isLast = i === modules.length - 1;
          const connector = isLast ? "└── " : "├── ";
          const marker = i === selected ? "▸ " : "  ";
          const statusIcon = m.status === "loaded" ? "●" : m.status === "error" ? "✗" : "○";
          lines.push(`${marker}${connector}${statusIcon} ${m.name} v${m.version}`);
          const prefix = isLast ? "    " : "│   ";
          lines.push(`${marker}${prefix}  cmds: ${m.commands.length}  wins: ${m.windowIds.length}`);
        }
        return lines.join("\n");
      }

      // Sparkline rendering
      function renderSparkline(data: number[]): string {
        const chars = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
        if (data.length === 0) return "─";
        const max = Math.max(...data, 1);
        return data.map(v => chars[Math.round((v / max) * (chars.length - 1))]).join("");
      }

      function render() {
        const tree = renderTree();
        const cmdSpark = renderSparkline(cmdHistory.slice(-20));
        const winSpark = renderSparkline(winHistory.slice(-20));

        const content = [
          "╔══ Module Observatory ══╗",
          "",
          tree,
          "",
          `  Commands: ${cmdSpark}`,
          `  Windows:  ${winSpark}`,
          "",
          "  [r]eload  [↑↓]select  [q]uit",
        ].join("\n");

        win.body.setContent(content);
        host.screen.render();
      }

      async function poll() {
        try {
          const res = await fetch("http://127.0.0.1:8099/modules/list");
          if (res.ok) {
            modules = await res.json() as ModuleEntry[];
            cmdHistory.push(modules.reduce((s, m) => s + m.commands.length, 0));
            winHistory.push(modules.reduce((s, m) => s + m.windowIds.length, 0));
            if (cmdHistory.length > 60) cmdHistory.shift();
            if (winHistory.length > 60) winHistory.shift();
          }
        } catch { /* offline */ }
        render();
      }

      win.body.key(["up", "k"], () => {
        if (selected > 0) selected--;
        render();
      });
      win.body.key(["down", "j"], () => {
        if (selected < modules.length - 1) selected++;
        render();
      });
      win.body.key(["r"], async () => {
        const m = modules[selected];
        if (!m) return;
        try {
          await fetch("http://127.0.0.1:8099/modules/reload", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name: m.name }),
          });
          await poll();
        } catch { /* ignore */ }
      });
      win.body.key(["q", "escape"], () => win.close());
      win.onResize(render);

      poll();
      const timer = setInterval(poll, 2000);
      win.onCleanup(() => clearInterval(timer));

      win.describeState(() => ({
        summary: `Module Observatory — ${modules.length} modules`,
        moduleCount: modules.length,
        selected: modules[selected]?.name,
      }));
    },
  });
}
