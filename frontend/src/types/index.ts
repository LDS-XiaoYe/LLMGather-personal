export type PageMode = 'chat' | 'agent' | 'battle' | 'group' | 'collab' | 'console' | 'api' | 'admin' | 'vision' | 'tts' | 'multimodal' | 'router' | 'docs';
export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  reasoning?: string;
  model?: string;
  routerInfo?: { intent: string; intentLabel: string; model: string; reason: string; debug?: { classifierModel?: string; rawOutput?: string; matchedBy?: string; prompt?: string } };
}

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface VisionMessage {
  role: 'user' | 'assistant';
  content: string | ContentPart[];
}

export interface ChatSession {
  id: string;
  title: string;
  chatType: 'direct' | 'battle' | 'group';
  messages: ChatMessage[];
  updatedAt: number;
  isDraft?: boolean;
}

export interface BattlePanelState {
  model: string;
  content: string;
  reasoning: string;
  requestId: string;
  status: string;
}

export interface GroupChatMessage {
  id: string;
  role: 'user' | 'assistant';
  model?: string;
  content: string;
  status?: 'streaming' | 'done' | 'error';
}
