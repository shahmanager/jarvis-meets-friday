import {bounded,HttpError} from './security';
import type {Message,ModelConfig} from './providers';

declare global {interface Env{CODEX_HARNESS_URL?:string;CODEX_HARNESS_TOKEN?:string;}}
export function harnessURL(value?:string){
 if(!value)throw new HttpError(409,'Configure the cloud CODEX_HARNESS_URL before selecting Codex.');
 let url:URL;try{url=new URL(value);}catch{throw new HttpError(400,'Invalid cloud harness URL.');}
 if(url.username||url.password||url.search||url.hash||url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw new HttpError(400,'Cloud harness requires HTTPS; HTTP is only supported for loopback tests.');
 return url.href.replace(/\/$/,'');
}
export async function codexCompletion(config:ModelConfig,messages:Message[],tools:unknown[],signal?:AbortSignal){
 const endpoint=harnessURL(config.harnessUrl);if(!config.harnessSession)throw new HttpError(409,'Codex requires a task-scoped harness session.');
 const response=await fetch(endpoint+'/v1/step',{method:'POST',headers:{Authorization:'Bearer '+config.key,'Content-Type':'application/json'},body:JSON.stringify({session_id:config.harnessSession,model:config.model,messages,tools}),signal:signal??AbortSignal.timeout(80000)});
 const raw=await bounded(response,2000000);if(!response.ok){let detail='';try{const error=JSON.parse(raw).error;if(typeof error==='string'&&/^(Cloud |Codex |A built-in|Unexpected Codex|Harness request|No matching tool|Model changed)/.test(error))detail=error.slice(0,240);}catch{}throw new HttpError(response.status===409?409:502,detail||`Cloud Codex harness returned HTTP ${response.status}. Check service, model access and capacity.`);}
 return JSON.parse(raw);
}
export const modelRecipient=(c:Pick<ModelConfig,'provider'|'model'|'harnessUrl'>)=>({provider:c.provider,model:c.model,...(c.provider==='codex'?{harnessUrl:harnessURL(c.harnessUrl)}:{})});
export async function cancelHarness(config:ModelConfig,taskId:string){
 if(config.provider!=='codex'||!config.key)return;
 const r=await fetch(harnessURL(config.harnessUrl)+'/v1/cancel',{method:'POST',headers:{Authorization:'Bearer '+config.key,'Content-Type':'application/json'},body:JSON.stringify({session_id:taskId}),signal:AbortSignal.timeout(10000)});if(!r.ok)throw new HttpError(502,'Cloud harness cancellation could not be confirmed.');
}
