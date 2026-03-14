export type RuntimeLifecycleMode =
  | "persistent-workspace"
  | "ephemeral-exploration";

export interface InstanceDescriptor {
  instanceId: string;
  instanceLabel?: string;
  host?: string;
  apiPort?: number;
  cliPort?: number;
  runtimeVersion?: string;
  workspacePath?: string;
  lifecycleMode?: RuntimeLifecycleMode;
}
