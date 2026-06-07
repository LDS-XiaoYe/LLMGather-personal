import { BUILTIN_AGENT_SPECS, getBuiltinAgentSpec, matchBuiltinAgent } from './builtin-agents';

describe('builtin agents', () => {
  it('exposes the initial stable builtin agent keys', () => {
    expect(BUILTIN_AGENT_SPECS.map((agent) => agent.key)).toEqual([
      'research',
      'code',
      'data',
      'support',
      'writer',
      'document',
      'knowledge',
      'orchestrator',
    ]);
  });

  it('resolves builtin agents by stable key', () => {
    expect(getBuiltinAgentSpec('research')?.name).toBe('Research Agent');
    expect(getBuiltinAgentSpec('missing')).toBeUndefined();
  });

  it('matches common user intents to builtin agents', () => {
    expect(matchBuiltinAgent('帮我调试这段 TypeScript 报错')?.spec.key).toBe('code');
    expect(matchBuiltinAgent('请把这份资料整理成知识库条目')?.spec.key).toBe('knowledge');
  });
});
