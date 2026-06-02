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
  content: string;
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
    response = await fetch(`${baseUrl}/models`, { headers: buildHeaders(), signal, ...credOpts });
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
  const response = await fetch(`${baseUrl}/admin/settings`, { headers: buildHeaders(), ...credOpts });
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
