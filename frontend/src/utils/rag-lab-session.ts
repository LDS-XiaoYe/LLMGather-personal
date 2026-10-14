/** Query snapshots and a generation token prevent stale or failed requests from retaining results. */
export function createRagLabSession<Request, Result, Meta>(state: {
  results: { value: Result[] }; meta: { value: Meta | null }; snapshot: { value: Request | null };
  error: { value: string }; searching: { value: boolean };
}, search: (request: Request) => Promise<{ data: Result[]; meta?: Meta }>) {
  let generation = 0;
  const clear = () => {
    state.results.value = []; state.meta.value = null; state.snapshot.value = null;
    state.error.value = ''; state.searching.value = false;
  };
  return {
    invalidate() { generation++; clear(); },
    async run(input: Request): Promise<boolean> {
      const request = { ...input }, current = ++generation;
      clear(); state.searching.value = true;
      try {
        const response = await search(request);
        if (current !== generation) return false;
        state.results.value = response.data; state.meta.value = response.meta ?? null; state.snapshot.value = request;
        return true;
      } catch (error) {
        if (current !== generation) return false;
        state.error.value = error instanceof Error ? error.message : '检索失败';
        return true;
      } finally { if (current === generation) state.searching.value = false; }
    },
  };
}
