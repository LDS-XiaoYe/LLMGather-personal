<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { ElMessageBox } from 'element-plus';
import { modelRequest } from '../model-services-api';
import { currentEmbeddingIndex } from '../utils/embedding-index-state';
const props=withDefaults(defineProps<{baseUrl?:string;modelValue?:string;kbId?:string;disabled?:boolean}>(),{baseUrl:'/v1',modelValue:'',disabled:false});
const emit=defineEmits<{(e:'update:modelValue',value:string):void;(e:'changed'):void;(e:'indexing',value:boolean):void}>();
const providers=ref<{id:string;modelId:string;nodeName:string;fingerprint:string;specJson:string}[]>([]);
const selected=ref(props.modelValue),boundModel=ref(props.modelValue),busy=ref(false),loading=ref(false),indexing=ref(false);
const error=ref(''),loadError=ref(''),retryNeeded=ref(false),awaitingCompletion=ref(false);
const bindingChanged=computed(()=>selected.value!==boundModel.value);
let request=0,disposed=false,poll:ReturnType<typeof setTimeout>|undefined,polling=false;
watch(()=>props.modelValue,value=>{const previous=boundModel.value;boundModel.value=value;if(!busy.value&&selected.value===previous)selected.value=value;});
watch(()=>props.kbId,()=>{request++;error.value='';retryNeeded.value=false;awaitingCompletion.value=false;indexing.value=false;void load();});
watch(()=>props.baseUrl,()=>{request++;void load();});
watch(()=>busy.value||indexing.value,value=>emit('indexing',value),{immediate:true});
async function load(silent=false){
  if(disposed)return;
  const current=++request,kbId=props.kbId,baseUrl=props.baseUrl;
  if(!silent)loading.value=true;
  try{
    const [items,indexes]=await Promise.all([
      modelRequest<typeof providers.value>(baseUrl,'/knowledge/embedding-providers'),
      kbId?modelRequest<{fingerprint:string;status:string;error?:string}[]>(baseUrl,`/knowledge/bases/${kbId}/index-status`):Promise.resolve([]),
    ]);
    if(disposed||current!==request)return;
    providers.value=items;loadError.value='';
    const fingerprint=items.find(p=>p.id===boundModel.value)?.fingerprint;
    const state=currentEmbeddingIndex(indexes,fingerprint);
    const wasIndexing=indexing.value;indexing.value=state.building;
    if(state.failed&&!busy.value){retryNeeded.value=true;error.value='自动索引失败，请重新绑定模型重试。';}
    if(state.ready){
      retryNeeded.value=false;
      if(awaitingCompletion.value&&boundModel.value===selected.value){awaitingCompletion.value=false;error.value='';emit('changed');}
    }
    if(wasIndexing&&!state.building)emit('changed');
  }catch(e){if(!disposed&&current===request)loadError.value=e instanceof Error?e.message:'获取模型失败';}
  finally{if(!disposed&&current===request)loading.value=false;}
}
function change(value:string){if(!props.kbId)emit('update:modelValue',value);}
function visibleChanged(visible:boolean){if(visible)void load();}
async function bind(){
  if(props.disabled||busy.value||indexing.value||!props.kbId||(!bindingChanged.value&&!retryNeeded.value))return;
  const kbId=props.kbId,instanceId=selected.value,baseUrl=props.baseUrl;
  busy.value=true;error.value='';
  try{
    await ElMessageBox.confirm('切换模型后将自动重建索引。原文保留，旧向量不会与新模型混用。','绑定 Embedding 模型',{type:'warning'});
    if(disposed)return;
    await modelRequest(baseUrl,`/knowledge/bases/${kbId}/embedding`,{instanceId});
    if(disposed||props.kbId!==kbId)return;
    boundModel.value=instanceId;error.value='';retryNeeded.value=false;awaitingCompletion.value=false;emit('changed');
    await load(true);
  }catch(e){
    if(disposed||props.kbId!==kbId||e==='cancel'||e==='close')return;
    retryNeeded.value=true;
    awaitingCompletion.value=e instanceof Error&&e.name==='TimeoutError';
    error.value=awaitingCompletion.value?'等待超时，正在自动跟踪后台结果。':e instanceof Error?e.message:'绑定失败，请重试';
    emit('changed');await load(true);
  }finally{if(!disposed)busy.value=false;}
}
async function pollState(){
  if(disposed)return;
  polling=true;
  try{if(typeof document==='undefined'||!document.hidden)await load(true);}finally{polling=false;}
  if(!disposed)poll=setTimeout(()=>void pollState(),5000);
}
function resume(){if(!document.hidden&&!disposed&&!polling)void load(true);}
onMounted(()=>{void pollState();document.addEventListener('visibilitychange',resume);});
onUnmounted(()=>{disposed=true;request++;clearTimeout(poll);document.removeEventListener('visibilitychange',resume);emit('indexing',false);});
</script>
<template><div class="embedding-selector"><el-select v-model="selected" :loading="loading" :disabled="disabled||busy||indexing" placeholder="选择 Embedding 模型" @change="change" @visible-change="visibleChanged">
  <el-option :label="kbId?'环境配置模型':'系统默认模型（未设置时使用环境配置）'" value=""/>
  <el-option v-if="boundModel&&!providers.some(p=>p.id===boundModel)" :value="boundModel" label="当前绑定模型（暂不可用）" disabled/>
  <el-option v-for="p in providers" :key="p.id" :value="p.id" :label="`${p.modelId} · ${p.nodeName}`"/>
</el-select><el-button v-if="kbId" :loading="busy||indexing" :disabled="disabled||indexing||(!bindingChanged&&!retryNeeded)" @click="bind">{{ busy||indexing?'正在更新':'绑定模型' }}</el-button><small v-if="error||loadError" role="alert" class="embedding-error">{{ error||loadError }}</small><small v-else-if="!kbId">可选择后台部署的 BGE-M3。</small></div></template>
<style scoped>.embedding-selector{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.el-select{flex:1 1 260px;min-width:0;max-width:380px}small{color:var(--el-text-color-secondary)}.embedding-error{color:var(--el-color-danger)}</style>
