import { onMounted, onUnmounted, unref, watch } from 'vue';

/** Keep workspace catalogues current without rerunning editor/history initialization. */
export function useAgentAutoRefresh(app: Record<string, any>) {
  const value = (key: string) => unref(app[key]);
  const recent = new Map<string, { scope: string; at: number }>();
  let timer: ReturnType<typeof setInterval> | null = null;
  let stopped = false;

  function request(key: string, options: Record<string, boolean>, busy: string[]) {
    if (busy.some(flag => value(flag))) return;
    const fn = value(key);
    if (typeof fn !== 'function') return;
    const scope = `${value('authUser')?.id}|${value('backendBaseUrl')}`;
    const previous = recent.get(key);
    if (previous?.scope === scope && Date.now() - previous.at < 5000) return;
    recent.set(key, { scope, at: Date.now() });
    void Promise.resolve(fn(options)).catch(error => console.error('[Agent catalogue refresh]', error));
  }

  function refresh() {
    if (stopped || !value('isAuthenticated') || document.visibilityState !== 'visible') return;
    request('refreshAgentStudio', { background: true }, ['agentLoading', 'agentRunning', 'agentSaving', 'agentPublishing', 'workflowCanvasSaving']);
    request('loadModels', { silent: true }, ['isLoadingModels', 'isSubmitting']);
  }

  watch([() => value('isAuthenticated'), () => value('authUser')?.id, () => value('backendBaseUrl')], refresh);
  onMounted(() => {
    refresh();
    timer = setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
  });
  onUnmounted(() => {
    stopped = true;
    if (timer !== null) clearInterval(timer);
    window.removeEventListener('focus', refresh);
    document.removeEventListener('visibilitychange', refresh);
  });
}
