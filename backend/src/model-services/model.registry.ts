import { readFileSync } from 'fs';
import { resolve } from 'path';
import { DeploymentConfig } from './model.types';

export interface ModelVariant {
  repository: string; revision: string; format: string; pooling: string; sources: string[];
  precision?: string; verification?: string; files: {path: string; size: number; sha256?: string; gitBlob?: string; modelscopeRevision?: string}[];
}
export interface ModelDefinition {
  id: string; name: string; type: string; parameters: number; dimensions: number; maxTokens: number;
  minMemoryMiB: number; minDiskMiB: number; minCpu: number; protocol: string; variants: Record<string, ModelVariant>;
}
export interface RuntimeDefinition {backend: string; arch?: string; capability?: string; image: string; precision: string; experimental?: boolean; verification: string}
/** Single audited manifest is shared by the controller and the independent Agent. */
export const modelRegistry = JSON.parse(readFileSync(resolve(__dirname, '../../../deployment-agent/registry.json'), 'utf8')) as {
  schemaVersion: number; models: ModelDefinition[]; matrix: RuntimeDefinition[];
};
export function validateConfig(input: DeploymentConfig): DeploymentConfig {
  const allowed = ['modelId','backend','source','cpu','memoryMiB','gpuUuid','allowExperimental'];
  const model = modelRegistry.models.find(m => m.id === input?.modelId);
  if (!input || !model || Object.keys(input).some(k => !allowed.includes(k)) || !['cpu','nvidia','apple'].includes(input.backend)
    || !['auto','huggingface','modelscope'].includes(input.source)) throw new Error('Invalid deployment configuration');
  if (!Number.isInteger(input.cpu) || input.cpu < model.minCpu || input.cpu > 64 || !Number.isInteger(input.memoryMiB)
    || input.memoryMiB < model.minMemoryMiB || input.memoryMiB > 131072) throw new Error('Invalid resource limit');
  if (input.allowExperimental !== undefined && typeof input.allowExperimental !== 'boolean') throw new Error('Invalid acknowledgement');
  if (input.backend === 'nvidia' && !/^GPU-[a-f0-9-]{36}$/.test(input.gpuUuid || '')) throw new Error('Invalid GPU selection');
  if (input.backend === 'apple' && input.source === 'modelscope') throw new Error('MLX variant is available on Hugging Face only');
  return input;
}
