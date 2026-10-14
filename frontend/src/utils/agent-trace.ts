import type { AgentRun, AgentRunStep } from '../api';

export function traceJson(value: string | undefined): any {
  try { return JSON.parse(value || 'null'); } catch { return null; }
}

export function traceStepFailed(step: AgentRunStep): boolean {
  if (step.status === 'failed' || step.error) return true;
  const children = step.stepType === 'tool_calling' ? traceJson(step.output) : null;
  return Array.isArray(children) && children.some(item => item?.status === 'failed' || item?.error);
}

export function traceTools(steps: AgentRunStep[]) {
  return steps.filter(step => step.stepType.includes('tool') && (step.output || step.error)).flatMap(step => {
    const metadata = traceJson(step.metadata) || {};
    const children = step.stepType === 'tool_calling' ? traceJson(step.output) : null;
    if (Array.isArray(children) && children.length && children.every(item => item && typeof item === 'object' && 'status' in item)) {
      return children.map((item, index) => ({
        id: `${step.id}-${index}`, name: item.toolName || step.name,
        toolName: item.toolName || step.name, deterministic: Boolean(metadata.deterministic),
        status: item.error ? 'failed' : item.status, input: item.input,
        output: item.output ?? item.error ?? '', error: item.error || '', latencyMs: item.latencyMs ?? null,
      }));
    }
    return [{ id: String(step.id), name: step.name, toolName: metadata.toolName || step.name,
      deterministic: Boolean(metadata.deterministic), status: step.status, input: step.input,
      output: step.output || step.error, error: step.error || '', latencyMs: step.latencyMs ?? null }];
  });
}

// Only use recorded data, never the current Agent editor. Legacy absence is unknown.
export function traceRecordedConfig(run: AgentRun | null) {
  for (const step of run?.steps ?? []) {
    const snapshot = traceJson(step.metadata)?.runtimeSnapshot;
    if (snapshot && typeof snapshot === 'object') return snapshot;
  }
  return null;
}

export function traceSnapshot(run: AgentRun | null, selected: AgentRunStep | null) {
  const index = selected ? run?.steps.findIndex(step => step.id === selected.id) ?? -1 : -1;
  const visible = index >= 0 ? run!.steps.slice(0, index + 1) : [];
  const config = visible.map(step => traceJson(step.metadata)?.runtimeSnapshot).find(Boolean);
  const request = traceJson(selected?.metadata)?.requestSnapshot;
  const tool = [...visible].reverse().find(step => /tool|observation/.test(step.stepType));
  return {
    model: request?.model || config?.model || run?.model || '',
    prompt: config?.systemPrompt ?? '未记录',
    parameters: request ? { temperature: request.temperature, maxTokens: request.max_tokens } : config?.parameters ?? null,
    messages: request?.messages ?? null,
    note: request?.omitted || config?.omitted || '',
    toolInput: tool?.input || '', toolOutput: tool?.output || tool?.error || '',
    memoryState: visible.filter(step => step.stepType.includes('memory')).map(step => ({ name: step.name, status: step.status, output: step.output || step.error })),
  };
}

export function traceSources(run: AgentRun | null): Record<string, number | null> {
  const counts: Record<string, number | null> = { knowledge: null, memory: null, skill: null };
  const identities: Record<string, Set<string>> = {};
  for (const step of run?.steps ?? []) {
    const metadata = traceJson(step.metadata) || {};
    const category = /rag|knowledge/.test(step.stepType) ? 'knowledge' : /memory_read|memory_retrieval/.test(step.stepType) ? 'memory' : /skill/.test(step.stepType) ? 'skill' : '';
    if (Array.isArray(metadata.contextSources) && (category || metadata.contextSources.length)) {
      if (category && counts[category] === null) counts[category] = 0;
      for (const source of metadata.contextSources) {
        const type = String(source?.type || category || 'unknown');
        const key = source?.id ? String(source.id) : JSON.stringify(source);
        const set = identities[type] ??= new Set();
        if (!set.has(key)) { set.add(key); counts[type] = (counts[type] ?? 0) + 1; }
      }
    } else if (category) {
      const output = traceJson(step.output);
      const count = Array.isArray(output) ? output.length : Number.isInteger(metadata.count) && metadata.count >= 0 ? metadata.count : null;
      if (count !== null) counts[category] = Math.max(counts[category] ?? 0, count);
    }
  }
  return counts;
}

export function traceComparison(current: AgentRun | null, baseline: AgentRun | null) {
  const before = traceRecordedConfig(baseline), after = traceRecordedConfig(current);
  return {
    current, baseline,
    inputDiff: { before: baseline?.input ?? '未选择', after: current?.input ?? '未选择' },
    modelDiff: { before: baseline?.model ?? '未选择', after: current?.model ?? '未选择' },
    promptDiff: { before: before?.systemPrompt ?? '未记录', after: after?.systemPrompt ?? '未记录' },
    skillDiff: { before: before?.skillIds ?? '未记录', after: after?.skillIds ?? '未记录' },
    workflowDiff: { before: before?.workflow ?? '未记录', after: after?.workflow ?? '未记录' },
    stepDiff: { before: baseline?.steps.map(step => ({ name: step.name, type: step.stepType, status: traceStepFailed(step) ? 'failed' : step.status })) ?? [],
      after: current?.steps.map(step => ({ name: step.name, type: step.stepType, status: traceStepFailed(step) ? 'failed' : step.status })) ?? [] },
  };
}

export function formatTraceDisplayValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '无';
  if (Array.isArray(value) && value.length === 0) return '无';
  if (typeof value !== 'string') return JSON.stringify(value, null, 2);
  const raw = value.trim();
  if (!raw) return '无';
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length === 0) return '无';
    // Keep the entire recorded payload: extracting result/stdout loses errors,
    // logs, exit codes and other evidence needed to diagnose a failed tool.
    return typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2);
  } catch {
    return value
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '  ');
  }
}
