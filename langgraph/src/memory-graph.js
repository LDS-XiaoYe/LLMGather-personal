import { randomUUID } from "node:crypto";
import { Annotation, END, START, StateGraph, getStore } from "@langchain/langgraph";

const MAX_CONTENT_LENGTH = 20_000;
const MAX_RESULT_CONTENT_LENGTH = 8_000;
const DEFAULT_NAMESPACE = "default";
const GLOBAL_AGENT = "global";
const SUPPORTED_OPERATIONS = new Set(["put", "search", "get", "delete"]);

const MemoryState = Annotation.Root({
  operation: Annotation({ default: () => "search" }),
  userId: Annotation({ default: () => "" }),
  agentId: Annotation({ default: () => null }),
  namespace: Annotation({ default: () => DEFAULT_NAMESPACE }),
  namespacePath: Annotation({ default: () => [] }),
  key: Annotation({ default: () => "" }),
  value: Annotation({ default: () => null }),
  content: Annotation({ default: () => "" }),
  memoryType: Annotation({ default: () => "" }),
  importance: Annotation({ default: () => 3 }),
  metadata: Annotation({ default: () => ({}) }),
  query: Annotation({ default: () => "" }),
  limit: Annotation({ default: () => 5 }),
  includeGlobal: Annotation({ default: () => true }),
  result: Annotation({ default: () => null }),
  results: Annotation({ default: () => [] }),
  status: Annotation({ default: () => "idle" }),
  error: Annotation({ default: () => "" }),
  audit: Annotation({ default: () => [] }),
});

function normalizeOperation(operation) {
  const normalized = String(operation || "search").trim().toLowerCase();
  if (["create", "update", "write", "remember", "upsert"].includes(normalized)) return "put";
  if (["remove", "forget", "del"].includes(normalized)) return "delete";
  return SUPPORTED_OPERATIONS.has(normalized) ? normalized : "search";
}

function sanitizeSegment(value, fallback) {
  const cleaned = String(value ?? "").trim();
  return cleaned ? cleaned.slice(0, 128) : fallback;
}

function normalizeAgentId(value) {
  const cleaned = String(value ?? "").trim();
  return cleaned && cleaned !== GLOBAL_AGENT ? cleaned.slice(0, 128) : null;
}

function normalizeNamespacePath(state, includeNamespace = true) {
  if (Array.isArray(state.namespacePath) && state.namespacePath.length > 0) {
    return state.namespacePath.map((item) => sanitizeSegment(item, DEFAULT_NAMESPACE));
  }
  const base = [
    "llmgather",
    sanitizeSegment(state.userId, "anonymous"),
    normalizeAgentId(state.agentId) || GLOBAL_AGENT,
  ];
  if (includeNamespace) base.push(sanitizeSegment(state.namespace, DEFAULT_NAMESPACE));
  return base;
}

function normalizeLimit(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 5;
  return Math.max(1, Math.min(50, Math.floor(numeric)));
}

function truncate(value, maxLength) {
  const text = String(value ?? "");
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

function redactSensitiveText(value) {
  return String(value ?? "")
    .replace(/(sk-[A-Za-z0-9_-]{16,})/g, "[REDACTED_OPENAI_KEY]")
    .replace(/(api[_-]?key|token|secret|password)\s*[:=]\s*["']?[^"'\s,;]+/gi, "$1=[REDACTED]");
}

function buildMemoryValue(state) {
  const incoming = state.value && typeof state.value === "object" && !Array.isArray(state.value)
    ? state.value
    : {};
  const content = redactSensitiveText(incoming.content ?? state.content);
  return {
    ...incoming,
    content: truncate(content, MAX_CONTENT_LENGTH),
    memoryType: sanitizeSegment(incoming.memoryType ?? state.memoryType, "fact"),
    importance: Math.max(1, Math.min(5, Number(incoming.importance ?? state.importance ?? 3) || 3)),
    userId: sanitizeSegment(incoming.userId ?? state.userId, "anonymous"),
    agentId: normalizeAgentId(incoming.agentId ?? state.agentId),
    namespace: sanitizeSegment(incoming.namespace ?? state.namespace, DEFAULT_NAMESPACE),
    metadata: incoming.metadata && typeof incoming.metadata === "object" ? incoming.metadata : state.metadata ?? {},
    updatedBy: "langgraph-memory-graph",
  };
}

function getGraphStore(config) {
  const store = config?.store ?? getStore(config);
  if (!store) {
    throw new Error("LangGraph Store 未注入，无法执行持久记忆图");
  }
  return store;
}

function serializeItem(item) {
  if (!item) return null;
  const value = item.value && typeof item.value === "object" ? item.value : {};
  return {
    key: String(item.key || ""),
    namespace: Array.isArray(item.namespace) ? item.namespace : [],
    value: {
      ...value,
      content: truncate(redactSensitiveText(value.content || value.text || ""), MAX_RESULT_CONTENT_LENGTH),
    },
    createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt,
    updatedAt: item.updatedAt instanceof Date ? item.updatedAt.toISOString() : item.updatedAt,
    score: Number(item.score ?? 0),
  };
}

function mergeSearchResults(resultGroups, limit) {
  const byId = new Map();
  for (const item of resultGroups.flat()) {
    const serialized = serializeItem(item);
    if (!serialized) continue;
    const id = `${serialized.namespace.join("/")}:${serialized.key}`;
    const existing = byId.get(id);
    if (!existing || Number(serialized.score ?? 0) > Number(existing.score ?? 0)) {
      byId.set(id, serialized);
    }
  }
  return Array.from(byId.values())
    .sort((a, b) => {
      const scoreDiff = Number(b.score ?? 0) - Number(a.score ?? 0);
      if (scoreDiff) return scoreDiff;
      const importanceDiff = Number(b.value?.importance ?? 0) - Number(a.value?.importance ?? 0);
      if (importanceDiff) return importanceDiff;
      return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
    })
    .slice(0, limit);
}

async function normalizeInput(state) {
  const operation = normalizeOperation(state.operation);
  const agentId = normalizeAgentId(state.agentId);
  const namespace = sanitizeSegment(state.namespace, DEFAULT_NAMESPACE);
  const key = sanitizeSegment(
    state.key,
    `${sanitizeSegment(state.userId, "anonymous")}:${agentId || GLOBAL_AGENT}:${namespace}:${operation}:${randomUUID()}`,
  );
  return {
    ...state,
    operation,
    userId: sanitizeSegment(state.userId, "anonymous"),
    agentId,
    namespace,
    key,
    memoryType: String(state.memoryType ?? "").trim(),
    limit: normalizeLimit(state.limit),
    includeGlobal: state.includeGlobal !== false,
    status: "running",
    error: "",
    audit: [`normalize:${operation}`],
  };
}

function routeOperation(state) {
  return state.operation;
}

async function putMemory(state, config) {
  const store = getGraphStore(config);
  const namespacePath = normalizeNamespacePath(state);
  const value = buildMemoryValue(state);
  await store.put(namespacePath, state.key, value);
  return {
    ...state,
    namespacePath,
    value,
    result: { key: state.key, namespace: namespacePath, value },
    status: "succeeded",
    audit: [...state.audit, "store.put"],
  };
}

async function getMemory(state, config) {
  const store = getGraphStore(config);
  const namespacePath = normalizeNamespacePath(state);
  const item = await store.get(namespacePath, state.key);
  return {
    ...state,
    namespacePath,
    result: serializeItem(item),
    status: item ? "succeeded" : "not_found",
    audit: [...state.audit, "store.get"],
  };
}

async function searchMemory(state, config) {
  const store = getGraphStore(config);
  const agentId = normalizeAgentId(state.agentId);
  const prefixes = [normalizeNamespacePath({ ...state, agentId }, false)];
  if (state.includeGlobal && agentId) {
    prefixes.push(normalizeNamespacePath({ ...state, agentId: null }, false));
  }
  const filter = state.memoryType ? { memoryType: sanitizeSegment(state.memoryType, "fact") } : undefined;
  const searches = await Promise.all(prefixes.map((prefix) => store.search(prefix, {
    query: String(state.query || state.content || "").trim() || undefined,
    filter,
    limit: state.limit,
  })));
  const results = mergeSearchResults(searches, state.limit);
  return {
    ...state,
    namespacePath: prefixes[0],
    results,
    status: "succeeded",
    audit: [...state.audit, `store.search:${prefixes.length}`],
  };
}

async function deleteMemory(state, config) {
  const store = getGraphStore(config);
  const namespacePath = normalizeNamespacePath(state);
  await store.delete(namespacePath, state.key);
  return {
    ...state,
    namespacePath,
    result: { key: state.key, namespace: namespacePath, deleted: true },
    status: "succeeded",
    audit: [...state.audit, "store.delete"],
  };
}

async function finalize(state) {
  return {
    ...state,
    audit: [...state.audit, "finalize"],
  };
}

export const graph = new StateGraph(MemoryState)
  .addNode("normalize", normalizeInput)
  .addNode("put", putMemory)
  .addNode("get", getMemory)
  .addNode("search", searchMemory)
  .addNode("delete", deleteMemory)
  .addNode("finalize", finalize)
  .addEdge(START, "normalize")
  .addConditionalEdges("normalize", routeOperation, {
    put: "put",
    get: "get",
    search: "search",
    delete: "delete",
  })
  .addEdge("put", "finalize")
  .addEdge("get", "finalize")
  .addEdge("search", "finalize")
  .addEdge("delete", "finalize")
  .addEdge("finalize", END)
  .compile({ name: "llmgather-memory-graph" });
