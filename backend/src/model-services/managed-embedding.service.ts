import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { EmbeddingDescriptor } from '../knowledge/retrieval/embedding.service';
import { AgentClient } from './agent.client';
import { ModelServicesService, managedId } from './model-services.service';
import { InstanceSpec } from './model.types';
import { randomUUID } from 'crypto';

@Injectable()
export class ManagedEmbeddingService {
  private active=0;
  constructor(private readonly database:DatabaseService,private readonly services:ModelServicesService,private readonly agent:AgentClient){}
  async describe(kb?:string):Promise<EmbeddingDescriptor|null>{
    if(!kb)return null;
    const row=await this.database.connection.prepare('SELECT embedding_instance_id,embedding_spec_json FROM knowledge_bases WHERE id=? AND deleted_at IS NULL').get(managedId(kb));
    if(!row)throw new NotFoundException('Knowledge base not found');
    if(!row.embedding_instance_id)return null;
    const i=await this.services.readyInstance(String(row.embedding_instance_id));
    const descriptor=JSON.parse(String(row.embedding_spec_json)) as EmbeddingDescriptor;
    if(i.fingerprint!==descriptor.fingerprint)throw new ConflictException('Knowledge model version mismatch; bind the new model and reindex');
    return descriptor;
  }
  async descriptor(id:string):Promise<EmbeddingDescriptor>{
    const i=await this.services.readyInstance(id),spec=JSON.parse(i.spec_json!) as InstanceSpec;
    return{model:i.model_id,dimensions:spec.dimensions,fingerprint:i.fingerprint!,revision:spec.revision,endpoint:'managed://'+i.id};
  }
  async initialBinding(selected?:string):Promise<{id:string|null;spec:string|null}>{
    const id=selected=== ''?null:selected||await this.services.defaultId();
    return id?{id,spec:JSON.stringify(await this.descriptor(id))}:{id:null,spec:null};
  }
  async bind(user:string,kb:string,id:string){
    managedId(kb);const descriptor=id?await this.descriptor(managedId(id)):null;
    const owner=randomUUID(),db=this.database.connection;
    const claim=await db.prepare(`UPDATE knowledge_bases SET rag_owner=?,rag_lease_until=DATE_ADD(NOW(3),INTERVAL 60 SECOND)
      WHERE id=? AND user_id=? AND provider='native' AND deleted_at IS NULL AND (rag_owner IS NULL OR rag_lease_until<NOW(3))`)
      .run(owner,kb,user);
    if(!claim.changes)throw new ConflictException('Knowledge base missing or indexing is active');
    try{
      const changed=await db.prepare("UPDATE knowledge_bases SET embedding_instance_id=NULLIF(?,''),embedding_spec_json=NULLIF(?,''),retrieval_backend='legacy' WHERE id=? AND user_id=? AND rag_owner=? AND rag_lease_until>NOW(3)")
        .run(id||null,descriptor?JSON.stringify(descriptor):null,kb,user,owner);
      if(!changed.changes)throw new ConflictException('Knowledge binding lease lost');
      await db.prepare("UPDATE knowledge_indexes SET status='pending',cursor_id='',indexed_count=0 WHERE kb_id=? AND user_id=?").run(kb,user);
      await this.services.audit(user,'knowledge.embedding.bind',kb,{instanceId:id||null,reindexRequired:true});
      return{reindexRequired:true,descriptor};
    }finally{await db.prepare('UPDATE knowledge_bases SET rag_owner=NULL,rag_lease_until=NULL WHERE id=? AND rag_owner=?').run(kb,owner);}
  }
  async embed(input:string[],expected:EmbeddingDescriptor):Promise<number[][]>{
    const id=managedId(expected.endpoint.slice('managed://'.length)),actual=await this.descriptor(id);
    if(actual.fingerprint!==expected.fingerprint)throw new ConflictException('Embedding vector space changed; reindex');
    const instance=await this.services.readyInstance(id),node=await this.services.node(instance.node_id);
    const out:number[][]=[];
    for(let start=0;start<input.length;start+=32){
      while(this.active>=2)await new Promise(r=>setTimeout(r,20));this.active++;
      try{
        const batch=input.slice(start,start+32);let result:{data:{index:number;embedding:number[]}[]}|undefined;
        for(let attempt=0;attempt<3;attempt++){
          try{result=await this.agent.request(node,'POST',`/v1/instances/${id}/embeddings`,{model:actual.model,input:batch});break;}
          catch(e){if(attempt===2)throw e;await new Promise(r=>setTimeout(r,200*2**attempt));}
        }
        const rows=result?.data?.slice().sort((a,b)=>a.index-b.index);
        if(!rows||rows.length!==batch.length||rows.some((r,i)=>r.index!==i||!Array.isArray(r.embedding)||r.embedding.length!==actual.dimensions||!r.embedding.every(Number.isFinite)||!r.embedding.some(v=>v!==0)))throw new Error('Embedding response index, dimension or values mismatch');
        out.push(...rows.map(r=>r.embedding));
      }finally{this.active--;}
    }
    return out;
  }
}
