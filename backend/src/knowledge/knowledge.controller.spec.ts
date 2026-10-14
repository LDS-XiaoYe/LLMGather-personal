import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { ManagedEmbeddingService } from '../model-services/managed-embedding.service';
import { ModelServicesService } from '../model-services/model-services.service';
import { AuthenticatedRequestUser } from '../auth/auth.types';

describe('automatic indexing after embedding binding',()=>{
  const user={id:'owner'} as AuthenticatedRequestUser;
  function fixture(){
    const sequence:string[]=[];
    const managed={bind:jest.fn(async()=>{sequence.push('bind');return{reindexRequired:true,descriptor:{model:'bge-m3'}};})};
    const knowledge={reindex:jest.fn(async()=>{sequence.push('index');return{status:'ready',indexedCount:7};})};
    const controller=new KnowledgeController(knowledge as unknown as KnowledgeService,managed as unknown as ManagedEmbeddingService,{} as ModelServicesService);
    return{controller,managed,knowledge,sequence};
  }
  it('automatically rebuilds after binding and returns only after completion',async()=>{
    const f=fixture();
    const result=await f.controller.bindEmbedding(user,'kb',{instanceId:'model'});
    expect(f.sequence).toEqual(['bind','index']);
    expect(f.managed.bind).toHaveBeenCalledWith('owner','kb','model');
    expect(f.knowledge.reindex).toHaveBeenCalledWith('owner','kb',true);
    expect(result.data).toMatchObject({reindexRequired:false,index:{status:'ready',indexedCount:7}});
  });
  it('never indexes when binding fails or the payload is invalid',async()=>{
    const f=fixture();f.managed.bind.mockRejectedValueOnce(new Error('binding failure'));
    await expect(f.controller.bindEmbedding(user,'kb',{instanceId:'model'})).rejects.toThrow('binding failure');
    await expect(f.controller.bindEmbedding(user,'kb',undefined as never)).rejects.toThrow('Invalid embedding instance');
    expect(f.knowledge.reindex).not.toHaveBeenCalled();
  });
  it('reports a saved binding distinctly from an indexing failure without exposing upstream details',async()=>{
    const f=fixture();f.knowledge.reindex.mockRejectedValueOnce(new Error('private upstream token'));
    try{await f.controller.bindEmbedding(user,'kb',{instanceId:'model'});throw Error('expected failure');}
    catch(e){expect((e as {getResponse:()=>unknown}).getResponse()).toMatchObject({bindingSaved:true,reindexRequired:true,message:expect.stringContaining('自动重建索引失败')});expect(String(e)).not.toContain('private upstream');}
  });
});
