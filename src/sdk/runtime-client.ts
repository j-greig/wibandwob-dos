import type { CommandListItem } from "../core/command-registry.js";
import type { RuntimeInspectionSnapshot } from "../domain/runtime-inspection.js";
import { buildLocalControlApiBaseUrl } from "../runtime/runtime-node.js";

export interface RuntimeInspectionEnvelope {
  ok: true;
  snapshot: RuntimeInspectionSnapshot;
}

export interface RuntimeCommandsEnvelope {
  ok: true;
  commands: CommandListItem[];
}

export interface RuntimeHealthEnvelope {
  ok: boolean;
  port?: number;
  requestedPort?: number;
  host?: string;
  instanceLabel?: string;
  instanceId?: string;
  scratchBase?: string;
  capturesDir?: string;
  workspacesDir?: string;
  statePath?: string;
}

export function getRuntimeControlApiBaseUrl(): string {
  return process.env.WIBWOB_API_BASE_URL
    ?? process.env.WIBWOB_API
    ?? process.env.WW_API
    ?? buildLocalControlApiBaseUrl();
}

async function fetchRuntimeJson<T>(path: string): Promise<T> {
  const response = await fetch(`${getRuntimeControlApiBaseUrl()}${path}`);
  if (!response.ok) {
    throw new Error(`${path} -> ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function fetchRuntimeHealth(): Promise<RuntimeHealthEnvelope> {
  return fetchRuntimeJson<RuntimeHealthEnvelope>("/health");
}

export function fetchRuntimeInspection(): Promise<RuntimeInspectionEnvelope> {
  return fetchRuntimeJson<RuntimeInspectionEnvelope>("/runtime/inspection");
}

export function fetchRuntimeCommands(options?: {
  surface?: "menu" | "palette" | "api" | "agent";
  includeUnavailable?: boolean;
}): Promise<RuntimeCommandsEnvelope> {
  const params = new URLSearchParams();
  if (options?.surface) {
    params.set("surface", options.surface);
  }
  if (options?.includeUnavailable) {
    params.set("includeUnavailable", "true");
  }
  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  return fetchRuntimeJson<RuntimeCommandsEnvelope>(`/commands/list${suffix}`);
}
