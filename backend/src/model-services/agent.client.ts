import { Injectable } from '@nestjs/common';
import { createHash, createHmac, randomBytes } from 'crypto';
import { lookup } from 'dns/promises';
import * as http from 'http';
import * as https from 'https';
import { unseal } from '../workflows/runtime/persistence-codec';
import { NodeRow } from './model.types';
import { LOCAL_AGENT_URL } from './local-node-bootstrap';

export function validateAgentUrl(value: string, administratorApproved = false): URL {
  const url = new URL(value);
  const hosts = (process.env.MODEL_AGENT_ALLOWED_HOSTS || '127.0.0.1,localhost,host.docker.internal').split(',').map(s=>s.trim().toLowerCase());
  const builtIn = url.href === LOCAL_AGENT_URL + '/';
  if ((!builtIn && !hosts.includes(url.hostname.toLowerCase()) && !(administratorApproved && url.protocol === 'https:')) || !['https:','http:'].includes(url.protocol) || url.username || url.password
    || url.search || url.hash || !['','/'].includes(url.pathname)) throw new Error('Agent URL is not in the configured node allowlist');
  if (url.protocol === 'http:' && !builtIn && !['127.0.0.1','localhost','host.docker.internal'].includes(url.hostname)) throw new Error('Remote Agent requires HTTPS');
  return url;
}
@Injectable()
export class AgentClient {
  async request<T>(node: NodeRow, method: 'GET'|'POST', route: string, payload?: unknown): Promise<T> {
    // URLs come only from administrator-approved registration or persisted model_nodes,
    // never a regular user's inference request. Approval lives in MySQL, not a hand-edited .env.
    const base=validateAgentUrl(node.base_url,true);
    if (!/^\/v1\/[a-z0-9/-]+$/.test(route)) throw new Error('Invalid Agent route');
    const address=await lookup(base.hostname); // Resolve once and pin the actual connect address; never follow redirects.
    if (/^(169\.254\.|0\.|127\.)/.test(address.address) && base.protocol==='https:' && !['localhost','127.0.0.1'].includes(base.hostname)) throw new Error('Invalid remote Agent address');
    if (/^(fe80:|::ffff:169\.254\.)/i.test(address.address)) throw new Error('Invalid remote Agent address');
    const body=payload===undefined?'':JSON.stringify(payload), stamp=String(Date.now()),nonce=randomBytes(16).toString('hex');
    const token=unseal<string>(node.token_cipher);
    const signature=createHmac('sha256',token).update([method,route,stamp,nonce,createHash('sha256').update(body).digest('hex')].join('\n')).digest('hex');
    return new Promise<T>((resolve,reject)=>{
      const transport=base.protocol==='https:'?https:http;
      const req=transport.request(new URL(route,base),{method,timeout:method==='GET'?10000:65000,family:address.family,lookup:(_host,_options,cb)=>cb(null,address.address,address.family),
        headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body),'x-agent-id':node.id,
          'x-agent-time':stamp,'x-agent-nonce':nonce,'x-agent-signature':signature}},res=>{
        let size=0;const chunks:Buffer[]=[];
        res.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>8*1024*1024)res.destroy(new Error('Agent response exceeds limit'));else chunks.push(chunk);});
        res.on('error',()=>reject(new Error('Node transport failed')));
        res.on('end',()=>{try{const value=JSON.parse(Buffer.concat(chunks).toString('utf8')) as {data:T;error?:string};
          if(res.statusCode!==200)reject(new Error(value.error?.slice(0,500)||'Agent operation failed'));else resolve(value.data);
        }catch{reject(new Error('Invalid Agent response'));}});
      });
      req.on('timeout',()=>req.destroy(new Error('Node request timeout')));
      req.on('error',()=>reject(new Error('Node transport failed')));req.end(body);
    });
  }
}
