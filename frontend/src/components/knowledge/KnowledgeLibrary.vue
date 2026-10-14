<script setup lang="ts">
import { onUnmounted, reactive, ref, watch } from "vue";
import { ElMessage, ElMessageBox, type UploadFile } from "element-plus";
import * as api from "../../api";
import { message } from "../../composables/useKnowledgeWorkspace";
const props = defineProps<{ baseUrl: string; bases: api.KnowledgeBase[] }>();
const emit = defineEmits<{ changed: [] }>();
const files = ref<api.UserLibraryFile[]>([]),
  loading = ref(false),
  busy = ref(false),
  error = ref(""),
  preview = ref<api.UserLibraryFile | null>(null),
  previewVisible = ref(false),
  previewLoading = ref(false),
  previewError = ref("");
const filters = reactive({ query: "", fileType: "", source: "", kbStatus: "" });
const target = ref(""),
  adding = ref<api.UserLibraryFile | null>(null);
let request = 0,
  detailRequest = 0,
  disposed = false;
async function load() {
  const current = ++request;
  loading.value = true;
  try {
    const data = await api.fetchUserLibraryFiles({ ...filters }, props.baseUrl);
    if (!disposed && current === request) {
      files.value = data;
      error.value = "";
    }
  } catch (e) {
    if (!disposed && current === request) error.value = message(e);
  } finally {
    if (!disposed && current === request) loading.value = false;
  }
}
async function upload(item: UploadFile) {
  if (!item.raw || busy.value) return;
  const file = item.raw;
  if (!file.size || file.size > 1024 * 1024) {
    error.value = "请选择非空且不超过 1 MB 的文件。";
    return;
  }
  busy.value = true;
  error.value = "";
  try {
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("文件读取失败"));
      reader.readAsDataURL(file);
    });
    await api.createUserLibraryFile(
      {
        filename: file.name,
        fileBase64: data,
        mimeType: file.type,
        source: "user_upload",
      },
      props.baseUrl,
    );
    await load();
    ElMessage.success("文件已保存到用户库");
  } catch (e) {
    error.value = message(e);
  } finally {
    busy.value = false;
  }
}
async function view(file: api.UserLibraryFile) {
  const current = ++detailRequest;
  preview.value = null;
  previewVisible.value = true;
  previewLoading.value = true;
  previewError.value = "";
  try {
    const data = await api.fetchUserLibraryFile(file.id, props.baseUrl);
    if (!disposed && current === detailRequest) preview.value = data;
  } catch (e) {
    if (!disposed && current === detailRequest) previewError.value = message(e);
  } finally {
    if (!disposed && current === detailRequest) previewLoading.value = false;
  }
}
async function rename(file: api.UserLibraryFile) {
  if (busy.value) return;
  try {
    const { value } = await ElMessageBox.prompt("输入新的文件名", "重命名", {
      inputValue: file.filename,
      inputValidator: (value) =>
        (!!value.trim() && value.length <= 191) || "文件名须为 1–191 字符",
      confirmButtonText: "保存",
      cancelButtonText: "取消",
    });
    busy.value = true;
    await api.renameUserLibraryFile(file.id, value.trim(), props.baseUrl);
    await load();
  } catch (e) {
    if (e !== "cancel" && e !== "close") error.value = message(e);
  } finally {
    busy.value = false;
  }
}
async function remove(file: api.UserLibraryFile) {
  if (busy.value) return;
  try {
    await ElMessageBox.confirm(
      `删除用户库文件“${file.filename}”？已加入知识库的文档不受影响。`,
      "删除文件",
      { type: "warning", confirmButtonText: "删除", cancelButtonText: "取消" },
    );
    busy.value = true;
    await api.deleteUserLibraryFile(file.id, props.baseUrl);
    await load();
  } catch (e) {
    if (e !== "cancel" && e !== "close") error.value = message(e);
  } finally {
    busy.value = false;
  }
}
async function download(file: api.UserLibraryFile) {
  try {
    const data = await api.fetchUserLibraryFile(file.id, props.baseUrl);
    if (!data.fileBase64) throw new Error("文件内容不存在");
    const encoded = /^data:([^;,]*)(?:;[^,]*)?;base64,([\s\S]+)$/i.exec(
      data.fileBase64,
    );
    if (!encoded) throw new Error("文件下载数据格式不正确");
    const bytes = Uint8Array.from(atob(encoded[2]), (char) =>
      char.charCodeAt(0),
    );
    const url = URL.createObjectURL(
      new Blob([bytes], { type: encoded[1] || "application/octet-stream" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = data.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e) {
    error.value = message(e);
  }
}
async function add() {
  if (!adding.value || !target.value || busy.value) return;
  busy.value = true;
  error.value = "";
  try {
    await api.addUserLibraryFileToKnowledge(
      adding.value.id,
      target.value,
      props.baseUrl,
    );
    adding.value = null;
    emit("changed");
    await load();
    ElMessage.success("已加入知识库");
  } catch (e) {
    error.value = message(e);
    emit("changed");
  } finally {
    busy.value = false;
  }
}
function command(action: string, file: api.UserLibraryFile) {
  if (action === "preview") void view(file);
  if (action === "download") void download(file);
  if (action === "rename") void rename(file);
  if (action === "remove") void remove(file);
}
const type = (value: string) =>
  ({
    word: "Word",
    pdf: "PDF",
    excel: "Excel",
    markdown: "Markdown",
    image: "图片",
    text: "文本",
  })[value] || value;
const source = (value: string) =>
  ({
    user_upload: "用户上传",
    agent_generated: "Agent 生成",
    conversation_attachment: "对话附件",
    intermediate: "中间产物",
  })[value] || value;
watch(
  () => props.baseUrl,
  () => void load(),
  { immediate: true },
);
onUnmounted(() => {
  disposed = true;
  request++;
  detailRequest++;
});
</script>
<template>
  <section class="knowledge-library">
    <div class="knowledge-library-toolbar">
      <el-input
        v-model="filters.query"
        clearable
        placeholder="搜索文件"
        aria-label="搜索文件"
        @keyup.enter="load"
      /><el-select
        v-model="filters.fileType"
        clearable
        placeholder="文件类型"
        aria-label="文件类型"
        ><el-option
          v-for="(label, value) in {
            word: 'Word',
            pdf: 'PDF',
            excel: 'Excel',
            markdown: 'Markdown',
            image: '图片',
            text: '文本',
          }"
          :key="value"
          :label="label"
          :value="value" /></el-select
      ><el-select
        v-model="filters.source"
        clearable
        placeholder="来源"
        aria-label="来源"
        ><el-option
          v-for="(label, value) in {
            user_upload: '用户上传',
            agent_generated: 'Agent 生成',
            conversation_attachment: '对话附件',
            intermediate: '中间产物',
          }"
          :key="value"
          :label="label"
          :value="value" /></el-select
      ><el-select
        v-model="filters.kbStatus"
        clearable
        placeholder="入库状态"
        aria-label="入库状态"
        ><el-option label="已加入知识库" value="added" /><el-option
          label="未入库"
          value="not_added" /></el-select
      ><el-button :loading="loading" @click="load">筛选</el-button
      ><el-upload
        :auto-upload="false"
        :show-file-list="false"
        :disabled="busy"
        @change="upload"
        ><el-button type="primary" icon="Upload" :loading="busy"
          >上传文件</el-button
        ></el-upload
      >
    </div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <div v-loading="loading">
      <article
        v-for="file in files"
        :key="file.id"
        class="knowledge-document-row"
      >
        <el-icon class="knowledge-document-icon"><Document /></el-icon>
        <div class="knowledge-document-main">
          <button class="knowledge-text-link" @click="view(file)">
            {{ file.filename }}
          </button>
          <p class="knowledge-muted">
            {{ type(file.fileType) }} · {{ source(file.source) }} ·
            {{ file.kbStatus === "added" ? "已加入知识库" : "未入库" }} ·
            {{ (file.fileSize / 1024).toFixed(1) }} KB
          </p>
          <p class="knowledge-muted">{{ file.preview }}</p>
        </div>
        <div class="knowledge-actions">
          <el-button
            text
            type="primary"
            :disabled="busy || !bases.length"
            @click="
              adding = file;
              target = bases[0]?.id || '';
            "
            >添加到知识库</el-button
          ><el-dropdown trigger="click" @command="command($event, file)"
            ><el-button
              text
              circle
              icon="MoreFilled"
              :aria-label="`${file.filename}的更多操作`"
            /><template #dropdown
              ><el-dropdown-menu
                ><el-dropdown-item command="preview">预览</el-dropdown-item
                ><el-dropdown-item command="download">下载</el-dropdown-item
                ><el-dropdown-item command="rename" :disabled="busy"
                  >重命名</el-dropdown-item
                ><el-dropdown-item command="remove" :disabled="busy"
                  >删除</el-dropdown-item
                ></el-dropdown-menu
              ></template
            ></el-dropdown
          >
        </div>
      </article>
      <el-empty
        v-if="!files.length && !loading"
        description="没有找到文件"
        :image-size="72"
      />
    </div>
  </section>
  <el-dialog
    v-model="previewVisible"
    :title="preview?.filename || '文件预览'"
    width="min(760px, calc(100vw - 32px))"
    @closed="detailRequest++"
    ><div v-loading="previewLoading">
      <el-alert
        v-if="previewError"
        :title="previewError"
        type="error"
        :closable="false"
      /><template v-if="preview"
        ><img
          v-if="preview.fileType === 'image' && preview.fileBase64"
          :src="preview.fileBase64"
          :alt="preview.filename"
          style="max-width: 100%"
        />
        <pre v-else class="knowledge-pre">{{
          preview.parsedContent || preview.preview || "此文件暂无文本预览"
        }}</pre>
      </template>
    </div></el-dialog
  ><el-dialog
    :model-value="!!adding"
    title="添加到知识库"
    width="min(460px, calc(100vw - 32px))"
    :show-close="!busy"
    :close-on-click-modal="false"
    :close-on-press-escape="!busy"
    @update:model-value="!busy && (adding = null)"
    ><p>{{ adding?.filename }}</p>
    <el-select
      v-model="target"
      filterable
      placeholder="目标知识库"
      aria-label="目标知识库"
      style="width: 100%"
      :disabled="busy"
      ><el-option
        v-for="kb in bases"
        :key="kb.id"
        :label="kb.name"
        :value="kb.id" /></el-select
    ><el-alert
      v-if="error"
      :title="error"
      type="error"
      :closable="false"
    /><template #footer
      ><el-button :disabled="busy" @click="adding = null">取消</el-button
      ><el-button
        type="primary"
        :loading="busy"
        :disabled="!target"
        @click="add"
        >添加到知识库</el-button
      ></template
    ></el-dialog
  >
</template>
