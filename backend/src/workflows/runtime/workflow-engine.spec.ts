import { MemorySaver } from '@langchain/langgraph-checkpoint';
import {
  LangGraphWorkflowEngine,
  LegacyWorkflowEngine,
  WorkflowDefinition,
  WorkflowExecutionContext,
} from './workflow-engine';
import { nextFor } from './workflow-runtime.service';
import { WorkflowNodeDto } from '../dto/workflow.dto';

function node(
  id: string,
  nextIds: string[] = [],
  type: WorkflowNodeDto['type'] = 'template_transform',
  config = {},
): WorkflowNodeDto {
  return { id, type, config: { nextIds, ...config } };
}
function context(
  execute: WorkflowExecutionContext['execute'],
  overrides: Partial<WorkflowExecutionContext> = {},
): WorkflowExecutionContext {
  return {
    threadId: 'test',
    input: 'yes',
    resume: false,
    signal: new AbortController().signal,
    maxSteps: 256,
    checkpointer: new MemorySaver(),
    execute,
    ...overrides,
  };
}
describe('real LangGraph workflow compiler', () => {
  it('returns the original input for an empty graph', async () => {
    const call = jest.fn(async () => ({ output: '', next: [] }));
    expect(await new LangGraphWorkflowEngine().execute({ schemaVersion: 2, nodes: [] }, context(call))).toBe('yes');
    expect(call).not.toHaveBeenCalled();
  });
  it('propagates a node exception', async () => {
    await expect(new LangGraphWorkflowEngine().execute({ schemaVersion: 2, nodes: [node('a')] },
      context(async () => { throw new Error('node execution failed'); }))).rejects.toThrow('node execution failed');
  });
  it('stops an end-node path without running its successor', async () => {
    const call = jest.fn(async (n) => ({ output: n.id, next: nextFor(n, '', '') }));
    expect(await new LangGraphWorkflowEngine().execute({ schemaVersion: 2, nodes: [node('e', ['after'], 'end'), node('after')] }, context(call))).toBe('e');
    expect(call).toHaveBeenCalledTimes(1);
  });
  it('maps classifier outputs to the configured branch', () => {
    expect(nextFor(node('c', ['a', 'b'], 'question_classifier', {
      branches: [{ name: 'selected', nextIds: ['a'] }], defaultNextIds: ['b'],
    }), 'input', '{"branch":"selected"}')).toEqual(['a']);
  });
  it('executes 50 linear nodes without the old recursion limit', async () => {
    const def: WorkflowDefinition = { schemaVersion: 1, nodes: Array.from({ length: 50 }, (_, i) => node('n' + i)) };
    const call = jest.fn(async (_n, input) => ({ output: input + '.', next: [] }));
    const result = await new LangGraphWorkflowEngine().execute(def, context(call));
    expect(call).toHaveBeenCalledTimes(50);
    expect(result).toBe('yes' + '.'.repeat(50));
  });
  it('selects one branch, skips the other, and joins exactly once', async () => {
    const def: WorkflowDefinition = {
      schemaVersion: 2,
      nodes: [
        node('c', ['t', 'f'], 'if_else', { trueNextIds: ['t'], falseNextIds: ['f'], expression: 'yes' }),
        node('t', ['j']),
        node('f', ['j']),
        node('j', [], 'end'),
      ],
    };
    const seen: string[] = [];
    const result = await new LangGraphWorkflowEngine().execute(
      def,
      context(async (n, input) => {
        seen.push(n.id);
        const output = n.id === 'c' ? input : n.id;
        return { output, next: nextFor(n, input, output) };
      }),
    );
    expect(seen).toEqual(['c', 't', 'j']);
    expect(result).toBe('j');
  });
  it('executes parallel nodes and merges output maps at a barrier', async () => {
    const def: WorkflowDefinition = {
      schemaVersion: 2,
      nodes: [node('s', ['a', 'b']), node('a', ['j']), node('b', ['j']), node('j', [], 'end')],
    };
    let active = 0;
    let peak = 0;
    const result = await new LangGraphWorkflowEngine().execute(
      def,
      context(async (n, input) => {
        active++;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active--;
        return { output: n.id === 'j' ? input : n.id, next: nextFor(n, input, '') };
      }),
    );
    expect(peak).toBe(2);
    expect(JSON.parse(result)).toEqual({ a: 'a', b: 'b' });
  });
  it('resumes failed parallel work without repeating completed sibling nodes', async () => {
    const def: WorkflowDefinition = {
      schemaVersion: 2,
      nodes: [node('a', ['j']), node('b', ['j']), node('j', [], 'end')],
    };
    const saver = new MemorySaver();
    const seen: string[] = [];
    let fail = true;
    const execute: WorkflowExecutionContext['execute'] = async (n) => {
      seen.push(n.id);
      if (n.id === 'b' && fail) {
        await new Promise((resolve) => setTimeout(resolve, 30));
        throw new Error('retryable');
      }
      return { output: n.id, next: nextFor(n, '', '') };
    };
    await expect(new LangGraphWorkflowEngine().execute(def, context(execute, { checkpointer: saver }))).rejects.toThrow(
      'retryable',
    );
    fail = false;
    await new LangGraphWorkflowEngine().execute(def, context(execute, { checkpointer: saver, resume: true }));
    expect(seen.filter((id) => id === 'a')).toHaveLength(1);
    expect(seen.filter((id) => id === 'b')).toHaveLength(2);
  });
  it('rejects cycles and branch mappings not present in nextIds', async () => {
    await expect(
      new LangGraphWorkflowEngine().execute(
        { schemaVersion: 2, nodes: [node('a', ['a'])] },
        context(async () => ({ output: '', next: [] })),
      ),
    ).rejects.toThrow('cycle');
    await expect(
      new LangGraphWorkflowEngine().execute(
        { schemaVersion: 2, nodes: [node('a', [], 'if_else', { trueNextIds: ['missing'], falseNextIds: [] })] },
        context(async () => ({ output: '', next: [] })),
      ),
    ).rejects.toThrow('Branch targets');
  });
  it('keeps v1 end-node behavior; requires explicit v2 upgrade', async () => {
    const def: WorkflowDefinition = { schemaVersion: 1, nodes: [node('end', [], 'end'), node('later')] };
    const fn = jest.fn(async (n) => ({ output: n.id, next: [] }));
    expect(await new LangGraphWorkflowEngine().execute(def, context(fn))).toBe('later');
    expect(await new LegacyWorkflowEngine().execute(def, context(fn))).toBe('later');
  });
  it('honors cancellation and maximum superstep budgets', async () => {
    const signal = AbortSignal.timeout(10);
    await expect(
      new LangGraphWorkflowEngine().execute(
        { schemaVersion: 2, nodes: [node('a')] },
        context(
          async () => {
            await new Promise((_, reject) =>
              signal.addEventListener('abort', () => reject(new Error('timeout')), { once: true }),
            );
            return { output: '', next: [] };
          },
          { signal },
        ),
      ),
    ).rejects.toThrow();
    await expect(
      new LangGraphWorkflowEngine().execute(
        { schemaVersion: 1, nodes: [node('a'), node('b'), node('c')] },
        context(async (n) => ({ output: n.id, next: [] }), { maxSteps: 2 }),
      ),
    ).rejects.toThrow();
  });
});
