/**
 * instance-discovery.ts — single owner of instance scanning, probing, and resolution.
 *
 * Consolidates discovery logic previously scattered across wibwob.ts (3 probe paths),
 * wibwob-router.ts (socket scan + port scan), and runtime-env.sh (port scan).
 *
 * Resolution chain (current):
 *   --instance/-i flag → $WIBWOB_INSTANCE env → manifest → socket scan → error
 *
 * // TODO: Phase 2 — add: @name prefix, $WIBWOB_DESKTOP, .wibwob-desktop file
 */

import fs from "node:fs";
import path from "node:path";
import { DATA_ROOT, SCRATCH_BASE } from "../core/config.js";

// ── Constants ────────────────────────────────────────────

const NEW_CONTROL_SOCKET = "control.sock";
const NEW_CONTROL_PID = "control.pid";
const DISCOVERY_FILE = "discovery.json";
const RUNTIME_CONTROL_MANIFEST = path.join(DATA_ROOT, "runtime", "control-manifest.json");

// ── Types ────────────────────────────────────────────────

export interface InstanceDiscoveryMetadata {
  instanceId?: string;
  instanceDisplayId?: string;
  instanceLabel?: string;
  port?: number;
}

export interface AliveInstance {
  label: string;
  socketPath: string;
  instanceId?: string;
  instanceDisplayId?: string;
  instanceLabel?: string;
}

export interface RuntimeControlManifest {
  instanceId?: string;
  instanceDisplayId?: string;
  instanceLabel?: string;
  pid?: number;
  socketPath?: string;
  apiPort?: number;
  updatedAt?: string;
}

export interface InstanceHealth {
  pid?: number;
  port?: number;
  screen?: { width: number; height: number } | null;
  cwd?: string;
  instanceId?: string;
  instanceDisplayId?: string;
  instanceLabel?: string | null;
  uptime?: string;
  startedAt?: string;
}

// ── Low-level utilities ──────────────────────────────────

export function safeUnlink(filePath: string): void {
  try { fs.unlinkSync(filePath); } catch {}
}

export function readPidFile(filePath: string): number | null {
  try {
    const pid = Number(fs.readFileSync(filePath, "utf8").trim());
    return Number.isFinite(pid) ? pid : null;
  } catch {
    return null;
  }
}

export function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// ── Discovery metadata ───────────────────────────────────

export function readDiscoveryMeta(instanceRoot: string): InstanceDiscoveryMetadata {
  try {
    const parsed = JSON.parse(
      fs.readFileSync(path.join(instanceRoot, DISCOVERY_FILE), "utf8"),
    ) as InstanceDiscoveryMetadata;
    return parsed ?? {};
  } catch {
    return {};
  }
}

export function readRuntimeControlManifest(): RuntimeControlManifest | null {
  try {
    return JSON.parse(fs.readFileSync(RUNTIME_CONTROL_MANIFEST, "utf8")) as RuntimeControlManifest;
  } catch {
    return null;
  }
}

// ── Instance scanning ────────────────────────────────────

function getInstanceRoots(): string[] {
  const roots = [
    path.join(DATA_ROOT, "instances"),
  ];
  return [...new Set(roots)];
}

function scanNewLayoutInstances(instancesRoot: string): AliveInstance[] {
  const alive: AliveInstance[] = [];
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(instancesRoot, { withFileTypes: true }); } catch { return alive; }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const instanceRoot = path.join(instancesRoot, entry.name);
    const socketPath = path.join(instanceRoot, NEW_CONTROL_SOCKET);
    const controlPidPath = path.join(instanceRoot, NEW_CONTROL_PID);
    const runtimePidPath = path.join(instanceRoot, "wibwob.pid");

    if (!fs.existsSync(socketPath)) continue;

    const pid = readPidFile(controlPidPath) ?? readPidFile(runtimePidPath);
    if (!pid || !isPidAlive(pid)) {
      safeUnlink(socketPath);
      safeUnlink(controlPidPath);
      safeUnlink(path.join(instanceRoot, DISCOVERY_FILE));
      continue;
    }

    const meta = readDiscoveryMeta(instanceRoot);
    const label =
      meta.instanceLabel?.trim() ||
      meta.instanceDisplayId?.trim() ||
      meta.instanceId?.trim() ||
      entry.name;

    alive.push({
      label,
      socketPath,
      instanceId: meta.instanceId ?? entry.name,
      instanceDisplayId: meta.instanceDisplayId,
      instanceLabel: meta.instanceLabel,
    });
  }

  return alive;
}

/** Scan for alive instances via instance-scoped layout. */
export function findAliveInstances(): AliveInstance[] {
  const alive: AliveInstance[] = [];
  const seenSockets = new Set<string>();
  const seenIdentity = new Set<string>();

  const pushIfNew = (inst: AliveInstance) => {
    const canonicalIdentity =
      inst.instanceId?.trim() ||
      inst.instanceLabel?.trim() ||
      inst.instanceDisplayId?.trim() ||
      inst.label.trim();
    const identityKey = canonicalIdentity ? `identity:${canonicalIdentity}` : "";

    if (seenSockets.has(inst.socketPath)) return;
    if (identityKey && seenIdentity.has(identityKey)) return;

    seenSockets.add(inst.socketPath);
    if (identityKey) seenIdentity.add(identityKey);
    alive.push(inst);
  };

  for (const instancesRoot of getInstanceRoots()) {
    for (const inst of scanNewLayoutInstances(instancesRoot)) {
      pushIfNew(inst);
    }
  }

  return alive;
}

export function findAliveInstanceBySelector(selector: string): AliveInstance | null {
  const directInstanceSocket = path.join(DATA_ROOT, "instances", selector, NEW_CONTROL_SOCKET);
  if (fs.existsSync(directInstanceSocket)) {
    return {
      label: selector,
      socketPath: directInstanceSocket,
      instanceId: selector,
    };
  }

  const alive = findAliveInstances();
  const matched = alive.find((inst) => (
    selector === inst.label ||
    selector === inst.instanceLabel ||
    selector === inst.instanceDisplayId ||
    selector === inst.instanceId
  ));
  return matched ?? null;
}

// ── Health probing (shared async implementation) ─────────

/**
 * Probe a running instance's /health endpoint via unix socket.
 * Returns null if the instance is unresponsive.
 * This is the single shared probe — use this instead of inline fetch/curl.
 */
export async function probeInstanceHealth(
  socketPath: string,
  timeoutMs = 200,
): Promise<InstanceHealth | null> {
  try {
    const res = await fetch("http://localhost/health", {
      // @ts-expect-error — Bun supports unix socket fetch
      unix: socketPath,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return (await res.json()) as InstanceHealth;
  } catch {
    return null;
  }
}

/**
 * Discover a running instance for external callers (wibwob-router, extensions).
 * Scans sockets, probes health, returns first alive instance.
 * Replaces wibwob-router.ts inline discovery.
 */
export async function discoverInstance(
  projectRoot?: string,
): Promise<{ socket?: string; port?: number } | null> {
  // Use the standard instance scanning
  const alive = findAliveInstances();

  for (const inst of alive) {
    const health = await probeInstanceHealth(inst.socketPath, 1000);
    if (health) {
      return { socket: inst.socketPath, port: health.port };
    }
  }

  return null;
}
