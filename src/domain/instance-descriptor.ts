export type RuntimeLifecycleMode =
  | "persistent-workspace"
  | "ephemeral-exploration";

export interface InstanceDescriptor {
  instanceId: string;
  instanceDisplayId: string;
  instanceLabel?: string;
  host?: string;
  apiPort?: number;
  apiBaseUrl?: string;
  cliPort?: number;
  runtimeVersion?: string;
  workspacePath?: string;
  scratchBase?: string;
  dataRoot?: string;
  // Instance-scoped paths (new)
  instanceRoot?: string;
  exportsDir?: string;
  // Legacy paths
  capturesDir?: string;
  workspacesDir?: string;
  statePath?: string;
  logsDir?: string;
  lifecycleMode?: RuntimeLifecycleMode;
}
