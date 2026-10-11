// One-time host setup. Model deployment itself is driven only by the authenticated Admin UI.
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {randomBytes,randomUUID}=require('node:crypto');
const {command}=require('../hardware.cjs');
const {xml}=require('../runtime.cjs');
async function install(){
  const root=path.resolve(process.env.AGENT_DATA_DIR||path.join(os.homedir(),'.llmgather','agent'));
  await fs.mkdir(root,{recursive:true,mode:0o700});
  const file=path.join(root,'agent.env.json');let config;
  try{config=JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;
    config={AGENT_ID:randomUUID(),AGENT_TOKEN:randomBytes(48).toString('hex'),AGENT_DATA_DIR:root,AGENT_HOST:process.env.AGENT_HOST||'127.0.0.1',AGENT_PORT:process.env.AGENT_PORT||'19090'};
    for(const key of ['AGENT_TLS_CERT','AGENT_TLS_KEY','AGENT_PYTHON','HF_TOKEN','MODELSCOPE_TOKEN','HTTPS_PROXY','HTTP_PROXY','NO_PROXY'])if(process.env[key])config[key]=process.env[key];
    await fs.writeFile(file,JSON.stringify(config,null,2),{mode:0o600});
  }
  const args=[process.execPath,path.join(__dirname,'launcher.cjs'),root];
  if(os.platform()==='darwin'){
    if(os.arch()!=='arm64')throw Error('Apple Metal requires Apple Silicon');
    await command(config.AGENT_PYTHON||'python3',['--version']);
    const directory=path.join(os.homedir(),'Library','LaunchAgents');await fs.mkdir(directory,{recursive:true});
    const plist=path.join(directory,'io.llmgather.deployment-agent.plist');
    const text=`<?xml version="1.0"?><plist version="1.0"><dict><key>Label</key><string>io.llmgather.deployment-agent</string><key>ProgramArguments</key><array>${args.map(a=>'<string>'+xml(a)+'</string>').join('')}</array><key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>StandardOutPath</key><string>${xml(path.join(root,'agent.log'))}</string><key>StandardErrorPath</key><string>${xml(path.join(root,'agent.err'))}</string></dict></plist>`;
    await fs.writeFile(plist,text,{mode:0o600});await command('launchctl',['bootout','gui/'+os.userInfo().uid+'/io.llmgather.deployment-agent']).catch(()=>{});
    await command('launchctl',['bootstrap','gui/'+os.userInfo().uid,plist]);
  }else if(os.platform()==='linux'){
    if(root.includes('\n')||args.some(a=>/[\n%"]/.test(a)))throw Error('Invalid service path');
    const folder=path.join(os.homedir(),'.config','systemd','user');await fs.mkdir(folder,{recursive:true});
    await fs.writeFile(path.join(folder,'llmgather-agent.service'),`[Unit]\nDescription=LLMGather restricted Deployment Agent\nAfter=network-online.target\n[Service]\nExecStart=${args.map(a=>'"'+a+'"').join(' ')}\nRestart=on-failure\nRestartSec=5\n[Install]\nWantedBy=default.target\n`,{mode:0o600});
    await command('systemctl',['--user','daemon-reload']);await command('systemctl',['--user','enable','--now','llmgather-agent.service']);
  }else if(os.platform()==='win32'){
    await command('icacls',[root,'/inheritance:r','/grant:r',os.userInfo().username+':(OI)(CI)F']);
    await command('schtasks',['/Create','/F','/SC','ONLOGON','/TN','LLMGather-Deployment-Agent','/TR',args.map(a=>'"'+a+'"').join(' ')]);
    await command('schtasks',['/Run','/TN','LLMGather-Deployment-Agent']);
  }else throw Error('Unsupported Agent OS');
  console.log('Agent installed. Device ID: '+config.AGENT_ID);console.log('Registration credential file (keep private): '+file);
}
install().catch(e=>{console.error(e.message);process.exitCode=1;});
