import { AgentsService } from './agents.service';
const fixture=(content:string,reason='stop')=>Object.assign(Object.create(AgentsService.prototype),{assertRunnableModel:jest.fn(),toolsService:{listForUser:jest.fn().mockResolvedValue([])},skillsService:{listForUser:jest.fn().mockResolvedValue([])},createAgentChatCompletionStream:jest.fn().mockImplementation(async()=>new Response('data: '+JSON.stringify({choices:[{delta:{content},finish_reason:reason}]})+'\n\ndata: [DONE]\n\n')),create:jest.fn()});
test('Agent AI generation disables thinking and returns actual generated configuration without persisting preview',async()=>{
 const s=fixture(JSON.stringify({name:'会议助手',description:'整理行动项',systemPrompt:'真实生成的提示词',toolNames:[],skillNames:[]}));
 const result=await s.generate('u',{model:'model',requirement:'整理会议',persist:false});expect(result.systemPrompt).toBe('真实生成的提示词');expect(s.create).not.toHaveBeenCalled();expect(s.createAgentChatCompletionStream.mock.calls[0][0].extra_body.enable_thinking).toBe(false);
});
test.each(['','not JSON','{}','null','[]','{"name":"invalid"}'])('invalid generated output %s is reported rather than replaced with a fake AI template',async content=>{
 const s=fixture(content);await expect(s.generate('u',{model:'model',requirement:'req',persist:true})).rejects.toThrow(/AI/);expect(s.create).not.toHaveBeenCalled();
});
test('truncated JSON is not accepted even when its prefix looks parseable',async()=>{
 const s=fixture('{"name":"partial","systemPrompt":"partial"}','length');await expect(s.generate('u',{model:'model',requirement:'req',persist:false})).rejects.toThrow(/截断/);
});
test.each(['error','premature'])('strict generation rejects %s stream results',async mode=>{
 const s=fixture('');s.createAgentChatCompletionStream.mockImplementation(async()=>new Response('data: '+JSON.stringify({choices:[{delta:{content:'{"name":"bad","systemPrompt":"bad"}'},finish_reason:mode==='error'?'error':null}]})+'\n\n'));
 await expect(s.generate('u',{model:'model',requirement:'req',persist:false})).rejects.toThrow();expect(s.create).not.toHaveBeenCalled();
});
