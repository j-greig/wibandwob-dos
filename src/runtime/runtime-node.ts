import path from "node:path";

import {
  APP_ROOT,
  CAPTURES_DIR,
  CONTROL_API_PORT,
  LOGS_DIR,
  REPO_ROOT,
  SCRATCH_BASE,
  STATE_PATH,
  WORKSPACES_DIR,
} from "../core/config.js";
import type {
  InstanceDescriptor,
  RuntimeLifecycleMode,
} from "../domain/instance-descriptor.js";

export interface RuntimeNodeDescriptor extends InstanceDescriptor {
  host: string;
  apiPort: number;
  apiBaseUrl: string;
  requestedApiPort: number;
  scratchBase: string;
  capturesDir: string;
  workspacesDir: string;
  statePath: string;
  logsDir: string;
  pidPath: string;
  appRoot: string;
  repoRoot: string;
  lifecycleMode: RuntimeLifecycleMode;
}

export function resolveConfiguredControlApiHost(): string {
  return process.env.WIBWOB_CONTROL_HOST?.trim() || "127.0.0.1";
}

export function buildLocalControlApiBaseUrl(
  port = CONTROL_API_PORT,
  host = resolveConfiguredControlApiHost(),
): string {
  return `http://${host}:${port}`;
}

export function createRuntimeNode(options: {
  instanceId: string;
  instanceLabel?: string;
  lifecycleMode?: RuntimeLifecycleMode;
}): RuntimeNodeDescriptor {
  const host = resolveConfiguredControlApiHost();
  const requestedApiPort = CONTROL_API_PORT;
  return {
    instanceId: options.instanceId.trim(),
    instanceLabel: options.instanceLabel?.trim() || undefined,
    host,
    apiPort: requestedApiPort,
    apiBaseUrl: buildLocalControlApiBaseUrl(requestedApiPort, host),
    requestedApiPort,
    scratchBase: SCRATCH_BASE,
    capturesDir: CAPTURES_DIR,
    workspacesDir: WORKSPACES_DIR,
    statePath: STATE_PATH,
    logsDir: LOGS_DIR,
    pidPath: path.join(SCRATCH_BASE, "wibwob.pid"),
    appRoot: APP_ROOT,
    repoRoot: REPO_ROOT,
    lifecycleMode: options.lifecycleMode ?? "persistent-workspace",
  };
}
