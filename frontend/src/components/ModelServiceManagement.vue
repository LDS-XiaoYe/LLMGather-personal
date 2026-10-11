<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { modelEvents, modelRequest, type DeploymentConfig, type ModelInstance, type ModelSnapshot, type Hardware } from '../model-services-api';
const props=withDefaults(defineProps<{baseUrl?:string}>(),{baseUrl:'/v1'});
const snapshot=ref<ModelSnapshot>({nodes:[],instances:[],tasks:[],defaultInstanceId:null,registry:{models:[],matrix:[]}});
const loading=ref(false),error=ref(''),wizard=ref(false),step=ref(0),nodeId=ref(''),nodeDialog=ref(false),detail=ref(''),detailTitle=ref('');
const nodeForm=ref({id:'',name:'',baseUrl:'http://127.0.0.1:19090',token:''});
const config=ref<DeploymentConfig>({modelId:'bge-m3',backend:'cpu',source:'auto',cpu:4,memoryMiB:8192,allowExperimental:false});
const node=computed(()=>snapshot.value.nodes.find(n=>n.id===nodeId.value));
const model=computed(()=>snapshot.value.registry.models.find(m=>m.id===config.value.modelId));
const abort=new AbortController();
async function refresh(){try{snapshot.value=await modelRequest(props.baseUrl,'/admin/model-services');error.value='';}catch(e){error.value=e instanceof Error?e.message:'加载失败';}}
async function action(run:()=>Promise<unknown>){loading.value=true;try{await run();await refresh();}catch(e){ElMessage.error(e instanceof Error?e.message:'操作失败');}finally{loading.value=false;}}
function disabledReason(backend:string){const h=node.value?.hardware;
  if(!node.value||node.value.status!=='ONLINE')return '请选择在线计算节点';
  if(backend==='apple')return h?.platform==='darwin'&&h.arch==='arm64'&&/^Apple M\d/.test(h.apple?.chip||'')?'':'需要 macOS Apple Silicon 原生 Agent';
  if(h?.docker?.os!=='linux'||!['amd64','x86_64'].includes(h.docker.arch))return '需要 Linux amd64 Docker daemon';
  if(backend==='nvidia'&&(!h.docker.nvidiaRuntime||!h.gpus.length))return '未检测到 NVIDIA GPU / Container Toolkit';return '';
}
const gpu=computed(()=>node.value?.hardware.gpus.find(g=>g.uuid===config.value.gpuUuid));
const gpuRuntime=computed(()=>snapshot.value.registry.matrix.find(r=>r.backend==='nvidia'&&r.capability===gpu.value?.capability));
const issues=computed(()=>{
  const errors:string[]=[];const h=node.value?.hardware;
  if(disabledReason(config.value.backend))errors.push(disabledReason(config.value.backend));
  if(model.value&&h&&h.freeDiskMiB<model.value.minDiskMiB)errors.push('模型缓存磁盘空间不足');
  if(h&&(config.value.backend==='apple'?h.memoryMiB:h.docker?.memoryMiB||0)<config.value.memoryMiB)errors.push('节点可用总内存不足');
  if(config.value.backend==='nvidia'){
    if(!gpu.value)errors.push('请选择 GPU');else if(!gpuRuntime.value)errors.push('当前 Compute Capability 未登记兼容镜像');
    if(gpuRuntime.value?.experimental&&!config.value.allowExperimental)errors.push('Blackwell 实验运行时需明确确认');
    if(gpu.value&&gpu.value.freeMiB<3072)errors.push('GPU 可用显存低于 3072 MiB');
  }return errors;
});
function openDeploy(i?:ModelInstance){nodeId.value=i?.node_id||snapshot.value.nodes.find(n=>n.status==='ONLINE')?.id||'';
  config.value=i?{...i.config}:{modelId:'bge-m3',backend:'cpu',source:'auto',cpu:4,memoryMiB:8192,allowExperimental:false};step.value=0;wizard.value=true;}
async function deploy(){await action(async()=>{await modelRequest(props.baseUrl,'/admin/model-services/tasks',{taskId:crypto.randomUUID(),instanceId:crypto.randomUUID(),nodeId:nodeId.value,action:'deploy',config:config.value});wizard.value=false;ElMessage.success('部署任务已入队');});}
async function operate(i:ModelInstance,operation:string){await action(async()=>{
  let confirm=false;
  if(['stop','remove','delete-cache'].includes(operation)){
    const dependencies=await modelRequest<{name:string}[]>(props.baseUrl,`/admin/model-services/instances/${i.id}/dependencies`);
    await ElMessageBox.confirm(`操作：${operation}。影响知识库：${dependencies.map(d=>d.name).join('、')||'无'}。${operation==='delete-cache'?'仅卸载后可删除权重。':'停止/卸载后这些知识库的向量检索将报服务不可用。'}`,'确认操作',{type:'warning'});confirm=true;
  }
  await modelRequest(props.baseUrl,'/admin/model-services/tasks',{taskId:crypto.randomUUID(),instanceId:i.id,action:operation,confirm});
});}
async function inspect(i:ModelInstance,kind:'logs'|'metrics'){await action(async()=>{detailTitle.value=kind==='logs'?'运行日志':'实际资源监控';const value=await modelRequest<unknown>(props.baseUrl,`/admin/model-services/instances/${i.id}/${kind}`);detail.value=JSON.stringify(value,null,2);});}
async function retry(i:ModelInstance){await action(()=>modelRequest(props.baseUrl,'/admin/model-services/tasks',{taskId:crypto.randomUUID(),instanceId:i.id,nodeId:i.node_id,action:'deploy',config:i.config}));}
function instanceSource(i:ModelInstance){return snapshot.value.tasks.find(t=>t.instanceId===i.id&&t.progress.source)?.progress.source||i.config.source;}
function instanceGpu(i:ModelInstance){return snapshot.value.nodes.find(n=>n.id===i.node_id)?.hardware?.gpus.find(g=>g.uuid===i.config.gpuUuid)?.name;}
function bytes(n?:number){return n?`${(n/1048576).toFixed(1)} MiB`:'0 MiB';}
function gpuNames(h?:Hardware){return h?.gpus.map(g=>g.name).join(' / ')||(h?.apple?'Apple Metal':'无 NVIDIA GPU');}
onMounted(async()=>{await refresh();void modelEvents(props.baseUrl,event=>{
  if(event.connectionError){error.value=String(event.connectionError);return;}
  if(event.snapshot){snapshot.value=event.snapshot as ModelSnapshot;error.value='';return;}
  const task=snapshot.value.tasks.find(t=>t.id===event.taskId);
  if(task){task.phase=String(event.phase||task.phase);task.status=String(event.status||task.status);task.error=String(event.error||'');task.progress={...task.progress,...event};}
  if(['COMPLETED','FAILED','CANCELLED'].includes(String(event.phase)))void refresh();
},abort.signal);});
onUnmounted(()=>abort.abort());
</script>

<template>
  <el-card shadow="never" class="model-services">
    <template #header><div class="toolbar"><strong>模型服务管理</strong><el-button :loading="loading" @click="refresh">刷新状态</el-button><el-button @click="nodeDialog=true">注册计算节点</el-button><el-button type="primary" @click="openDeploy()">部署模型</el-button></div></template>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-alert title="模型部署在所选计算节点，而不是浏览器所在设备。默认 Provider 只影响新知识库；更新模型会创建新实例，已有知识库需显式绑定并重新索引。" type="info" :closable="false" />
    <h4>计算节点</h4>
    <el-table :data="snapshot.nodes" size="small"><el-table-column prop="name" label="节点"/><el-table-column prop="status" label="状态" width="100"/>
      <el-table-column label="平台 / 硬件"><template #default="{row}">{{ row.hardware?.platform }} / {{ row.hardware?.arch }} · {{ row.hardware?.apple?.chip || row.hardware?.cpu }} · {{ row.hardware?.memoryMiB }} MiB</template></el-table-column>
      <el-table-column label="GPU"><template #default="{row}">{{ gpuNames(row.hardware) }}</template></el-table-column>
      <el-table-column label="缓存剩余"><template #default="{row}">{{ Math.floor(row.hardware?.freeDiskMiB||0) }} MiB</template></el-table-column>
    </el-table>
    <h4>Embedding 模型实例</h4>
    <el-table :data="snapshot.instances" size="small" stripe>
      <el-table-column label="模型 / 节点" min-width="170"><template #default="{row}"><strong>{{ row.model_id }}</strong> · {{ snapshot.nodes.find(n=>n.id===row.node_id)?.name }}<br><small>{{ row.id }}</small><br><el-tag v-if="snapshot.defaultInstanceId===row.id">新知识库默认</el-tag></template></el-table-column>
      <el-table-column label="后端 / 来源" width="150"><template #default="{row}">{{ row.config.backend }} / {{ instanceSource(row) }}<br>{{ instanceGpu(row) }}<br>{{ row.spec?.precision }} · {{ row.spec?.dimensions }} 维</template></el-table-column>
      <el-table-column label="期望 / 实际" width="170"><template #default="{row}">{{ row.desired_state }} / {{ row.actual_state }}<br>Provider：{{ row.provider_registered?'已注册':'未就绪' }}</template></el-table-column>
      <el-table-column label="操作" min-width="320"><template #default="{row}"><div class="actions">
        <el-button size="small" :disabled="!!row.operation_id" @click="operate(row,'start')">启动</el-button><el-button size="small" :disabled="!!row.operation_id" @click="operate(row,'stop')">停止</el-button><el-button size="small" :disabled="!!row.operation_id" @click="operate(row,'restart')">重启</el-button>
        <el-button size="small" @click="inspect(row,'logs')">日志</el-button><el-button size="small" @click="inspect(row,'metrics')">资源</el-button><el-button size="small" @click="openDeploy(row)">更新（新实例）</el-button>
        <el-button v-if="['FAILED','MISSING'].includes(row.actual_state)" size="small" :disabled="!!row.operation_id" @click="retry(row)">恢复部署</el-button>
        <el-button size="small" :disabled="!row.provider_registered" @click="action(()=>modelRequest(baseUrl,`/admin/model-services/instances/${row.id}/default`,{}))">设为默认</el-button>
        <el-button size="small" type="danger" :disabled="!!row.operation_id" @click="operate(row,'remove')">卸载</el-button><el-button size="small" type="danger" :disabled="row.actual_state!=='REMOVED'||!!row.operation_id" @click="operate(row,'delete-cache')">删除缓存</el-button>
      </div></template></el-table-column>
    </el-table>
    <h4>部署任务 · 实际阶段与字节进度</h4>
    <el-table :data="snapshot.tasks" size="small"><el-table-column label="任务" width="130"><template #default="{row}">{{ row.id.slice(0,8) }} / {{ row.status }}</template></el-table-column>
      <el-table-column prop="phase" label="真实阶段" width="220"/><el-table-column label="模型文件下载"><template #default="{row}">
        <el-progress v-if="row.progress.totalBytes" :percentage="Math.min(100,Math.floor((row.progress.downloadedBytes||0)/row.progress.totalBytes*100))"/>
        {{ bytes(row.progress.downloadedBytes) }} / {{ bytes(row.progress.totalBytes) }} · {{ row.progress.source }} {{ row.progress.cached?'缓存已校验':'' }}<br><small>{{ row.progress.file }}</small><span class="error">{{ row.error }}</span>
      </template></el-table-column><el-table-column width="90"><template #default="{row}"><el-button v-if="['PENDING','RUNNING'].includes(row.status)" size="small" @click="action(()=>modelRequest(baseUrl,`/admin/model-services/tasks/${row.id}/cancel`,{}))">取消</el-button></template></el-table-column></el-table>
    <el-collapse><el-collapse-item title="运行时兼容性矩阵与实测状态"><el-table :data="snapshot.registry.matrix" size="small"><el-table-column prop="backend" label="后端"/><el-table-column prop="capability" label="Compute Capability"/><el-table-column prop="image" label="固定镜像（digest）"/><el-table-column prop="verification" label="验证状态"/></el-table></el-collapse-item></el-collapse>
  </el-card>
  <el-dialog v-model="nodeDialog" title="注册受限 Deployment Agent" width="560px"><el-form label-width="110px"><el-form-item label="设备 ID"><el-input v-model="nodeForm.id" placeholder="Agent 的固定 UUID"/></el-form-item><el-form-item label="节点名称"><el-input v-model="nodeForm.name"/></el-form-item><el-form-item label="Agent URL"><el-input v-model="nodeForm.baseUrl"/></el-form-item><el-form-item label="Agent 凭证"><el-input v-model="nodeForm.token" type="password" show-password/></el-form-item></el-form><p>远程节点使用 HTTPS；主机名须在后端 MODEL_AGENT_ALLOWED_HOSTS 中登记。凭证仅此处输入，数据库加密保存。</p><template #footer><el-button :loading="loading" type="primary" @click="action(async()=>{await modelRequest(baseUrl,'/admin/model-services/nodes',nodeForm);nodeForm.token='';nodeDialog=false;})">检测并注册</el-button></template></el-dialog>
  <el-dialog v-model="wizard" title="部署模型" width="760px" :close-on-click-modal="false"><el-steps :active="step" finish-status="success"><el-step v-for="label in ['模型','节点','计算模式','下载源','资源检查','确认部署']" :key="label" :title="label"/></el-steps>
    <div class="wizard-body"><el-form label-width="140px">
      <el-form-item v-if="step===0" label="模型"><el-select v-model="config.modelId"><el-option v-for="m in snapshot.registry.models" :key="m.id" :label="`${m.name} · ${m.dimensions} 维`" :value="m.id"/></el-select></el-form-item>
      <el-form-item v-if="step===1" label="计算节点"><el-select v-model="nodeId"><el-option v-for="n in snapshot.nodes" :key="n.id" :label="`${n.name} · ${n.status}`" :value="n.id" :disabled="n.status!=='ONLINE'"/></el-select></el-form-item>
      <template v-if="step===2"><el-form-item label="计算模式"><el-radio-group v-model="config.backend"><el-radio v-for="b in (['cpu','nvidia','apple'] as const)" :key="b" :value="b" :disabled="!!disabledReason(b)">{{ b }} <small>{{ disabledReason(b) }}</small></el-radio></el-radio-group></el-form-item>
        <el-form-item v-if="config.backend==='nvidia'" label="目标 GPU"><el-select v-model="config.gpuUuid"><el-option v-for="g in node?.hardware.gpus" :key="g.uuid" :value="g.uuid" :label="`${g.name} · CC ${g.capability} · 可用 ${g.freeMiB} MiB`"/></el-select></el-form-item>
        <el-alert v-if="config.backend==='apple'" title="原生 MLX FP16 独立模型变体，仅 Hugging Face。Apple 真机验收状态请查看部署文档；部署成功以节点 Metal 与实际向量探针为准。" :closable="false"/>
      </template>
      <el-form-item v-if="step===3" label="下载源"><el-select v-model="config.source"><el-option label="自动（ModelScope 优先，兼容版本才回退）" value="auto"/><el-option label="Hugging Face" value="huggingface"/><el-option label="ModelScope" value="modelscope" :disabled="config.backend==='apple'"/></el-select></el-form-item>
      <template v-if="step===4"><el-form-item label="CPU 核数"><el-input-number v-model="config.cpu" :min="model?.minCpu||2" :max="64"/></el-form-item><el-form-item label="内存上限 MiB"><el-input-number v-model="config.memoryMiB" :min="model?.minMemoryMiB||6144" :max="131072" :step="1024"/></el-form-item><el-form-item v-if="gpuRuntime?.experimental&&config.backend==='nvidia'"><el-checkbox v-model="config.allowExperimental">确认使用 Blackwell 实验 CUDA 运行时</el-checkbox></el-form-item><p>最低：{{ model?.minMemoryMiB }} MiB 内存 / {{ model?.minDiskMiB }} MiB 缓存磁盘。服务仅绑定节点回环地址。</p><el-alert v-for="issue in issues" :key="issue" type="error" :title="issue" :closable="false"/></template>
      <template v-if="step===5"><p>目标节点：{{ node?.name }} · {{ node?.hardware.platform }}</p><pre>{{ JSON.stringify(config,null,2) }}</pre><p>模型 Revision：{{ model?.variants[config.backend==='apple'?'mlx':'tei']?.revision }}</p></template>
    </el-form></div><template #footer><el-button v-if="step>0" @click="step--">上一步</el-button><el-button v-if="step<5" type="primary" :disabled="step===4&&issues.length>0" @click="step++">下一步</el-button><el-button v-else type="primary" :loading="loading" :disabled="issues.length>0" @click="deploy">确认部署</el-button></template>
  </el-dialog>
  <el-dialog :model-value="!!detail" :title="detailTitle" width="800px" @close="detail=''"><pre class="detail">{{ detail }}</pre></el-dialog>
</template>
<style scoped>.model-services{margin-bottom:24px}.toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.toolbar strong{margin-right:auto}.actions{display:flex;gap:6px;flex-wrap:wrap}.actions .el-button{margin:0}.wizard-body{min-height:230px;margin-top:28px}.detail{max-height:60vh;overflow:auto;white-space:pre-wrap;word-break:break-all}.error{color:var(--el-color-danger)}h4{margin:22px 0 12px}.el-alert{margin-bottom:12px}small{color:var(--el-text-color-secondary)}</style>
