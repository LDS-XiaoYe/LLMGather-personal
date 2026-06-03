export interface ModelDescriptor {
  id: string;
  object: 'model';
  owned_by: string;
}

export interface AuthUser {
  id: string;
  username: string;
  email: string | null;
  role: string;
  credits: number;
  totalSpent: number;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  model?: string;
}

export interface ConversationSession {
  id: string;
  title: string;
  chatType?: 'direct' | 'battle' | 'group';
  messages: ConversationMessage[];
  updatedAt: number;
}

export interface BillingRule {
  key: string;
  value: number;
  description: string;
  updatedAt: string;
}

export interface BillingLedgerItem {
  id: string;
  model: string;
  requestType: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  createdAt: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
  user?: string;
  extra_body?: {
    enable_thinking?: boolean;
    [key: string]: unknown;
  };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | Array<{ type: string; [key: string]: unknown }>;
  name?: string;
}

export interface ChatCompletionChunk {
  id?: string;
  created?: number;
  model?: string;
  choices?: Array<{
    index: number;
    delta?: {
      role?: 'assistant';
      content?: string;
      reasoning_content?: string;
    };
    finish_reason?: string | null;
  }>;
}

const defaultBaseUrl = '/v1';
const REQUEST_TIMEOUT_MS = 60_000;
const TOKEN_STORAGE_KEY = 'llm_gather_access_token';

export function getStoredToken(): string {
  try { return localStorage.getItem(TOKEN_STORAGE_KEY) ?? ''; } catch { return ''; }
}

export function setStoredToken(token: string): void {
  try {
    if (!token) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      return;
    }
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {}
}

export function clearStoredToken(): void {
  try { localStorage.removeItem(TOKEN_STORAGE_KEY); } catch {}
}

function buildHeaders(): HeadersInit {
  const token = getStoredToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

const noStore: RequestCache = 'no-store';

/** Shared fetch options for credentials (cookies) */
const credOpts: RequestInit = { credentials: 'include' };

function withTimeoutSignal(timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    cleanup: () => window.clearTimeout(timeoutId),
  };
}

async function readError(response: Response): Promise<string> {
  const fallback = `Request failed (${response.status})`;
  const text = await response.text();
  if (!text) return fallback;
  try {
    const payload = JSON.parse(text) as { message?: string | string[]; error?: string };
    const message = Array.isArray(payload.message)
      ? payload.message.join('; ')
      : payload.message || payload.error;
    return message || text;
  } catch {
    return text;
  }
}

export async function fetchModels(baseUrl = defaultBaseUrl): Promise<ModelDescriptor[]> {
  const { signal, cleanup } = withTimeoutSignal();
  let response: Response;

  try {
    response = await fetch(`${baseUrl}/models`, { headers: buildHeaders(), signal, cache: noStore, ...credOpts });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('加载模型超时，请检查后端或网络连接');
    }
    throw error;
  } finally {
    cleanup();
  }

  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { data?: ModelDescriptor[] };
  return payload.data ?? [];
}

export async function sendVerificationCode(
  email: string,
  baseUrl = defaultBaseUrl,
): Promise<{ ok: boolean; message: string }> {
  const response = await fetch(`${baseUrl}/auth/send-verification-code`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ email }),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as { ok: boolean; message: string };
}

export async function register(
  username: string,
  password: string,
  email: string,
  verificationCode: string,
  invitationCode: string | undefined,
  baseUrl = defaultBaseUrl,
): Promise<AuthResponse> {
  const response = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ username, password, email, verificationCode, invitationCode }),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as AuthResponse;
}

export async function login(
  username: string,
  password: string,
  baseUrl = defaultBaseUrl,
): Promise<AuthResponse> {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ username, password }),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as AuthResponse;
}

export async function fetchMe(baseUrl = defaultBaseUrl): Promise<AuthUser> {
  const response = await fetch(`${baseUrl}/auth/me`, {
    method: 'GET',
    headers: buildHeaders(),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as AuthUser;
}

export async function topUp(amount: number, baseUrl = defaultBaseUrl): Promise<AuthUser> {
  const response = await fetch(`${baseUrl}/auth/topup`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ amount }),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as AuthUser;
}

export async function fetchInvitationCode(baseUrl = defaultBaseUrl): Promise<string | null> {
  const response = await fetch(`${baseUrl}/auth/invitation-code`, {
    method: 'GET',
    headers: buildHeaders(),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { invitationCode: string | null };
  return payload.invitationCode;
}

export async function fetchConversations(baseUrl = defaultBaseUrl): Promise<ConversationSession[]> {
  const response = await fetch(`${baseUrl}/conversations`, {
    method: 'GET',
    headers: buildHeaders(),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { data?: ConversationSession[] };
  return Array.isArray(payload.data) ? payload.data : [];
}

export async function syncConversations(
  sessions: ConversationSession[],
  baseUrl = defaultBaseUrl,
): Promise<void> {
  const response = await fetch(`${baseUrl}/conversations/sync`, {
    method: 'PUT',
    headers: buildHeaders(),
    body: JSON.stringify({ sessions }),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
}

export async function deleteConversation(
  sessionId: string,
  baseUrl = defaultBaseUrl,
): Promise<void> {
  const response = await fetch(`${baseUrl}/conversations/${sessionId}`, {
    method: 'DELETE',
    headers: buildHeaders(),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
}

export async function fetchBillingRules(baseUrl = defaultBaseUrl): Promise<BillingRule[]> {
  const response = await fetch(`${baseUrl}/billing/rules`, {
    method: 'GET',
    headers: buildHeaders(),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { data?: BillingRule[] };
  return payload.data ?? [];
}

export async function fetchBillingLedger(baseUrl = defaultBaseUrl): Promise<BillingLedgerItem[]> {
  const response = await fetch(`${baseUrl}/billing/ledger`, {
    method: 'GET',
    headers: buildHeaders(),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { data?: BillingLedgerItem[] };
  return payload.data ?? [];
}

export async function fetchPageModels(baseUrl = defaultBaseUrl): Promise<Record<string, string>> {
  const response = await fetch(`${baseUrl}/billing/page-models`, {
    headers: buildHeaders(),
    cache: noStore,
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { data: Record<string, string> };
  return payload.data ?? {};
}

export interface DailyUsage {
  date: string;
  requests: number;
  tokens: number;
  cost: number;
}

export async function fetchDailyUsage(days = 30, baseUrl = defaultBaseUrl): Promise<DailyUsage[]> {
  const response = await fetch(`${baseUrl}/billing/usage/daily?days=${days}`, {
    headers: buildHeaders(),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { data: DailyUsage[] };
  return payload.data ?? [];
}

export async function fetchAdminDailyUsage(days = 30, baseUrl = defaultBaseUrl): Promise<DailyUsage[]> {
  const response = await fetch(`${baseUrl}/admin/stats/daily?days=${days}`, {
    headers: buildHeaders(),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { data: DailyUsage[] };
  return payload.data ?? [];
}

export interface ApiKeyItem {
  id: string;
  name: string;
  key: string;       // masked: sk-xxxx...xxxx
  rawKey?: string;   // full key, only on create response
  createdAt: string;
}

export async function listApiKeys(baseUrl = defaultBaseUrl): Promise<ApiKeyItem[]> {
  const response = await fetch(`${baseUrl}/api-keys`, { headers: buildHeaders(), ...credOpts });
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { data?: ApiKeyItem[] };
  return payload.data ?? [];
}

export async function createApiKey(name: string, baseUrl = defaultBaseUrl): Promise<ApiKeyItem> {
  const response = await fetch(`${baseUrl}/api-keys`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ name }),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as ApiKeyItem;
}

export async function revokeApiKey(id: string, baseUrl = defaultBaseUrl): Promise<void> {
  const response = await fetch(`${baseUrl}/api-keys/${id}`, {
    method: 'DELETE',
    headers: buildHeaders(),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
}

export async function logout(baseUrl = defaultBaseUrl): Promise<void> {
  const response = await fetch(`${baseUrl}/auth/logout`, {
    method: 'POST',
    headers: buildHeaders(),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
}

export async function streamCompletion(
  payload: ChatCompletionRequest,
  handlers: {
    onRequestId?: (requestId: string) => void;
    onChunk?: (chunk: ChatCompletionChunk) => void;
    onDone?: () => void;
    onAbort?: () => void;
  },
  baseUrl = defaultBaseUrl,
  externalSignal?: AbortSignal,
): Promise<void> {
  const { signal: timeoutSignal, cleanup } = withTimeoutSignal();

  // Merge external signal and timeout signal
  const controller = new AbortController();
  const onAnyAbort = () => controller.abort();
  timeoutSignal.addEventListener('abort', onAnyAbort);
  externalSignal?.addEventListener('abort', onAnyAbort);
  if (timeoutSignal.aborted || externalSignal?.aborted) controller.abort();

  let response: Response;

  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ ...payload, stream: true }),
      signal: controller.signal,
      credentials: 'include',
    });
  } catch (error) {
    cleanup();
    timeoutSignal.removeEventListener('abort', onAnyAbort);
    externalSignal?.removeEventListener('abort', onAnyAbort);
    if (error instanceof DOMException && error.name === 'AbortError') {
      if (externalSignal?.aborted) { handlers.onAbort?.(); return; }
      throw new Error('流式请求超时，请检查后端日志和 Provider 配置');
    }
    throw error;
  }

  if (!response.ok) {
    cleanup();
    throw new Error(await readError(response));
  }

  handlers.onRequestId?.(response.headers.get('x-request-id') ?? '');

  const reader = response.body?.getReader();
  if (!reader) { cleanup(); throw new Error('流式响应不可用'); }

  const decoder = new TextDecoder();
  let buffer = '';

  function consumeEvent(rawEvent: string): boolean {
    const lines = rawEvent.split(/\r?\n/).filter((line) => line.length > 0);
    if (lines.length === 0) return false;

    const dataLines = lines.filter((line) => line.startsWith('data:')).map((line) => line.slice('data:'.length).trim());
    if (dataLines.length === 0) return false;

    const data = dataLines.join('\n');
    if (!data) return false;

    if (data === '[DONE]') { handlers.onDone?.(); return true; }

    try { handlers.onChunk?.(JSON.parse(data) as ChatCompletionChunk); } catch {}
    return false;
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() ?? '';

      for (const event of events) {
        if (consumeEvent(event)) return;
      }
    }
    if (buffer.trim() && consumeEvent(buffer)) return;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      if (externalSignal?.aborted) { handlers.onAbort?.(); return; }
      throw new Error('流式请求超时，请检查后端日志和 Provider 配置');
    }
    throw error;
  } finally {
    cleanup();
    timeoutSignal.removeEventListener('abort', onAnyAbort);
    externalSignal?.removeEventListener('abort', onAnyAbort);
    reader.releaseLock();
  }
}

/* ───────── Agent API ───────── */

export interface AgentDefinition {
  id: string;
  userId: string;
  name: string;
  description: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  memoryEnabled: boolean;
  toolIds: string[];
  knowledgeBaseIds: string[];
  skillIds: string[];
  published: boolean;
  apiEnabled: boolean;
  publicSlug: string;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  runCount: number;
}

export interface AgentMarketplaceTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  toolNames?: string[];
  skillNames?: string[];
  toolIds?: string[];
  skillIds?: string[];
  knowledgeBaseIds?: string[];
  source?: 'builtin' | 'custom' | string;
}

export interface AgentInput {
  name: string;
  description?: string;
  model: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  memoryEnabled?: boolean;
  toolIds?: string[];
  knowledgeBaseIds?: string[];
  skillIds?: string[];
  status?: 'active' | 'archived';
}

export interface AgentRunStep {
  id: number;
  runId: string;
  stepType: string;
  name: string;
  status: 'running' | 'succeeded' | 'failed';
  input: string;
  output: string;
  error: string;
  startedAt: string;
  endedAt: string | null;
  latencyMs: number;
  metadata: string;
}

export interface AgentRun {
  id: string;
  agentId: string;
  userId: string;
  status: 'running' | 'succeeded' | 'failed';
  input: string;
  output: string;
  model: string;
  error: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  createdAt: string;
  completedAt: string | null;
  steps: AgentRunStep[];
}

export interface AgentEvaluation {
  id: string;
  agentId: string;
  runId: string;
  userId: string;
  score: number;
  grade: 'excellent' | 'good' | 'fair' | 'poor' | 'failed';
  summary: string;
  rubric: Record<string, unknown>;
  createdAt: string;
}

export interface AgentRunStats {
  agentId: string;
  totalRuns: number;
  succeededRuns: number;
  failedRuns: number;
  successRate: number;
  averageLatencyMs: number;
  averageTokens: number;
  averageScore: number;
  evaluatedRuns: number;
}

export async function fetchAgents(baseUrl = defaultBaseUrl): Promise<AgentDefinition[]> {
  const response = await fetch(`${baseUrl}/agents`, { headers: buildHeaders(), ...credOpts });
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { data?: AgentDefinition[] };
  return payload.data ?? [];
}

export async function createAgent(payload: AgentInput, baseUrl = defaultBaseUrl): Promise<AgentDefinition> {
  const response = await fetch(`${baseUrl}/agents`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(payload),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  const data = (await response.json()) as { data: AgentDefinition };
  return data.data;
}

export async function updateAgent(
  id: string,
  payload: Partial<AgentInput>,
  baseUrl = defaultBaseUrl,
): Promise<AgentDefinition> {
  const response = await fetch(`${baseUrl}/agents/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: buildHeaders(),
    body: JSON.stringify(payload),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  const data = (await response.json()) as { data: AgentDefinition };
  return data.data;
}

export async function updateAgentPublication(
  id: string,
  payload: { published?: boolean; apiEnabled?: boolean; publicSlug?: string },
  baseUrl = defaultBaseUrl,
): Promise<AgentDefinition> {
  const response = await fetch(`${baseUrl}/agents/${encodeURIComponent(id)}/publication`, {
    method: 'PATCH',
    headers: buildHeaders(),
    body: JSON.stringify(payload),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  const data = (await response.json()) as { data: AgentDefinition };
  return data.data;
}

export async function deleteAgent(id: string, baseUrl = defaultBaseUrl): Promise<void> {
  const response = await fetch(`${baseUrl}/agents/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: buildHeaders(),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
}

export async function runAgent(
  id: string,
  input: string,
  optionsOrBaseUrl: { imageUrls?: string[] } | string = {},
  maybeBaseUrl = defaultBaseUrl,
): Promise<AgentRun> {
  const options = typeof optionsOrBaseUrl === 'string' ? {} : optionsOrBaseUrl;
  const baseUrl = typeof optionsOrBaseUrl === 'string' ? optionsOrBaseUrl : maybeBaseUrl;
  const response = await fetch(`${baseUrl}/agents/${encodeURIComponent(id)}/runs`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ input, imageUrls: options.imageUrls }),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  const data = (await response.json()) as { data: AgentRun };
  return data.data;
}

export async function fetchAgentRuns(id: string, baseUrl = defaultBaseUrl): Promise<AgentRun[]> {
  const response = await fetch(`${baseUrl}/agents/${encodeURIComponent(id)}/runs`, {
    headers: buildHeaders(),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { data?: AgentRun[] };
  return payload.data ?? [];
}

export async function evaluateAgentRun(
  runId: string,
  payload: { expectedOutput?: string; rubric?: string } = {},
  baseUrl = defaultBaseUrl,
): Promise<AgentEvaluation> {
  const response = await fetch(`${baseUrl}/agents/runs/${encodeURIComponent(runId)}/evaluations`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(payload),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  const data = (await response.json()) as { data: AgentEvaluation };
  return data.data;
}

export async function fetchAgentEvaluations(id: string, baseUrl = defaultBaseUrl): Promise<AgentEvaluation[]> {
  const response = await fetch(`${baseUrl}/agents/${encodeURIComponent(id)}/evaluations`, {
    headers: buildHeaders(),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { data?: AgentEvaluation[] };
  return payload.data ?? [];
}

export async function fetchAgentStats(id: string, baseUrl = defaultBaseUrl): Promise<AgentRunStats> {
  const response = await fetch(`${baseUrl}/agents/${encodeURIComponent(id)}/stats`, {
    headers: buildHeaders(),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  const data = (await response.json()) as { data: AgentRunStats };
  return data.data;
}

/* ───────── Agent Capability APIs ───────── */

export interface ToolDefinition {
  id: string;
  userId: string | null;
  name: string;
  displayName: string;
  description: string;
  schema: Record<string, unknown>;
  implementationType: string;
  enabled: boolean;
}

export interface ToolInvocationResult {
  id: string;
  toolId: string;
  toolName: string;
  input: Record<string, unknown>;
  output: string;
  status: 'succeeded' | 'failed';
  error: string;
  latencyMs: number;
}

export interface KnowledgeBase {
  id: string;
  userId: string;
  name: string;
  description: string;
  documentCount: number;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeDocumentResult {
  id: string;
  kbId: string;
  title: string;
  chunkCount: number;
}

export interface KnowledgeSearchResult {
  id: string;
  kbId: string;
  documentId: string;
  title: string;
  content: string;
  score: number;
}

export interface MemoryItem {
  id: string;
  userId: string;
  agentId: string | null;
  namespace: string;
  memoryType: string;
  content: string;
  importance: number;
  metadata: string;
  createdAt: string;
  updatedAt: string;
  score?: number;
}

export interface SkillDefinition {
  id: string;
  userId: string | null;
  name: string;
  description: string;
  content: string;
  category: string;
  icon: string;
  source: 'builtin' | 'custom';
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  permissions: Record<string, unknown>;
  exampleInput: string;
  exampleOutput: string;
  riskLevel: 'low' | 'medium' | 'high';
  version: number;
  enabled: boolean;
  bindingCount: number;
  boundAgents?: Array<{ id: string; name: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowNode {
  id: string;
  type: 'prompt' | 'agent' | 'tool' | 'knowledge' | 'memory' | 'skill';
  name?: string;
  config: Record<string, unknown>;
}

export interface Workflow {
  id: string;
  userId: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  userId: string;
  status: 'running' | 'succeeded' | 'failed';
  input: string;
  output: string;
  error: string;
  createdAt: string;
  completedAt: string | null;
  steps: Array<{
    id: number;
    nodeId: string;
    nodeType: string;
    status: string;
    input: string;
    output: string;
    error: string;
    createdAt: string;
  }>;
}

export interface AgentTeamMember {
  agentId: string;
  role?: string;
  inputTemplate?: string;
}

export interface AgentTeam {
  id: string;
  userId: string;
  name: string;
  description: string;
  strategy: 'sequential' | 'review' | 'debate' | 'parallel' | 'consensus' | 'router';
  members: AgentTeamMember[];
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface AgentTeamRun {
  id: string;
  teamId: string;
  userId: string;
  status: 'running' | 'succeeded' | 'failed';
  input: string;
  output: string;
  error: string;
  memberOutputs: Array<{
    agentId: string;
    role: string;
    runId: string;
    status: string;
    output: string;
    error: string;
  }>;
  latencyMs: number;
  createdAt: string;
  completedAt: string | null;
}

export interface McpServer {
  id: string;
  userId: string;
  name: string;
  serverType: 'notion';
  config: Record<string, unknown>;
  enabled: boolean;
  lastStatus: string;
  lastError: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentVersion {
  id: string;
  agentId: string;
  userId: string;
  versionNumber: number;
  label: string;
  snapshot: Record<string, unknown>;
  createdAt: string;
}

export interface AgentTestSuite {
  id: string;
  agentId: string;
  userId: string;
  name: string;
  description: string;
  caseCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AgentTestCase {
  id: string;
  suiteId: string;
  agentId: string;
  name: string;
  input: string;
  expectedOutput: string;
  rubric: string;
  createdAt: string;
  updatedAt: string;
}

export async function fetchTools(baseUrl = defaultBaseUrl): Promise<ToolDefinition[]> {
  const response = await fetch(`${baseUrl}/tools`, { headers: buildHeaders(), ...credOpts });
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { data?: ToolDefinition[] };
  return payload.data ?? [];
}

export async function fetchSkills(baseUrl = defaultBaseUrl): Promise<SkillDefinition[]> {
  const response = await fetch(`${baseUrl}/skills`, { headers: buildHeaders(), ...credOpts });
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { data?: SkillDefinition[] };
  return payload.data ?? [];
}

export async function createSkill(
  payload: Partial<SkillDefinition> & { name: string; content: string },
  baseUrl = defaultBaseUrl,
): Promise<SkillDefinition> {
  const response = await fetch(`${baseUrl}/skills`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(payload),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  const data = (await response.json()) as { data: SkillDefinition };
  return data.data;
}

export async function fetchSkillDetail(id: string, baseUrl = defaultBaseUrl): Promise<SkillDefinition> {
  const response = await fetch(`${baseUrl}/skills/${encodeURIComponent(id)}`, { headers: buildHeaders(), ...credOpts });
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { data: SkillDefinition };
  return payload.data;
}

export async function updateSkill(
  id: string,
  payload: Partial<SkillDefinition> & { name?: string; content?: string },
  baseUrl = defaultBaseUrl,
): Promise<SkillDefinition> {
  const response = await fetch(`${baseUrl}/skills/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: buildHeaders(),
    body: JSON.stringify(payload),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  const data = (await response.json()) as { data: SkillDefinition };
  return data.data;
}

export async function deleteSkill(id: string, baseUrl = defaultBaseUrl): Promise<void> {
  const response = await fetch(`${baseUrl}/skills/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: buildHeaders(),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
}

export async function copySkill(id: string, baseUrl = defaultBaseUrl): Promise<SkillDefinition> {
  const response = await fetch(`${baseUrl}/skills/${encodeURIComponent(id)}/copy`, {
    method: 'POST',
    headers: buildHeaders(),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  const data = (await response.json()) as { data: SkillDefinition };
  return data.data;
}

export interface SkillTestResult {
  skillId: string;
  output: string;
  latencyMs: number;
  error: string;
  logs: Array<{ type: string; message: string; createdAt: string }>;
  toolCalls: Array<Record<string, unknown>>;
  knowledgeAccessed: boolean;
  tokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number };
}

export async function testSkill(id: string, input: string, baseUrl = defaultBaseUrl): Promise<SkillTestResult> {
  const response = await fetch(`${baseUrl}/skills/${encodeURIComponent(id)}/test`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ input }),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  const data = (await response.json()) as { data: SkillTestResult };
  return data.data;
}

export async function fetchAgentTeams(baseUrl = defaultBaseUrl): Promise<AgentTeam[]> {
  const response = await fetch(`${baseUrl}/agent-teams`, { headers: buildHeaders(), ...credOpts });
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { data?: AgentTeam[] };
  return payload.data ?? [];
}

export async function createAgentTeam(
  payload: { name: string; description?: string; strategy?: AgentTeam['strategy']; members: AgentTeamMember[] },
  baseUrl = defaultBaseUrl,
): Promise<AgentTeam> {
  const response = await fetch(`${baseUrl}/agent-teams`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(payload),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  const data = (await response.json()) as { data: AgentTeam };
  return data.data;
}

export async function generateAgent(
  payload: { requirement: string; model: string; persist?: boolean },
  baseUrl = defaultBaseUrl,
): Promise<AgentDefinition> {
  const response = await fetch(`${baseUrl}/agents/generate`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(payload),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  const data = (await response.json()) as { data: AgentDefinition };
  return data.data;
}

export async function fetchAgentMarketplaceTemplates(baseUrl = defaultBaseUrl): Promise<AgentMarketplaceTemplate[]> {
  const response = await fetch(`${baseUrl}/agents/marketplace/templates`, { headers: buildHeaders(), ...credOpts });
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { data?: AgentMarketplaceTemplate[] };
  return payload.data ?? [];
}

export async function installAgentMarketplaceTemplate(
  payload: { templateId: string; model: string },
  baseUrl = defaultBaseUrl,
): Promise<AgentDefinition> {
  const response = await fetch(`${baseUrl}/agents/marketplace/install`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(payload),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  const data = (await response.json()) as { data: AgentDefinition };
  return data.data;
}

export async function createAgentMarketplaceTemplate(
  payload: { name: string; description?: string; category?: string; sourceAgentId: string },
  baseUrl = defaultBaseUrl,
): Promise<AgentMarketplaceTemplate> {
  const response = await fetch(`${baseUrl}/agents/marketplace/templates`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(payload),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  const data = (await response.json()) as { data: AgentMarketplaceTemplate };
  return data.data;
}

export async function runAgentTeam(
  id: string,
  input: string,
  baseUrl = defaultBaseUrl,
): Promise<AgentTeamRun> {
  const response = await fetch(`${baseUrl}/agent-teams/${encodeURIComponent(id)}/runs`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ input }),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  const data = (await response.json()) as { data: AgentTeamRun };
  return data.data;
}

export async function fetchMcpServers(baseUrl = defaultBaseUrl): Promise<McpServer[]> {
  const response = await fetch(`${baseUrl}/mcp/servers`, { headers: buildHeaders(), ...credOpts });
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { data?: McpServer[] };
  return payload.data ?? [];
}

export async function createMcpServer(
  payload: { name: string; serverType: 'notion'; config: Record<string, unknown>; enabled?: boolean },
  baseUrl = defaultBaseUrl,
): Promise<McpServer> {
  const response = await fetch(`${baseUrl}/mcp/servers`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(payload),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  const data = (await response.json()) as { data: McpServer };
  return data.data;
}

export async function testMcpServer(id: string, query = 'test', baseUrl = defaultBaseUrl): Promise<Record<string, unknown>> {
  const response = await fetch(`${baseUrl}/mcp/servers/${encodeURIComponent(id)}/test`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ query }),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  const data = (await response.json()) as { data: Record<string, unknown> };
  return data.data;
}

export async function fetchAgentVersions(id: string, baseUrl = defaultBaseUrl): Promise<AgentVersion[]> {
  const response = await fetch(`${baseUrl}/agents/${encodeURIComponent(id)}/versions`, { headers: buildHeaders(), ...credOpts });
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { data?: AgentVersion[] };
  return payload.data ?? [];
}

export async function createAgentVersion(id: string, label = '', baseUrl = defaultBaseUrl): Promise<AgentVersion> {
  const response = await fetch(`${baseUrl}/agents/${encodeURIComponent(id)}/versions`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ label }),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  const data = (await response.json()) as { data: AgentVersion };
  return data.data;
}

export async function restoreAgentVersion(id: string, versionId: string, baseUrl = defaultBaseUrl): Promise<AgentDefinition> {
  const response = await fetch(`${baseUrl}/agents/${encodeURIComponent(id)}/versions/${encodeURIComponent(versionId)}/restore`, {
    method: 'POST',
    headers: buildHeaders(),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  const data = (await response.json()) as { data: AgentDefinition };
  return data.data;
}

export async function fetchAgentTestSuites(id: string, baseUrl = defaultBaseUrl): Promise<AgentTestSuite[]> {
  const response = await fetch(`${baseUrl}/agents/${encodeURIComponent(id)}/test-suites`, { headers: buildHeaders(), ...credOpts });
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { data?: AgentTestSuite[] };
  return payload.data ?? [];
}

export async function createAgentTestSuite(
  id: string,
  payload: { name: string; description?: string },
  baseUrl = defaultBaseUrl,
): Promise<AgentTestSuite> {
  const response = await fetch(`${baseUrl}/agents/${encodeURIComponent(id)}/test-suites`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(payload),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  const data = (await response.json()) as { data: AgentTestSuite };
  return data.data;
}

export async function fetchAgentTestCases(suiteId: string, baseUrl = defaultBaseUrl): Promise<AgentTestCase[]> {
  const response = await fetch(`${baseUrl}/agents/test-suites/${encodeURIComponent(suiteId)}/cases`, { headers: buildHeaders(), ...credOpts });
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { data?: AgentTestCase[] };
  return payload.data ?? [];
}

export async function createAgentTestCase(
  suiteId: string,
  payload: { name: string; input: string; expectedOutput?: string; rubric?: string },
  baseUrl = defaultBaseUrl,
): Promise<AgentTestCase> {
  const response = await fetch(`${baseUrl}/agents/test-suites/${encodeURIComponent(suiteId)}/cases`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(payload),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  const data = (await response.json()) as { data: AgentTestCase };
  return data.data;
}

export async function runAgentTestSuite(suiteId: string, baseUrl = defaultBaseUrl): Promise<Record<string, unknown>> {
  const response = await fetch(`${baseUrl}/agents/test-suites/${encodeURIComponent(suiteId)}/runs`, {
    method: 'POST',
    headers: buildHeaders(),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  const data = (await response.json()) as { data: Record<string, unknown> };
  return data.data;
}

export async function invokeTool(
  id: string,
  args: Record<string, unknown>,
  baseUrl = defaultBaseUrl,
): Promise<ToolInvocationResult> {
  const response = await fetch(`${baseUrl}/tools/${encodeURIComponent(id)}/invoke`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ args }),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { data: ToolInvocationResult };
  return payload.data;
}

export async function fetchKnowledgeBases(baseUrl = defaultBaseUrl): Promise<KnowledgeBase[]> {
  const response = await fetch(`${baseUrl}/knowledge/bases`, { headers: buildHeaders(), ...credOpts });
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { data?: KnowledgeBase[] };
  return payload.data ?? [];
}

export async function createKnowledgeBase(
  payload: { name: string; description?: string },
  baseUrl = defaultBaseUrl,
): Promise<KnowledgeBase> {
  const response = await fetch(`${baseUrl}/knowledge/bases`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(payload),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  const data = (await response.json()) as { data: KnowledgeBase };
  return data.data;
}

export async function addKnowledgeDocument(
  kbId: string,
  payload: { title: string; content: string },
  baseUrl = defaultBaseUrl,
): Promise<KnowledgeDocumentResult> {
  const response = await fetch(`${baseUrl}/knowledge/bases/${encodeURIComponent(kbId)}/documents`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(payload),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  const data = (await response.json()) as { data: KnowledgeDocumentResult };
  return data.data;
}

export async function searchKnowledgeBase(
  kbId: string,
  query: string,
  options: { mode?: 'hybrid' | 'keyword' | 'vector'; limit?: number } = {},
  baseUrl = defaultBaseUrl,
): Promise<KnowledgeSearchResult[]> {
  const response = await fetch(`${baseUrl}/knowledge/bases/${encodeURIComponent(kbId)}/search`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ query, ...options }),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { data?: KnowledgeSearchResult[] };
  return payload.data ?? [];
}

export async function fetchMemories(agentId?: string, baseUrl = defaultBaseUrl): Promise<MemoryItem[]> {
  const query = agentId ? `?agentId=${encodeURIComponent(agentId)}` : '';
  const response = await fetch(`${baseUrl}/memory${query}`, { headers: buildHeaders(), ...credOpts });
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { data?: MemoryItem[] };
  return payload.data ?? [];
}

export async function createMemory(
  payload: { content: string; agentId?: string; namespace?: string; memoryType?: string; importance?: number },
  baseUrl = defaultBaseUrl,
): Promise<MemoryItem> {
  const response = await fetch(`${baseUrl}/memory`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(payload),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  const data = (await response.json()) as { data: MemoryItem };
  return data.data;
}

export async function searchMemory(
  query: string,
  agentId?: string,
  baseUrl = defaultBaseUrl,
): Promise<MemoryItem[]> {
  const response = await fetch(`${baseUrl}/memory/search`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ query, agentId }),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { data?: MemoryItem[] };
  return payload.data ?? [];
}

export async function fetchWorkflows(baseUrl = defaultBaseUrl): Promise<Workflow[]> {
  const response = await fetch(`${baseUrl}/workflows`, { headers: buildHeaders(), ...credOpts });
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { data?: Workflow[] };
  return payload.data ?? [];
}

export async function createWorkflow(
  payload: { name: string; description?: string; nodes: WorkflowNode[] },
  baseUrl = defaultBaseUrl,
): Promise<Workflow> {
  const response = await fetch(`${baseUrl}/workflows`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(payload),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  const data = (await response.json()) as { data: Workflow };
  return data.data;
}

export async function runWorkflow(
  id: string,
  input: string,
  baseUrl = defaultBaseUrl,
): Promise<WorkflowRun> {
  const response = await fetch(`${baseUrl}/workflows/${encodeURIComponent(id)}/runs`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ input }),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  const data = (await response.json()) as { data: WorkflowRun };
  return data.data;
}

/* ───────── Admin API ───────── */

export interface AdminStats {
  totalUsers: number;
  totalRevenue: number;
  totalRequests: number;
  activeModels: number;
  newUsersToday: number;
  totalTokens: number;
}

export interface TodayStats {
  requests: number;
  revenue: number;
  tokens: number;
}

export interface ModelUsageStat {
  model: string;
  providerName: string;
  requests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  totalCost: number;
  avgCost: number;
}

export interface AdminUser {
  id: string;
  username: string;
  email: string | null;
  role: string;
  credits: number;
  totalSpent: number;
  requestCount: number;
  createdAt: string;
}

export interface AdminBillingRow {
  id: string;
  userId: string;
  username: string;
  model: string;
  requestType: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  createdAt: string;
}

export async function fetchAdminCheck(baseUrl = defaultBaseUrl): Promise<{ isAdmin: boolean; role: string }> {
  const response = await fetch(`${baseUrl}/admin/check`, { headers: buildHeaders(), ...credOpts });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as { isAdmin: boolean; role: string };
}

export async function fetchAdminStats(baseUrl = defaultBaseUrl): Promise<AdminStats> {
  const response = await fetch(`${baseUrl}/admin/stats`, { headers: buildHeaders(), ...credOpts });
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { data: AdminStats };
  return payload.data;
}

export async function fetchAdminUsers(
  page = 1, pageSize = 50, search?: string, baseUrl = defaultBaseUrl,
): Promise<{ data: AdminUser[]; total: number }> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search) params.set('search', search);
  const response = await fetch(`${baseUrl}/admin/users?${params}`, { headers: buildHeaders(), ...credOpts });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as { data: AdminUser[]; total: number };
}

export async function updateAdminUser(
  userId: string, updates: { credits?: number; role?: string }, baseUrl = defaultBaseUrl,
): Promise<AdminUser> {
  const response = await fetch(`${baseUrl}/admin/users/${userId}`, {
    method: 'PATCH',
    headers: buildHeaders(),
    body: JSON.stringify(updates),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { data: AdminUser };
  return payload.data;
}

export async function deleteAdminUser(userId: string, baseUrl = defaultBaseUrl): Promise<void> {
  const response = await fetch(`${baseUrl}/admin/users/${userId}`, {
    method: 'DELETE',
    headers: buildHeaders(),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
}

export async function resetAdminUserPassword(userId: string, password: string, baseUrl = defaultBaseUrl): Promise<void> {
  const response = await fetch(`${baseUrl}/admin/users/${userId}/password`, {
    method: 'PATCH',
    headers: buildHeaders(),
    body: JSON.stringify({ password }),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
}

export async function fetchAdminModelUsage(baseUrl = defaultBaseUrl): Promise<ModelUsageStat[]> {
  const response = await fetch(`${baseUrl}/admin/stats/models`, { headers: buildHeaders(), ...credOpts });
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { data: ModelUsageStat[] };
  return payload.data ?? [];
}

export async function fetchAdminTodayStats(baseUrl = defaultBaseUrl): Promise<TodayStats> {
  const response = await fetch(`${baseUrl}/admin/stats/today`, { headers: buildHeaders(), ...credOpts });
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { data: TodayStats };
  return payload.data;
}

export async function fetchAdminBilling(
  page = 1, pageSize = 50, filters?: { userId?: string; model?: string; fromDate?: string; toDate?: string },
  baseUrl = defaultBaseUrl,
): Promise<{ data: AdminBillingRow[]; total: number }> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (filters?.userId) params.set('userId', filters.userId);
  if (filters?.model) params.set('model', filters.model);
  if (filters?.fromDate) params.set('fromDate', filters.fromDate);
  if (filters?.toDate) params.set('toDate', filters.toDate);
  const response = await fetch(`${baseUrl}/admin/billing?${params}`, { headers: buildHeaders(), ...credOpts });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as { data: AdminBillingRow[]; total: number };
}

export function exportAdminBillingCsv(
  filters?: { userId?: string; model?: string; fromDate?: string; toDate?: string },
  baseUrl = defaultBaseUrl,
): void {
  const params = new URLSearchParams();
  if (filters?.userId) params.set('userId', filters.userId);
  if (filters?.model) params.set('model', filters.model);
  if (filters?.fromDate) params.set('fromDate', filters.fromDate);
  if (filters?.toDate) params.set('toDate', filters.toDate);
  const qs = params.toString();
  const token = getStoredToken();
  const url = `${baseUrl}/admin/billing/export${qs ? '?' + qs : ''}`;
  // Use a hidden link to trigger download with auth header
  const a = document.createElement('a');
  a.href = url;
  a.download = 'billing-export.csv';
  // For auth, we need to use fetch + blob approach
  fetch(url, { headers: buildHeaders(), ...credOpts })
    .then(async (r) => {
      if (!r.ok) throw new Error(await readError(r));
      return r.blob();
    })
    .then((blob) => {
      const blobUrl = URL.createObjectURL(blob);
      a.href = blobUrl;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    })
    .catch((e) => {
      console.error('[exportAdminBillingCsv] failed:', e);
    });
}

export async function updateAdminBillingRule(
  key: string, value: number, description?: string, baseUrl = defaultBaseUrl,
): Promise<{ key: string; value: number; description: string }> {
  const response = await fetch(`${baseUrl}/admin/billing/rules/${encodeURIComponent(key)}`, {
    method: 'PATCH',
    headers: buildHeaders(),
    body: JSON.stringify({ value, description }),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { data: { key: string; value: number; description: string } };
  return payload.data;
}

/* ───────── System Settings admin ───────── */

export interface SystemSetting {
  key: string;
  value: string;
  description: string;
}

export async function fetchAdminSettings(baseUrl = defaultBaseUrl): Promise<SystemSetting[]> {
  const response = await fetch(`${baseUrl}/admin/settings`, { headers: buildHeaders(), cache: noStore, ...credOpts });
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { data: SystemSetting[] };
  return payload.data ?? [];
}

export async function updateAdminSetting(key: string, value: string, baseUrl = defaultBaseUrl): Promise<void> {
  const response = await fetch(`${baseUrl}/admin/settings/${encodeURIComponent(key)}`, {
    method: 'PATCH',
    headers: buildHeaders(),
    body: JSON.stringify({ value }),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
}

/* ───────── Provider API Key admin ───────── */

export interface ProviderApiKeyRow {
  id: string;
  providerName: string;
  name: string;
  apiKey: string;
  keyPrefix: string;
  createdAt: string;
}

export async function fetchAdminProviderKeys(
  provider?: string,
  baseUrl = defaultBaseUrl,
): Promise<ProviderApiKeyRow[]> {
  const params = new URLSearchParams();
  if (provider) params.set('provider', provider);
  const qs = params.toString();
  const response = await fetch(`${baseUrl}/admin/provider-keys${qs ? '?' + qs : ''}`, {
    headers: buildHeaders(),
    cache: noStore,
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { data: ProviderApiKeyRow[] };
  return payload.data ?? [];
}

export async function createAdminProviderKey(
  dto: { provider: string; name?: string; key: string },
  baseUrl = defaultBaseUrl,
): Promise<ProviderApiKeyRow> {
  const response = await fetch(`${baseUrl}/admin/provider-keys`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(dto),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { data: ProviderApiKeyRow };
  return payload.data;
}

export async function deleteAdminProviderKey(
  id: string,
  baseUrl = defaultBaseUrl,
): Promise<void> {
  const response = await fetch(`${baseUrl}/admin/provider-keys/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: buildHeaders(),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
}

/* ───────── Provider Config admin ───────── */

export interface ProviderConfigRow {
  id: string;
  providerName: string;
  displayName: string;
  baseUrl: string;
  models: string;
  modelPrefix: string | null;
  authHeader: string;
  authPrefix: string;
  timeoutMs: number;
  retryCount: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderConfigInput {
  providerName: string;
  displayName: string;
  baseUrl: string;
  models: string;
  modelPrefix?: string;
  authHeader?: string;
  authPrefix?: string;
  timeoutMs?: number;
  retryCount?: number;
}

export async function fetchAdminProviderConfigs(
  baseUrl = defaultBaseUrl,
): Promise<ProviderConfigRow[]> {
  const response = await fetch(`${baseUrl}/admin/provider-configs`, {
    headers: buildHeaders(),
    cache: noStore,
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { data: ProviderConfigRow[] };
  return payload.data ?? [];
}

export async function createAdminProviderConfig(
  input: ProviderConfigInput,
  baseUrl = defaultBaseUrl,
): Promise<ProviderConfigRow> {
  const response = await fetch(`${baseUrl}/admin/provider-configs`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(input),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { data: ProviderConfigRow };
  return payload.data;
}

export async function updateAdminProviderConfig(
  id: string,
  input: Partial<ProviderConfigInput> & { enabled?: boolean },
  baseUrl = defaultBaseUrl,
): Promise<ProviderConfigRow> {
  const response = await fetch(
    `${baseUrl}/admin/provider-configs/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: buildHeaders(),
      body: JSON.stringify(input),
      ...credOpts,
    },
  );
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { data: ProviderConfigRow };
  return payload.data;
}

export async function deleteAdminProviderConfig(
  id: string,
  baseUrl = defaultBaseUrl,
): Promise<void> {
  const response = await fetch(
    `${baseUrl}/admin/provider-configs/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
      headers: buildHeaders(),
      ...credOpts,
    },
  );
  if (!response.ok) throw new Error(await readError(response));
}

/* ───────── Model Tier admin ───────── */

export interface TierPriceInfo {
  prompt: number;
  completion: number;
  description: string;
}

export interface ModelTiersData {
  tiers: Record<string, string[]>;
  prices: Record<string, TierPriceInfo>;
  labels: Record<string, string>;
}

export async function fetchAdminModelTiers(baseUrl = defaultBaseUrl): Promise<ModelTiersData> {
  const response = await fetch(`${baseUrl}/admin/model-tiers`, {
    headers: buildHeaders(),
    cache: noStore,
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { data: ModelTiersData };
  return payload.data;
}

export async function updateAdminModelTiers(
  data: { tiers: Record<string, string[]>; prices: Record<string, TierPriceInfo>; labels?: Record<string, string> },
  baseUrl = defaultBaseUrl,
): Promise<ModelTiersData> {
  const response = await fetch(`${baseUrl}/admin/model-tiers`, {
    method: 'PUT',
    headers: buildHeaders(),
    body: JSON.stringify(data),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { data: ModelTiersData };
  return payload.data;
}

export async function addModelsToTier(
  tierKey: string,
  models: string[],
  baseUrl = defaultBaseUrl,
): Promise<{ tiers: Record<string, string[]> }> {
  const response = await fetch(
    `${baseUrl}/admin/model-tiers/${encodeURIComponent(tierKey)}/models`,
    {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ models }),
      ...credOpts,
    },
  );
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { data: { tiers: Record<string, string[]> } };
  return payload.data;
}

export async function removeModelFromTier(
  tierKey: string,
  modelId: string,
  baseUrl = defaultBaseUrl,
): Promise<{ tiers: Record<string, string[]> }> {
  const response = await fetch(
    `${baseUrl}/admin/model-tiers/${encodeURIComponent(tierKey)}/models/${encodeURIComponent(modelId)}`,
    {
      method: 'DELETE',
      headers: buildHeaders(),
      ...credOpts,
    },
  );
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { data: { tiers: Record<string, string[]> } };
  return payload.data;
}

/* ───────── Recharge (Alipay) ───────── */

export interface RechargeOrder {
  id: string;
  amount: number;
  status: string;
  qrCode: string | null;
  alipayTradeNo: string | null;
  createdAt: string;
  paidAt: string | null;
}

export async function createRechargeOrder(
  amount: number,
  baseUrl = defaultBaseUrl,
): Promise<RechargeOrder> {
  const response = await fetch(`${baseUrl}/recharge/orders`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ amount }),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { data: RechargeOrder };
  return payload.data;
}

export async function fetchRechargeOrders(
  page = 1,
  pageSize = 20,
  baseUrl = defaultBaseUrl,
): Promise<{ data: RechargeOrder[]; total: number }> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  const response = await fetch(`${baseUrl}/recharge/orders?${params}`, {
    headers: buildHeaders(),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as { data: RechargeOrder[]; total: number };
}

export async function fetchRechargeOrder(
  orderId: string,
  baseUrl = defaultBaseUrl,
): Promise<RechargeOrder> {
  const response = await fetch(`${baseUrl}/recharge/orders/${encodeURIComponent(orderId)}`, {
    headers: buildHeaders(),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { data: RechargeOrder };
  return payload.data;
}

export async function checkRechargeOrder(
  orderId: string,
  baseUrl = defaultBaseUrl,
): Promise<RechargeOrder> {
  const response = await fetch(`${baseUrl}/recharge/orders/${encodeURIComponent(orderId)}/check`, {
    method: 'POST',
    headers: buildHeaders(),
    ...credOpts,
  });
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { data: RechargeOrder };
  return payload.data;
}
