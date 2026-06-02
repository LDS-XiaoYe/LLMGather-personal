export type ChatMessageRole = 'system' | 'user' | 'assistant' | 'tool';

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface ChatMessage {
  role: ChatMessageRole;
  content: string | ContentPart[];
  name?: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
  user?: string;
  extra_body?: {
    enable_thinking?: boolean;
    [key: string]: unknown;
  };
}

export interface ChatCompletionUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ChatCompletionChoice {
  index: number;
  message: {
    role: 'assistant';
    content: string;
  };
  finish_reason: string;
}

export interface ChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage?: ChatCompletionUsage;
}

export interface ModelDescriptor {
  id: string;
  object: 'model';
  owned_by: string;
}

export interface ProviderAdapter {
  providerName: string;
  isModelSupported(model: string): boolean;
  chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
  chatCompletionStream(request: ChatCompletionRequest): Promise<Response>;
  listModels(): ModelDescriptor[];
}
