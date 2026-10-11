import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { BaseCheckpointSaver } from '@langchain/langgraph-checkpoint';
import { WorkflowNodeDto } from '../dto/workflow.dto';

export interface WorkflowDefinition {
  schemaVersion: 1 | 2;
  nodes: WorkflowNodeDto[];
}
export interface NodeResult {
  output: string;
  next: string[];
}
export interface WorkflowExecutionContext {
  threadId: string;
  input: string;
  resume: boolean;
  signal: AbortSignal;
  checkpointer: BaseCheckpointSaver;
  maxSteps: number;
  leaseOwner?: string;
  runId?: string;
  execute(node: WorkflowNodeDto, input: string): Promise<NodeResult>;
}
export interface WorkflowEngine {
  execute(definition: WorkflowDefinition, context: WorkflowExecutionContext): Promise<string>;
}
function makeState() {
  return Annotation.Root({
    originalInput: Annotation<string>(),
    outputs: Annotation<Record<string, string>>({ reducer: (a, b) => ({ ...a, ...b }), default: () => ({}) }),
    selected: Annotation<Record<string, string[]>>({ reducer: (a, b) => ({ ...a, ...b }), default: () => ({}) }),
    done: Annotation<string[]>({ reducer: (a, b) => [...new Set([...a, ...b])], default: () => [] }),
    skipped: Annotation<string[]>({ reducer: (a, b) => [...new Set([...a, ...b])], default: () => [] }),
    ready: Annotation<string[]>(),
  });
}
type ExecutionState = ReturnType<typeof makeState>['State'];

/** Compatibility linearization is deliberate and applies ONLY to version 1. */
export function legacyOrder(nodes: WorkflowNodeDto[]): WorkflowNodeDto[] {
  const remaining = [...nodes];
  const ordered: WorkflowNodeDto[] = [];
  while (remaining.length) {
    const ready = remaining.filter((n) => !remaining.some((p) => p.id !== n.id && nextIds(p).includes(n.id)));
    if (!ready.length) return [...ordered, ...remaining]; // historical cyclic ordering
    for (const n of ready) {
      ordered.push(n);
      remaining.splice(remaining.indexOf(n), 1);
    }
  }
  return ordered;
}
export function nextIds(node: WorkflowNodeDto): string[] {
  return Array.isArray(node.config.nextIds) ? [...new Set(node.config.nextIds.map(String))] : [];
}
export function validateDefinition(definition: WorkflowDefinition): void {
  const ids = new Set(definition.nodes.map((n) => n.id));
  if (
    definition.nodes.some((n) => !n.id || n.id.length > 64 || ['__proto__', 'constructor', 'prototype'].includes(n.id))
  )
    throw new Error('Invalid node identifier');
  if (ids.size !== definition.nodes.length || definition.nodes.length > 50)
    throw new Error('Duplicate node IDs or node budget exceeded');
  if (definition.schemaVersion === 1) return;
  const indegree = new Map(definition.nodes.map((n) => [n.id, 0]));
  for (const node of definition.nodes) {
    for (const id of nextIds(node)) {
      if (!ids.has(id)) throw new Error(`Unknown edge target: ${id}`);
      indegree.set(id, indegree.get(id)! + 1);
    }
    const targets = [
      ...(Array.isArray(node.config.trueNextIds) ? node.config.trueNextIds.map(String) : []),
      ...(Array.isArray(node.config.falseNextIds) ? node.config.falseNextIds.map(String) : []),
      ...(Array.isArray(node.config.branches)
        ? node.config.branches.flatMap((b) => {
            const branch = b as Record<string, unknown>;
            return Array.isArray(branch.nextIds) ? branch.nextIds.map(String) : [];
          })
        : []),
      ...(Array.isArray(node.config.defaultNextIds) ? node.config.defaultNextIds.map(String) : []),
    ];
    if (targets.some((id) => !nextIds(node).includes(id)))
      throw new Error('Branch targets must be declared in nextIds');
    if (
      (node.type === 'if_else' || node.config.dagType === 'condition') &&
      (!Array.isArray(node.config.trueNextIds) || !Array.isArray(node.config.falseNextIds))
    )
      throw new Error('Version 2 conditions require trueNextIds and falseNextIds');
  }
  const queue = [...indegree].filter(([, degree]) => degree === 0).map(([id]) => id);
  let visited = 0;
  while (queue.length) {
    const id = queue.shift()!;
    visited++;
    for (const next of nextIds(definition.nodes.find((n) => n.id === id)!)) {
      indegree.set(next, indegree.get(next)! - 1);
      if (indegree.get(next) === 0) queue.push(next);
    }
  }
  if (visited !== ids.size) throw new Error('Version 2 DAG contains a cycle; explicit loops are not supported');
}

export class LangGraphWorkflowEngine implements WorkflowEngine {
  async execute(definition: WorkflowDefinition, context: WorkflowExecutionContext): Promise<string> {
    const State = makeState();
    validateDefinition(definition);
    const nodes = definition.schemaVersion === 1 ? legacyOrder(definition.nodes) : definition.nodes;
    const invocation = {
      configurable: { thread_id: context.threadId, execution_owner: context.leaseOwner, execution_run_id: context.runId },
      recursionLimit: context.maxSteps,
      signal: context.signal,
      durability: 'sync' as const,
    };
    if (!nodes.length) {
      const graph = new StateGraph(State)
        .addNode('empty', (state) => ({ originalInput: state.originalInput }))
        .addEdge(START, 'empty').addEdge('empty', END)
        .compile({ checkpointer: context.checkpointer });
      return (await graph.invoke(context.resume ? null : { originalInput: context.input }, invocation)).originalInput;
    }
    const edges = new Map(
      nodes.map((n, i) => [
        n.id,
        definition.schemaVersion === 1 ? (nodes[i + 1] ? [nodes[i + 1].id] : []) : nextIds(n),
      ]),
    );
    const parents = new Map(
      nodes.map((n) => [n.id, nodes.filter((p) => edges.get(p.id)!.includes(n.id)).map((p) => p.id)]),
    );
    const schedule = (state: ExecutionState) => {
      context.signal.throwIfAborted();
      const settled = new Set([...state.done, ...state.skipped]);
      const skipped: string[] = [];
      let changed = true;
      while (changed) {
        changed = false;
        for (const n of nodes) {
          const incoming = parents.get(n.id)!;
          if (
            !settled.has(n.id) &&
            incoming.length &&
            incoming.every((p) => settled.has(p)) &&
            !incoming.some((p) => state.selected[p]?.includes(n.id))
          ) {
            settled.add(n.id);
            skipped.push(n.id);
            changed = true;
          }
        }
      }
      const ready = nodes
        .filter(
          (n) =>
            !settled.has(n.id) &&
            parents.get(n.id)!.every((p) => settled.has(p)) &&
            (!parents.get(n.id)!.length || parents.get(n.id)!.some((p) => state.selected[p]?.includes(n.id))),
        )
        .map((n) => `n_${Buffer.from(n.id).toString('hex')}`);
      if (!ready.length && settled.size !== nodes.length) throw new Error('Workflow cannot make progress');
      return { ready, skipped };
    };
    const actions: Record<string, (state: ExecutionState) => Promise<Partial<ExecutionState>>> = {};
    for (const node of nodes)
      actions[`n_${Buffer.from(node.id).toString('hex')}`] = async (state) => {
        const incoming = parents.get(node.id)!.filter((p) => state.outputs[p] !== undefined);
        let input =
          incoming.length === 1
            ? state.outputs[incoming[0]]
            : incoming.length > 1
              ? JSON.stringify(Object.fromEntries(incoming.map((p) => [p, state.outputs[p]])))
              : state.originalInput;
        if (typeof node.config.inputFrom === 'string') {
          if (!incoming.includes(node.config.inputFrom))
            throw new Error('inputFrom must refer to an executed direct predecessor');
          input = state.outputs[node.config.inputFrom];
        }
        const result = await context.execute(node, input);
        const next = definition.schemaVersion === 1 ? edges.get(node.id)! : result.next;
        if (next.some((id) => !edges.get(node.id)!.includes(id))) throw new Error('Node returned an undeclared edge');
        return { outputs: { [node.id]: result.output }, selected: { [node.id]: next }, done: [node.id] };
      };
    const builder = new StateGraph(State).addNode(actions).addNode('schedule', schedule).addEdge(START, 'schedule');
    for (const node of nodes) builder.addEdge(`n_${Buffer.from(node.id).toString('hex')}`, 'schedule');
    builder.addConditionalEdges('schedule', (state) => (state.ready.length ? state.ready : END));
    const graph = builder.compile({
      checkpointer: context.checkpointer,
      name: 'llmgather-workflow-v' + definition.schemaVersion,
    });
    const result = await graph.invoke(context.resume ? null : { originalInput: context.input, ready: [] }, invocation);
    const terminals = nodes.filter(
      (n) => result.done.includes(n.id) && (!edges.get(n.id)!.length || !result.selected[n.id]?.length),
    );
    if (!terminals.length) return result.originalInput;
    return terminals.length === 1
      ? result.outputs[terminals[0].id]
      : JSON.stringify(Object.fromEntries(terminals.map((n) => [n.id, result.outputs[n.id]])));
  }
}

/** Legacy engine is selected explicitly; failures never silently rerun side effects in another engine. */
export class LegacyWorkflowEngine implements WorkflowEngine {
  async execute(definition: WorkflowDefinition, context: WorkflowExecutionContext): Promise<string> {
    if (definition.schemaVersion !== 1 || context.resume)
      throw new Error('Legacy engine accepts only fresh version 1 runs');
    let output = context.input;
    for (const node of legacyOrder(definition.nodes)) {
      context.signal.throwIfAborted();
      output = (await context.execute(node, output)).output;
    }
    return output;
  }
}
