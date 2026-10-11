const fs=require('node:fs/promises');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
class AgentStore {
  constructor(root){this.root=path.resolve(root);this.file=path.join(this.root,'state.json');this.state={instances:{},tasks:{},downloads:{}};this.chain=Promise.resolve();}
  async load(){await fs.mkdir(this.root,{recursive:true,mode:0o700});try{this.state=JSON.parse(await fs.readFile(this.file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}return this;}
  async save(){this.chain=this.chain.catch(()=>{}).then(async()=>{const temp=this.file+'.'+randomUUID();const handle=await fs.open(temp,'wx',0o600);try{await handle.writeFile(JSON.stringify(this.state));await handle.sync();}finally{await handle.close();}await fs.rename(temp,this.file);});return this.chain;}
}
module.exports={AgentStore};
