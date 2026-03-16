/**
 * mermaid-renderer — pi extension
 *
 * Hotloaded from: https://github.com/anis-dr/opencode-mermaid-renderer
 * Core: beautiful-mermaid (lukilabs/craft) → renderMermaidAscii
 *
 * Registers:
 *   - Tool: render_mermaid      — render any mermaid string to ASCII art
 *   - Command: /mermaid         — render mermaid from clipboard / args
 *   - Command: /arch            — draw WibWob-DOS software architecture
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

// Dynamically import so jiti resolves from this dir's node_modules
const { renderMermaidAscii } = await import("beautiful-mermaid");

// ──────────────────────────────────────────────────────────────
// WibWob-DOS architecture — Mermaid flowchart
// ──────────────────────────────────────────────────────────────
const WWDOS_ARCH = `graph TD
    subgraph Entry["Entry Point"]
        APP["src/app.ts\\nBun entrypoint"]
    end

    subgraph Core["Core (src/core/)"]
        AC["AppController\\ncomposition root"]
        CC["CommandCatalog\\nsource of truth"]
        CR["CommandRegistry\\nexecution + dispatch"]
        WF["WindowFacade\\n11-method interface"]
        WC["WindowChrome\\nchrome sizing math"]
        MR["MicroappRegistry\\ntier classification"]
        FS["SafeFs\\nfilesystem wrapper"]
    end

    subgraph Services["Services (src/services/)"]
        CA["ControlAPI\\nHTTP :8099"]
        SS["StateService\\nlive desktop state"]
        ML["MicroappLoader\\ndiscovery + host"]
        SDK["MicroappSDK\\nexport surface"]
    end

    subgraph UI["UI System (src/ui/)"]
        LAYOUT["layout"]
        CHROME["chrome"]
        FORMS["forms"]
        FEEDBACK["feedback"]
        PATTERNS["patterns"]
    end

    subgraph Microapps["Microapps (microapps/)"]
        MA1["wibwob.figlet\\nBanner"]
        MA2["wibwob.chat\\nWib&Wob Chat"]
        MA3["wibwob.art\\nGen Art"]
        MA4["wibwob.gallery\\nGallery"]
        MA5["wibwob.primer\\nPrimer"]
        MAn["...etc"]
    end

    subgraph Extensions["Pi Extensions (.pi/extensions/)"]
        EX1["control.ts"]
        EX2["wwdos-state.ts"]
        EX3["todos.ts"]
        EXn["...etc"]
    end

    APP --> AC
    AC --> CC
    AC --> CR
    AC --> WF
    AC --> SS
    AC --> CA
    AC --> ML
    CC --> CR
    CR --> WF
    WF --> WC
    ML --> MR
    ML --> SDK
    SDK --> MA1
    SDK --> MA2
    SDK --> MA3
    SDK --> MA4
    SDK --> MA5
    SDK --> MAn
    CA --> SS
    CA --> CR
    WF --> UI
    Extensions -.->|HTTP API| CA
    Extensions -.->|pi SDK| AC`;

// ──────────────────────────────────────────────────────────────

function renderMermaidBlocks(text: string): string {
  const REGEX = /```mermaid\n([\s\S]*?)```/g;
  return text.replace(REGEX, (_match, code: string) => {
    try {
      const ascii = renderMermaidAscii(code.trim());
      return "```\n" + ascii + "\n```";
    } catch (e) {
      const msg = ((e as Error).message ?? "unknown").replace(/--/g, "- -").replace(/>/g, "&gt;");
      return "```mermaid\n" + code + "\n```\n<!-- mermaid render failed: " + msg + " -->";
    }
  });
}

export default function (pi: ExtensionAPI) {
  // ── Tool: render_mermaid ────────────────────────────────────
  pi.registerTool({
    name: "render_mermaid",
    label: "Render Mermaid",
    description:
      "Render a Mermaid diagram string to ASCII art using beautiful-mermaid. " +
      "Supports: graph TD/LR/BT/RL, stateDiagram-v2, sequenceDiagram, classDiagram, erDiagram. " +
      "Returns the ASCII art as text.",
    parameters: Type.Object({
      diagram: Type.String({
        description: "The full Mermaid diagram source (without the ```mermaid fences)",
      }),
    }),
    async execute(_id, params, _signal, _onUpdate, _ctx) {
      try {
        const ascii = renderMermaidAscii(params.diagram.trim());
        return {
          content: [{ type: "text", text: ascii }],
          details: { ascii },
        };
      } catch (e) {
        const msg = (e as Error).message ?? "unknown error";
        return {
          content: [{ type: "text", text: `Mermaid render failed: ${msg}` }],
          details: { error: msg },
          isError: true,
        };
      }
    },
  });

  // ── Command: /arch ──────────────────────────────────────────
  pi.registerCommand("arch", {
    description: "Render WibWob-DOS software architecture as ASCII art",
    handler: async (_args, ctx) => {
      try {
        ctx.ui.notify("Rendering architecture diagram…", "info");
        const ascii = renderMermaidAscii(WWDOS_ARCH.trim());
        // Post the result as a message so it appears in the chat window
        pi.sendMessage(
          {
            customType: "mermaid-arch",
            content: "WibWob-DOS Software Architecture\n\n```\n" + ascii + "\n```",
            display: true,
          },
          { triggerTurn: false }
        );
        ctx.ui.notify("Architecture diagram rendered ✓", "info");
      } catch (e) {
        const msg = (e as Error).message ?? "unknown";
        ctx.ui.notify(`Render failed: ${msg}`, "error");
      }
    },
  });

  // ── Hook: auto-render mermaid blocks in assistant messages ──
  pi.on("message_end", async (event, _ctx) => {
    const msg = event.message;
    if (msg.role !== "assistant") return;
    // Check if any content block has mermaid fences
    for (const block of msg.content ?? []) {
      if (block.type === "text" && block.text.includes("```mermaid")) {
        // We can't mutate the message here — just notify user it's renderable
        // The render_mermaid tool is available for the LLM to call explicitly
        break;
      }
    }
  });

  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("mermaid-renderer loaded — /arch for WibWob-DOS map", "info");
  });
}
