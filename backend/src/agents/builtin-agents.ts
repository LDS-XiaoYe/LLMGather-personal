export type BuiltinAgentKey =
  | 'research'
  | 'code'
  | 'data'
  | 'support'
  | 'writer'
  | 'document'
  | 'knowledge'
  | 'orchestrator';

export interface BuiltinAgentSpec {
  key: BuiltinAgentKey;
  name: string;
  category: string;
  description: string;
  intents: string[];
  tags: string[];
  riskLevel: 'low' | 'medium' | 'high';
  toolNames: string[];
  skillNames: string[];
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
}

export const BUILTIN_AGENT_SPECS: BuiltinAgentSpec[] = [
  {
    key: 'research',
    name: 'Research Agent',
    category: 'research',
    description: '检索资料、整理证据、输出引用和不确定性。',
    intents: ['研究', '调研', '检索', '资料', '证据', '引用', '竞品', '论文', 'research', 'source', 'citation'],
    tags: ['research', 'web', 'evidence'],
    riskLevel: 'medium',
    toolNames: ['browser_fetch', 'notion_search', 'text_stats'],
    skillNames: ['Research Planner', 'Workflow Orchestrator'],
    temperature: 0.3,
    maxTokens: 4096,
    systemPrompt: '你是严谨的研究型 Agent。先拆解问题，再检索和整理证据，明确标注来源、不确定性、冲突信息和下一步建议。不要编造引用；资料不足时说明缺口。',
  },
  {
    key: 'code',
    name: 'Code Agent',
    category: 'engineering',
    description: '代码解释、调试、生成和可选执行验证。',
    intents: ['代码', '编程', '开发', '调试', '报错', '函数', '脚本', 'code', 'debug', 'program', 'typescript', 'python', 'javascript'],
    tags: ['code', 'debug', 'tools'],
    riskLevel: 'high',
    toolNames: ['container_javascript_runner', 'container_python_runner', 'calculator', 'text_stats'],
    skillNames: ['Code Operator', 'Data Analyst'],
    temperature: 0.2,
    maxTokens: 4096,
    systemPrompt: '你是可靠的代码 Agent。先理解目标和环境，再给出最小可行修改或代码。遇到计算、转换、调试任务时优先用工具验证；如果工具未授权，说明验证受限并给出人工验证步骤。',
  },
  {
    key: 'data',
    name: 'Data Analyst',
    category: 'analysis',
    description: '表格/数据分析、计算、趋势和结论。',
    intents: ['数据', '表格', 'excel', 'csv', '统计', '分析', '趋势', '指标', '计算', 'data', 'analysis', 'spreadsheet'],
    tags: ['data', 'analysis', 'spreadsheet'],
    riskLevel: 'medium',
    toolNames: ['calculator', 'container_javascript_runner', 'text_stats'],
    skillNames: ['Data Analyst', 'Code Operator'],
    temperature: 0.2,
    maxTokens: 4096,
    systemPrompt: '你是数据分析 Agent。你会先确认字段和口径，再计算关键指标、发现趋势、异常和结论。输出要包含方法、结果、限制和可复核步骤。',
  },
  {
    key: 'support',
    name: 'Customer Support Agent',
    category: 'business',
    description: '客服问答、知识库检索和标准答复。',
    intents: ['客服', '客户', '工单', '售后', '退款', '投诉', '支持', 'support', 'customer', 'ticket', 'faq'],
    tags: ['support', 'faq', 'knowledge'],
    riskLevel: 'low',
    toolNames: ['current_time', 'browser_fetch'],
    skillNames: ['Workflow Orchestrator'],
    temperature: 0.5,
    maxTokens: 2048,
    systemPrompt: '你是专业客服 Agent。基于知识库和上下文给出简洁、礼貌、可执行的答复；不确定时先说明需要补充的信息，不做无法兑现的承诺。',
  },
  {
    key: 'writer',
    name: 'Writer Agent',
    category: 'writing',
    description: '写作、改写、润色、标题和内容结构。',
    intents: ['写', '文案', '改写', '润色', '标题', '邮件', '公告', '脚本', 'copywriting', 'rewrite', 'polish', 'write'],
    tags: ['writing', 'editing'],
    riskLevel: 'low',
    toolNames: ['text_stats'],
    skillNames: ['Workflow Orchestrator'],
    temperature: 0.7,
    maxTokens: 4096,
    systemPrompt: '你是写作 Agent。根据受众、目的和语气组织内容，输出清晰结构；需要时提供多个版本，并说明每个版本适合的使用场景。',
  },
  {
    key: 'document',
    name: 'Document Analyst',
    category: 'document',
    description: 'PDF/Word/Excel 内容总结、抽取和对比。',
    intents: ['文档', 'pdf', 'word', 'docx', 'excel', 'xlsx', '总结文件', '提取', '对比文档', 'document'],
    tags: ['document', 'summary', 'extraction'],
    riskLevel: 'low',
    toolNames: ['text_stats', 'calculator'],
    skillNames: ['Data Analyst', 'Research Planner'],
    temperature: 0.2,
    maxTokens: 4096,
    systemPrompt: '你是文档分析 Agent。你会从文档内容中抽取结构、要点、数据、风险和待办；对比多个文档时明确相同点、差异点和证据位置。',
  },
  {
    key: 'knowledge',
    name: 'Knowledge Curator',
    category: 'knowledge',
    description: '把资料整理成知识库条目、发现知识缺口。',
    intents: ['知识库', '知识库条目', '沉淀', '归档', '整理', '整理资料', '资料整理', '知识条目', '知识缺口', '手册', 'SOP', 'knowledge', 'kb'],
    tags: ['knowledge', 'curation', 'rag'],
    riskLevel: 'low',
    toolNames: ['text_stats'],
    skillNames: ['Research Planner', 'Workflow Orchestrator'],
    temperature: 0.3,
    maxTokens: 4096,
    systemPrompt: '你是知识整理 Agent。你会把原始资料整理成可检索、可维护的知识条目，包含标题、适用场景、正文、关键词、缺口和更新建议。',
  },
  {
    key: 'orchestrator',
    name: 'Workflow Orchestrator',
    category: 'workflow',
    description: '拆解复杂任务，并自动委派给其他内置 Agent。',
    intents: ['流程', '计划', '拆解', '复杂任务', '自动化', '工作流', '多步骤', '编排', 'workflow', 'orchestrate', 'plan'],
    tags: ['workflow', 'delegation', 'planning'],
    riskLevel: 'medium',
    toolNames: ['current_time', 'text_stats'],
    skillNames: ['Workflow Orchestrator'],
    temperature: 0.3,
    maxTokens: 4096,
    systemPrompt: '你是工作流编排 Agent。你会拆解复杂任务，识别适合委派的子任务，整合子 Agent 结果，并输出清晰的执行计划、当前结果和后续动作。',
  },
];

export function getBuiltinAgentSpec(key: string): BuiltinAgentSpec | undefined {
  return BUILTIN_AGENT_SPECS.find((agent) => agent.key === key);
}

export function matchBuiltinAgent(input: string): { spec: BuiltinAgentSpec; score: number; confidence: number; reason: string } | null {
  const lower = input.toLowerCase();
  const scored = BUILTIN_AGENT_SPECS.map((spec) => {
    let score = 0;
    const matched: string[] = [];
    for (const intent of spec.intents) {
      const term = intent.toLowerCase();
      if (term && lower.includes(term)) {
        score += term.length >= 5 ? 2 : 1;
        matched.push(intent);
      }
    }
    if (spec.key === 'code' && /```|报错|stack trace|typescript|javascript|python|sql/i.test(input)) score += 2;
    if (spec.key === 'document' && /\.(pdf|docx?|xlsx?|csv)\b/i.test(input)) score += 3;
    if (spec.key === 'data' && /\b(avg|sum|count|chart|table|csv|excel)\b|均值|总和|图表/.test(lower)) score += 2;
    return { spec, score, matched };
  }).sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || best.score < 2) return null;
  const confidence = Math.min(0.95, 0.58 + best.score * 0.08);
  return {
    spec: best.spec,
    score: best.score,
    confidence,
    reason: `命中 ${best.spec.name}: ${best.matched.slice(0, 4).join('、') || best.spec.category}`,
  };
}
