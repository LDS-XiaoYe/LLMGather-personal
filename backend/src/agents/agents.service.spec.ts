jest.mock('@langchain/langgraph', () => ({
  Annotation: { Root: jest.fn() },
  START: '__start__',
  END: '__end__',
  StateGraph: jest.fn(),
}));

import { AgentRun, AgentsService } from './agents.service';
import { ToolDefinition } from '../tools/tools.service';

function makeTool(overrides: Partial<ToolDefinition> = {}): ToolDefinition {
  return {
    id: overrides.id ?? 'tool-1',
    userId: overrides.userId ?? 'user-1',
    name: overrides.name ?? 'calculator',
    displayName: overrides.displayName ?? 'Calculator',
    description: overrides.description ?? 'Calculate arithmetic expressions',
    schema: overrides.schema ?? {
      type: 'object',
      properties: { expression: { type: 'string' } },
      required: ['expression'],
    },
    outputSchema: overrides.outputSchema,
    permissions: overrides.permissions ?? {},
    implementationType: overrides.implementationType ?? 'builtin',
    source: overrides.source ?? 'builtin',
    category: overrides.category ?? 'utility',
    runtime: overrides.runtime ?? 'javascript',
    riskLevel: overrides.riskLevel ?? 'low',
    code: overrides.code,
    version: overrides.version ?? 1,
    callCount: overrides.callCount ?? 0,
    timeoutMs: overrides.timeoutMs ?? 30000,
    retries: overrides.retries ?? 0,
    enabled: overrides.enabled ?? true,
    permissionLevel: overrides.permissionLevel ?? 'auto',
  };
}

function makeService(overrides: {
  completions?: unknown[];
  invoke?: jest.Mock;
  getAgentTools?: jest.Mock;
} = {}) {
  const chatService = {
    createCompletion: jest.fn(),
  };
  for (const completion of overrides.completions ?? []) {
    chatService.createCompletion.mockResolvedValueOnce(completion);
  }

  const billingService = {
    chargeForCompletion: jest.fn(async () => ({ credits: 99 })),
    getBalance: jest.fn(async () => ({ credits: 99 })),
  };
  const toolsService = {
    invoke: overrides.invoke ?? jest.fn(async () => ({
      id: 'inv-1',
      toolId: 'tool-1',
      toolName: 'calculator',
      input: { expression: '1+2' },
      output: '3',
      status: 'succeeded',
      error: '',
      latencyMs: 3,
    })),
    getAgentTools: overrides.getAgentTools ?? jest.fn(),
    listForUser: jest.fn(),
  };
  const databaseService = {
    now: jest.fn(() => '2026-06-09 09:00:00.000'),
    connection: { prepare: jest.fn() },
  };

  const service = new AgentsService(
    databaseService as never,
    chatService as never,
    billingService as never,
    toolsService as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, chatService, billingService, toolsService };
}

const agent = {
  id: 'agent-1',
  userId: 'user-1',
  name: 'Harness Agent',
  description: '',
  model: 'qwen-plus',
  systemPrompt: '',
  temperature: 0.2,
  maxTokens: 1024,
  memoryEnabled: false,
  toolIds: ['tool-1'],
  knowledgeBaseIds: [],
  skillIds: [],
  workflowIds: [],
  subAgentIds: [],
  published: false,
  apiEnabled: false,
  publicSlug: '',
  status: 'active' as const,
  createdAt: '',
  updatedAt: '',
  runCount: 0,
};

function makeRun(overrides: Partial<AgentRun> = {}): AgentRun {
  return {
    id: overrides.id ?? 'run-1',
    agentId: overrides.agentId ?? 'agent-1',
    userId: overrides.userId ?? 'user-1',
    status: overrides.status ?? 'succeeded',
    conversationId: overrides.conversationId ?? 'conversation-1',
    parentRunId: overrides.parentRunId ?? null,
    input: overrides.input ?? '写一段论文摘要',
    output: overrides.output ?? '这是一段完整的论文摘要，包含研究背景、方法、发现和结论，足以触发自动评测输出分。',
    model: overrides.model ?? 'qwen-plus',
    error: overrides.error ?? '',
    promptTokens: overrides.promptTokens ?? 100,
    completionTokens: overrides.completionTokens ?? 200,
    totalTokens: overrides.totalTokens ?? 300,
    latencyMs: overrides.latencyMs ?? 1200,
    createdAt: overrides.createdAt ?? '2026-06-09 09:00:00.000',
    completedAt: overrides.completedAt ?? '2026-06-09 09:00:01.200',
    steps: overrides.steps ?? [{
      id: 1,
      runId: overrides.id ?? 'run-1',
      stepType: 'llm_completion',
      name: '最终回答',
      status: 'succeeded',
      input: overrides.input ?? '写一段论文摘要',
      output: overrides.output ?? '这是一段完整的论文摘要，包含研究背景、方法、发现和结论，足以触发自动评测输出分。',
      error: '',
      startedAt: '2026-06-09 09:00:00.000',
      endedAt: '2026-06-09 09:00:01.200',
      latencyMs: 1200,
      metadata: '{}',
    }],
  };
}

function completion(content: string, toolCalls: unknown[] = []) {
  return {
    id: `cmpl-${Math.random()}`,
    object: 'chat.completion',
    created: 0,
    model: 'qwen-plus',
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content,
        ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
      },
      finish_reason: toolCalls.length ? 'tool_calls' : 'stop',
    }],
    usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
  };
}

async function completeStep(
  stepId: number,
  status: 'succeeded' | 'failed',
  output: string,
  error = '',
  metadata: Record<string, unknown> = {},
) {
  return {
    id: stepId ?? 0,
    runId: 'run-1',
    stepType: 'llm_completion',
    name: '完成步骤',
    status,
    input: '',
    output,
    error,
    startedAt: '2026-06-09 09:00:00.000',
    endedAt: '2026-06-09 09:00:00.100',
    latencyMs: 100,
    metadata: JSON.stringify(metadata),
  };
}

describe('AgentsService function calling harness', () => {
  it('converts bound tools to OpenAI function definitions', () => {
    const { service } = makeService();
    const converted = (service as any).toolDefinitionToChatTool(makeTool());
    expect(converted).toEqual({
      type: 'function',
      function: {
        name: 'calculator',
        description: 'Calculate arithmetic expressions',
        parameters: {
          type: 'object',
          properties: { expression: { type: 'string' } },
          required: ['expression'],
        },
      },
    });

    const emptySchema = (service as any).toolDefinitionToChatTool(makeTool({ schema: {} }));
    expect(emptySchema.function.parameters).toEqual({ type: 'object', properties: {} });
  });

  it('executes a model tool_call and feeds the tool result back into the next LLM turn', async () => {
    const toolCall = {
      id: 'call-1',
      type: 'function',
      function: { name: 'calculator', arguments: '{"expression":"1+2"}' },
    };
    const { service, chatService, toolsService, billingService } = makeService({
      completions: [completion('', [toolCall]), completion('结果是 3')],
    });
    const steps: unknown[] = [];

    const output = await (service as any).runToolUseHarness(
      'user-1',
      agent,
      { input: '计算 1+2' },
      'run-1',
      { model: 'qwen-plus', messages: [{ role: 'user', content: '计算 1+2' }] },
      [makeTool()],
      [],
      3,
      async (step: unknown) => { steps.push(step); return step; },
      completeStep,
      { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    );

    expect(output).toBe('结果是 3');
    expect(toolsService.invoke).toHaveBeenCalledWith('user-1', 'tool-1', { expression: '1+2' }, { agentId: 'agent-1', runId: 'run-1' });
    expect(chatService.createCompletion).toHaveBeenCalledTimes(2);
    expect((chatService.createCompletion.mock.calls[1][0].messages)).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'assistant', tool_calls: [toolCall] }),
      expect.objectContaining({ role: 'tool', tool_call_id: 'call-1', content: '3', name: 'calculator' }),
    ]));
    expect(steps).toEqual(expect.arrayContaining([
      expect.objectContaining({ stepType: 'tool_call', status: 'succeeded' }),
      expect.objectContaining({ stepType: 'observation', status: 'succeeded' }),
    ]));
    expect(billingService.chargeForCompletion).toHaveBeenCalledTimes(2);
  });

  it('executes multiple tool_calls in return order', async () => {
    const calls = [
      { id: 'call-1', type: 'function', function: { name: 'calculator', arguments: '{"expression":"1+2"}' } },
      { id: 'call-2', type: 'function', function: { name: 'current_time', arguments: '{"timezone":"Asia/Shanghai"}' } },
    ];
    const invoke = jest.fn()
      .mockResolvedValueOnce({ output: '3', status: 'succeeded', error: '', id: '1', toolId: 'tool-1', toolName: 'calculator', input: {}, latencyMs: 1 })
      .mockResolvedValueOnce({ output: '星期二', status: 'succeeded', error: '', id: '2', toolId: 'tool-2', toolName: 'current_time', input: {}, latencyMs: 1 });
    const { service } = makeService({ completions: [completion('', calls), completion('完成')], invoke });

    await (service as any).runToolUseHarness(
      'user-1',
      agent,
      { input: '计算并告诉我时间' },
      'run-1',
      { model: 'qwen-plus', messages: [{ role: 'user', content: '计算并告诉我时间' }] },
      [makeTool(), makeTool({ id: 'tool-2', name: 'current_time', displayName: 'Current time', schema: { type: 'object', properties: { timezone: { type: 'string' } } } })],
      [],
      3,
      async (step: unknown) => step,
      completeStep,
      { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    );

    expect(invoke.mock.calls.map((call) => call[1])).toEqual(['tool-1', 'tool-2']);
  });

  it('executes delegate_agent calls and feeds the child result back into the next LLM turn', async () => {
    const delegateCall = {
      id: 'call-delegate',
      type: 'function',
      function: { name: 'delegate_agent', arguments: '{"agentId":"agent-2","task":"核查事实","reason":"需要专家复核"}' },
    };
    const childAgent = { ...agent, id: 'agent-2', name: 'Fact Checker', subAgentIds: [] };
    const { service, chatService } = makeService({
      completions: [completion('', [delegateCall]), completion('已经综合子 Agent 结果')],
    });
    (service as any).delegateUserAgent = jest.fn(async () => ({
      observation: 'Fact Checker (succeeded) runId=child-run\n事实无误',
      run: makeRun({ id: 'child-run', agentId: 'agent-2', output: '事实无误' }),
    }));

    const output = await (service as any).runToolUseHarness(
      'user-1',
      { ...agent, subAgentIds: ['agent-2'] },
      { input: '请复核事实' },
      'run-1',
      { model: 'qwen-plus', messages: [{ role: 'user', content: '请复核事实' }] },
      [],
      [childAgent],
      3,
      async (step: unknown) => step,
      completeStep,
      { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      { delegationDepth: 0 },
    );

    expect(output).toBe('已经综合子 Agent 结果');
    expect((service as any).delegateUserAgent).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ id: 'agent-1' }),
      expect.objectContaining({ input: '请复核事实' }),
      expect.objectContaining({ action: 'delegate', agentId: 'agent-2', input: '核查事实' }),
      'run-1',
      expect.any(Object),
      expect.any(Function),
      expect.any(Function),
    );
    expect(chatService.createCompletion.mock.calls[1][0].messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'tool', tool_call_id: 'call-delegate', content: expect.stringContaining('事实无误'), name: 'delegate_agent' }),
    ]));
  });

  it('records malformed tool arguments as failed observations without invoking the tool', async () => {
    const toolCall = {
      id: 'call-bad',
      type: 'function',
      function: { name: 'calculator', arguments: '{"expression":' },
    };
    const invoke = jest.fn();
    const { service } = makeService({ completions: [completion('', [toolCall]), completion('参数有误，无法计算')], invoke });
    const steps: Array<{ stepType: string; status: string; error: string }> = [];

    const output = await (service as any).runToolUseHarness(
      'user-1',
      agent,
      { input: '计算' },
      'run-1',
      { model: 'qwen-plus', messages: [{ role: 'user', content: '计算' }] },
      [makeTool()],
      [],
      3,
      async (step: any) => { steps.push(step); return step; },
      completeStep,
      { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    );

    expect(output).toBe('参数有误，无法计算');
    expect(invoke).not.toHaveBeenCalled();
    expect(steps).toEqual(expect.arrayContaining([
      expect.objectContaining({ stepType: 'tool_call', status: 'failed', error: expect.stringContaining('JSON 解析失败') }),
      expect.objectContaining({ stepType: 'observation', status: 'failed' }),
    ]));
  });

  it('does not expose disabled, high-risk, or unapproved confirm tools', async () => {
    const allowedConfirm = makeTool({ id: 'confirm-1', name: 'safe_confirm', permissionLevel: 'confirm' });
    const disabled = makeTool({ id: 'disabled-1', name: 'disabled_tool', permissionLevel: 'disabled' });
    const highRisk = makeTool({ id: 'danger-1', name: 'external_delete', riskLevel: 'high' });
    const getAgentTools = jest.fn(async () => [allowedConfirm, disabled, highRisk]);
    const { service } = makeService({ getAgentTools });

    const resolved = await (service as any).resolveRunnableTools(
      'user-1',
      { ...agent, source: 'user' },
      ['confirm-1'],
    );

    expect(resolved.allowed.map((tool: ToolDefinition) => tool.id)).toEqual(['confirm-1']);
    expect(resolved.skipped.map((item: { tool: ToolDefinition }) => item.tool.id)).toEqual(['disabled-1', 'danger-1']);
  });

  it('stops tool looping at maxSteps and asks for a final non-tool response', async () => {
    const toolCall = {
      id: 'call-1',
      type: 'function',
      function: { name: 'calculator', arguments: '{"expression":"1+2"}' },
    };
    const { service, chatService } = makeService({
      completions: [completion('', [toolCall]), completion('达到上限，结果是 3')],
    });

    const output = await (service as any).runToolUseHarness(
      'user-1',
      agent,
      { input: '计算 1+2' },
      'run-1',
      { model: 'qwen-plus', messages: [{ role: 'user', content: '计算 1+2' }] },
      [makeTool()],
      [],
      1,
      async (step: unknown) => step,
      completeStep,
      { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    );

    expect(output).toBe('达到上限，结果是 3');
    expect(chatService.createCompletion).toHaveBeenCalledTimes(2);
    expect(chatService.createCompletion.mock.calls[1][0].tool_choice).toBe('none');
    expect(chatService.createCompletion.mock.calls[1][0].tools).toBeUndefined();
  });
});

describe('AgentsService run evaluation', () => {
  it('scores a run with rules mode without calling an LLM judge', async () => {
    const { service, chatService } = makeService();

    const result = await (service as any).scoreRunWithJudge(makeRun(), { mode: 'rules' });

    expect(result.score).toBeGreaterThan(0);
    expect(result.rubric.mode).toBe('rules');
    expect(chatService.createCompletion).not.toHaveBeenCalled();
  });

  it('falls back to rules scoring when the LLM judge fails', async () => {
    const { service, chatService } = makeService();
    chatService.createCompletion.mockRejectedValueOnce(new Error('judge timeout'));

    const result = await (service as any).scoreRunWithJudge(makeRun(), { mode: 'hybrid', judgeModel: 'qwen-plus' });

    expect(result.score).toBeGreaterThan(0);
    expect(result.summary).toContain('LLM Judge 未完成');
    expect(result.rubric.mode).toBe('rules_fallback');
  });
});
