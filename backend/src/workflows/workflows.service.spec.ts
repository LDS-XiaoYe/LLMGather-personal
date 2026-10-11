import { WorkflowsService } from './workflows.service';
import { WorkflowNodeDto } from './dto/workflow.dto';
import { RuntimeOptions } from './runtime/workflow-runtime.service';
describe('workflow node adapters', () => {
  function runner(toolResult = { status: 'failed', error: 'tool failed', output: '' }) {
    const service = new WorkflowsService(
      {} as never,
      {} as never,
      { invoke: jest.fn(async () => toolResult) } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return service as unknown as {
      runNode(
        user: string,
        node: WorkflowNodeDto,
        input: string,
        original: string,
        options: RuntimeOptions,
      ): Promise<string>;
    };
  }
  it('propagates failed tool execution rather than reporting a successful node', async () => {
    await expect(
      runner().runNode('u', { id: 't', type: 'tool', config: { toolId: 'tool' } }, 'input', 'input', {}),
    ).rejects.toThrow('tool failed');
  });
  it('passes successful tool output to downstream nodes', async () => {
    expect(
      await runner({ status: 'succeeded', error: '', output: '42' }).runNode(
        'u',
        { id: 't', type: 'tool', config: { toolId: 'tool' } },
        'input',
        'input',
        {},
      ),
    ).toBe('42');
  });
  it('does not pretend a v2 LLM node without model configuration ran a model', async () => {
    await expect(
      runner().runNode('u', { id: 'llm', type: 'llm', config: {} }, 'input', 'input', { schemaVersion: 2 }),
    ).rejects.toThrow('requires config.model');
  });
});
