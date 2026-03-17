/**
 * ptc.ts — Programmatic Tool Calling extension for pi
 *
 * Registers an `execute_code` tool that lets the LLM write JavaScript code
 * which calls pi's built-in tools programmatically inside a sandbox.
 * Only console.log() output returns to the LLM context — raw tool results
 * stay in the sandbox. This dramatically reduces token consumption for
 * multi-tool workflows (85%+ reduction measured on batch operations).
 *
 * The LLM writes code like:
 *   const files = await grep({ pattern: "TODO", path: "src/" });
 *   const parsed = JSON.parse(files);
 *   console.log(`Found ${parsed.length} TODOs`);
 *
 * Security note: node:vm is NOT a security boundary. The sandbox shares
 * process memory and filesystem with pi. This is fine — the LLM already
 * has bash() which is equally powerful. Don't mistake this for isolation.
 *
 * See: .planning/epics/e051-programmatic-tool-calling/README.md
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import * as vm from "node:vm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ToolDef {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
}

interface ToolResult {
  content: Array<{ type: string; text?: string }>;
  details?: Record<string, unknown>;
  isError?: boolean;
}

// ---------------------------------------------------------------------------
// Tool execution bridge
// ---------------------------------------------------------------------------

/**
 * Build the __callTool bridge function that execute_code's sandbox uses
 * to invoke real pi tools. Results return to the sandbox, NOT to LLM context.
 */
function buildToolBridge(
  allTools: ToolDef[],
  executeTool: (name: string, params: Record<string, unknown>) => Promise<ToolResult>
) {
  const toolNames = new Set(allTools.map((t) => t.name));

  return async function __callTool(name: string, params: Record<string, unknown>): Promise<string> {
    if (!toolNames.has(name)) {
      throw new Error(`Unknown tool: ${name}. Available: ${[...toolNames].join(", ")}`);
    }
    const result = await executeTool(name, params);
    if (result.isError) {
      const errText = result.content
        .filter((c) => c.type === "text" && c.text)
        .map((c) => c.text)
        .join("\n");
      throw new Error(`Tool ${name} failed: ${errText}`);
    }
    // Return the text content as a string
    return result.content
      .filter((c) => c.type === "text" && c.text)
      .map((c) => c.text)
      .join("\n");
  };
}

// ---------------------------------------------------------------------------
// Stub generation — async function wrappers the LLM calls in code
// ---------------------------------------------------------------------------

/**
 * Generate JavaScript source for tool stub functions.
 * Each stub is an async function that delegates to __callTool.
 */
function generateToolStubs(tools: ToolDef[]): string {
  // Tools that shouldn't be available inside execute_code (recursive!)
  const EXCLUDED = new Set(["execute_code"]);

  return tools
    .filter((t) => !EXCLUDED.has(t.name))
    .map((t) => {
      // Sanitise tool name to valid JS identifier
      const safeName = t.name.replace(/[^a-zA-Z0-9_]/g, "_");
      return `async function ${safeName}(params) { return await __callTool("${t.name}", params || {}); }`;
    })
    .join("\n");
}

// ---------------------------------------------------------------------------
// Sandbox execution
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 120_000; // 2 minutes

async function executeInSandbox(
  code: string,
  tools: ToolDef[],
  executeTool: (name: string, params: Record<string, unknown>) => Promise<ToolResult>,
  signal?: AbortSignal
): Promise<{ stdout: string; stderr: string }> {
  const stdout: string[] = [];
  const stderr: string[] = [];

  const toolBridge = buildToolBridge(tools, executeTool);
  const stubs = generateToolStubs(tools);

  // Build the full script: stubs + user code wrapped in async IIFE
  const fullScript = `
    ${stubs}
    (async () => {
      ${code}
    })();
  `;

  // Create sandbox context with console and tool bridge
  const sandbox = {
    console: {
      log: (...args: unknown[]) => stdout.push(args.map(String).join(" ")),
      error: (...args: unknown[]) => stderr.push(args.map(String).join(" ")),
      warn: (...args: unknown[]) => stderr.push(args.map(String).join(" ")),
    },
    __callTool: toolBridge,
    JSON,
    Math,
    Date,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Map,
    Set,
    Promise,
    Error,
    TypeError,
    RangeError,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    encodeURIComponent,
    decodeURIComponent,
    encodeURI,
    decodeURI,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
  };

  const context = vm.createContext(sandbox);

  try {
    const result = vm.runInContext(fullScript, context, {
      timeout: DEFAULT_TIMEOUT_MS,
      filename: "execute_code.js",
    });

    // The script returns a Promise (async IIFE) — await it
    if (result && typeof result.then === "function") {
      await Promise.race([
        result,
        new Promise((_, reject) => {
          if (signal) {
            signal.addEventListener("abort", () => reject(new Error("Aborted")), { once: true });
          }
        }),
        // Fallback timeout for the async portion (vm timeout only covers sync)
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Execution timed out")), DEFAULT_TIMEOUT_MS)
        ),
      ]);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    stderr.push(`Error: ${msg}`);
  }

  return {
    stdout: stdout.join("\n"),
    stderr: stderr.join("\n"),
  };
}

// ---------------------------------------------------------------------------
// Tool docs for prompt injection
// ---------------------------------------------------------------------------

function buildToolDocs(tools: ToolDef[]): string {
  const EXCLUDED = new Set(["execute_code"]);
  const lines = tools
    .filter((t) => !EXCLUDED.has(t.name))
    .map((t) => {
      const safeName = t.name.replace(/[^a-zA-Z0-9_]/g, "_");
      // Extract parameter names from schema if available
      const schema = t.parameters as Record<string, unknown> | undefined;
      const props = (schema?.properties ?? {}) as Record<string, { description?: string }>;
      const required = (schema?.required ?? []) as string[];
      const paramList = Object.entries(props)
        .map(([k, v]) => {
          const opt = required.includes(k) ? "" : "?";
          const desc = v?.description ? ` — ${v.description}` : "";
          return `${k}${opt}${desc}`;
        })
        .join(", ");
      return `  - ${safeName}({ ${paramList} }) — ${t.description?.split("\n")[0] ?? ""}`;
    });
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Extension entry point
// ---------------------------------------------------------------------------

export default function ptc(pi: ExtensionAPI) {
  // Store tool cache (refreshed on session_start and reload)
  let cachedTools: ToolDef[] = [];
  let cachedToolDocs = "";

  function refreshToolCache() {
    const active = pi.getAllTools?.() ?? [];
    cachedTools = active.map((t: any) => ({
      name: t.name,
      description: t.description ?? "",
      parameters: t.parameters,
    }));
    cachedToolDocs = buildToolDocs(cachedTools);
  }

  // Refresh tool list on session start
  pi.on("session_start", async () => {
    refreshToolCache();
  });

  // Register the execute_code tool
  pi.registerTool({
    name: "execute_code",
    label: "Execute Code",
    description: `Execute JavaScript code with programmatic access to all pi tools as async functions.
Use this instead of multiple individual tool calls when you need to:
- Call many tools and process/filter/aggregate results
- Chain tool calls with sequential dependencies
- Process large tool outputs without putting them in your context

Only console.log() output returns to you. Raw tool results stay in the sandbox.
Call tools as: const result = await toolName({ param: "value" })
Results are returned as strings (text content from the tool).`,
    promptSnippet:
      "Execute JS code that calls pi tools programmatically. Use for batch operations, chained tool calls, or filtering large results. Only console.log() returns to context.",
    promptGuidelines: [
      "Use execute_code when a task needs 3+ tool calls, especially if results need filtering or aggregation.",
      "Inside execute_code, call tools as async functions: `const r = await read({ path: 'file.txt' })`",
      "Process results in code and console.log() only the summary — this saves tokens.",
      "For simple single-tool calls, use the tool directly instead of execute_code.",
    ],
    parameters: Type.Object({
      code: Type.String({
        description:
          "JavaScript code to execute. Has access to all pi tools as async functions. Use console.log() for output.",
      }),
    }),

    async execute(toolCallId, params, signal, onUpdate, ctx) {
      // Ensure tools are loaded
      if (cachedTools.length === 0) refreshToolCache();

      const { code } = params as { code: string };

      if (!code?.trim()) {
        return {
          content: [{ type: "text", text: "Error: No code provided" }],
          isError: true,
        };
      }

      onUpdate?.({
        content: [{ type: "text", text: "Executing code..." }],
      });

      // Build the tool executor that actually calls pi tools
      const executeTool = async (
        name: string,
        toolParams: Record<string, unknown>
      ): Promise<ToolResult> => {
        // Use pi's internal tool execution
        // We need to find the tool and call it
        const tools = pi.getAllTools?.() ?? [];
        const tool = tools.find((t: any) => t.name === name);
        if (!tool) {
          return {
            content: [{ type: "text", text: `Unknown tool: ${name}` }],
            isError: true,
          };
        }

        try {
          // Execute the tool via its execute function
          const result = await (tool as any).execute(
            `${toolCallId}-${name}-${Date.now()}`,
            toolParams,
            signal,
            undefined, // no onUpdate for inner tool calls
            ctx
          );
          return result as ToolResult;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          return {
            content: [{ type: "text", text: `Tool ${name} error: ${msg}` }],
            isError: true,
          };
        }
      };

      const { stdout, stderr } = await executeInSandbox(code, cachedTools, executeTool, signal);

      // Build response — only stdout + stderr, no raw tool results
      const parts: string[] = [];
      if (stdout) parts.push(stdout);
      if (stderr) parts.push(`\n[stderr]\n${stderr}`);
      if (!stdout && !stderr) parts.push("(no output — use console.log() to return results)");

      return {
        content: [{ type: "text", text: parts.join("\n") }],
        details: {
          codeLength: code.length,
          hasErrors: !!stderr,
        },
      };
    },
  });

  // Inject tool discovery docs into system prompt
  pi.on("before_agent_start", async (event, _ctx) => {
    if (cachedTools.length === 0) refreshToolCache();
    if (!cachedToolDocs) return;

    const injection = `
<execute_code_tools>
Available functions inside execute_code (call with await):
${cachedToolDocs}

Pattern — batch tools, return summary:
  const files = await find({ pattern: "*.ts", path: "src/" });
  const matches = await grep({ pattern: "TODO", path: "src/" });
  console.log("Found " + matches.split("\\n").length + " TODOs");
</execute_code_tools>`;

    return {
      systemPrompt: event.systemPrompt + "\n" + injection,
    };
  });
}
