<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { modelEvents, modelRequest, type DeploymentConfig, type ModelInstance, type ModelSnapshot, type Hardware } from '../model-services-api';
import { formatModelRuntimeLogs } from '../utils/model-runtime-logs';
import { isVisibleModelInstance } from '../utils/model-instance-visibility';
const props=withDefaults(defineProps<{baseUrl?:string}>(),{baseUrl:'/v1'});
const snapshot=ref<ModelSnapshot>({nodes:[],instances:[],tasks:[],defaultInstanceId:null,registry:{models:[],matrix:[]}});
const loading=ref(false),error=ref(''),wizard=ref(false),step=ref(0),nodeId=ref(''),nodeDialog=ref(false),detail=ref(''),detailTitle=ref('');
const detailOpen=ref(false),detailLoading=ref(false),detailError=ref('');
const detailTarget=ref<{instance:ModelInstance;kind:'logs'|'metrics'}|null>(null);
const isLogDetail=computed(()=>detailTarget.value?.kind==='logs');
const detailLineCount=computed(()=>detail.value?detail.value.split('\n').length:0);
let detailRequest=0;
const nodeForm=ref({id:'',name:'',baseUrl:'http://127.0.0.1:19090',token:''});
const localNode=computed(()=>snapshot.value.localNode);
const expanded=ref<string[]>([]);
const defaultNode=computed(()=>snapshot.value.nodes.find(n=>n.id===localNode.value?.nodeId));
const defaultConnected=computed(()=>defaultNode.value?.status==='ONLINE');
const connectionLabel=computed(()=>defaultConnected.value?'默认节点已连接':localNode.value?.status==='CONNECTING'?'正在连接节点':localNode.value?.status==='DISABLED'?'使用自定义节点':localNode.value?'默认节点未连接':'正在加载节点');
const activeTasks=computed(()=>snapshot.value.tasks.filter(t=>['PENDING','RUNNING'].includes(t.status)));
const visibleInstances=computed(()=>snapshot.value.instances.filter(isVisibleModelInstance));
const readyCount=computed(()=>visibleInstances.value.filter(i=>i.actual_state==='RUNNING'&&i.provider_registered&&!i.operation_id&&snapshot.value.nodes.some(n=>n.id===i.node_id&&n.status==='ONLINE')).length);
const config=ref<DeploymentConfig>({modelId:'bge-m3',backend:'cpu',source:'auto',cpu:4,memoryMiB:8192,allowExperimental:false});
const node=computed(()=>snapshot.value.nodes.find(n=>n.id===nodeId.value));
const model=computed(()=>snapshot.value.registry.models.find(m=>m.id===config.value.modelId));
const abort=new AbortController();
async function refresh(){try{snapshot.value=await modelRequest(props.baseUrl,'/admin/model-services');error.value='';}catch(e){error.value=e instanceof Error?e.message:'加载失败';}}
async function action(run:()=>Promise<unknown>){loading.value=true;try{await run();await refresh();}catch(e){if(e!=='cancel'&&e!=='close')ElMessage.error(e instanceof Error?e.message:'操作失败');}finally{loading.value=false;}}
function disabledReason(backend:string){const h=node.value?.hardware;
  if(!node.value||node.value.status!=='ONLINE')return '请选择在线计算节点';
  if(backend==='apple')return h?.platform==='darwin'&&h.arch==='arm64'&&/^Apple M\d/.test(h.apple?.chip||'')?'':'需要 macOS Apple Silicon 原生 Agent';
  if(h?.docker?.os!=='linux'||!['amd64','x86_64'].includes(h.docker.arch))return '需要 Linux amd64 Docker daemon';
  if(backend==='nvidia'){
    if(h.gpuDiscovery?.status&&h.gpuDiscovery.status!=='available')return h.gpuDiscovery.message;
    if(!h.docker.nvidiaRuntime)return 'Docker GPU 运行时不可用';
    if(!h.gpus.length)return h.gpuError||'节点未发现 NVIDIA GPU';
  }return '';
}
const gpu=computed(()=>node.value?.hardware.gpus.find(g=>g.uuid===config.value.gpuUuid));
const gpuRuntime=computed(()=>snapshot.value.registry.matrix.find(r=>r.backend==='nvidia'&&r.capability===gpu.value?.capability));
const computeModes=[
  {value:'cpu',title:'CPU',description:'通用处理器推理，不需要显卡'},
  {value:'nvidia',title:'NVIDIA GPU',description:'使用节点显卡进行 CUDA 加速'},
  {value:'apple',title:'Apple Silicon',description:'通过原生 Agent 使用 Metal 加速'},
] as const;
function selectGpu(){
  if(config.value.backend!=='nvidia'){delete config.value.gpuUuid;return;}
  if(!node.value?.hardware.gpus.some(g=>g.uuid===config.value.gpuUuid))config.value.gpuUuid=node.value?.hardware.gpus[0]?.uuid;
}
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
function openDeploy(i?:ModelInstance){nodeId.value=i?.node_id||snapshot.value.nodes.find(n=>n.id===localNode.value?.nodeId&&n.status==='ONLINE')?.id||snapshot.value.nodes.find(n=>n.status==='ONLINE')?.id||'';
  config.value=i?{...i.config}:{modelId:'bge-m3',backend:'cpu',source:'auto',cpu:4,memoryMiB:8192,allowExperimental:false};step.value=0;wizard.value=true;}
async function deploy(){await action(async()=>{await modelRequest(props.baseUrl,'/admin/model-services/tasks',{taskId:crypto.randomUUID(),instanceId:crypto.randomUUID(),nodeId:nodeId.value,action:'deploy',config:config.value});wizard.value=false;ElMessage.success('部署任务已入队');});}
async function quickDeploy(){
  await action(async()=>{
    const target=snapshot.value.nodes.find(n=>n.id===localNode.value?.nodeId&&n.status==='ONLINE');
    const definition=snapshot.value.registry.models.find(m=>m.id==='bge-m3');
    if(!target||!definition)throw Error('默认部署节点尚未就绪，请先点击重新检测');
    if(target.hardware.docker?.os!=='linux'||!['amd64','x86_64'].includes(target.hardware.docker.arch))throw Error('默认部署需要 Linux amd64 Docker；其他平台请使用高级部署选择兼容节点');
    const memoryMiB=definition.minMemoryMiB;
    if(target.hardware.docker.memoryMiB<memoryMiB||target.hardware.freeDiskMiB<definition.minDiskMiB)throw Error('默认部署节点的内存或缓存空间不足，请增加 Docker 资源后重新检测');
    const existing=snapshot.value.instances.find(i=>i.node_id===target.id&&i.model_id==='bge-m3'&&i.config.backend==='cpu'&&i.actual_state!=='REMOVED');
    if(existing){
      if(existing.operation_id||existing.actual_state==='RUNNING'){ElMessage.info('BGE-M3 已部署或正在部署，可在下方查看状态');return;}
      const request={taskId:crypto.randomUUID(),instanceId:existing.id,...(['FAILED','MISSING','PENDING'].includes(existing.actual_state)?{nodeId:target.id,action:'deploy',config:existing.config}:{action:'start'})};
      await modelRequest(props.baseUrl,'/admin/model-services/tasks',request);
    }else await modelRequest(props.baseUrl,'/admin/model-services/tasks',{taskId:crypto.randomUUID(),instanceId:crypto.randomUUID(),nodeId:target.id,action:'deploy',config:{modelId:'bge-m3',backend:'cpu',source:'auto',cpu:Math.max(definition.minCpu,Math.min(4,target.hardware.cpuCount)),memoryMiB,allowExperimental:false}});
    ElMessage.success('BGE-M3 部署任务已提交，下载和启动进度见下方');
  });
}
async function operate(i:ModelInstance,operation:string){await action(async()=>{
  let confirm=false;
  if(['stop','remove','delete-cache'].includes(operation)){
    const dependencies=await modelRequest<{name:string}[]>(props.baseUrl,`/admin/model-services/instances/${i.id}/dependencies`);
    const label=operation==='stop'?'停止模型':operation==='remove'?'卸载模型':'删除缓存';
    await ElMessageBox.confirm(`${label}？关联知识库：${dependencies.map(d=>d.name).join('、')||'无'}。${operation==='delete-cache'?'将删除本地模型文件。':'操作后，关联知识库暂时无法使用此模型检索。'}`,label,{type:'warning'});confirm=true;
  }
  await modelRequest(props.baseUrl,'/admin/model-services/tasks',{taskId:crypto.randomUUID(),instanceId:i.id,action:operation,confirm});
});}
async function inspect(i:ModelInstance,kind:'logs'|'metrics'){
  detailTarget.value={instance:i,kind};detailTitle.value=kind==='logs'?'运行日志':'实际资源监控';
  detail.value='';detailError.value='';detailOpen.value=true;await refreshDetail();
}
async function refreshDetail(){
  const target=detailTarget.value;if(!target)return;
  const request=++detailRequest;detailLoading.value=true;detailError.value='';
  try{
    const value=await modelRequest<unknown>(props.baseUrl,`/admin/model-services/instances/${target.instance.id}/${target.kind}`);
    if(request===detailRequest&&detailOpen.value)detail.value=target.kind==='logs'?formatModelRuntimeLogs(value):JSON.stringify(value,null,2);
  }catch(e){if(request===detailRequest&&detailOpen.value)detailError.value=e instanceof Error?e.message:'加载失败，请重试';}
  finally{if(request===detailRequest)detailLoading.value=false;}
}
function closeDetail(){detailRequest++;detailLoading.value=false;detailError.value='';detail.value='';detailTarget.value=null;}
async function retry(i:ModelInstance){await action(()=>modelRequest(props.baseUrl,'/admin/model-services/tasks',{taskId:crypto.randomUUID(),instanceId:i.id,nodeId:i.node_id,action:'deploy',config:i.config}));}
function instanceSource(i:ModelInstance){return snapshot.value.tasks.find(t=>t.instanceId===i.id&&t.progress.source)?.progress.source||i.config.source;}
function instanceGpu(i:ModelInstance){return snapshot.value.nodes.find(n=>n.id===i.node_id)?.hardware?.gpus.find(g=>g.uuid===i.config.gpuUuid)?.name;}
function backendLabel(backend:string){return ({cpu:'CPU',nvidia:'NVIDIA GPU',apple:'Apple Silicon'} as Record<string,string>)[backend]||backend;}
function sourceLabel(source:string){return ({auto:'自动',modelscope:'ModelScope',huggingface:'Hugging Face'} as Record<string,string>)[source]||source;}
function stateLabel(state:string){return ({ONLINE:'在线',OFFLINE:'离线',PENDING:'待部署',PREPARING:'部署中',RUNNING:'运行中',STOPPED:'已停止',REMOVED:'已卸载',FAILED:'失败',MISSING:'待恢复',UNHEALTHY:'异常',STALE_NETWORK:'待恢复',SUCCEEDED:'已完成',CANCELLED:'已取消'} as Record<string,string>)[state]||state;}
function phaseLabel(phase:string){return ({PENDING:'等待执行',QUEUED:'等待执行',CHECKING_ENVIRONMENT:'检查部署环境',PREPARING_RUNTIME:'准备运行环境',PULLING_IMAGE:'准备镜像',DOWNLOADING_MODEL:'下载模型',VERIFYING_MODEL:'校验文件',CREATING_SERVICE:'创建服务',STARTING_SERVICE:'启动服务',LOADING_MODEL:'加载模型',HEALTH_CHECKING:'检查服务',REGISTERING_PROVIDER:'注册模型',COMPLETED:'已完成',FAILED:'失败',CANCELLED:'已取消'} as Record<string,string>)[phase]||phase;}
function instanceState(i:ModelInstance){
  if(i.operation_id)return '处理中';
  if(i.actual_state==='RUNNING'){
    if(!snapshot.value.nodes.some(n=>n.id===i.node_id&&n.status==='ONLINE'))return '节点离线';
    if(!i.provider_registered)return '待注册';
  }
  return stateLabel(i.actual_state);
}
function instanceTag(i:ModelInstance):'success'|'info'|'warning'|'danger'{
  if(i.operation_id)return 'warning';
  if(['FAILED','UNHEALTHY'].includes(i.actual_state))return 'danger';
  if(instanceState(i)==='运行中')return 'success';
  return ['STOPPED','REMOVED'].includes(i.actual_state)?'info':'warning';
}
function instancePhase(i:ModelInstance){const task=activeTasks.value.find(t=>t.instanceId===i.id);return task?phaseLabel(task.phase):'';}
function instanceMenu(i:ModelInstance,command:string){
  if(command==='metrics')void inspect(i,'metrics');
  else if(command==='update')openDeploy(i);
  else if(command==='details'){closeDetail();detailTitle.value='模型详情';detail.value=JSON.stringify({id:i.id,node:snapshot.value.nodes.find(n=>n.id===i.node_id)?.name,config:i.config,spec:i.spec,desiredState:i.desired_state,actualState:i.actual_state},null,2);detailOpen.value=true;}
  else if(['restart','remove','delete-cache'].includes(command))void operate(i,command);
}
function bytes(n?:number){return n?`${(n/1048576).toFixed(1)} MiB`:'0 MiB';}
function gpuNames(h?:Hardware){return h?.gpus.map(g=>g.name).join(' / ')||(h?.apple?'Apple Metal':h?.gpuDiscovery?.status==='unavailable'?'GPU 探测失败':h?.gpuDiscovery?.status==='runtime-unavailable'?'Docker GPU 运行时不可用':h?.gpuError?'GPU 探测未完成':'无 NVIDIA GPU');}
onMounted(async()=>{await refresh();void modelEvents(props.baseUrl,event=>{
  if(event.connectionError){error.value=String(event.connectionError);return;}
  if(event.snapshot){snapshot.value=event.snapshot as ModelSnapshot;error.value='';return;}
  const task=snapshot.value.tasks.find(t=>t.id===event.taskId);
  if(task){task.phase=String(event.phase||task.phase);task.status=String(event.status||task.status);task.error=String(event.error||'');task.progress={...task.progress,...event};}
  if(['COMPLETED','FAILED','CANCELLED'].includes(String(event.phase)))void refresh();
},abort.signal);});
onUnmounted(()=>{abort.abort();closeDetail();});
</script>

<template>
  <el-card shadow="never" class="model-services">
    <template #header>
      <div class="page-toolbar">
        <div class="page-title"><strong>知识库模型</strong><p>部署和管理知识库使用的 Embedding 模型</p></div>
        <div class="header-actions">
          <el-button :loading="loading" @click="refresh">刷新</el-button>
          <el-button @click="openDeploy()">自定义部署</el-button>
          <el-button :loading="loading" type="primary" :disabled="!defaultConnected" @click="quickDeploy">一键部署 BGE-M3（CPU）</el-button>
        </div>
      </div>
    </template>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <div class="node-summary">
      <span class="connection"><span class="status-dot" :class="{connected:defaultConnected}" />{{ connectionLabel }}</span>
      <span v-if="defaultConnected" class="node-hint">{{ gpuNames(defaultNode?.hardware) }}</span>
      <el-button link type="primary" @click="expanded=expanded.includes('nodes')?expanded.filter(n=>n!=='nodes'):[...expanded,'nodes']">节点设置</el-button>
    </div>
    <el-alert v-if="localNode&&localNode.status!=='DISABLED'&&!defaultConnected" title="默认节点暂未连接，请在节点设置中重新检测。" type="warning" :closable="false" />

    <div class="section-heading"><h3>模型</h3><small>{{ visibleInstances.length }} 个模型 · {{ readyCount }} 个可用</small></div>
    <el-table :data="visibleInstances" class="models-table" empty-text="尚未部署模型，点击上方按钮开始" row-key="id">
      <el-table-column label="模型" min-width="240">
        <template #default="{row}">
          <div class="cell-stack"><div class="model-name"><strong>{{ snapshot.registry.models.find(m=>m.id===row.model_id)?.name || row.model_id }}</strong><el-tag v-if="snapshot.defaultInstanceId===row.id" size="small" effect="plain">默认</el-tag></div><small>{{ snapshot.nodes.find(n=>n.id===row.node_id)?.name || '节点待同步' }}</small></div>
        </template>
      </el-table-column>
      <el-table-column label="运行方式" min-width="170">
        <template #default="{row}"><div class="cell-stack"><span>{{ backendLabel(row.config.backend) }}<span v-if="row.spec?.dimensions" class="muted"> · {{ row.spec.dimensions }} 维</span></span><small v-if="instanceGpu(row)">{{ instanceGpu(row) }}</small><small v-else>{{ sourceLabel(instanceSource(row)) }}</small></div></template>
      </el-table-column>
      <el-table-column label="状态" min-width="130">
        <template #default="{row}"><div class="cell-stack"><el-tag :type="instanceTag(row)" size="small" effect="light">{{ instanceState(row) }}</el-tag><small v-if="instancePhase(row)">{{ instancePhase(row) }}</small></div></template>
      </el-table-column>
      <el-table-column label="操作" min-width="270">
        <template #default="{row}"><div class="actions">
          <el-button v-if="['FAILED','MISSING'].includes(row.actual_state)" size="small" :disabled="loading||!!row.operation_id" @click="retry(row)">重试部署</el-button>
          <el-button v-else-if="row.actual_state==='RUNNING'" size="small" :disabled="loading||!!row.operation_id" @click="operate(row,'stop')">停止</el-button>
          <el-button v-else-if="row.actual_state!=='REMOVED'" size="small" :disabled="loading||!!row.operation_id" @click="operate(row,'start')">启动</el-button>
          <el-button v-if="snapshot.defaultInstanceId!==row.id&&row.actual_state!=='REMOVED'" size="small" :disabled="loading||!!row.operation_id||!row.provider_registered||instanceState(row)!=='运行中'" @click="action(()=>modelRequest(baseUrl,`/admin/model-services/instances/${row.id}/default`,{}))">设为默认</el-button>
          <el-button size="small" text @click="inspect(row,'logs')">日志</el-button>
          <el-dropdown trigger="click" @command="(command:string)=>instanceMenu(row,command)">
            <el-button size="small" text>更多</el-button>
            <template #dropdown><el-dropdown-menu>
              <el-dropdown-item command="details">模型详情</el-dropdown-item>
              <el-dropdown-item command="metrics">资源监控</el-dropdown-item>
              <el-dropdown-item command="restart" :disabled="loading||!!row.operation_id||row.actual_state==='REMOVED'">重启</el-dropdown-item>
              <el-dropdown-item command="update">部署新实例</el-dropdown-item>
              <el-dropdown-item v-if="row.actual_state!=='REMOVED'" command="remove" divided :disabled="loading||!!row.operation_id" class="danger-action">卸载模型</el-dropdown-item>
              <el-dropdown-item v-else command="delete-cache" divided :disabled="loading||!!row.operation_id" class="danger-action">删除缓存</el-dropdown-item>
            </el-dropdown-menu></template>
          </el-dropdown>
        </div></template>
      </el-table-column>
    </el-table>
    <p class="model-note">默认模型用于新建知识库；已有知识库更换模型后需重建索引。</p>

    <section v-if="activeTasks.length" class="active-tasks">
      <div class="section-heading"><h3>进行中的任务</h3><small>{{ activeTasks.length }} 项</small></div>
      <div v-for="task in activeTasks" :key="task.id" class="active-task">
        <div class="task-heading"><strong>{{ snapshot.instances.find(i=>i.id===task.instanceId)?.model_id || '模型任务' }}</strong><span>{{ phaseLabel(task.phase) }}</span><el-button size="small" text :disabled="loading" @click="action(()=>modelRequest(baseUrl,`/admin/model-services/tasks/${task.id}/cancel`,{}))">取消任务</el-button></div>
        <el-progress v-if="task.progress.totalBytes" :percentage="Math.min(100,Math.floor((task.progress.downloadedBytes||0)/task.progress.totalBytes*100))" :stroke-width="6" />
        <small v-if="task.progress.totalBytes">{{ bytes(task.progress.downloadedBytes) }} / {{ bytes(task.progress.totalBytes) }}</small>
      </div>
    </section>

    <el-collapse v-model="expanded" class="advanced-panels">
      <el-collapse-item title="部署节点" name="nodes">
        <div class="panel-toolbar"><p>模型运行在部署节点上，默认节点自动连接。</p><el-button size="small" :loading="loading" @click="action(()=>modelRequest(baseUrl,'/admin/model-services/nodes/local/connect',{}))">重新检测</el-button><el-button size="small" @click="nodeDialog=true">添加远程节点</el-button></div>
        <el-table :data="snapshot.nodes" size="small" empty-text="暂无部署节点">
          <el-table-column prop="name" label="节点" min-width="200" />
          <el-table-column label="状态" width="80"><template #default="{row}"><el-tag :type="row.status==='ONLINE'?'success':'info'" size="small">{{ stateLabel(row.status) }}</el-tag></template></el-table-column>
          <el-table-column label="硬件" min-width="230"><template #default="{row}"><div class="cell-stack"><span>{{ row.hardware?.apple?.chip || row.hardware?.cpu || '待检测' }}</span><small>{{ row.hardware?.platform }} / {{ row.hardware?.arch }} · {{ Math.round((row.hardware?.memoryMiB||0)/1024) }} GiB 内存</small></div></template></el-table-column>
          <el-table-column label="GPU" min-width="240"><template #default="{row}"><div class="cell-stack"><span>{{ gpuNames(row.hardware) }}</span><small v-if="row.hardware?.gpuDiscovery?.message">{{ row.hardware.gpuDiscovery.message }}</small><small v-else-if="row.hardware?.gpus?.length">{{ row.hardware.gpus.map((g:Hardware['gpus'][number])=>`${g.totalMiB} MiB · CC ${g.capability}`).join(' / ') }}</small></div></template></el-table-column>
          <el-table-column label="可用缓存空间" width="140"><template #default="{row}">{{ Math.floor((row.hardware?.freeDiskMiB||0)/1024) }} GiB</template></el-table-column>
        </el-table>
      </el-collapse-item>
      <el-collapse-item title="任务记录" name="tasks">
        <el-table :data="snapshot.tasks" size="small" max-height="360" empty-text="暂无任务记录">
          <el-table-column label="任务" width="110"><template #default="{row}"><span :title="row.id">{{ row.id.slice(0,8) }}</span></template></el-table-column>
          <el-table-column label="状态" width="90"><template #default="{row}">{{ stateLabel(row.status) }}</template></el-table-column>
          <el-table-column label="阶段" width="150"><template #default="{row}">{{ phaseLabel(row.phase) }}</template></el-table-column>
          <el-table-column label="详情" min-width="230"><template #default="{row}"><div class="cell-stack"><span v-if="row.error" class="error">{{ row.error }}</span><template v-if="row.progress.totalBytes"><span>{{ bytes(row.progress.downloadedBytes) }} / {{ bytes(row.progress.totalBytes) }}<span v-if="row.progress.source"> · {{ sourceLabel(row.progress.source) }}</span></span><small v-if="row.progress.file">{{ row.progress.file }}</small></template><span v-else-if="!row.error" class="muted">{{ row.progress.cached?'已复用模型缓存':'—' }}</span></div></template></el-table-column>
        </el-table>
      </el-collapse-item>
      <el-collapse-item title="兼容性与使用说明" name="help">
        <ul class="help-list"><li>一键部署使用 CPU；GPU 与远程节点请使用自定义部署。</li><li>默认节点自动配置，无需填写凭证或修改 .env。</li><li>部署新实例不会替换已有模型或知识库索引。</li><li>Blackwell 为实验运行时；Apple 模式仍待 Mac 真机验收。</li></ul>
        <el-table :data="snapshot.registry.matrix" size="small"><el-table-column label="模式" width="140"><template #default="{row}">{{ backendLabel(row.backend) }}</template></el-table-column><el-table-column prop="capability" label="Compute Capability" width="160" /><el-table-column prop="verification" label="验证情况" min-width="220" /><el-table-column prop="image" label="固定镜像" min-width="200" show-overflow-tooltip /></el-table>
      </el-collapse-item>
    </el-collapse>
  </el-card>

  <el-dialog v-model="nodeDialog" title="添加远程节点" width="min(560px, calc(100vw - 32px))"><el-form label-width="110px"><el-form-item label="设备 ID"><el-input v-model="nodeForm.id" placeholder="远程 Agent 的 UUID"/></el-form-item><el-form-item label="节点名称"><el-input v-model="nodeForm.name" placeholder="便于识别的名称"/></el-form-item><el-form-item label="Agent 地址"><el-input v-model="nodeForm.baseUrl"/></el-form-item><el-form-item label="连接凭证"><el-input v-model="nodeForm.token" type="password" show-password/></el-form-item></el-form><p class="model-note">用于连接已安装 Agent 的节点。远程地址使用 HTTPS，凭证加密保存。</p><template #footer><el-button :loading="loading" type="primary" @click="action(async()=>{await modelRequest(baseUrl,'/admin/model-services/nodes',nodeForm);nodeForm.token='';nodeDialog=false;})">连接节点</el-button></template></el-dialog>
  <el-dialog v-model="wizard" title="部署模型" width="min(880px, calc(100vw - 32px))" class="deploy-wizard" :close-on-click-modal="false"><el-steps :active="step" finish-status="success" align-center><el-step v-for="label in ['模型','节点','计算模式','下载源','资源检查','确认部署']" :key="label" :title="label"/></el-steps>
    <div class="wizard-body"><el-form label-width="140px">
      <el-form-item v-if="step===0" label="模型"><el-select v-model="config.modelId"><el-option v-for="m in snapshot.registry.models" :key="m.id" :label="`${m.name} · ${m.dimensions} 维`" :value="m.id"/></el-select></el-form-item>
      <el-form-item v-if="step===1" label="部署节点"><el-select v-model="nodeId" @change="selectGpu"><el-option v-for="n in snapshot.nodes" :key="n.id" :label="`${n.name} · ${stateLabel(n.status)}`" :value="n.id" :disabled="n.status!=='ONLINE'"/></el-select></el-form-item>
      <template v-if="step===2"><el-form-item label="计算模式"><el-radio-group v-model="config.backend" class="compute-modes" @change="selectGpu"><el-radio v-for="mode in computeModes" :key="mode.value" :value="mode.value" :disabled="!!disabledReason(mode.value)" border><div class="compute-mode-text"><strong>{{ mode.title }}</strong><small>{{ disabledReason(mode.value) || mode.description }}</small></div></el-radio></el-radio-group></el-form-item>
        <el-form-item v-if="config.backend==='nvidia'" label="目标 GPU"><el-select v-model="config.gpuUuid"><el-option v-for="g in node?.hardware.gpus" :key="g.uuid" :value="g.uuid" :label="`${g.name} · CC ${g.capability} · 可用 ${g.freeMiB} MiB`"/></el-select></el-form-item>
        <el-alert v-if="config.backend==='apple'" title="Apple 模式使用独立 MLX 模型，仅支持 Hugging Face，仍待 Mac 真机验收。" :closable="false"/>
      </template>
      <el-form-item v-if="step===3" label="下载源"><el-select v-model="config.source"><el-option label="自动（优先 ModelScope）" value="auto"/><el-option label="Hugging Face" value="huggingface"/><el-option label="ModelScope" value="modelscope" :disabled="config.backend==='apple'"/></el-select></el-form-item>
      <template v-if="step===4"><el-form-item label="CPU 核数"><el-input-number v-model="config.cpu" :min="model?.minCpu||2" :max="64"/></el-form-item><el-form-item label="内存上限（MiB）"><el-input-number v-model="config.memoryMiB" :min="model?.minMemoryMiB||6144" :max="131072" :step="1024"/></el-form-item><el-form-item v-if="gpuRuntime?.experimental&&config.backend==='nvidia'"><el-checkbox v-model="config.allowExperimental">确认使用 Blackwell 实验运行时</el-checkbox></el-form-item><p class="model-note">至少需要 {{ model?.minMemoryMiB }} MiB 内存和 {{ model?.minDiskMiB }} MiB 缓存空间。</p><el-alert v-for="issue in issues" :key="issue" type="error" :title="issue" :closable="false"/></template>
      <template v-if="step===5"><el-descriptions :column="2" border><el-descriptions-item label="模型">{{ model?.name }}</el-descriptions-item><el-descriptions-item label="部署节点">{{ node?.name }}</el-descriptions-item><el-descriptions-item label="计算模式">{{ backendLabel(config.backend) }}</el-descriptions-item><el-descriptions-item label="下载源">{{ sourceLabel(config.source) }}</el-descriptions-item><el-descriptions-item label="CPU">{{ config.cpu }} 核</el-descriptions-item><el-descriptions-item label="内存上限">{{ config.memoryMiB }} MiB</el-descriptions-item><el-descriptions-item v-if="config.backend==='nvidia'" label="显卡">{{ gpu?.name }}</el-descriptions-item></el-descriptions><details class="version-note"><summary>模型版本</summary><code>{{ model?.variants[config.backend==='apple'?'mlx':'tei']?.revision }}</code></details></template>
    </el-form></div><template #footer><el-button v-if="step>0" @click="step--">上一步</el-button><el-button v-if="step<5" type="primary" :disabled="(step===2&&!!disabledReason(config.backend))||(step===4&&issues.length>0)" @click="step++">下一步</el-button><el-button v-else type="primary" :loading="loading" :disabled="issues.length>0" @click="deploy">确认部署</el-button></template>
  </el-dialog>
  <el-dialog v-model="detailOpen" :title="detailTitle" width="min(1000px, calc(100vw - 32px))" @close="closeDetail">
    <div v-if="detailTarget" class="detail-toolbar">
      <span>{{ detailTarget.instance.model_id }}<template v-if="isLogDetail"> · 日志快照 · {{ detailLineCount }} 行</template></span>
      <el-button size="small" :loading="detailLoading" @click="refreshDetail">刷新{{ isLogDetail?'日志':'资源' }}</el-button>
    </div>
    <el-alert v-if="detailError" :title="detailError" type="error" :closable="false"/>
    <div v-if="detailLoading&&!detail" class="detail-empty" role="status">正在加载{{ isLogDetail?'日志':'资源信息' }}…</div>
    <pre v-else-if="detail" class="detail" :class="{'runtime-log':isLogDetail}" :role="isLogDetail?'log':undefined" tabindex="0">{{ detail }}</pre>
    <el-empty v-else-if="!detailError" :image-size="56" :description="isLogDetail?'暂无日志':'暂无内容'"/>
  </el-dialog>
</template>
<style scoped>
.model-services{margin-bottom:24px}
.page-toolbar,.header-actions,.section-heading,.panel-toolbar,.task-heading{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.page-title{margin-right:auto}.page-title strong{font-size:18px}.page-title p{margin:6px 0 0;font-size:13px;color:var(--el-text-color-secondary)}
.header-actions .el-button{margin:0}
.node-summary{display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:12px 16px;margin-bottom:24px;background:var(--el-fill-color-lighter);border-radius:8px;font-size:13px}
.connection{display:flex;align-items:center;gap:8px}.status-dot{width:7px;height:7px;border-radius:50%;background:var(--el-color-warning)}.status-dot.connected{background:var(--el-color-success)}
.node-hint{color:var(--el-text-color-secondary)}.node-summary .el-button{margin-left:auto}
.section-heading{justify-content:space-between;margin:0 0 12px}.section-heading h3{margin:0;font-size:15px;font-weight:600}
.cell-stack{display:flex;flex-direction:column;align-items:flex-start;gap:5px;padding:8px 0;line-height:1.5;overflow-wrap:anywhere}
.model-name{display:flex;align-items:center;gap:10px}.model-name strong{font-size:14px}
.actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.actions .el-button{margin:0}
.model-note{margin:12px 0 24px;font-size:12px;color:var(--el-text-color-secondary)}
.active-tasks{margin-bottom:24px}.active-task{border:1px solid var(--el-border-color-lighter);border-radius:8px;padding:12px 16px;margin-bottom:10px}.task-heading{font-size:13px;margin-bottom:8px}.task-heading span{color:var(--el-text-color-secondary)}.task-heading .el-button{margin-left:auto}
.advanced-panels{border-top:1px solid var(--el-border-color-lighter)}.advanced-panels :deep(.el-collapse-item__header){font-size:13px;color:var(--el-text-color-regular)}
.panel-toolbar{margin:8px 0 12px}.panel-toolbar p{margin:0 auto 0 0;color:var(--el-text-color-secondary);font-size:12px}
.help-list{padding-left:18px;line-height:1.9;color:var(--el-text-color-secondary);font-size:13px;margin:4px 0 16px}
.wizard-body{min-height:190px;margin-top:24px}.wizard-body :deep(.el-select){width:100%}
.compute-modes{display:flex;flex-direction:column;gap:12px;width:100%;align-items:stretch}.compute-modes :deep(.el-radio){height:auto;min-height:68px;margin:0;padding:14px 16px;white-space:normal}.compute-modes :deep(.el-radio__label){min-width:0;flex:1;padding-left:12px;line-height:1.5}.compute-mode-text{display:flex;flex-direction:column;gap:4px}.compute-mode-text small{font-size:12px;color:inherit;opacity:.8}
.deploy-wizard :deep(.el-step__title){font-size:14px;line-height:24px}.version-note{margin-top:16px;font-size:12px;color:var(--el-text-color-secondary)}.version-note code{display:block;margin-top:8px;overflow-wrap:anywhere}
.detail-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px;color:var(--el-text-color-secondary);font-size:12px}
.detail{margin:0;max-height:60vh;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;padding:16px;border:1px solid var(--el-border-color-lighter);border-radius:8px;background:var(--el-fill-color-light);color:var(--el-text-color-primary);font-family:ui-monospace,SFMono-Regular,Consolas,"Liberation Mono",monospace;font-size:12px;line-height:1.75;tab-size:2}
.runtime-log{min-height:180px}.detail:focus-visible{outline:2px solid var(--el-color-primary);outline-offset:2px}.detail-empty{padding:32px;text-align:center;color:var(--el-text-color-secondary)}
.error,.danger-action{color:var(--el-color-danger)}.muted,small{color:var(--el-text-color-secondary)}.el-alert{margin-bottom:16px}
@media(max-width:640px){.header-actions{width:100%;gap:8px}.header-actions .el-button{flex:1 1 auto}.node-summary{gap:10px}.node-hint{width:100%;order:3}.wizard-body :deep(.el-form-item){display:block}.wizard-body :deep(.el-form-item__label){float:none;justify-content:flex-start;width:auto!important}.wizard-body :deep(.el-form-item__content){margin-left:0!important}.deploy-wizard :deep(.el-step__title){font-size:12px}}

</style>
