<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { modelRequest } from '../model-services-api';
const props=withDefaults(defineProps<{baseUrl?:string;modelValue?:string;kbId?:string}>(),{baseUrl:'/v1',modelValue:''});
const emit=defineEmits<{(e:'update:modelValue',value:string):void}>();
const providers=ref<{id:string;modelId:string;nodeName:string;fingerprint:string;specJson:string}[]>([]),selected=ref(props.modelValue),busy=ref(false),error=ref('');
async function load(){try{providers.value=await modelRequest(props.baseUrl,'/knowledge/embedding-providers');error.value='';}catch(e){error.value=e instanceof Error?e.message:'获取模型失败';}}
function visibleChanged(visible:boolean){if(visible)void load();}
async function bind(){busy.value=true;try{
  await ElMessageBox.confirm('更改向量空间将使当前语义索引失效。绑定后点击重新索引，旧模型的索引不会混用。','切换知识库 Embedding',{type:'warning'});
  await modelRequest(props.baseUrl,`/knowledge/bases/${props.kbId}/embedding`,{instanceId:selected.value});ElMessage.success('已绑定，需重新索引');
}catch(e){if(e instanceof Error)ElMessage.error(e.message);}finally{busy.value=false;}}
async function reindex(){busy.value=true;try{await modelRequest(props.baseUrl,`/knowledge/bases/${props.kbId}/reindex`,{reset:true});ElMessage.success('索引已就绪');}catch(e){ElMessage.error(e instanceof Error?e.message:'索引失败');}finally{busy.value=false;}}
onMounted(()=>void load());
</script>
<template><div class="embedding-selector"><el-select v-model="selected" placeholder="选择 Embedding 模型" @change="emit('update:modelValue',selected)" @visible-change="visibleChanged">
  <el-option label="环境配置 / 创建时使用系统默认" value=""/><el-option v-for="p in providers" :key="p.id" :value="p.id" :label="`${p.modelId} · ${p.nodeName} · ${p.fingerprint.slice(0,8)}`"/>
</el-select><template v-if="kbId"><el-button :loading="busy" @click="bind">绑定模型</el-button><el-button :loading="busy" @click="reindex">重新索引</el-button></template><small v-if="error">{{ error }}</small><small v-else>不同 Revision / 精度 / 运行时使用独立向量空间。</small></div></template>
<style scoped>.embedding-selector{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.el-select{min-width:260px}small{color:var(--el-text-color-secondary)}</style>
