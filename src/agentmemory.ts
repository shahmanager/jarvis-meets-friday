import {HttpError,bounded,object,text} from './security';
import type {Memory,Store} from './persistence';
declare global {interface Env {AGENTMEMORY_URL?:string;AGENTMEMORY_SECRET?:string}}
export async function memoryService(env:Env,path:string,body?:unknown){
 if(!env.AGENTMEMORY_URL||!env.AGENTMEMORY_SECRET)throw new HttpError(409,'AgentMemory service is not connected.');
 const base=new URL(env.AGENTMEMORY_URL);if(base.protocol!=='https:'&&!(base.protocol==='http:'&&['127.0.0.1','localhost'].includes(base.hostname)))throw new HttpError(409,'AgentMemory needs HTTPS or a local loopback URL.');
 const r=await fetch(base.origin+'/agentmemory/'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+env.AGENTMEMORY_SECRET,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});const data=object(JSON.parse(await bounded(r,500000)));if(!r.ok)throw new HttpError(502,'AgentMemory request failed.');return data;
}
export async function indexedRecall(env:Env,store:Store,query:string){const data=await memoryService(env,'search',{query:text(query,500),agentId:'dual-agent',limit:8}),found:Memory[]=[];for(const hit of Array.isArray(data.results)?data.results:[]){const match=JSON.stringify(hit).match(/Dual Agent memory ([a-f0-9-]{36})/);if(!match)continue;const memory=store.get<Memory>('memory:'+match[1]);if(memory&&!found.some(m=>m.id===memory.id))found.push(memory);}return found;}
