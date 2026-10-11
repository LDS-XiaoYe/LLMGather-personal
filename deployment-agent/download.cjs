const fs=require('node:fs/promises');
const {createReadStream}=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {inside}=require('./security.cjs');
const {Readable}=require('node:stream');
const {pipeline}=require('node:stream/promises');
const {createWriteStream}=require('node:fs');
const registry=require('./registry.json');
const {fetch: proxyFetch, EnvHttpProxyAgent}=require('undici');
const dispatcher=new EnvHttpProxyAgent();
const allowedDownloadHost=host=>host==='huggingface.co'||host.endsWith('.huggingface.co')||host.endsWith('.hf.co')||host==='modelscope.cn'||host.endsWith('.modelscope.cn')||host==='www.modelscope.cn';
async function request(url,headers,signal,redirects=0){
  const target=new URL(url);if(target.protocol!=='https:'||target.username||target.password||!allowedDownloadHost(target.hostname)||redirects>8)throw Error('Download redirect is not trusted');
  const response=await proxyFetch(url,{headers,signal,redirect:'manual',dispatcher});
  if([301,302,303,307,308].includes(response.status)){
    const next=new URL(response.headers.get('location'),url);
    const safeHeaders={...headers};if(next.hostname!==target.hostname)delete safeHeaders.Authorization;
    await response.body?.cancel();return request(next.href,safeHeaders,signal,redirects+1);
  }
  return response;
}
class HuggingFaceDownloadProvider {
  name='huggingface';
  url(variant,file){return `https://huggingface.co/${variant.repository}/resolve/${variant.revision}/${file.path}`;}
  headers(){return process.env.HF_TOKEN?{Authorization:'Bearer '+process.env.HF_TOKEN}:{};}
}
class ModelScopeDownloadProvider {
  name='modelscope';
  url(variant,file){if(!file.modelscopeRevision)throw Error('ModelScope revision is missing');return `https://modelscope.cn/api/v1/models/${variant.repository}/repo?Revision=${file.modelscopeRevision}&FilePath=${encodeURIComponent(file.path)}`;}
  headers(){return process.env.MODELSCOPE_TOKEN?{Authorization:'Bearer '+process.env.MODELSCOPE_TOKEN}:{};}
}
async function digest(file,expected) {
  const sha=crypto.createHash(expected.sha256?'sha256':'sha1');
  if(!expected.sha256)sha.update(`blob ${expected.size}\0`);
  for await(const chunk of createReadStream(file))sha.update(chunk);
  return sha.digest('hex');
}
class ModelDownloadService {
  constructor(root,store,transport=request){this.root=path.resolve(root);this.store=store;this.transport=transport;this.providers={huggingface:new HuggingFaceDownloadProvider(),modelscope:new ModelScopeDownloadProvider()};this.locks=new Set();}
  key(variant){return crypto.createHash('sha256').update(JSON.stringify({repository:variant.repository,revision:variant.revision,files:variant.files})).digest('hex');}
  async verify(folder,variant){for(const file of variant.files){const target=inside(folder,file.path);const stat=await fs.stat(target);if(stat.size!==file.size||await digest(target,file)!==(file.sha256||file.gitBlob))throw Error('Model integrity check failed: '+file.path);}return true;}
  async prepare(modelId,variantId,source,onProgress,signal){
    const model=registry.models.find(m=>m.id===modelId);const variant=model?.variants[variantId];
    if(!variant||!['auto','huggingface','modelscope'].includes(source))throw Error('Invalid model/source');
    if(source!=='auto'&&!variant.sources.includes(source))throw Error('Model variant is unavailable on selected source');
    await fs.mkdir(this.root,{recursive:true,mode:0o700});const key=this.key(variant),final=inside(this.root,key),partial=inside(this.root,key+'.partial');
    if(this.locks.has(key))throw Error('Cache download already running');this.locks.add(key);
    const total=variant.files.reduce((n,f)=>n+f.size,0);
    try{
      try{const complete=JSON.parse(await fs.readFile(path.join(final,'COMPLETE.json'),'utf8'));if(complete.key!==key)throw Error('Cache identity mismatch');await this.verify(final,variant);await onProgress({phase:'VERIFYING_MODEL',downloadedBytes:total,totalBytes:total,source:complete.source,cached:true});return{path:final,key,source:complete.source,variant};}catch(e){if(e.code!=='ENOENT')throw e;}
      const disk=await fs.statfs(this.root);if(Number(disk.bavail)*Number(disk.bsize)<total*1.1)throw Error('Insufficient model cache disk space');
      await fs.mkdir(partial,{recursive:true,mode:0o700});
      const providers=source==='auto'?variant.sources.map(s=>this.providers[s]):[this.providers[source]];let last;
      for(const provider of providers){
        signal.throwIfAborted();
        try{
          let completed=0;
          for(const file of variant.files){
            if(file.path.includes('..')||path.isAbsolute(file.path))throw Error('Invalid model manifest path');
            const target=inside(partial,file.path);await fs.mkdir(path.dirname(target),{recursive:true});
            let size=0;try{size=(await fs.stat(target)).size;}catch{}
            if(size===file.size&&await digest(target,file)===(file.sha256||file.gitBlob)){completed+=size;continue;}
            if(size>=file.size){await fs.truncate(target,0);size=0;}
            for(let attempt=0;;attempt++){
              signal.throwIfAborted();
              try{
                const timeout=AbortSignal.any([signal,AbortSignal.timeout(30*60*1000)]);
                const response=await this.transport(provider.url(variant,file),{...provider.headers(),...(size?{Range:`bytes=${size}-`}:{})},timeout);
                if(!response.ok)throw Error('Download HTTP '+response.status);
                if(size&&response.status!==206){size=0;await fs.truncate(target,0);}
                if(response.status===206&&!String(response.headers.get('content-range')).startsWith(`bytes ${size}-`))throw Error('Download invalid byte range');
                let lastEvent=0, progress=Promise.resolve();
                const sourceStream=Readable.fromWeb(response.body);
                sourceStream.on('data',chunk=>{size+=chunk.length;if(size>file.size)sourceStream.destroy(Error('Download exceeds manifest size'));const now=Date.now();if(now-lastEvent>500){lastEvent=now;const update={phase:'DOWNLOADING_MODEL',downloadedBytes:completed+size,totalBytes:total,source:provider.name,file:file.path};progress=progress.then(()=>onProgress(update));}});
                await pipeline(sourceStream,createWriteStream(target,{flags:size>0&&response.status===206?'a':'w'}),{signal});
                await progress;
                if((await fs.stat(target)).size!==file.size||await digest(target,file)!==(file.sha256||file.gitBlob))throw Error('Model integrity check failed: '+file.path);
                break;
              }catch(error){if(signal.aborted||attempt>=2)throw error;try{size=(await fs.stat(target)).size;if(size>=file.size){await fs.truncate(target,0);size=0;}}catch{size=0;}await new Promise(r=>setTimeout(r,250*2**attempt));}
            }
            completed+=file.size;await onProgress({phase:'DOWNLOADING_MODEL',downloadedBytes:completed,totalBytes:total,source:provider.name,file:file.path});
          }
          await onProgress({phase:'VERIFYING_MODEL',downloadedBytes:total,totalBytes:total,source:provider.name});await this.verify(partial,variant);signal.throwIfAborted();
          await fs.writeFile(path.join(partial,'COMPLETE.json'),JSON.stringify({key,source:provider.name,revision:variant.revision,files:variant.files}),{mode:0o600});
          await fs.rename(partial,final);return{path:final,key,source:provider.name,variant};
        }catch(error){last=error;if(signal.aborted)throw error;await onProgress({phase:'DOWNLOADING_MODEL',source:provider.name,error:'Source failed; trying next compatible source'});}
      }
      throw Error('Download failed for all compatible sources: '+(last?.message?.startsWith('Model integrity')?last.message:'check connectivity and credentials'));
    }finally{this.locks.delete(key);}
  }
}
module.exports={ModelDownloadService,HuggingFaceDownloadProvider,ModelScopeDownloadProvider,digest,request};
