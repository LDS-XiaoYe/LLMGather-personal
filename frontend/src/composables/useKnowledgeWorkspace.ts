import { computed, onUnmounted, reactive, ref, watch, type Ref } from "vue";
import { ElMessage } from "element-plus";
import * as api from "../api";
import { modelRequest } from "../model-services-api";
import {
  knowledgeHash,
  readKnowledgeRoute,
  type KnowledgeTab,
} from "../utils/knowledge-navigation";

export function useKnowledgeWorkspace(
  baseUrl: Ref<string>,
  authenticated: Ref<boolean>,
  publish: (bases: api.KnowledgeBase[]) => void,
) {
  const route = ref(readKnowledgeRoute(window.location.hash));
  const bases = ref<api.KnowledgeBase[]>([]),
    documents = ref<api.KnowledgeDocument[]>([]);
  const loading = ref(false),
    documentsLoading = ref(false),
    error = ref(""),
    documentError = ref("");
  const query = ref(""),
    documentQuery = ref(""),
    indexes = ref<{ fingerprint: string; status: string; error?: string }[]>(
      [],
    );
  const indexError = ref(""),
    indexing = computed(() =>
      indexes.value.some((i) => i.status === "building"),
    );
  const selected = computed(() =>
    bases.value.find((k) => k.id === route.value.id),
  );
  const filtered = computed(() =>
    bases.value.filter((k) =>
      `${k.name} ${k.description}`
        .toLowerCase()
        .includes(query.value.trim().toLowerCase()),
    ),
  );
  const createVisible = ref(false),
    creating = ref(false),
    createError = ref("");
  const form = reactive({
    name: "",
    description: "",
    provider: "native" as "native" | "ragflow",
    embeddingInstanceId: "",
    ragflowBaseUrl: "",
    ragflowApiKey: "",
    ragflowDatasetId: "",
  });
  let listRequest = 0,
    docRequest = 0,
    indexRequest = 0,
    disposed = false;
  function navigate(id = "", tab: KnowledgeTab = "documents") {
    window.location.hash = knowledgeHash(id, tab);
  }
  function syncRoute() {
    route.value = readKnowledgeRoute(window.location.hash);
  }
  window.addEventListener("hashchange", syncRoute);
  async function loadBases() {
    if (!authenticated.value) return;
    const generation = ++listRequest;
    loading.value = true;
    error.value = "";
    try {
      const data = await api.fetchKnowledgeBases(baseUrl.value);
      if (disposed || generation !== listRequest) return;
      bases.value = data;
      publish(data);
    } catch (e) {
      if (generation === listRequest && !disposed) error.value = message(e);
    } finally {
      if (generation === listRequest && !disposed) loading.value = false;
    }
  }
  async function loadDocuments(silent = false) {
    const id = route.value.id;
    if (!id || !authenticated.value) return;
    const generation = ++docRequest;
    if (!silent) documentsLoading.value = true;
    try {
      const data = await api.fetchKnowledgeDocuments(
        id,
        documentQuery.value,
        baseUrl.value,
      );
      if (disposed || generation !== docRequest) return;
      documents.value = data;
      documentError.value = "";
    } catch (e) {
      if (generation === docRequest && !disposed)
        documentError.value = message(e);
    } finally {
      if (generation === docRequest && !disposed)
        documentsLoading.value = false;
    }
  }
  async function loadIndexes() {
    const kb = selected.value;
    if (!kb || kb.provider !== "native") return;
    const generation = ++indexRequest;
    try {
      const data = await modelRequest<typeof indexes.value>(
        baseUrl.value,
        `/knowledge/bases/${encodeURIComponent(kb.id)}/index-status`,
      );
      if (disposed || generation !== indexRequest) return;
      indexes.value = data;
      indexError.value = "";
    } catch (e) {
      if (generation === indexRequest && !disposed)
        indexError.value = message(e);
    }
  }
  async function changed() {
    await Promise.all([loadBases(), loadDocuments(true), loadIndexes()]);
  }
  async function create() {
    if (creating.value || !form.name.trim()) return;
    creating.value = true;
    createError.value = "";
    try {
      const payload =
        form.provider === "native"
          ? {
              name: form.name.trim(),
              description: form.description,
              provider: form.provider,
              embeddingInstanceId: form.embeddingInstanceId || undefined,
            }
          : {
              name: form.name.trim(),
              description: form.description,
              provider: form.provider,
              ragflowBaseUrl: form.ragflowBaseUrl,
              ragflowApiKey: form.ragflowApiKey,
              ragflowDatasetId: form.ragflowDatasetId || undefined,
            };
      const kb = await api.createKnowledgeBase(payload, baseUrl.value);
      if (disposed) return;
      bases.value = [kb, ...bases.value];
      publish(bases.value);
      createVisible.value = false;
      form.name = "";
      form.description = "";
      form.ragflowApiKey = "";
      navigate(kb.id);
      ElMessage.success("知识库已创建，接下来上传文档。");
      void loadBases();
    } catch (e) {
      if (!disposed) createError.value = message(e);
    } finally {
      if (!disposed) creating.value = false;
    }
  }
  watch(
    [authenticated, baseUrl],
    () => {
      listRequest++;
      docRequest++;
      indexRequest++;
      bases.value = [];
      documents.value = [];
      indexes.value = [];
      if (authenticated.value) {
        void loadBases();
        void loadDocuments();
      }
    },
    { immediate: true },
  );
  watch(
    () => route.value.id,
    () => {
      docRequest++;
      indexRequest++;
      documents.value = [];
      indexes.value = [];
      documentQuery.value = "";
      documentError.value = "";
      indexError.value = "";
      void loadDocuments();
      void loadIndexes();
    },
  );
  watch(
    () => selected.value?.id,
    () => void loadIndexes(),
  );
  let polling = false;
  const timer = window.setInterval(async () => {
    if (
      disposed ||
      polling ||
      document.hidden ||
      !authenticated.value ||
      !selected.value
    )
      return;
    polling = true;
    try {
      await Promise.all([loadDocuments(true), loadIndexes()]);
    } finally {
      polling = false;
    }
  }, 5000);
  onUnmounted(() => {
    disposed = true;
    listRequest++;
    docRequest++;
    indexRequest++;
    window.clearInterval(timer);
    window.removeEventListener("hashchange", syncRoute);
  });
  return {
    route,
    bases,
    documents,
    loading,
    documentsLoading,
    error,
    documentError,
    indexError,
    indexes,
    indexing,
    query,
    documentQuery,
    selected,
    filtered,
    createVisible,
    creating,
    createError,
    form,
    navigate,
    loadBases,
    loadDocuments,
    changed,
    create,
  };
}
export function message(e: unknown) {
  return e instanceof Error ? e.message : "操作失败，请重试。";
}
