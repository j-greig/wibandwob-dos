/**
 * usage-pulse.ts
 *
 * Lightweight usage telemetry for local agent ergonomics.
 * Tracks last-seen usage for skills, extensions, and agents in:
 *   .pi/metrics/usage-last-seen.json
 *
 * Design goal: low bloat.
 * - Stores compact last-seen + counter state (no unbounded event stream).
 * - Applies a short in-process write cooldown per key.
 */

import type { ExtensionAPI, ExtensionContext, ToolResultEvent } from "@mariozechner/pi-coding-agent";
import fs from "node:fs/promises";
import path from "node:path";

const SKILL_PATH_RE = /\.pi\/skills\/([^/]+)\/SKILL\.md$/;
const AGENT_PATH_RE = /\.pi\/agents\/([^/]+)\.md$/;
const COMMAND_RE = /\/(\w[\w-]*)/g;
const MENTION_RE = /@([a-zA-Z0-9_-]+)/g;

const WRITE_COOLDOWN_MS = 5 * 60 * 1000;

type Surface = "skills" | "extensions" | "agents";

type UsageEntry = {
  lastSeen: string;
  count: number;
  sources: string[];
};

type UsageState = {
  generatedAt: string;
  surfaces: {
    skills: Record<string, UsageEntry>;
    extensions: Record<string, UsageEntry>;
    agents: Record<string, UsageEntry>;
  };
};

const defaultState = (): UsageState => ({
  generatedAt: new Date().toISOString(),
  surfaces: {
    skills: {},
    extensions: {},
    agents: {},
  },
});

function normaliseReadPath(inputPath: string, cwd: string): string {
  let p = inputPath;
  if (!path.isAbsolute(p)) p = path.resolve(cwd, p);
  return path.normalize(p);
}

function extractTextFromContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const chunks: string[] = [];
  for (const part of content) {
    if (part && typeof part === "object" && (part as any).type === "text" && typeof (part as any).text === "string") {
      chunks.push((part as any).text);
    }
  }
  return chunks.join("\n");
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

async function readJson<T>(p: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(p, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonAtomic(p: string, value: unknown): Promise<void> {
  const dir = path.dirname(p);
  await fs.mkdir(dir, { recursive: true });
  const tmp = `${p}.tmp.${process.pid}`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2) + "\n", "utf8");
  await fs.rename(tmp, p);
}

function updateEntry(surface: Record<string, UsageEntry>, name: string, source: string): void {
  const now = new Date().toISOString();
  const existing = surface[name];
  if (!existing) {
    surface[name] = { lastSeen: now, count: 1, sources: [source] };
    return;
  }
  existing.lastSeen = now;
  existing.count += 1;
  if (!existing.sources.includes(source)) {
    existing.sources = [...existing.sources, source].slice(-8);
  }
}

export default function usagePulseExtension(pi: ExtensionAPI): void {
  const lastWriteByKey = new Map<string, number>();

  let cachedCwd = "";
  let commandToExtension = new Map<string, string>();
  let toolToExtension = new Map<string, string>();

  async function refreshExtensionIndex(cwd: string): Promise<void> {
    if (cachedCwd === cwd && commandToExtension.size > 0) return;

    const extensionsDir = path.join(cwd, ".pi", "extensions");
    if (!(await fileExists(extensionsDir))) {
      cachedCwd = cwd;
      commandToExtension = new Map();
      toolToExtension = new Map();
      return;
    }

    const cmdMap = new Map<string, string>();
    const toolMap = new Map<string, string>();

    const files = await fs.readdir(extensionsDir);
    for (const f of files) {
      if (!f.endsWith(".ts")) continue;
      const extName = f.slice(0, -3);
      const fullPath = path.join(extensionsDir, f);
      const src = await fs.readFile(fullPath, "utf8").catch(() => "");
      if (!src) continue;

      const cmdRe = /pi\.registerCommand\("([^"]+)"/g;
      const toolRe = /name:\s*"([a-zA-Z0-9_-]+)"/g;

      let m: RegExpExecArray | null;
      while ((m = cmdRe.exec(src)) !== null) cmdMap.set(m[1], extName);
      while ((m = toolRe.exec(src)) !== null) toolMap.set(m[1], extName);
    }

    cachedCwd = cwd;
    commandToExtension = cmdMap;
    toolToExtension = toolMap;
  }

  async function recordUsage(ctx: ExtensionContext, surface: Surface, name: string, source: string): Promise<void> {
    const nowMs = Date.now();
    const key = `${surface}:${name}:${source}`;
    const prev = lastWriteByKey.get(key) ?? 0;
    if (nowMs - prev < WRITE_COOLDOWN_MS) return;
    lastWriteByKey.set(key, nowMs);

    const statePath = path.join(ctx.cwd, ".pi", "metrics", "usage-last-seen.json");
    const state = await readJson<UsageState>(statePath, defaultState());
    updateEntry(state.surfaces[surface], name, source);
    state.generatedAt = new Date().toISOString();
    await writeJsonAtomic(statePath, state);
  }

  pi.on("session_start", async (_event, ctx) => {
    await refreshExtensionIndex(ctx.cwd);
  });

  pi.on("session_switch", async (_event, ctx) => {
    await refreshExtensionIndex(ctx.cwd);
  });

  pi.on("tool_result", async (event: ToolResultEvent, ctx: ExtensionContext) => {
    await refreshExtensionIndex(ctx.cwd);

    const e = event as any;
    const toolName = e.toolName as string | undefined;
    if (!toolName) return;

    if (toolName === "read" && !e.isError) {
      const inputPath = e.input?.path;
      if (typeof inputPath === "string") {
        const p = normaliseReadPath(inputPath, ctx.cwd);
        const sm = p.match(SKILL_PATH_RE);
        if (sm) {
          await recordUsage(ctx, "skills", sm[1], "read:SKILL.md");
        }
        const am = p.match(AGENT_PATH_RE);
        if (am) {
          await recordUsage(ctx, "agents", am[1], "read:agent.md");
        }
      }
      return;
    }

    const ext = toolToExtension.get(toolName);
    if (ext && !e.isError) {
      await recordUsage(ctx, "extensions", ext, `tool:${toolName}`);
    }
  });

  pi.on("message_end", async (event: any, ctx: ExtensionContext) => {
    await refreshExtensionIndex(ctx.cwd);

    const msg = event?.message;
    if (!msg || msg.role !== "user") return;

    const text = extractTextFromContent(msg.content);
    if (!text) return;

    for (const m of text.matchAll(COMMAND_RE)) {
      const cmd = m[1];
      const ext = commandToExtension.get(cmd);
      if (ext) {
        await recordUsage(ctx, "extensions", ext, `command:/${cmd}`);
      }
    }

    for (const m of text.matchAll(MENTION_RE)) {
      const agent = m[1];
      const agentPath = path.join(ctx.cwd, ".pi", "agents", `${agent}.md`);
      if (await fileExists(agentPath)) {
        await recordUsage(ctx, "agents", agent, "mention:@agent");
      }
    }
  });
}
