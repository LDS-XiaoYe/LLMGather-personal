import { readFile } from 'fs/promises';
import { ConflictException } from '@nestjs/common';

export const LOCAL_AGENT_URL = 'http://model-agent:19090';
export interface LocalNodeStatus {
  status: 'DISABLED' | 'CONNECTING' | 'ONLINE' | 'UNAVAILABLE';
  nodeId?: string;
  message: string;
}
export async function readLocalNodeCredentials(file: string): Promise<{ id: string; token: string }> {
  try {
    const bytes = await readFile(file, 'utf8');
    if (bytes.length > 2048) throw Error('Invalid identity file');
    const value = JSON.parse(bytes) as { id?: unknown; token?: unknown };
    if (typeof value.id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value.id) ||
        typeof value.token !== 'string' || value.token.length < 32 || value.token.length > 512) throw Error('Invalid identity');
    return { id: value.id, token: value.token };
  } catch {
    // Never include file contents, private paths or tokens in HTTP errors/logs.
    throw new ConflictException('默认部署节点身份尚未就绪，请检查 model-agent 服务状态');
  }
}
