/**
 * Manages pi subprocesses in RPC mode.
 * Each agent is a pi process that receives an initial prompt and then
 * listens for IRC messages via the pirc extension.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { createInterface, type Interface } from "node:readline";
import path from "node:path";

export interface AgentConfig {
  readonly nick: string;
  readonly role: string;
  readonly channels: readonly string[];
  readonly cwd: string;
  readonly extensionPath: string;
  readonly provider: string;
  readonly model: string;
  readonly server: string;
  readonly port: number;
  readonly bootPrompt: string;
}

export interface AgentHandle {
  readonly nick: string;
  readonly role: string;
  readonly pid: number;
  readonly alive: boolean;
  kill(): void;
  sendPrompt(message: string): Promise<RpcResponse>;
}

export interface RpcResponse {
  readonly id: string;
  readonly success: boolean;
  readonly error?: string;
}

interface AgentProcess {
  readonly config: AgentConfig;
  readonly proc: ChildProcess;
  readonly rl: Interface;
  reqId: number;
  readonly pending: Map<string, (resp: RpcResponse) => void>;
  alive: boolean;
}

const agents = new Map<string, AgentProcess>();

function send(agent: AgentProcess, obj: Record<string, unknown>): Promise<RpcResponse> {
  const id = `req-${++agent.reqId}`;
  const payload = { ...obj, id };
  const line = JSON.stringify(payload);
  agent.proc.stdin?.write(line + "\n");
  return new Promise((resolve) => {
    agent.pending.set(id, resolve);
  });
}

function rejectPending(agent: AgentProcess, reason: string): void {
  for (const [id, resolve] of agent.pending) {
    resolve({ id, success: false, error: reason });
  }
  agent.pending.clear();
}

function makeHandle(agent: AgentProcess): AgentHandle {
  return {
    nick: agent.config.nick,
    role: agent.config.role,
    get pid() {
      return agent.proc.pid ?? -1;
    },
    get alive() {
      return agent.alive;
    },
    kill() {
      agent.alive = false;
      rejectPending(agent, "Agent killed");
      agent.proc.kill();
      agents.delete(agent.config.nick);
    },
    sendPrompt(message: string) {
      if (!agent.alive) {
        return Promise.resolve({
          id: "",
          success: false,
          error: "Agent is not alive",
        });
      }
      return send(agent, { type: "prompt", message });
    },
  };
}

async function waitForReady(agent: AgentProcess, timeoutMs = 15000): Promise<void> {
  const start = Date.now();
  while (agent.alive && Date.now() - start < timeoutMs) {
    const resp = await send(agent, { type: "get_state" });
    if (resp.success) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  if (!agent.alive) throw new Error("Agent died during startup");
  throw new Error("Agent failed to become ready within timeout");
}

export function spawnAgent(
  config: AgentConfig,
  onLog?: (nick: string, msg: string) => void,
): AgentHandle {
  if (agents.has(config.nick)) {
    throw new Error(`Agent "${config.nick}" is already running`);
  }

  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    PIRC_NICK: config.nick,
    PIRC_SERVER: config.server,
    PIRC_PORT: String(config.port),
    PIRC_CHANNELS: config.channels.join(","),
    PIRC_WATCH_CHANNELS: config.channels.join(","),
  };

  const extensionPath = path.resolve(config.extensionPath);
  const log = (msg: string): void => {
    onLog?.(config.nick, msg);
  };

  log(`Spawning pi --mode rpc -e ${extensionPath} in ${config.cwd}`);

  const proc = spawn(
    "pi",
    ["--mode", "rpc", "--provider", config.provider, "--model", config.model, "-e", extensionPath],
    {
      cwd: config.cwd,
      env,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );

  const rl = createInterface({ input: proc.stdout! });

  const agent: AgentProcess = {
    config,
    proc,
    rl,
    reqId: 0,
    pending: new Map(),
    alive: true,
  };

  rl.on("line", (line: string) => {
    try {
      const event = JSON.parse(line) as Record<string, unknown>;

      if (
        event["type"] === "response" &&
        typeof event["id"] === "string" &&
        agent.pending.has(event["id"])
      ) {
        const resolver = agent.pending.get(event["id"])!;
        agent.pending.delete(event["id"]);
        resolver(event as unknown as RpcResponse);
        return;
      }

      const t = event["type"] as string;
      if (t === "tool_execution_start") {
        log(
          `🔧 ${String(event["toolName"])}(${JSON.stringify(event["args"] ?? {}).slice(0, 120)})`,
        );
      } else if (t === "tool_execution_end") {
        const result = event["result"] as Record<string, unknown> | undefined;
        const content = result?.["content"] as Array<Record<string, unknown>> | undefined;
        const text = content?.[0]?.["text"] as string | undefined;
        log(`✅ ${String(event["toolName"])}: ${(text ?? "").slice(0, 120)}`);
      } else if (t === "turn_end") {
        log("--- turn complete ---");
      } else if (t === "error") {
        log(`❌ ${String(event["message"] ?? JSON.stringify(event))}`);
      } else if (t === "extension_ui_request") {
        log(`📢 ${String(event["message"])}`);
      }
    } catch {
      log(line);
    }
  });

  proc.stderr?.on("data", (data: Buffer) => {
    const msg = data.toString().trim();
    if (msg) log(`[stderr] ${msg}`);
  });

  proc.on("exit", (code: number | null) => {
    agent.alive = false;
    rejectPending(agent, `Agent exited with code ${String(code)}`);
    agents.delete(config.nick);
    log(`Exited with code ${String(code)}`);
  });

  agents.set(config.nick, agent);

  // Wait for the RPC process to be ready, then send boot prompt
  void waitForReady(agent)
    .then(() => send(agent, { type: "prompt", message: config.bootPrompt }))
    .then((resp) => {
      if (!resp.success) {
        log(`Boot prompt failed: ${JSON.stringify(resp)}`);
      }
    })
    .catch((err: unknown) => {
      log(`Startup failed: ${String(err)}`);
    });

  return makeHandle(agent);
}

export function getAgent(nick: string): AgentHandle | undefined {
  const agent = agents.get(nick);
  if (!agent) return undefined;
  return makeHandle(agent);
}

export function listAgents(): readonly AgentHandle[] {
  return [...agents.values()].map(makeHandle);
}

export function killAll(): void {
  for (const [nick, agent] of agents) {
    agent.alive = false;
    rejectPending(agent, "All agents killed");
    agent.proc.kill();
    agents.delete(nick);
  }
}
