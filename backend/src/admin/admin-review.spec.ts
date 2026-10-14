import 'reflect-metadata';
import { ValidationPipe, ExecutionContext } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { validateSettingValue } from '../common/setting-validation';
import { AdminGuard } from '../common/guards/admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtService } from '../auth/jwt.service';
import { ApiKeyOrJwtGuard } from '../api-keys/api-key-or-jwt.guard';
import { RouterController } from '../router/router.controller';
import { DatabaseService } from '../database/database.service';
import { ManagedEmbeddingService } from '../model-services/managed-embedding.service';
import { AgentClient } from '../model-services/agent.client';
import { ModelServicesService } from '../model-services/model-services.service';
import { SystemSettingsService } from '../common/system-settings.service';
import { csvCell } from './admin.service';
import { UpdateProviderDto, UpdateSettingDto, UpdateAdminUserDto } from './admin.dto';
import { AuthController } from '../auth/auth.controller';
import { ProviderApiKeyStore } from '../providers/provider-api-key.store';

describe('admin and knowledge review regression', () => {
  it.each([
    ['tier_prices', '{"tier_budget":{"prompt":-1,"completion":1}}'],
    ['default_prices', '{"prompt":"1","completion":1}'],
    ['model_tier_mapping', '{"t":"bad"}'], ['model_tags', '{broken'],
    ['tier_labels', '{"__proto__":"bad"}'], ['default_temperature', 'abc'],
    ['rate_limit_login', '0/0'], ['max_json_body_size', '0mb'],
    ['invitation_credits', '-1'], ['router_classifier_model', 'auto'],
  ])('rejects invalid %s before persistence', (key, value) => expect(() => validateSettingValue(key, value)).toThrow());
  it('preserves custom Gemini models and accepts unit-bearing JSON limits', () => {
    expect(validateSettingValue('model_tier_mapping', '{"tier_custom":["gemini-custom","qwen3.6-plus"]}')).toContain('gemini-custom');
    expect(validateSettingValue('max_json_body_size', '2mb')).toBe('2mb');
  });
  it.each([
    [UpdateProviderDto, { enabled: 'false' }], [UpdateProviderDto, { enabled: null }],
    [UpdateSettingDto, { value: { lost: true } }], [UpdateAdminUserDto, { credits: 2, role: 'root' }],
    [UpdateAdminUserDto, { role: null }], [UpdateSettingDto, { value: 'ok', injected: true }],
  ])('DTO rejects malformed input without implicit coercion', async (type, value) => {
    await expect(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }).transform(value, {type:'body',metatype:type as any})).rejects.toThrow();
  });
  it('protects all router administration handlers with JWT and administrator guards', () => {
    for (const method of ['getRulesRaw','saveRule','deleteRule']) expect(Reflect.getMetadata(GUARDS_METADATA, RouterController.prototype[method])).toEqual([JwtAuthGuard,AdminGuard]);
  });
  it('ordinary users cannot use the unverified self-service topup endpoint', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AuthController.prototype.topUp)).toEqual([JwtAuthGuard,AdminGuard]);
  });
  it('provider stale-edit checks are applied to the actual UPDATE statement', async () => {
    const run=jest.fn(async()=>({changes:0}));
    let update='';
    const db={now:()=>'',connection:{prepare:(sql:string)=>{if(sql.startsWith('UPDATE'))update=sql;return {get:async()=>({id:'i',provider_name:'p'}),run};}}} as unknown as DatabaseService;
    const store=new ProviderApiKeyStore(db);
    await expect(store.updateConfig('i',{displayName:'new',expectedUpdatedAt:'2026-10-12T01:00:00.000Z'})).rejects.toThrow(/配置已变化/);
    expect(update).toContain('AND updated_at = ?');
    await expect(store.toggleEnabled('i',false,'2026-10-12T01:00:00.000Z')).rejects.toThrow(/状态已变化/);
  });
  it('uses current database role, not a stale administrator claim', async () => {
    const database = {connection:{prepare:()=>({get:async()=>({role:'user'})})}} as unknown as DatabaseService;
    const context = {switchToHttp:()=>({getRequest:()=>({user:{id:'test',role:'admin'}})})} as ExecutionContext;
    await expect(new AdminGuard(database).canActivate(context)).rejects.toThrow();
  });
  it('deleted accounts and password-reset tokens fail both JWT authentication paths', async () => {
    let row: unknown = undefined;
    const db = {connection:{prepare:()=>({get:async()=>row})}} as unknown as DatabaseService;
    const jwt = {verify:()=>({sub:'id',username:'name',version:0})} as unknown as JwtService;
    const req = {header:()=> 'Bearer signed', headers:{authorization:'Bearer signed'}};
    const context = {switchToHttp:()=>({getRequest:()=>req})} as ExecutionContext;
    for (const guard of [new JwtAuthGuard(jwt,db),new ApiKeyOrJwtGuard({} as any,jwt,db)]) {
      row=undefined;await expect(guard.canActivate(context)).rejects.toThrow();
      row={id:'id',username:'name',role:'admin',auth_version:1};await expect(guard.canActivate(context)).rejects.toThrow();
      row={id:'id',username:'name',role:'user',auth_version:0};await expect(guard.canActivate(context)).resolves.toBe(true);
    }
  });
  it('blank create selection binds the same default as omitted selection', async () => {
    const id='f5736df0-4f77-4b34-9acf-0183beac0de0';
    const services={defaultId:async()=>id,readyInstance:async()=>({id,model_id:'bge-m3',fingerprint:'f',spec_json:'{"dimensions":1024,"revision":"r"}'})} as unknown as ModelServicesService;
    const service=new ManagedEmbeddingService({} as DatabaseService,services,{} as AgentClient);
    expect(await service.initialBinding('')).toEqual(await service.initialBinding());
    expect((await service.initialBinding('')).id).toBe(id);
  });
  it('never claims successful saves for nonexistent keys or stale drafts', async () => {
    let row: unknown;
    const run=jest.fn();
    const db={transaction:async(work:any)=>work({prepare:()=>({get:async()=>row,run})}),now:()=>''} as unknown as DatabaseService;
    const service=new SystemSettingsService(db);
    await expect(service.updateValues({default_temperature:'0.5'})).rejects.toThrow();
    row={value:'0.7'};
    await expect(service.updateValues({default_temperature:'0.5'},{default_temperature:'0.6'})).rejects.toThrow(/其他管理员/);
    expect(run).not.toHaveBeenCalled();
  });
  it('quotes CSV fields and neutralizes spreadsheet formulas', () => {
    expect(csvCell('=SUM(1,2)')).toBe('"\'=SUM(1,2)"');
    expect(csvCell('a,"b"\nc')).toBe('"a,""b""\nc"');
  });
  it('retains committed values when a subsequent cache SELECT fails', async () => {
    const db={initialize:async()=>{},transaction:async(work:any)=>work({prepare:()=>({get:async()=>({value:'0.7'}),run:async()=>({changes:1})})}),now:()=>'',connection:{prepare:()=>({all:async()=>{throw Error('read unavailable');}})}} as unknown as DatabaseService;
    const settings=new SystemSettingsService(db);
    await expect(settings.updateValues({default_temperature:'0.5'})).resolves.toBeUndefined();
    expect(settings.getString('default_temperature')).toBe('0.5');
  });
});
