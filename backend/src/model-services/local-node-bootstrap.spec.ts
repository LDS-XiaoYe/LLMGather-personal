import { mkdtemp, writeFile, unlink, rmdir, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { readLocalNodeCredentials, LOCAL_AGENT_URL } from './local-node-bootstrap';
import { validateAgentUrl, AgentClient } from './agent.client';
import { ModelServicesService } from './model-services.service';
import { DatabaseService } from '../database/database.service';

describe('default model deployment node',()=>{
  const oldEnv={...process.env};
  const identity={id:'12345678-1234-4123-8123-123456789abc',token:'fixture-credential-'+ 'x'.repeat(64)};
  let directory:string,file:string;
  beforeEach(async()=>{
    directory=await mkdtemp(join(tmpdir(),'llmgather-local-node-'));file=join(directory,'agent.json');
    process.env.MODEL_AGENT_BOOTSTRAP_FILE=file;
    process.env.CHECKPOINT_ENCRYPTION_KEY='test-only-checkpoint-key-32-characters';
  });
  afterEach(async()=>{await unlink(file).catch(()=>{});await rmdir(directory);process.env={...oldEnv};});
  it('loads persisted credentials without creating or exposing a key',async()=>{
    await writeFile(file,JSON.stringify(identity));const bytes=await readFile(file);
    expect(await readLocalNodeCredentials(file)).toEqual(identity);
    expect(await readFile(file)).toEqual(bytes);
    await writeFile(file,JSON.stringify({id:identity.id,token:'SECRET_SENTINEL'}));
    await expect(readLocalNodeCredentials(file)).rejects.toThrow('默认部署节点身份尚未就绪');
    await expect(readLocalNodeCredentials(file)).rejects.not.toThrow('SECRET_SENTINEL');
  });
  it('accepts the fixed private Agent and approved HTTPS without editing environment allowlists',()=>{
    process.env.MODEL_AGENT_ALLOWED_HOSTS='localhost';
    expect(validateAgentUrl(LOCAL_AGENT_URL).hostname).toBe('model-agent');
    expect(validateAgentUrl('https://gpu.example:19090',true).hostname).toBe('gpu.example');
    for(const url of ['http://gpu.example:19090','https://token@gpu.example','https://gpu.example/command','http://model-agent:80'])expect(()=>validateAgentUrl(url,true)).toThrow();
    expect(()=>validateAgentUrl('https://gpu.example:19090')).toThrow();
  });
  function service(){
    const queries:string[]=[];const run=jest.fn().mockResolvedValue({changes:1});
    const database={connection:{prepare:(sql:string)=>{queries.push(sql);return{get:async()=>undefined,run};}}} as unknown as DatabaseService;
    const request=jest.fn().mockResolvedValue({id:identity.id,hardware:{docker:{os:'linux',arch:'amd64',memoryMiB:16384}}});
    return{value:new ModelServicesService(database,{request} as unknown as AgentClient),request,run,queries};
  }
  it('auto-registers through a signed identity probe and returns no credentials',async()=>{
    await writeFile(file,JSON.stringify(identity));const {value,request,queries,run}=service();
    const results=await Promise.all([value.connectLocalNode(),value.connectLocalNode()]);
    expect(results[0]).toMatchObject({status:'ONLINE',nodeId:identity.id});
    expect(JSON.stringify(results)).not.toContain(identity.token);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0].base_url).toBe(LOCAL_AGENT_URL);
    expect(request.mock.calls[0][0].token_cipher).not.toBe(identity.token);
    expect(queries.some(q=>q.startsWith('INSERT INTO model_nodes'))).toBe(true);
    expect(run).toHaveBeenCalledTimes(2);
  });
  it('keeps offline/mismatched nodes unavailable and retries with the same persisted identity',async()=>{
    await writeFile(file,JSON.stringify(identity));const {value,request,run}=service();
    request.mockRejectedValueOnce(Error(identity.token));
    expect(await value.connectLocalNode()).toMatchObject({status:'UNAVAILABLE'});
    expect(run).not.toHaveBeenCalled();
    expect(await value.connectLocalNode()).toMatchObject({status:'ONLINE',nodeId:identity.id});
    request.mockResolvedValueOnce({id:'another-device',hardware:{}});
    expect(await value.connectLocalNode()).toMatchObject({status:'UNAVAILABLE'});
    expect(JSON.stringify(await value.connectLocalNode())).not.toContain(identity.token);
  });
  it('does not invent a node in non-Compose startup or when the bootstrap file is missing',async()=>{
    const {value,request}=service();
    expect(await value.connectLocalNode()).toMatchObject({status:'UNAVAILABLE'});
    expect(request).not.toHaveBeenCalled();
    delete process.env.MODEL_AGENT_BOOTSTRAP_FILE;
    const disabled=service();expect(await disabled.value.connectLocalNode()).toMatchObject({status:'DISABLED'});
  });
});
