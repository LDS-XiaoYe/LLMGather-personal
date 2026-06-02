import { ref } from 'vue';
import {
  fetchBillingLedger,
  fetchBillingRules,
  topUp,
  type BillingRule,
  type BillingLedgerItem,
} from '../api';
import { authUser, billingRules, billingLedger, backendBaseUrl, isSettingsOpen, topUpAmount, topUpLoading } from './state';
import { getStoredValue, setStoredValue } from '../utils';

const BASE_URL_KEY = 'llm_gather_base_url';

export function useSettings() {
  function init() {
    backendBaseUrl.value = getStoredValue(BASE_URL_KEY) || '/v1';
    const stop = setStoredValue.bind(null, BASE_URL_KEY);
    // We'll handle persistence in the watcher
  }

  async function refreshBillingData() {
    if (!authUser.value) return;
    try {
      billingRules.value = await fetchBillingRules(backendBaseUrl.value);
      billingLedger.value = await fetchBillingLedger(backendBaseUrl.value);
    } catch (e) { console.error('[refreshBillingData] failed:', e); }
  }

  async function handleTopUp() {
    if (!authUser.value || topUpAmount.value <= 0) return;
    topUpLoading.value = true;
    try {
      authUser.value = await topUp(topUpAmount.value, backendBaseUrl.value);
      billingLedger.value = await fetchBillingLedger(backendBaseUrl.value);
    } catch { /* handled by caller */ } finally {
      topUpLoading.value = false;
    }
  }

  return { backendBaseUrl, isSettingsOpen, billingRules, billingLedger, topUpAmount, topUpLoading, refreshBillingData, handleTopUp };
}
