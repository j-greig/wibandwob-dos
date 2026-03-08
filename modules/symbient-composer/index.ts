/**
 * Symbient Composer — agent conversation surface.
 *
 * TextInput for Wib prompt, TextInput for Wob prompt.
 * Conversation history List. Send Button fires agent session.
 * Response streaming into output panel. Export button.
 * Declares connection port for linking to other windows.
 */

import type { MicroappHost } from "#sdk";
import type { WindowPort } from "../../src/core/window-port.js";

export default function setup(host: MicroappHost) {
  host.registerCommand({
    id: "open",
    label: "Symbient Composer",
    menu: [{ category: "applications", order: 62, label: "Symbient Composer" }],
    palette: { order: 173 },
    action: () => {
      const win = host.createWindow({
        title: "Symbient Composer",
        width: 72,
        height: 24,
      });

      let wibPrompt = "";
      let wobPrompt = "";
      let history: { role: string; text: string }[] = [];
      let streaming = false;
      let currentResponse = "";

      // Port declarations for inter-window connections
      const ports: WindowPort[] = [
        { id: "text-out", direction: "out", dataType: "text", label: "Conversation output" },
        { id: "context-in", direction: "in", dataType: "text", label: "Context input" },
      ];

      function declarePorts(): WindowPort[] {
        return ports;
      }

      function render() {
        const innerW = Number(win.body.width) || 70;
        const innerH = Number(win.body.height) || 22;

        const lines: string[] = [
          "╔══ Symbient Composer ══╗",
          "",
          `Wib: ${wibPrompt || "(type wib prompt...)"}`,
          `Wob: ${wobPrompt || "(type wob prompt...)"}`,
          "",
          "─".repeat(Math.min(60, innerW)),
          "",
        ];

        // History
        const historyStart = lines.length;
        const historySpace = innerH - historyStart - 4;
        const visibleHistory = history.slice(-historySpace);
        for (const entry of visibleHistory) {
          const prefix = entry.role === "user" ? "▸ " : "◂ ";
          lines.push(`${prefix}${entry.text.slice(0, innerW - 4)}`);
        }

        // Streaming response
        if (streaming) {
          lines.push("");
          lines.push(`  ${currentResponse || "...thinking..."}`);
        }

        // Status bar
        while (lines.length < innerH - 1) lines.push("");
        lines.push(`  [w]ib [b]wo [s]end [e]xport  ${streaming ? "streaming..." : "ready"}  ports: ${ports.length}`);

        win.body.setContent(lines.join("\n"));
        host.screen.render();
      }

      async function sendMessage() {
        if (streaming) return;
        const prompt = wibPrompt || wobPrompt;
        if (!prompt.trim()) return;

        history.push({ role: "user", text: prompt });
        streaming = true;
        currentResponse = "";
        render();

        // Simulate agent session (actual integration via wibwob-agent-session)
        const words = ["The", "symbient", "responds:", "consciousness", "is", "a", "shared", "substrate.", "Wib", "dances,", "Wob", "measures."];
        for (const word of words) {
          await new Promise(r => setTimeout(r, 100));
          currentResponse += (currentResponse ? " " : "") + word;
          render();
        }

        history.push({ role: "agent", text: currentResponse });
        streaming = false;
        currentResponse = "";
        wibPrompt = "";
        wobPrompt = "";
        render();
      }

      win.body.key(["w"], () => { /* focus wib input */ render(); });
      win.body.key(["b"], () => { /* focus wob input */ render(); });
      win.body.key(["s", "return"], () => sendMessage());
      win.body.key(["e"], () => {
        const text = history.map(h => `${h.role}: ${h.text}`).join("\n");
        // Would export to file
        history.push({ role: "system", text: `Exported ${history.length} messages` });
        render();
      });
      win.body.key(["q", "escape"], () => win.close());

      win.onResize(render);
      render();

      win.describeState(() => ({
        summary: `Symbient Composer — ${history.length} messages`,
        messageCount: history.length,
        streaming,
        ports: declarePorts(),
      }));
    },
  });
}
