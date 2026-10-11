const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');
function sign(key, method, route, timestamp, nonce, body) {
  return crypto.createHmac('sha256',key).update([method,route,timestamp,nonce,crypto.createHash('sha256').update(body).digest('hex')].join('\n')).digest('hex');
}
class RequestVerifier {
  constructor(key) { if (!key || key.length<32) throw Error('AGENT_TOKEN requires at least 32 characters'); this.key=key;this.nonces=new Map(); }
  verify(method,route,headers,body) {
    const stamp=String(headers['x-agent-time']||''), nonce=String(headers['x-agent-nonce']||''), signature=String(headers['x-agent-signature']||'');
    const now=Date.now();
    if (!/^\d{13}$/.test(stamp)||Math.abs(now-Number(stamp))>30000||!/^[a-f0-9]{32}$/.test(nonce)||!/^[a-f0-9]{64}$/.test(signature)||this.nonces.has(nonce)) throw Error('Agent authentication failed');
    const expected=sign(this.key,method,route,stamp,nonce,body);
    if(!crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(signature)))throw Error('Agent authentication failed');
    for(const [n,expires]of this.nonces)if(expires<now)this.nonces.delete(n);
    if(this.nonces.size>10000)throw Error('Agent request capacity exceeded');
    this.nonces.set(nonce,now+60000);
  }
}
function id(value) { if(typeof value!=='string'||! /^[a-f0-9-]{36}$/.test(value))throw Error('Invalid managed ID');return value; }
function inside(root,...parts) {
  const base=path.resolve(root),target=path.resolve(base,...parts),relative=path.relative(base,target);
  if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw Error('Invalid managed path');
  let cursor=target;
  while(cursor!==base){if(fs.existsSync(cursor)&&fs.lstatSync(cursor).isSymbolicLink())throw Error('Linked managed path');cursor=path.dirname(cursor);}
  return target;
}
function safeError(error) { const text=error?.message||'Model operation failed';return /^(Invalid|Unsupported|Insufficient|Incompatible|GPU|CUDA|MLX|Metal|Model|Cache|Download|Agent|Managed|Docker|Native|Task|Health|Node|Missing|Apple)/.test(text)?text.slice(0,500).replace(/https?:\/\/\S+/g,'[endpoint]'):'Model operation failed; inspect node diagnostics'; }
module.exports={sign,RequestVerifier,id,inside,safeError};
