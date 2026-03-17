/**
 * ptc-bench.ts — Measurement harness for PTC token savings
 *
 * Tracks tool calls, result sizes, and turn counts per agent run.
 * Prints a summary at agent_end showing what PTC saved (or would save).
 *
 * Load alongside ptc.ts:
 *   pi -e .pi/extensions/ptc.ts -e .pi/extensions/ptc-bench.ts -p "<prompt>"
 *
 * Or without PTC to get baseline:
 *   pi -e .pi/extensions/ptc-bench.ts -p "<prompt>"
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

interface ToolCallRecord {
  name: string;
  resultBytes: number;
  timestamp: number;
}

export default function ptcBench(pi: ExtensionAPI) {
  let toolCalls: ToolCallRecord[] = [];
  let turnCount = 0;
  let executeCodeCalls = 0;
  let executeCodeOutputBytes = 0;
  let startTime = 0;

  pi.on("agent_start", async () => {
    toolCalls = [];
    turnCount = 0;
    executeCodeCalls = 0;
    executeCodeOutputBytes = 0;
    startTime = Date.now();
  });

  pi.on("turn_start", async () => {
    turnCount++;
  });

  pi.on("tool_result", async (event) => {
    const resultText = event.content
      ?.filter((c: any) => c.type === "text" && c.text)
      .map((c: any) => c.text)
      .join("\n") ?? "";

    const bytes = Buffer.byteLength(resultText, "utf-8");

    toolCalls.push({
      name: event.toolName,
      resultBytes: bytes,
      timestamp: Date.now(),
    });

    if (event.toolName === "execute_code") {
      executeCodeCalls++;
      executeCodeOutputBytes += bytes;
    }
  });

  pi.on("agent_end", async (_event, ctx) => {
    const elapsed = Date.now() - startTime;
    const totalCalls = toolCalls.length;
    const directCalls = toolCalls.filter((t) => t.name !== "execute_code");
    const totalResultBytes = toolCalls.reduce((sum, t) => sum + t.resultBytes, 0);
    const directResultBytes = directCalls.reduce((sum, t) => sum + t.resultBytes, 0);

    // Group by tool name
    const byTool: Record<string, { count: number; bytes: number }> = {};
    for (const t of toolCalls) {
      if (!byTool[t.name]) byTool[t.name] = { count: 0, bytes: 0 };
      byTool[t.name].count++;
      byTool[t.name].bytes += t.resultBytes;
    }

    const lines = [
      "",
      "╔══════════════════════════════════════════╗",
      "║         PTC BENCHMARK RESULTS            ║",
      "╠══════════════════════════════════════════╣",
      `║ Elapsed:        ${String(elapsed).padStart(8)}ms             ║`,
      `║ Turns:          ${String(turnCount).padStart(8)}               ║`,
      `║ Total calls:    ${String(totalCalls).padStart(8)}               ║`,
      `║ execute_code:   ${String(executeCodeCalls).padStart(8)}               ║`,
      `║ Direct calls:   ${String(directCalls.length).padStart(8)}               ║`,
      "╠══════════════════════════════════════════╣",
      `║ Total result bytes:  ${formatBytes(totalResultBytes).padStart(10)}         ║`,
      `║ execute_code output: ${formatBytes(executeCodeOutputBytes).padStart(10)}         ║`,
      `║ Direct tool output:  ${formatBytes(directResultBytes).padStart(10)}         ║`,
      "╠══════════════════════════════════════════╣",
      "║ Tool breakdown:                          ║",
    ];

    const sorted = Object.entries(byTool).sort((a, b) => b[1].bytes - a[1].bytes);
    for (const [name, stats] of sorted) {
      const line = `║  ${name.padEnd(20)} ${String(stats.count).padStart(3)}× ${formatBytes(stats.bytes).padStart(8)} ║`;
      lines.push(line);
    }

    if (executeCodeCalls > 0 && directCalls.length > 0) {
      lines.push("╠══════════════════════════════════════════╣");
      lines.push("║ ⚠ Mixed mode: both PTC and direct calls  ║");
    }

    lines.push("╚══════════════════════════════════════════╝");

    // Print to stderr so it doesn't pollute agent output
    for (const line of lines) {
      process.stderr.write(line + "\n");
    }
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
