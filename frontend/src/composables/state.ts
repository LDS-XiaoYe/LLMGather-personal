// Module-level shared reactive state — imported by composables to avoid circular deps
import { ref } from 'vue';
import type { AuthUser, BillingLedgerItem, BillingRule, ModelDescriptor, ConversationSession, ApiKeyItem } from '../api';
import type { ChatSession } from '../types';

export const authUser = ref<AuthUser | null>(null);
export const isAuthLoaded = ref(false);
export const isSessionLoaded = ref(false);

export const models = ref<ModelDescriptor[]>([]);
export const selectedModel = ref('');
export const isLoadingModels = ref(false);
export const status = ref('等待连接');

export const sessions = ref<ChatSession[]>([]);
export const activeSessionId = ref('');

export const backendBaseUrl = ref('');
export const isSettingsOpen = ref(false);

export const billingRules = ref<BillingRule[]>([]);
export const billingLedger = ref<BillingLedgerItem[]>([]);

export const apiKeys = ref<Array<{ id: string; name: string; maskedKey: string; fullKey?: string; createdAt: string }>>([]);

export const topUpAmount = ref(10);
export const topUpLoading = ref(false);
