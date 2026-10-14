import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { BailianModelsService } from './bailian-models.service';
import { RouterController } from '../router/router.controller';
import { RouterService } from '../router/router.service';
import { ModelServicesController } from '../model-services/model-services.controller';
import { ModelServicesService } from '../model-services/model-services.service';
import { AuthController } from '../auth/auth.controller';
import { AuthService } from '../auth/auth.service';
import { VerificationCodeService } from '../auth/verification-code.service';
import { JwtService } from '../auth/jwt.service';
import { UsersService } from '../auth/users.service';
import { DatabaseService } from '../database/database.service';
import { ApiKeysService } from '../api-keys/api-keys.service';
import { ChatService } from '../gateway/chat.service';
import { BillingService } from '../billing/billing.service';
import { AgentsService } from '../agents/agents.service';
import { SettingsThrottleGuard } from '../common/settings-throttle.guard';

describe('admin HTTP authorization and validation', () => {
  let app: INestApplication,base:string,userToken:string,adminToken:string;
  const write=jest.fn(async()=>({}));
  beforeAll(async()=>{
    const module=await Test.createTestingModule({controllers:[AdminController,RouterController,ModelServicesController,AuthController],providers:[
      JwtService,
      {provide:DatabaseService,useValue:{connection:{prepare:()=>({get:async(id:string)=>({id,username:id,role:id==='admin'?'admin':'user',auth_version:0})})}}},
      {provide:ApiKeysService,useValue:{validateKey:async()=>null}},
      {provide:AdminService,useValue:{getSystemSettings:async()=>[],getStats:async()=>({}),updateSystemSetting:write}},
      {provide:BailianModelsService,useValue:{preview:write,apply:write,credentialStatus:async()=>({remembered:false}),forgetCredential:write}},
      {provide:RouterService,useValue:{getRulesRaw:async()=>[],updateRule:write}},
      {provide:ModelServicesService,useValue:{snapshot:async()=>({nodes:[],instances:[]})}},
      {provide:AuthService,useValue:{topUp:write}},
      ...[UsersService,VerificationCodeService,ChatService,BillingService,AgentsService].map(provide=>({provide,useValue:{}})),
    ]}).overrideGuard(SettingsThrottleGuard).useValue({canActivate:()=>true}).compile();
    app=module.createNestApplication();app.setGlobalPrefix('v1');app.useGlobalPipes(new ValidationPipe({transform:true,whitelist:true,forbidNonWhitelisted:true}));
    await app.listen(0,'127.0.0.1');base=await app.getUrl();
    const jwt=module.get(JwtService);userToken=jwt.sign('user','user');adminToken=jwt.sign('admin','admin');
  });
  afterAll(async()=>{await app?.close();});
  it('anonymous and ordinary users cannot access any administrative controller',async()=>{
    for(const route of ['/admin/settings','/admin/stats','/router/admin/rules','/admin/model-services']) {
      expect((await fetch(base+'/v1'+route)).status).toBe(401);
      expect((await fetch(base+'/v1'+route,{headers:{Authorization:'Bearer '+userToken}})).status).toBe(403);
      expect((await fetch(base+'/v1'+route,{headers:{Authorization:'Bearer '+adminToken}})).status).toBe(200);
    }
  });
  it('ordinary users cannot mutate routing or mint balance',async()=>{
    write.mockClear();
    for(const [route,body] of [['/router/admin/rules',{intent:'general',models:['test']}],['/auth/topup',{amount:100}]]) {
      const response=await fetch(base+'/v1'+route,{method:'POST',headers:{Authorization:'Bearer '+userToken,'Content-Type':'application/json'},body:JSON.stringify(body)});
      expect(response.status).toBe(403);
    }
    expect(write).not.toHaveBeenCalled();
  });
  it('settings DTO rejects non-string and unknown fields before invoking persistence',async()=>{
    write.mockClear();
    for(const body of [{value:{data:'bad'}},{value:'ok',injected:true}]) {
      const response=await fetch(base+'/v1/admin/settings/default_temperature',{method:'PATCH',headers:{Authorization:'Bearer '+adminToken,'Content-Type':'application/json'},body:JSON.stringify(body)});
      expect(response.status).toBe(400);
    }
    expect(write).not.toHaveBeenCalled();
  });
  it('Bailian preview and apply require an administrator and validated bodies', async () => {
    write.mockClear();
    for (const [route, body] of [['preview', {region:'cn-beijing',apiKey:'fixture-key',saveKey:true,removeMissing:true}], ['apply', {previewId:'12345678-1234-1234-1234-123456789abc',selections:[{providerId:'qwen',modelId:'qwen-new',action:'added'}]}]]) {
      const url = base + '/v1/admin/bailian-models/' + route;
      const options = {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)};
      expect((await fetch(url, options)).status).toBe(401);
      expect((await fetch(url, {...options,headers:{...options.headers,Authorization:'Bearer '+userToken}})).status).toBe(403);
      expect((await fetch(url, {...options,headers:{...options.headers,Authorization:'Bearer '+adminToken}})).status).toBe(200);
    }
    write.mockClear();
    const response = await fetch(base + '/v1/admin/bailian-models/preview', {method:'POST',headers:{Authorization:'Bearer '+adminToken,'Content-Type':'application/json'},body:JSON.stringify({region:'cn-beijing',apiKey:'fixture-key',saveKey:'true',removeMissing:true,endpoint:'http://localhost'})});
    expect(response.status).toBe(400); expect(write).not.toHaveBeenCalled();
    for(const selections of [undefined,[],[{providerId:'qwen',modelId:'qwen-new',action:'delete'}],[{providerId:'qwen',modelId:'qwen-new',action:'added',models:'injected'}]]) {
      const response=await fetch(base+'/v1/admin/bailian-models/apply',{method:'POST',headers:{Authorization:'Bearer '+adminToken,'Content-Type':'application/json'},body:JSON.stringify({previewId:'12345678-1234-1234-1234-123456789abc',selections})});
      expect(response.status).toBe(400);
    }
    expect(write).not.toHaveBeenCalled();
  });
  it('remembered-Key status and forgetting are administrator-only and reject extra secret fields',async()=>{
    for(const action of ['status','forget']) {
      const url=base+'/v1/admin/bailian-models/credential/'+action,body=JSON.stringify({region:'cn-beijing'});
      const options={method:'POST',headers:{'Content-Type':'application/json'},body};
      expect((await fetch(url,options)).status).toBe(401);
      expect((await fetch(url,{...options,headers:{...options.headers,Authorization:'Bearer '+userToken}})).status).toBe(403);
      expect((await fetch(url,{...options,headers:{...options.headers,Authorization:'Bearer '+adminToken}})).status).toBe(200);
      expect((await fetch(url,{...options,headers:{...options.headers,Authorization:'Bearer '+adminToken},body:JSON.stringify({region:'cn-beijing',apiKey:'injected'})})).status).toBe(400);
    }
  });
});
