import { BailianModelsService, bailianEndpoint, offline } from './bailian-models.service';
import type { ProviderConfig } from '../providers/provider-api-key.store';

const config = (providerName = 'qwen', models = 'qwen-old,qwen-current', baseUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1'): ProviderConfig => ({
  id: providerName, providerName, displayName: providerName, models, baseUrl, enabled: true, modelPrefix: null,
  authHeader: 'Authorization', authPrefix: 'Bearer', timeoutMs: 25000, retryCount: 2, createdAt: 'now', updatedAt: 'now',
});
const model = (id: string, extra = {}) => ({ model: id, name: id, provider: 'qwen', inference_provider: 'aliyun-bailian', capabilities: ['TG'], inference_metadata: { request_modality: ['Text'], response_modality: ['Text'] }, ...extra });
const input = { region: 'cn-beijing' as const, apiKey: 'fixture-secret-key', saveKey: false, removeMissing: true };
const choose = (preview: Awaited<ReturnType<BailianModelsService['preview']>>) => preview.providers.flatMap(p => p.changes.map(c => ({providerId:p.id,modelId:c.id,action:c.action})));
function harness(configs = [config()], existingKey = true) {
  const statements: Array<{sql: string; params: unknown[]}> = [];
  const rows = () => configs.map(c => ({id:c.id,provider_name:c.providerName,display_name:c.displayName,base_url:c.baseUrl,models:c.models,model_prefix:c.modelPrefix,auth_header:c.authHeader,auth_prefix:c.authPrefix,timeout_ms:c.timeoutMs,retry_count:c.retryCount,enabled:c.enabled?1:0,created_at:c.createdAt,updated_at:c.updatedAt}));
  const tx = {exec:jest.fn(),prepare:(sql:string)=>({all:async()=>rows(),get:async()=>sql.includes('system_settings')?{value:'{}'}:existingKey?{id:'key'}:undefined,run:async(...params:unknown[])=>{statements.push({sql,params});return {changes:1};}})};
  const remembered=new Map<string,{owner:string;key_cipher:string;key_prefix:string}>();
  const connection={prepare:(sql:string)=>({get:async(id:string,owner:string)=>{const row=remembered.get(id);return row?.owner===owner?row:undefined;},run:async(...params:unknown[])=>{
    if(sql.startsWith('INSERT INTO bailian_sync_credentials'))remembered.set(String(params[0]),{owner:String(params[1]),key_cipher:String(params[4]),key_prefix:String(params[5])});
    if(sql.startsWith('DELETE FROM bailian_sync_credentials')&&remembered.get(String(params[0]))?.owner===params[1])remembered.delete(String(params[0]));
    return {changes:1};
  }})};
  const db = {now:()=> 'new',connection,transaction:jest.fn(async(work:any)=>work(tx))};
  const keys = {listConfigs:jest.fn(async()=>configs),reloadPool:jest.fn(async()=>{})};
  const registry = {reloadProvider:jest.fn(async()=>{})}, settings = {reloadAll:jest.fn(async()=>{})};
  return {service:new BailianModelsService(db as any, keys as any, registry as any, settings as any),db,keys,registry,settings,statements,remembered};
}
const response = (models: unknown[], page = 1, total = models.length, status = 200) => new Response(JSON.stringify({success:status===200,output:{page_no:page,total,models}}),{status});

describe('Bailian model synchronization', () => {
  const nativeFetch = global.fetch;
  const originalEncryptionKey = process.env.CHECKPOINT_ENCRYPTION_KEY;
  beforeEach(()=>{process.env.CHECKPOINT_ENCRYPTION_KEY='fixture-encryption-key-32-characters-only';});
  afterEach(()=>{global.fetch=nativeFetch; jest.restoreAllMocks();if(originalEncryptionKey===undefined)delete process.env.CHECKPOINT_ENCRYPTION_KEY;else process.env.CHECKPOINT_ENCRYPTION_KEY=originalEncryptionKey;});
  it('uses fixed official regional hosts and rejects endpoint injection',()=>{
    expect(bailianEndpoint('cn-beijing')).toBe('https://dashscope.aliyuncs.com/api/v1/models');
    expect(bailianEndpoint('eu-central-1','llm-example')).toContain('llm-example.eu-central-1.maas.aliyuncs.com');
    expect(()=>bailianEndpoint('eu-central-1')).toThrow();
    expect(()=>bailianEndpoint('cn-beijing','evil.com/path')).toThrow();
    expect(()=>bailianEndpoint('http://localhost')).toThrow();
  });
  it('fetches every page and excludes external inference, embeddings, future offline dates and other endpoints',async()=>{
    const h=harness([config(),config('gemini','gemini-test','https://generativelanguage.googleapis.com/v1beta')]);
    const list=[model('qwen-current'),model('qwen-new',{capabilities:['TG','VU'],inference_metadata:{request_modality:['Text','Image'],response_modality:['Text']}}),
      model('qwen-future',{inference_offline_info:{inference:{offline_time:'2099-01-01 00:00:00'}}}),model('embedding',{capabilities:['TR']}),model('external',{inference_provider:'siliconflow'})];
    global.fetch=jest.fn().mockResolvedValueOnce(response(list.slice(0,2),1,5)).mockResolvedValueOnce(response(list.slice(2),2,5));
    const p=await h.service.preview('admin',input);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(String((global.fetch as jest.Mock).mock.calls[1][0])).toContain('page_no=2');
    expect(p.providers[0].changes.map(c=>c.id)).toEqual(['qwen-old','qwen-new','qwen-future']);
    expect(p.skipped[0].displayName).toBe('gemini');
    expect(JSON.stringify(p)).not.toContain(input.apiKey); expect(h.db.transaction).not.toHaveBeenCalled();
  });
  it.each(['empty','partial','duplicate','changing-total','unauthorized'])('does not prepare destructive changes for %s upstream results',async(kind)=>{
    const h=harness();
    if(kind==='empty')global.fetch=jest.fn().mockResolvedValue(response([]));
    if(kind==='unauthorized')global.fetch=jest.fn().mockResolvedValue(response([],1,0,401));
    if(kind==='partial')global.fetch=jest.fn().mockResolvedValueOnce(response([model('qwen-new')],1,2)).mockResolvedValueOnce(response([],2,2));
    if(kind==='duplicate')global.fetch=jest.fn().mockResolvedValueOnce(response([model('qwen-new')],1,2)).mockResolvedValueOnce(response([model('qwen-new')],2,2));
    if(kind==='changing-total')global.fetch=jest.fn().mockResolvedValueOnce(response([model('qwen-new')],1,2)).mockResolvedValueOnce(response([model('qwen-current')],2,3));
    await expect(h.service.preview('admin',input)).rejects.toThrow(); expect(h.db.transaction).not.toHaveBeenCalled();
  });
  it('can preserve missing models while always removing models explicitly offline in Beijing time',async()=>{
    const h=harness();
    global.fetch=jest.fn().mockResolvedValue(response([model('qwen-current',{inference_offline_info:{inference:{offline_time:'2000-01-01 00:00:00'}}}),model('qwen-new')]));
    const p=await h.service.preview('admin',{...input,removeMissing:false});
    expect(p.providers[0].changes.find(c=>c.action==='removed')?.id).toBe('qwen-current');
    expect(p.providers[0].changes.some(c=>c.id==='qwen-old')).toBe(false);
    expect(offline(model('m',{inference_offline_info:{a:{offline_time:'2026-10-12 08:00:00'}}}),Date.parse('2026-10-12T00:00:00Z'))).toBe(true);
  });
  it('applies only server-held previews, rejects stale snapshots and duplicate confirmation',async()=>{
    const configs=[config()],h=harness(configs);
    global.fetch=jest.fn().mockResolvedValue(response([model('qwen-current'),model('qwen-new')]));
    const p=await h.service.preview('admin',input);
    await expect(h.service.apply('other',p.previewId,choose(p))).rejects.toThrow(/过期/);
    configs[0].models='concurrently-edited';
    await expect(h.service.apply('admin',p.previewId,choose(p))).rejects.toThrow(/已变化/); expect(h.statements).toHaveLength(0);
    configs[0].models='qwen-old,qwen-current';
    expect(await h.service.apply('admin',p.previewId,choose(p))).toMatchObject({added:1,removed:1,providers:1,warnings:[]});
    expect(h.statements.find(s=>s.sql.startsWith('UPDATE provider_configs'))?.params[0]).toBe('qwen-current,qwen-new');
    expect(h.statements.some(s=>s.sql.startsWith('INSERT INTO provider_api_keys'))).toBe(false);
    expect(h.registry.reloadProvider).toHaveBeenCalledWith('qwen');
    await expect(h.service.apply('admin',p.previewId,choose(p))).rejects.toThrow(/过期/);
  });
  it('adds a submitted Key only on confirmed save, deduplicates it and returns persisted status on refresh failure',async()=>{
    const h=harness([config()],false);
    global.fetch=jest.fn().mockResolvedValue(response([model('qwen-current')]));
    const p=await h.service.preview('admin',{...input,saveKey:true});
    expect(h.statements).toHaveLength(0);
    h.registry.reloadProvider.mockRejectedValueOnce(new Error('private downstream detail'));
    const result=await h.service.apply('admin',p.previewId,choose(p));
    expect(h.statements.filter(s=>s.sql.startsWith('INSERT INTO provider_api_keys'))).toHaveLength(1);
    expect(result.warnings[0]).toContain('已保存');expect(JSON.stringify(result)).not.toContain(input.apiKey);
    global.fetch=jest.fn().mockImplementation(async()=>response([model('qwen-current')]));
    const h2=harness([config()],true),p2=await h2.service.preview('admin',{...input,saveKey:true});
    await h2.service.apply('admin',p2.previewId,choose(p2));expect(h2.statements.some(s=>s.sql.startsWith('INSERT INTO provider_api_keys'))).toBe(false);
  });
  it('applies only chosen additions, preserves unchosen deletions and other providers, and skips unchosen tags/Keys',async()=>{
    const h=harness([config(),config('deepseek','deepseek-old')],false);
    global.fetch=jest.fn().mockResolvedValue(response([model('qwen-current'),model('qwen-new'),model('qwen-not-selected'),model('deepseek-new',{provider:'deepseek'})]));
    const p=await h.service.preview('admin',{...input,saveKey:true});
    const result=await h.service.apply('admin',p.previewId,[{providerId:'qwen',modelId:'qwen-new',action:'added'}]);
    expect(result).toMatchObject({added:1,removed:0,providers:1});
    const update=h.statements.find(s=>s.sql.startsWith('UPDATE provider_configs'))!;
    expect(update.params).toEqual(['qwen-old,qwen-current,qwen-new','new','qwen']);
    expect(h.statements.filter(s=>s.sql.startsWith('UPDATE provider_configs'))).toHaveLength(1);
    const tags=JSON.parse(String(h.statements.find(s=>s.sql.startsWith('UPDATE system_settings'))!.params[0]));
    expect(tags['qwen-new']).toEqual(['language']);expect(tags['qwen-not-selected']).toBeUndefined();expect(tags['deepseek-new']).toBeUndefined();
    expect(h.statements.filter(s=>s.sql.startsWith('INSERT INTO provider_api_keys')).map(s=>s.params[1])).toEqual(['qwen']);
    expect(h.registry.reloadProvider).not.toHaveBeenCalledWith('deepseek');
  });
  it('allows deletion without any additions and rejects empty, forged, wrong-action and duplicate selections before writing',async()=>{
    const h=harness();global.fetch=jest.fn().mockResolvedValue(response([model('qwen-current'),model('qwen-new')]));
    const p=await h.service.preview('admin',input),valid={providerId:'qwen',modelId:'qwen-old',action:'removed' as const};
    for(const selections of [[],[{...valid,modelId:'forged'}],[{...valid,providerId:'other'}],[{...valid,action:'added' as const}],[valid,valid]])
      await expect(h.service.apply('admin',p.previewId,selections)).rejects.toThrow();
    expect(h.statements).toHaveLength(0);expect(h.db.transaction).not.toHaveBeenCalled();
    expect(await h.service.apply('admin',p.previewId,[valid])).toMatchObject({added:0,removed:1});
    expect(h.statements.find(s=>s.sql.startsWith('UPDATE provider_configs'))?.params[0]).toBe('qwen-current');
  });
  it('remembers validated Keys encrypted, returns only a mask, and reuses without a submitted Key after service recreation',async()=>{
    const h=harness();global.fetch=jest.fn().mockImplementation(async()=>response([model('qwen-current')]));
    const preview=await h.service.preview('admin',{...input,rememberKey:true});
    expect(preview.credential).toEqual({remembered:true,keyPrefix:'***-key'});
    expect(JSON.stringify(preview)).not.toContain(input.apiKey);
    expect([...h.remembered.values()][0].key_cipher).not.toContain(input.apiKey);
    const reopened=new BailianModelsService(h.db as any,h.keys as any,h.registry as any,h.settings as any);
    expect(await reopened.credentialStatus('admin',input)).toMatchObject({remembered:true});
    await reopened.preview('admin',{...input,apiKey:undefined});
    expect((global.fetch as jest.Mock).mock.calls[1][1].headers.Authorization).toBe('Bearer '+input.apiKey);
    expect(h.statements).toHaveLength(0);
  });
  it('isolates remembered credentials by administrator/region/workspace and never replaces them after failed validation',async()=>{
    const h=harness();global.fetch=jest.fn().mockImplementation(async()=>response([model('qwen-current')]));
    await h.service.preview('admin',{...input,rememberKey:true});
    for(const [owner,scope] of [['other',input],['admin',{...input,region:'ap-southeast-1'}],['admin',{...input,workspaceId:'other-space'}]] as const)
      expect(await h.service.credentialStatus(owner,scope)).toEqual({remembered:false});
    await expect(h.service.preview('other',{...input,apiKey:undefined})).rejects.toThrow(/尚未记住/);
    const previous=[...h.remembered.values()][0].key_cipher;
    global.fetch=jest.fn().mockResolvedValue(response([],1,0,401));
    await expect(h.service.preview('admin',{...input,apiKey:'bad-new-key',rememberKey:true})).rejects.toThrow();
    expect([...h.remembered.values()][0].key_cipher).toBe(previous);
  });
  it('can replace or forget a remembered Key, invalidates its pending preview and preserves provider Keys',async()=>{
    const h=harness();global.fetch=jest.fn().mockImplementation(async()=>response([model('qwen-current')]));
    await h.service.preview('admin',{...input,rememberKey:true});
    const preview=await h.service.preview('admin',{...input,apiKey:'fixture-replacement-key',rememberKey:true});
    expect(h.remembered.size).toBe(1);
    await h.service.forgetCredential('other',input);expect(h.remembered.size).toBe(1);
    await h.service.forgetCredential('admin',input);expect(h.remembered.size).toBe(0);
    expect(await h.service.credentialStatus('admin',input)).toEqual({remembered:false});
    await expect(h.service.apply('admin',preview.previewId,choose(preview))).rejects.toThrow(/过期/);
    expect(h.statements).toHaveLength(0);
  });
});
