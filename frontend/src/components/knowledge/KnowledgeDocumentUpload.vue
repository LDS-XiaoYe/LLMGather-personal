<script setup lang="ts">
import { computed, ref } from "vue";
import type { UploadFile } from "element-plus";
import { ElMessage } from "element-plus";
import { addKnowledgeDocument, parseKnowledgeFile } from "../../api";
import { validateKnowledgeFile } from "../../utils/knowledge-navigation";
import { message } from "../../composables/useKnowledgeWorkspace";
const props = defineProps<{
  modelValue: boolean;
  kbId: string;
  baseUrl: string;
}>();
const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  saved: [];
  changed: [];
}>();
const mode = ref("file"),
  title = ref(""),
  content = ref(""),
  error = ref(""),
  busy = ref(false),
  parsing = ref(false),
  phase = ref(""),
  readProgress = ref(0);
const valid = computed(
  () =>
    title.value.trim() &&
    content.value.trim() &&
    content.value.length <= 200000 &&
    !busy.value &&
    !parsing.value,
);
let generation = 0;
async function selectFile(upload: UploadFile) {
  if (!upload.raw || parsing.value || busy.value) return;
  error.value = validateKnowledgeFile(upload.raw);
  if (error.value) return;
  const current = ++generation;
  title.value = upload.raw.name;
  content.value = "";
  parsing.value = true;
  phase.value = "读取文件";
  readProgress.value = 0;
  try {
    const file = upload.raw;
    let text = "";
    if (/\.(txt|md|csv|json)$/i.test(file.name)) text = await file.text();
    else {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onprogress = (e) => {
          if (e.lengthComputable && current === generation)
            readProgress.value = Math.round((e.loaded / e.total) * 100);
        };
        reader.onerror = () => reject(new Error("读取文件失败"));
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(file);
      });
      phase.value = "正在上传并解析文件";
      text = (
        await parseKnowledgeFile(
          { file: data, filename: file.name },
          props.baseUrl,
        )
      ).content;
    }
    if (current !== generation) return;
    if (!text.trim()) throw new Error("没有解析到文本，请检查文件内容。");
    if (text.length > 200000)
      throw new Error("解析文本超过 200,000 字符，请拆分文档后上传。");
    title.value = file.name;
    content.value = text;
  } catch (e) {
    if (current === generation) error.value = message(e);
  } finally {
    if (current === generation) {
      parsing.value = false;
      phase.value = "";
    }
  }
}
async function save() {
  if (!valid.value) return;
  busy.value = true;
  error.value = "";
  phase.value = "正在写入知识库";
  try {
    await addKnowledgeDocument(
      props.kbId,
      { title: title.value.trim(), content: content.value.trim() },
      props.baseUrl,
    );
    emit("saved");
    emit("update:modelValue", false);
    title.value = "";
    content.value = "";
    ElMessage.success("文档已添加，处理状态会自动更新。");
  } catch (e) {
    error.value = `${message(e)} 请检查文档列表是否已保存，避免重复添加。`;
    emit("changed");
  } finally {
    busy.value = false;
    phase.value = "";
  }
}
function close() {
  if (!busy.value && !parsing.value) emit("update:modelValue", false);
}
</script>
<template>
  <el-dialog
    :model-value="modelValue"
    title="上传文档"
    width="min(640px, calc(100vw - 32px))"
    :close-on-click-modal="false"
    :close-on-press-escape="!busy && !parsing"
    :show-close="!busy && !parsing"
    @update:model-value="close"
  >
    <el-segmented
      v-model="mode"
      :disabled="busy || parsing"
      :options="[
        { label: '上传文件', value: 'file' },
        { label: '直接录入', value: 'text' },
      ]"
      aria-label="添加文档方式"
    />
    <el-upload
      v-if="mode === 'file'"
      class="knowledge-upload"
      drag
      :auto-upload="false"
      :show-file-list="false"
      :disabled="busy || parsing"
      accept=".txt,.md,.csv,.json,.pdf,.doc,.docx,.xls,.xlsx"
      @change="selectFile"
      ><el-icon :size="30"><UploadFilled /></el-icon>
      <p>拖拽文件到此处，或点击选择</p>
      <small
        >TXT、Markdown、PDF、Word、Excel、CSV、JSON · 单个文件 1 MB 内</small
      ></el-upload
    >
    <el-form label-position="top" class="knowledge-form"
      ><el-form-item label="文档名称" required
        ><el-input
          v-model="title"
          maxlength="191"
          :disabled="busy || parsing"
          placeholder="为文档填写便于查找的名称" /></el-form-item
      ><el-form-item
        :label="mode === 'file' ? '解析文本（可在入库前检查）' : '文档内容'"
        required
        ><el-input
          v-model="content"
          type="textarea"
          :rows="8"
          :disabled="busy || parsing"
          maxlength="200000"
          show-word-limit
          placeholder="粘贴需要 AI 使用的资料" /></el-form-item
    ></el-form>
    <el-progress
      v-if="parsing && phase === '读取文件' && readProgress"
      :percentage="readProgress"
    />
    <p v-if="phase" role="status" class="knowledge-muted">
      {{ phase }}，请稍候。服务器未提供百分比进度。
    </p>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <template #footer
      ><el-button :disabled="busy || parsing" @click="close">取消</el-button
      ><el-button
        type="primary"
        :loading="busy || parsing"
        :disabled="!valid"
        @click="save"
        >添加文档</el-button
      ></template
    >
  </el-dialog>
</template>
