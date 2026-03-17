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
import * as fs from "node:fs";
import * as path from "node:path";

const BENCH_DIR = path.join(process.cwd(), "scratch", "ptc-bench", "runs");

interface ToolCallRecord {
  name: string;
  resultBytes: number;
  timestamp: number;
  sandboxed?: boolean;
}

export default function ptcBench(pi: ExtensionAPI) {
  // Only activate when PTC_BENCH_ID is set (via run-test.sh)
  // Otherwise this extension bleeds into every pi session in the repo
  if (!process.env.PTC_BENCH_ID) return;

  let toolCalls: ToolCallRecord[] = [];
  let turnCount = 0;
  let executeCodeCalls = 0;
  let executeCodeOutputBytes = 0;
  let startTime = 0;

  let payloadSizes: number[] = [];

  pi.on("agent_start", async () => {
    toolCalls = [];
    turnCount = 0;
    executeCodeCalls = 0;
    executeCodeOutputBytes = 0;
    payloadSizes = [];
    startTime = Date.now();
  });

  // Track actual payload size sent to the LLM API — this is ground truth
  pi.on("before_provider_request", (event) => {
    const size = JSON.stringify(event.payload).length;
    payloadSizes.push(size);
  });

  pi.on("turn_start", async () => {
    turnCount++;
  });

  // Track whether we're inside an execute_code call
  let insideExecuteCode = false;
  let sandboxedBytes = 0;

  pi.on("tool_execution_start", async (event) => {
    if (event.toolName === "execute_code") {
      insideExecuteCode = true;
    }
  });

  pi.on("tool_execution_end", async (event) => {
    if (event.toolName === "execute_code") {
      insideExecuteCode = false;
    }
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
      sandboxed: insideExecuteCode && event.toolName !== "execute_code",
    });

    if (event.toolName === "execute_code") {
      executeCodeCalls++;
      executeCodeOutputBytes += bytes;
    }

    if (insideExecuteCode && event.toolName !== "execute_code") {
      sandboxedBytes += bytes;
    }
  });

  pi.on("agent_end", async (_event, ctx) => {
    const elapsed = Date.now() - startTime;
    const totalCalls = toolCalls.length;
    const directCalls = toolCalls.filter((t) => t.name !== "execute_code" && !t.sandboxed);
    const sandboxedCalls = toolCalls.filter((t) => t.sandboxed);
    const totalResultBytes = toolCalls.reduce((sum, t) => sum + t.resultBytes, 0);
    const directResultBytes = directCalls.reduce((sum, t) => sum + t.resultBytes, 0);
    sandboxedBytes = sandboxedCalls.reduce((sum, t) => sum + t.resultBytes, 0);
    const contextBytes = directResultBytes + executeCodeOutputBytes; // what actually hit LLM context

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
      `║ → In context:       ${formatBytes(contextBytes).padStart(10)}         ║`,
      `║ → In sandbox:       ${formatBytes(sandboxedBytes).padStart(10)}         ║`,
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

    const peakPayload = payloadSizes.length > 0 ? Math.max(...payloadSizes) : 0;
    const totalPayload = payloadSizes.reduce((a, b) => a + b, 0);

    lines.push("╠══════════════════════════════════════════╣");
    lines.push("║ API payload (ground truth):               ║");
    lines.push(`║  Peak request size:  ${formatBytes(peakPayload).padStart(10)}         ║`);
    lines.push(`║  Total across turns: ${formatBytes(totalPayload).padStart(10)}         ║`);
    lines.push(`║  Requests:           ${String(payloadSizes.length).padStart(10)}         ║`);

    if (executeCodeCalls > 0 && directCalls.length > 0) {
      lines.push("╠══════════════════════════════════════════╣");
      lines.push("║ ⚠ Mixed mode: both PTC and direct calls  ║");
    }

    lines.push("╚══════════════════════════════════════════╝");

    // Print to stderr so it doesn't pollute agent output
    for (const line of lines) {
      process.stderr.write(line + "\n");
    }

    // Write structured JSON to bench file for reproducibility
    try {
      fs.mkdirSync(BENCH_DIR, { recursive: true });
      const benchId = process.env.PTC_BENCH_ID || `run-${Date.now()}`;
      const benchFile = path.join(BENCH_DIR, `${benchId}.bench.json`);
      const benchData = {
        id: benchId,
        timestamp: new Date().toISOString(),
        elapsed,
        turnCount,
        totalCalls,
        executeCodeCalls,
        directCalls: directCalls.length,
        sandboxedCalls: sandboxedCalls.length,
        totalResultBytes,
        contextBytes,
        sandboxedBytes,
        executeCodeOutputBytes,
        directResultBytes,
        contextReduction: totalResultBytes > 0 ? `${Math.round((1 - contextBytes / totalResultBytes) * 100)}%` : "N/A",
        peakPayloadBytes: peakPayload,
        totalPayloadBytes: totalPayload,
        payloadRequests: payloadSizes.length,
        byTool,
        toolCalls: toolCalls.map(t => ({ name: t.name, bytes: t.resultBytes, sandboxed: !!t.sandboxed })),
      };
      fs.writeFileSync(benchFile, JSON.stringify(benchData, null, 2));
      process.stderr.write(`\nBench data written to: ${benchFile}\n`);
    } catch (e) {
      process.stderr.write(`\nFailed to write bench file: ${e}\n`);
    }
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
