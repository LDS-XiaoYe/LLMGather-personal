const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(process.argv[2]);
const config=JSON.parse(fs.readFileSync(path.join(root,'agent.env.json'),'utf8'));
for(const [key,value]of Object.entries(config))if(key.startsWith('AGENT_')||['HF_TOKEN','MODELSCOPE_TOKEN','HTTPS_PROXY','HTTP_PROXY','NO_PROXY'].includes(key))process.env[key]=String(value);
require('../server.cjs').start().catch(()=>{console.error('Agent startup failed');process.exitCode=1;});
