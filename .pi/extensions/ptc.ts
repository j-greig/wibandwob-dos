/**
 * ptc.ts — Programmatic Tool Calling extension for pi
 *
 * Registers an `execute_code` tool that lets the LLM write JavaScript code
 * which calls pi's built-in tools programmatically inside a sandbox.
 * Only console.log() output returns to the LLM context — raw tool results
 * stay in the sandbox. This dramatically reduces token consumption for
 * multi-tool workflows (85%+ reduction measured on batch operations).
 *
 * v2: Direct implementations bypass pi's tool pipeline entirely. Tool
 * results never enter the conversation — only console.log() output does.
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
import * as fs from "node:fs";
import * as path from "node:path";
import * as childProcess from "node:child_process";

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
// Direct tool implementations — bypass pi's pipeline entirely
// ---------------------------------------------------------------------------

/** Read a file directly. Returns text content. */
async function directRead(params: Record<string, unknown>): Promise<string> {
  const filePath = params.path as string;
  if (!filePath) throw new Error("read: path is required");

  const resolved = path.resolve(filePath);
  const content = fs.readFileSync(resolved, "utf-8");
  const lines = content.split("\n");

  const offset = (params.offset as number) || 1;
  const limit = params.limit as number;
  const start = Math.max(0, offset - 1);
  const sliced = limit ? lines.slice(start, start + limit) : lines.slice(start);

  return sliced.join("\n");
}

/** Write a file directly. */
async function directWrite(params: Record<string, unknown>): Promise<string> {
  const filePath = params.path as string;
  const content = params.content as string;
  if (!filePath) throw new Error("write: path is required");
  if (content === undefined) throw new Error("write: content is required");

  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, content);
  return `Successfully wrote ${Buffer.byteLength(content)} bytes to ${filePath}`;
}

/** Edit a file directly via exact text replacement. */
async function directEdit(params: Record<string, unknown>): Promise<string> {
  const filePath = params.path as string;
  const oldText = params.oldText as string;
  const newText = params.newText as string;
  if (!filePath || oldText === undefined || newText === undefined)
    throw new Error("edit: path, oldText, newText are required");

  const resolved = path.resolve(filePath);
  const content = fs.readFileSync(resolved, "utf-8");
  if (!content.includes(oldText))
    throw new Error(`edit: oldText not found in ${filePath}`);
  const updated = content.replace(oldText, newText);
  fs.writeFileSync(resolved, updated);
  return `Successfully edited ${filePath}`;
}

/** Run a bash command directly. Returns stdout. */
async function directBash(params: Record<string, unknown>): Promise<string> {
  const command = params.command as string;
  if (!command) throw new Error("bash: command is required");
  const timeout = ((params.timeout as number) || 30) * 1000;

  return new Promise((resolve) => {
    childProcess.exec(command, { timeout, maxBuffer: 1024 * 1024 * 10, cwd: process.cwd() }, (err, stdout, stderr) => {
      let result = "";
      if (stdout) result += stdout;
      if (stderr) result += (result ? "\n" : "") + stderr;
      if (err && !stdout && !stderr) result = `Error: ${err.message}`;
      resolve(result);
    });
  });
}

/** Grep via ripgrep or grep directly. Returns matching lines. */
async function directGrep(params: Record<string, unknown>): Promise<string> {
  const pattern = params.pattern as string;
  if (!pattern) throw new Error("grep: pattern is required");
  const searchPath = (params.path as string) || ".";
  const glob = params.glob as string;
  const ignoreCase = params.ignoreCase as boolean;
  const literal = params.literal as boolean;
  const context = params.context as number;
  const limit = (params.limit as number) || 100;

  let cmd = "rg --no-heading --line-number --color never";
  if (ignoreCase) cmd += " -i";
  if (literal) cmd += " -F";
  if (context) cmd += ` -C ${context}`;
  cmd += ` -m ${limit}`;
  if (glob) cmd += ` -g '${glob}'`;
  cmd += ` -- '${pattern.replace(/'/g, "'\\''")}'`;
  cmd += ` '${searchPath.replace(/'/g, "'\\''")}'`;

  return directBash({ command: cmd, timeout: 15 });
}

/** Find files via fd or find directly. */
async function directFind(params: Record<string, unknown>): Promise<string> {
  const pattern = params.pattern as string;
  if (!pattern) throw new Error("find: pattern is required");
  const searchPath = (params.path as string) || ".";
  const limit = (params.limit as number) || 1000;

  // Use fd if available, fallback to find
  const cmd = `fd --type f --glob '${pattern}' '${searchPath}' 2>/dev/null | head -${limit} || find '${searchPath}' -name '${pattern}' -type f 2>/dev/null | head -${limit}`;
  return directBash({ command: cmd, timeout: 15 });
}

/** List directory directly. */
async function directLs(params: Record<string, unknown>): Promise<string> {
  const dirPath = (params.path as string) || ".";
  const resolved = path.resolve(dirPath);

  const entries = fs.readdirSync(resolved, { withFileTypes: true });
  const formatted = entries
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((e) => (e.isDirectory() ? e.name + "/" : e.name));
  return formatted.join("\n");
}

// Map of built-in tool names to their direct implementations
const DIRECT_TOOLS: Record<string, (params: Record<string, unknown>) => Promise<string>> = {
  read: directRead,
  bash: directBash,
  write: directWrite,
  edit: directEdit,
  grep: directGrep,
  find: directFind,
  ls: directLs,
};

// ---------------------------------------------------------------------------
// Tool bridge — routes to direct implementations or extension tools
// ---------------------------------------------------------------------------

function buildToolBridge(
  allTools: ToolDef[],
  extensionToolExecutor: (name: string, params: Record<string, unknown>) => Promise<string>
) {
  const toolNames = new Set(allTools.map((t) => t.name));

  return async function __callTool(name: string, params: Record<string, unknown>): Promise<string> {
    if (!toolNames.has(name)) {
      throw new Error(`Unknown tool: ${name}. Available: ${[...toolNames].join(", ")}`);
    }

    // Direct implementation — bypasses pi entirely, no events, no conversation
    if (DIRECT_TOOLS[name]) {
      return DIRECT_TOOLS[name](params);
    }

    // Extension tools — call execute() directly, bypasses pi's agent loop
    return extensionToolExecutor(name, params);
  };
}

// ---------------------------------------------------------------------------
// Stub generation
// ---------------------------------------------------------------------------

function generateToolStubs(tools: ToolDef[]): string {
  const EXCLUDED = new Set(["execute_code"]);

  return tools
    .filter((t) => !EXCLUDED.has(t.name))
    .map((t) => {
      const safeName = t.name.replace(/[^a-zA-Z0-9_]/g, "_");
      return `async function ${safeName}(params) { return await __callTool("${t.name}", params || {}); }`;
    })
    .join("\n");
}

// ---------------------------------------------------------------------------
// Sandbox execution
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 120_000;

async function executeInSandbox(
  code: string,
  tools: ToolDef[],
  extensionToolExecutor: (name: string, params: Record<string, unknown>) => Promise<string>,
  signal?: AbortSignal
): Promise<{ stdout: string; stderr: string }> {
  const stdout: string[] = [];
  const stderr: string[] = [];

  const toolBridge = buildToolBridge(tools, extensionToolExecutor);
  const stubs = generateToolStubs(tools);

  const fullScript = `
    ${stubs}
    (async () => {
      ${code}
    })();
  `;

  const sandbox = {
    console: {
      log: (...args: unknown[]) => stdout.push(args.map(String).join(" ")),
      error: (...args: unknown[]) => stderr.push(args.map(String).join(" ")),
      warn: (...args: unknown[]) => stderr.push(args.map(String).join(" ")),
    },
    __callTool: toolBridge,
    JSON, Math, Date, Array, Object, String, Number, Boolean, RegExp,
    Map, Set, Promise, Error, TypeError, RangeError,
    parseInt, parseFloat, isNaN, isFinite,
    encodeURIComponent, decodeURIComponent, encodeURI, decodeURI,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
  };

  const context = vm.createContext(sandbox);

  try {
    const result = vm.runInContext(fullScript, context, {
      timeout: DEFAULT_TIMEOUT_MS,
      filename: "execute_code.js",
    });

    if (result && typeof result.then === "function") {
      await Promise.race([
        result,
        new Promise((_, reject) => {
          if (signal) {
            signal.addEventListener("abort", () => reject(new Error("Aborted")), { once: true });
          }
        }),
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

  pi.on("session_start", async () => {
    refreshToolCache();
  });

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

      // Extension tool executor — for tools without direct implementations.
      // Calls tool.execute() directly, bypassing pi's agent loop.
      // Results stay in the sandbox, never enter conversation.
      const extensionToolExecutor = async (
        name: string,
        toolParams: Record<string, unknown>
      ): Promise<string> => {
        const tools = pi.getAllTools?.() ?? [];
        const tool = tools.find((t: any) => t.name === name);
        if (!tool) throw new Error(`Unknown tool: ${name}`);

        try {
          const result = await (tool as any).execute(
            `${toolCallId}-ptc-${name}-${Date.now()}`,
            toolParams,
            signal,
            undefined,
            ctx
          ) as ToolResult;

          if (result.isError) {
            const errText = result.content
              .filter((c) => c.type === "text" && c.text)
              .map((c) => c.text)
              .join("\n");
            throw new Error(`Tool ${name} failed: ${errText}`);
          }

          return result.content
            .filter((c) => c.type === "text" && c.text)
            .map((c) => c.text)
            .join("\n");
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          throw new Error(`Tool ${name} error: ${msg}`);
        }
      };

      const { stdout, stderr } = await executeInSandbox(code, cachedTools, extensionToolExecutor, signal);

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
