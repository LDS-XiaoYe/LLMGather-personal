// Agent相关类型
export interface AgentForm {
  id: string;
  name: string;
  description: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  memoryEnabled: boolean;
  toolIds: string[];
  knowledgeBaseIds: string[];
  skillIds: string[];
  workflowIds: string[];
  subAgentIds: string[];
  status: 'active' | 'archived';
  published: boolean;
  apiEnabled: boolean;
  publicSlug: string;
}

// DAG节点类型
export type DagNodeType = 
  | 'start' | 'user_input' | 'file_input' | 'form_input' 
  | 'output' | 'structured_output' | 'generate_file' | 'end'
  | 'intent_detection' | 'parameter_extract' | 'info_extract'
  | 'content_classify' | 'condition' | 'if_else' | 'multi_branch' | 'question_classifier' | 'confidence_check'
  | 'knowledge_search' | 'context_read' | 'memory_read' | 'memory_write'
  | 'doc_parse' | 'citation整理'
  | 'tool_call' | 'skill_call' | 'agent_call' | 'http_request'
  | 'db_query' | 'code执行' | 'code' | 'webhook'
  | 'llm_generate' | 'prompt_builder' | 'template_transform' | 'variable_assigner' | 'result_summary' | 'result_rewrite'
  | 'format_output' | 'json_parse' | 'multi_result_merge'
  | 'human_confirm' | 'permission_check' | 'sensitive_confirm'
  | 'retry' | 'error_handle' | 'fallback' | 'wait';

export interface DagNodeItem {
  type: DagNodeType;
  label: string;
  description: string;
  icon: string;
  category: string;
  inputs: string[];
  outputs: string[];
  configSchema: Record<string, any>;
}

export interface DagNodeCategory {
  id: string;
  label: string;
  icon: string;
  nodes: DagNodeItem[];
}

export interface DagTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  nodes: any[];
  edges: any[];
}

// Tool相关类型
export interface CustomTool {
  id: string;
  name: string;
  displayName: string;
  description: string;
  icon: string;
  category: string;
  type: 'builtin' | 'custom';
  runtime: 'python' | 'javascript' | 'http' | 'webhook' | 'db';
  status: 'enabled' | 'disabled';
  riskLevel: 'low' | 'medium' | 'high';
  version: string;
  inputSchema: Record<string, any>;
  outputSchema: Record<string, any>;
  permissions: {
    network: boolean;
    database: boolean;
    fileRead: boolean;
    fileWrite: boolean;
    externalRequest: boolean;
  };
  code?: string;
  entry?: string;
  exampleInput?: string;
  exampleOutput?: string;
  timeout: number;
  retries: number;
  createdAt: string;
  updatedAt: string;
  callCount: number;
  lastCallAt?: string;
}

// Skill相关类型
export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  content: string;
  category: string;
  icon: string;
  riskLevel: 'low' | 'medium' | 'high';
  source: 'builtin' | 'custom';
  version: number;
  enabled: boolean;
  bindingCount: number;
  inputSchema?: Record<string, any>;
  outputSchema?: Record<string, any>;
  exampleInput?: string;
  exampleOutput?: string;
  permissions?: Record<string, boolean>;
  boundAgents?: Array<{ id: string; name: string }>;
}

// Knowledge相关类型
export interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  provider?: 'native' | 'ragflow';
  externalId?: string | null;
  documentCount: number;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeDocument {
  id: string;
  kbId: string;
  title: string;
  content: string;
  chunkCount: number;
  createdAt: string;
}
