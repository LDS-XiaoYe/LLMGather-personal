import { ref, computed } from 'vue';
import type { DagNodeCategory, DagNodeItem, DagNodeType, DagTemplate } from '../types/agent';

// DAG节点分类定义
export const dagNodeCategories: DagNodeCategory[] = [
  {
    id: 'io',
    label: '输入输出',
    icon: '📥',
    nodes: [
      { type: 'start', label: '开始节点', description: 'DAG流程起点', icon: '▶️', category: 'io', inputs: [], outputs: ['trigger'], configSchema: {} },
      { type: 'user_input', label: '用户输入', description: '接收用户输入文本', icon: '💬', category: 'io', inputs: ['trigger'], outputs: ['text', 'user_id'], configSchema: { placeholder: '', maxLength: 10000 } },
      { type: 'file_input', label: '文件输入', description: '接收用户上传文件', icon: '📁', category: 'io', inputs: ['trigger'], outputs: ['file_content', 'file_name', 'file_type'], configSchema: { acceptTypes: ['.txt', '.md', '.pdf'], maxSize: 10 } },
      { type: 'output', label: '输出回复', description: '输出最终回复给用户', icon: '📤', category: 'io', inputs: ['text'], outputs: [], configSchema: { format: 'text' } },
      { type: 'end', label: '终止节点', description: 'DAG流程终点', icon: '⏹️', category: 'io', inputs: ['result'], outputs: [], configSchema: {} },
    ]
  },
  {
    id: 'understand',
    label: '理解与决策',
    icon: '🧠',
    nodes: [
      { type: 'intent_detection', label: '意图识别', description: '识别用户输入的意图', icon: '🎯', category: 'understand', inputs: ['text'], outputs: ['intent', 'confidence', 'reason'], configSchema: { model: '', prompt: '', intents: [], threshold: 0.7 } },
      { type: 'parameter_extract', label: '参数提取', description: '从文本中提取关键参数', icon: '🔑', category: 'understand', inputs: ['text'], outputs: ['params'], configSchema: { model: '', params: [], prompt: '' } },
      { type: 'condition', label: '条件判断', description: '根据条件分支执行', icon: '🔀', category: 'understand', inputs: ['value'], outputs: ['true_branch', 'false_branch'], configSchema: { expression: '' } },
      { type: 'multi_branch', label: '多分支路由', description: '根据值选择多个分支', icon: '🔄', category: 'understand', inputs: ['value'], outputs: ['branches'], configSchema: { branches: [] } },
    ]
  },
  {
    id: 'knowledge',
    label: '知识与上下文',
    icon: '📚',
    nodes: [
      { type: 'knowledge_search', label: '知识库查询', description: '从知识库检索相关内容', icon: '🔍', category: 'knowledge', inputs: ['query'], outputs: ['chunks', 'citations', 'scores', 'rag_context'], configSchema: { kbIds: [], topK: 5, threshold: 0.7, rerank: false, returnCitations: true } },
      { type: 'memory_read', label: '记忆读取', description: '读取长期记忆', icon: '🧠', category: 'knowledge', inputs: ['query'], outputs: ['memory_context'], configSchema: { memoryType: 'agent', topK: 5 } },
      { type: 'memory_write', label: '记忆写入', description: '写入长期记忆', icon: '💾', category: 'knowledge', inputs: ['content'], outputs: ['status'], configSchema: { memoryType: 'agent', importance: 3, confirm: false } },
    ]
  },
  {
    id: 'execute',
    label: '执行动作',
    icon: '⚡',
    nodes: [
      { type: 'tool_call', label: '调用工具', description: '调用平台或自定义工具', icon: '🔧', category: 'execute', inputs: ['tool_params'], outputs: ['tool_result', 'status_code', 'error_message'], configSchema: { toolId: '', paramMapping: {}, timeout: 30, retries: 0, confirm: false } },
      { type: 'skill_call', label: '调用 Skill', description: '调用平台或自定义Skill', icon: '⚡', category: 'execute', inputs: ['skill_input'], outputs: ['skill_result', 'skill_logs'], configSchema: { skillId: '', inputMapping: {}, confirm: false } },
      { type: 'agent_call', label: '调用 Agent', description: '调用其他Agent', icon: '🤖', category: 'execute', inputs: ['agent_input'], outputs: ['agent_result', 'agent_logs'], configSchema: { agentId: '', inputMapping: {}, waitForResult: true } },
      { type: 'http_request', label: 'HTTP 请求', description: '发送HTTP请求', icon: '🌐', category: 'execute', inputs: ['params'], outputs: ['response', 'status_code'], configSchema: { method: 'GET', url: '', headers: {}, body: '' } },
    ]
  },
  {
    id: 'generate',
    label: '生成与处理',
    icon: '✨',
    nodes: [
      { type: 'llm_generate', label: 'LLM 生成', description: '调用大模型生成内容', icon: '🤖', category: 'generate', inputs: ['prompt', 'context'], outputs: ['response', 'tokens'], configSchema: { model: '', temperature: 0.7, maxTokens: 2000 } },
      { type: 'prompt_builder', label: 'Prompt 组装', description: '组装完整的Prompt', icon: '📝', category: 'generate', inputs: ['template', 'variables'], outputs: ['prompt_text'], configSchema: { template: '', variables: [] } },
      { type: 'result_summary', label: '结果总结', description: '总结和提炼结果', icon: '📋', category: 'generate', inputs: ['input'], outputs: ['summary'], configSchema: { model: '', prompt: '' } },
    ]
  },
  {
    id: 'control',
    label: '控制与安全',
    icon: '🛡️',
    nodes: [
      { type: 'human_confirm', label: '人工确认', description: '等待人工确认后继续', icon: '👤', category: 'control', inputs: ['content'], outputs: ['confirmed', 'rejected'], configSchema: { message: '', timeout: 300 } },
      { type: 'retry', label: '重试节点', description: '失败时重试', icon: '🔄', category: 'control', inputs: ['input'], outputs: ['success', 'failed'], configSchema: { maxRetries: 3, delay: 1000 } },
      { type: 'error_handle', label: '错误处理', description: '处理错误情况', icon: '🚨', category: 'control', inputs: ['error'], outputs: ['recovery'], configSchema: { strategy: 'fallback' } },
    ]
  }
];

// DAG模板
export const dagTemplates: DagTemplate[] = [
  {
    id: 'knowledge_qa',
    name: '知识库问答',
    description: '基于知识库的问答流程',
    icon: '📚',
    category: '通用',
    nodes: [
      { type: 'start', x: 50, y: 200 },
      { type: 'user_input', x: 200, y: 200 },
      { type: 'intent_detection', x: 400, y: 200 },
      { type: 'knowledge_search', x: 600, y: 200 },
      { type: 'prompt_builder', x: 800, y: 200 },
      { type: 'llm_generate', x: 1000, y: 200 },
      { type: 'output', x: 1200, y: 200 },
    ],
    edges: [
      { from: 'start', to: 'user_input' },
      { from: 'user_input', to: 'intent_detection' },
      { from: 'intent_detection', to: 'knowledge_search' },
      { from: 'knowledge_search', to: 'prompt_builder' },
      { from: 'prompt_builder', to: 'llm_generate' },
      { from: 'llm_generate', to: 'output' },
    ]
  },
  {
    id: 'tool_call',
    name: '工具调用',
    description: '识别意图后调用工具',
    icon: '🔧',
    category: '通用',
    nodes: [
      { type: 'start', x: 50, y: 200 },
      { type: 'user_input', x: 200, y: 200 },
      { type: 'intent_detection', x: 400, y: 200 },
      { type: 'parameter_extract', x: 600, y: 200 },
      { type: 'human_confirm', x: 800, y: 200 },
      { type: 'tool_call', x: 1000, y: 200 },
      { type: 'result_summary', x: 1200, y: 200 },
      { type: 'output', x: 1400, y: 200 },
    ],
    edges: [
      { from: 'start', to: 'user_input' },
      { from: 'user_input', to: 'intent_detection' },
      { from: 'intent_detection', to: 'parameter_extract' },
      { from: 'parameter_extract', to: 'human_confirm' },
      { from: 'human_confirm', to: 'tool_call' },
      { from: 'tool_call', to: 'result_summary' },
      { from: 'result_summary', to: 'output' },
    ]
  },
  {
    id: 'customer_service',
    name: '客服 Agent',
    description: '多意图客服处理流程',
    icon: '🎧',
    category: '业务',
    nodes: [
      { type: 'start', x: 50, y: 200 },
      { type: 'user_input', x: 200, y: 200 },
      { type: 'intent_detection', x: 400, y: 200 },
      { type: 'multi_branch', x: 600, y: 200 },
      { type: 'knowledge_search', x: 800, y: 100 },
      { type: 'parameter_extract', x: 800, y: 250 },
      { type: 'llm_generate', x: 1000, y: 100 },
      { type: 'tool_call', x: 1000, y: 250 },
      { type: 'output', x: 1200, y: 200 },
    ],
    edges: [
      { from: 'start', to: 'user_input' },
      { from: 'user_input', to: 'intent_detection' },
      { from: 'intent_detection', to: 'multi_branch' },
      { from: 'multi_branch', to: 'knowledge_search', label: '售前咨询' },
      { from: 'multi_branch', to: 'parameter_extract', label: '订单查询' },
      { from: 'knowledge_search', to: 'llm_generate' },
      { from: 'parameter_extract', to: 'tool_call' },
      { from: 'llm_generate', to: 'output' },
      { from: 'tool_call', to: 'output' },
    ]
  }
];

// Composable函数
export function useDagNodes() {
  const getDagNodeInfo = (type: DagNodeType): DagNodeItem | undefined => {
    for (const category of dagNodeCategories) {
      const node = category.nodes.find(n => n.type === type);
      if (node) return node;
    }
    return undefined;
  };

  const applyDagTemplate = (template: DagTemplate, nodes: any[], setNodes: (nodes: any[]) => void) => {
    const newNodes: Array<{
      id: string;
      type: string;
      name: string;
      x: number;
      y: number;
      config: { nextIds?: string[] };
    }> = template.nodes.map((node, index) => ({
      id: `node_${Date.now()}_${index}`,
      type: node.type,
      name: getDagNodeInfo(node.type as DagNodeType)?.label || node.type,
      x: node.x,
      y: node.y,
      config: {},
    }));

    const nodeMap = new Map(newNodes.map((n, i) => [template.nodes[i].type, n.id]));
    newNodes.forEach((node, index) => {
      const templateNode = template.nodes[index];
      const nextEdges = template.edges.filter(e => e.from === templateNode.type);
      node.config.nextIds = nextEdges
        .map(e => nodeMap.get(e.to))
        .filter((nextId): nextId is string => Boolean(nextId));
    });

    setNodes(newNodes);
    return newNodes;
  };

  return {
    dagNodeCategories,
    dagTemplates,
    getDagNodeInfo,
    applyDagTemplate,
  };
}
