import { getStoredToken } from './api';
export interface Hardware {
  platform:string;arch:string;cpu:string;cpuCount:number;memoryMiB:number;freeDiskMiB:number;
  docker:null|{os:string;arch:string;nvidiaRuntime:boolean;memoryMiB:number};
  gpus:{name:string;uuid:string;totalMiB:number;freeMiB:number;capability:string;driver:string}[];
  gpuDiscovery?:{source:'native'|'docker';status:'available'|'not-detected'|'unavailable'|'runtime-unavailable';message:string};
  gpuError?:string;
  apple:null|{chip:string;version:string;mlx:boolean;metal:boolean};
}
export interface ComputeNode {id:string;name:string;baseUrl:string;status:string;hardware:Hardware;lastSeen:string}
export interface DeploymentConfig {modelId:string;backend:'cpu'|'nvidia'|'apple';source:'auto'|'huggingface'|'modelscope';cpu:number;memoryMiB:number;gpuUuid?:string;allowExperimental?:boolean}
export interface ModelInstance {id:string;node_id:string;model_id:string;desired_state:string;actual_state:string;provider_registered:number;fingerprint:string;config:DeploymentConfig;spec:null|{revision:string;precision:string;dimensions:number;runtime:string;variant:string};operation_id:string|null}
export interface DeploymentTask {id:string;instanceId:string;status:string;phase:string;error:string;progress:{downloadedBytes?:number;totalBytes?:number;source?:string;file?:string;cached?:boolean}}
export interface ModelDefinition {id:string;name:string;type:string;dimensions:number;minMemoryMiB:number;minDiskMiB:number;minCpu:number;variants:Record<string,{revision:string;sources:string[];verification?:string}>}
export interface ModelSnapshot {nodes:ComputeNode[];instances:ModelInstance[];tasks:DeploymentTask[];defaultInstanceId:string|null;localNode?:{status:'DISABLED'|'CONNECTING'|'ONLINE'|'UNAVAILABLE';nodeId?:string;message:string};registry:{models:ModelDefinition[];matrix:{backend:string;capability?:string;image:string;verification:string;experimental?:boolean}[]}}
export async function modelRequest<T>(base:string,route:string,body?:unknown):Promise<T>{
  const res=await fetch(`${base.replace(/\/$/,'')}${route}`,{method:body===undefined?'GET':'POST',credentials:'include',
    headers:{'Content-Type':'application/json',Authorization:'Bearer '+getStoredToken()},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(70000)});
  const payload=await res.json();if(!res.ok)throw Error(Array.isArray(payload.message)?payload.message.join(', '):payload.message||`HTTP ${res.status}`);return payload.data as T;
}
export async function modelEvents(base:string,onEvent:(event:Record<string,unknown>)=>void,signal:AbortSignal){
  let cursor=0;
  while(!signal.aborted){
    try{
      const res=await fetch(`${base.replace(/\/$/,'')}/admin/model-services/events?after=${cursor}`,{credentials:'include',headers:{Authorization:'Bearer '+getStoredToken()},signal});
      if(!res.ok||!res.body)throw Error(`SSE HTTP ${res.status}`);
      const reader=res.body.getReader(),decoder=new TextDecoder();let buffer='';
      try{for(;;){const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});
        let end:number;while((end=buffer.indexOf('\n\n'))>=0){const frame=buffer.slice(0,end);buffer=buffer.slice(end+2);let data='';
          for(const line of frame.split('\n')){if(line.startsWith('id:'))cursor=Number(line.slice(3));if(line.startsWith('data:'))data+=line.slice(5).trim();}
          if(data)onEvent(JSON.parse(data) as Record<string,unknown>);
        }
      }}finally{reader.releaseLock();}
    }catch(e){if(signal.aborted)return;onEvent({connectionError:e instanceof Error?e.message:'SSE disconnected'});}
    await new Promise<void>(r=>{const timer=setTimeout(r,2000);signal.addEventListener('abort',()=>{clearTimeout(timer);r();},{once:true});});
  }
}
