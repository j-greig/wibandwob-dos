import path from "node:path";

import {
  APP_ROOT,
  CAPTURES_DIR,
  CONTROL_API_PORT,
  DATA_ROOT,
  LOGS_DIR,
  REPO_ROOT,
  SCRATCH_BASE,
  STATE_PATH,
  WORKSPACES_DIR,
  resolveInstancePaths,
  ensureDirectoryExists,
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
  dataRoot: string;
  // Two-level identity: canonical + display
  instanceId: string;
  instanceDisplayId: string;
  // Instance-scoped paths (new - under DATA_ROOT/instances/{instance_id}/)
  instanceRoot: string;
  exportsDir: string;
  // Legacy paths (still used, deprecated)
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

// ── Actual port tracking for in-process callers ──
// The ControlApiService sets this after binding so internal callers
// (scramble-brain, agent-session, slash-commands, SDK) use the real
// port instead of defaulting to 8099 which may be a different instance.
let _actualControlApiPort: number | undefined;

/** Called by ControlApiService.start() after the HTTP server binds. */
export function setActualControlApiPort(port: number): void {
  _actualControlApiPort = port;
}

export function buildLocalControlApiBaseUrl(
  port = _actualControlApiPort ?? CONTROL_API_PORT,
  host = resolveConfiguredControlApiHost(),
): string {
  return `http://${host}:${port}`;
}

export function createRuntimeNode(options: {
  instanceId: string;
  instanceDisplayId: string;
  instanceLabel?: string;
  lifecycleMode?: RuntimeLifecycleMode;
}): RuntimeNodeDescriptor {
  const host = resolveConfiguredControlApiHost();
  const requestedApiPort = CONTROL_API_PORT;
  
  // Resolve instance-scoped paths under DATA_ROOT
  const instancePaths = resolveInstancePaths(options.instanceId.trim());
  
  // Ensure instance directories exist
  ensureDirectoryExists(instancePaths.instanceRoot);
  ensureDirectoryExists(instancePaths.workspacesDir);
  ensureDirectoryExists(instancePaths.exportsDir);
  ensureDirectoryExists(instancePaths.logsDir);
  
  return {
    instanceId: options.instanceId.trim(),
    instanceDisplayId: options.instanceDisplayId,
    instanceLabel: options.instanceLabel?.trim() || undefined,
    host,
    apiPort: requestedApiPort,
    apiBaseUrl: buildLocalControlApiBaseUrl(requestedApiPort, host),
    requestedApiPort,
    scratchBase: SCRATCH_BASE,
    dataRoot: DATA_ROOT,
    // Instance-scoped paths (new)
    instanceRoot: instancePaths.instanceRoot,
    exportsDir: instancePaths.exportsDir,
    // Legacy paths (still populated for backward compat)
    capturesDir: CAPTURES_DIR,
    workspacesDir: instancePaths.workspacesDir,  // Prefer instance-scoped
    statePath: instancePaths.statePath,           // Prefer instance-scoped
    logsDir: instancePaths.logsDir,               // Prefer instance-scoped
    pidPath: instancePaths.pidPath,               // Prefer instance-scoped
    appRoot: APP_ROOT,
    repoRoot: REPO_ROOT,
    lifecycleMode: options.lifecycleMode ?? "persistent-workspace",
  };
}
