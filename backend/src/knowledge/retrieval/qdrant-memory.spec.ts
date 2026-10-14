import { QdrantService } from './qdrant.service';
describe('Qdrant memory collection contracts', () => {
  const env={...process.env};
  beforeEach(() => {process.env.QDRANT_URL='http://qdrant.test';});
  afterEach(() => {process.env={...env};});
  const descriptor={fingerprint:'a'.repeat(64),model:'test',dimensions:2,endpoint:'http://test',revision:'1'};
  const point={id:'id',userId:'user',agentId:null,memoryType:'fact',revision:'1',contentHash:'hash'};
  function fixture() {
    const client={search:jest.fn(async () => [{id:'id',score:0.9,payload:{revision:'1',content_hash:'hash'}}]),
      upsert:jest.fn(async () => {}),delete:jest.fn(async () => {}),
      getCollection:jest.fn(async () => ({config:{params:{vectors:{size:2,distance:'Cosine'}}}})),createPayloadIndex:jest.fn(async () => {})};
    const service=new QdrantService();Object.assign(service,{client});return {service,client};
  }
  it('separates knowledge and memory collections, validates dimensions and creates filter indexes',async () => {
    const f=fixture();
    expect(f.service.memoryCollection(descriptor)).not.toBe(f.service.collection(descriptor));
    await f.service.ensureMemory(descriptor);
    expect(f.client.createPayloadIndex).toHaveBeenCalledTimes(4);
    await expect(f.service.ensureMemory({...descriptor,dimensions:3})).rejects.toThrow('mismatch');
    await expect(f.service.upsertMemory(descriptor,point,[1])).rejects.toThrow('mismatch');
  });
  it('stores only derived metadata, never the memory text', async () => {
    const f=fixture();await f.service.upsertMemory(descriptor,point,[1,2]);
    expect(f.client.upsert).toHaveBeenCalledWith(f.service.memoryCollection(descriptor),expect.objectContaining({
      wait:true,points:[expect.objectContaining({payload:expect.objectContaining({user_id:'user',agent_id:'',revision:'1',content_hash:'hash'})})],
    }));
    expect(JSON.stringify(f.client.upsert.mock.calls)).not.toContain('content"');
  });
  it('prefilters tenant, agent/global, model space and type and requests only version/hash payload',async () => {
    const f=fixture();
    expect(await f.service.searchMemories(descriptor,[1,2],'user','agent',5,'skill')).toEqual([{id:'id',score:0.9,revision:'1',contentHash:'hash'}]);
    expect(f.client.search).toHaveBeenCalledWith(f.service.memoryCollection(descriptor),expect.objectContaining({
      with_payload:['revision','content_hash'], filter:{must:[
        {key:'user_id',match:{value:'user'}},{key:'fingerprint',match:{value:descriptor.fingerprint}},
        {key:'agent_id',match:{any:['','agent']}},{key:'memory_type',match:{value:'skill'}},
      ]},
    }));
    await expect(f.service.searchMemories(descriptor,[1],'user',undefined,5)).rejects.toThrow('mismatch');
  });
  it('accepts missing historical collections but retries other delete failures via the caller',async () => {
    const f=fixture();f.client.delete.mockRejectedValueOnce({status:404} as never);
    await expect(f.service.deleteMemory('old','user','id')).resolves.toBeUndefined();
    f.client.delete.mockRejectedValueOnce({status:403} as never);
    await expect(f.service.deleteMemory('old','user','id')).rejects.toThrow('HTTP 403');
  });
});
