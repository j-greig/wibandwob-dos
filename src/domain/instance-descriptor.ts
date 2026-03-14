export type RuntimeLifecycleMode =
  | "persistent-workspace"
  | "ephemeral-exploration";

export interface InstanceDescriptor {
  instanceId: string;
  instanceLabel?: string;
  host?: string;
  apiPort?: number;
  apiBaseUrl?: string;
  cliPort?: number;
  runtimeVersion?: string;
  workspacePath?: string;
  scratchBase?: string;
  capturesDir?: string;
  workspacesDir?: string;
  statePath?: string;
  logsDir?: string;
  lifecycleMode?: RuntimeLifecycleMode;
}
