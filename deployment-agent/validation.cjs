function validateDeployment(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid deployment configuration');
  const allowed=['modelId','backend','source','cpu','memoryMiB','gpuUuid','allowExperimental'];
  if(Object.keys(input).some(k=>!allowed.includes(k)))throw Error('Invalid deployment field');
  const model=require('./registry.json').models.find(m=>m.id===input.modelId);
  if(!model||!['cpu','nvidia','apple'].includes(input.backend)||!['auto','huggingface','modelscope'].includes(input.source))throw Error('Invalid deployment selection');
  if(!Number.isInteger(input.cpu)||input.cpu<model.minCpu||input.cpu>64||!Number.isInteger(input.memoryMiB)||input.memoryMiB<model.minMemoryMiB||input.memoryMiB>131072)throw Error('Invalid deployment resource limit');
  if(input.allowExperimental!==undefined&&typeof input.allowExperimental!=='boolean')throw Error('Invalid experimental acknowledgement');
  if(input.backend==='nvidia'&&(!/^GPU-[a-f0-9-]{36}$/.test(input.gpuUuid||'')))throw Error('Invalid GPU UUID');
  if(input.backend==='apple'&&input.source==='modelscope')throw Error('Model MLX variant is only registered on Hugging Face');
  return {...input};
}
module.exports={validateDeployment};
