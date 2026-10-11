const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs/promises');
const {ModelDownloadService}=require('../download.cjs');
const registry=require('../registry.json');
async function main(){
  const root=path.resolve(process.argv[2]||'.p0-artifacts/bge-m3'),variant=registry.models[0].variants.tei;
  const results=[];
  for(const [source,folder]of [['modelscope','agent-state/cache'],['huggingface','hf-cache']]){
    const downloader=new ModelDownloadService(path.join(root,folder));
    const cache=await downloader.prepare('bge-m3','tei',source,async p=>{if(p.phase==='VERIFYING_MODEL')console.log('VERIFIED',source,p.downloadedBytes,'bytes');},new AbortController().signal);
    await downloader.verify(cache.path,variant);assert.equal(cache.source,source);
    results.push({source,key:cache.key,revision:cache.variant.revision,totalBytes:variant.files.reduce((n,f)=>n+f.size,0)});
  }
  assert.equal(results[0].key,results[1].key);
  await fs.writeFile(path.join(root,'download-acceptance.json'),JSON.stringify(results,null,2));
  console.log('PASS ModelScope/Hugging Face canonical revision + file hashes; '+results[0].totalBytes+' bytes per source');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
