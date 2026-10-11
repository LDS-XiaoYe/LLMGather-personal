export type Backend = 'cpu' | 'nvidia' | 'apple';
export interface DeploymentConfig {
  modelId: string; backend: Backend; source: 'auto' | 'huggingface' | 'modelscope';
  cpu: number; memoryMiB: number; gpuUuid?: string; allowExperimental?: boolean;
}
export interface Hardware {
  platform: string; arch: string; cpu: string; cpuCount: number; memoryMiB: number; freeDiskMiB: number;
  docker: null | {os: string; arch: string; memoryMiB: number; nvidiaRuntime: boolean};
  gpus: {name: string; uuid: string; totalMiB: number; freeMiB: number; capability: string; driver: string}[];
  apple: null | {chip: string; version: string; mlx: boolean; metal: boolean};
}
export interface InstanceSpec {
  modelId: string; repository: string; revision: string; dimensions: number;
  precision: string; pooling: string; runtime: string; variant: string;
}
export interface AgentInstance extends DeploymentConfig {
  id: string; actualState: string; desiredState: string; fingerprint?: string; spec?: InstanceSpec;
  gpuName?: string; cacheKey?: string; cacheDeleted?: boolean;
}
export interface AgentTask {
  taskId: string; instanceId: string; status: string; phase: string; error?: string;
  downloadedBytes?: number; totalBytes?: number; source?: string; file?: string; cached?: boolean;
  history?:{phase:string;status:string;at:string}[];
}
export interface AgentState {instances: Record<string, AgentInstance>; tasks: Record<string, AgentTask>}
export interface AgentNode {id: string; hardware: Hardware}
export interface NodeRow {id: string; name: string; base_url: string; token_cipher: string; status: string; hardware_json: string; last_seen: string; fresh?:number}
export interface InstanceRow {
  id: string; node_id: string; model_id: string; config_json: string; spec_json: string | null;
  desired_state: string; actual_state: string; fingerprint: string | null; provider_registered: number;
  operation_id: string | null; default_provider?: number; node_status?: string;
}
export interface TaskRow {
  id: string; instance_id: string; node_id: string; request_json: string; status: string; phase: string;
  owner: string | null; cancel_requested: number; progress_json: string; error: string; request_hash: string;
}
