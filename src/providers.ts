import {bounded,HttpError,text} from './security';
export const providers={openrouter:{label:'OpenRouter',url:'https://openrouter.ai/api/v1/chat/completions',models:'https://openrouter.ai/api/v1/models'},nvidia:{label:'NVIDIA',url:'https://integrate.api.nvidia.com/v1/chat/completions',models:'https://integrate.api.nvidia.com/v1/models'},gemini:{label:'Gemini',url:'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',models:'https://generativelanguage.googleapis.com/v1beta/openai/models'}};
export type Provider=keyof typeof providers;
export interface ToolCall {id:string;type:'function';function:{name:string;arguments:string}}
export interface Message {role:'system'|'user'|'assistant'|'tool';content:string|null|({type:'text';text:string}|{type:'image_url';image_url:{url:string;detail:'low'}})[];tool_calls?:ToolCall[];tool_call_id?:string}
export interface ModelConfig {provider:Provider;model:string;key?:string}
export function provider(value:unknown):Provider {if(typeof value!=='string'||!Object.hasOwn(providers,value))throw new HttpError(400,'Unknown provider.');return value as Provider;}
export async function completion(config:ModelConfig,messages:Message[],tools:unknown[],signal?:AbortSignal){
 if(!config.key)throw new HttpError(409,'Configure a provider API key in Settings.');
 const response=await fetch(providers[config.provider].url,{method:'POST',headers:{Authorization:`Bearer ${config.key}`,'Content-Type':'application/json','HTTP-Referer':'https://relay-agent.example','X-Title':'Relay Computer Agent'},body:JSON.stringify({model:config.model,messages,tools:tools.length?tools:undefined,tool_choice:tools.length?'auto':undefined,max_tokens:1800,stream:false}),signal:signal??AbortSignal.timeout(90000)});
 const raw=await bounded(response,2000000);if(!response.ok)throw new HttpError(502,`Model provider returned HTTP ${response.status}. Check key, model, quota, and tool support.`);
 const parsed=JSON.parse(raw) as {choices?:{message?:Omit<Message,'content'>&{content:string|null}}[],usage?:{prompt_tokens?:number;completion_tokens?:number;total_tokens?:number}};
 const message=parsed.choices?.[0]?.message;if(!message||message.role!=='assistant')throw new HttpError(502,'Provider returned no assistant message.');
 if(message.content!==null&&typeof message.content!=='string')throw new HttpError(502,'Unsupported model response format.');
 if(message.tool_calls&&(!Array.isArray(message.tool_calls)||message.tool_calls.length>8))throw new HttpError(502,'Too many tool calls.');
 for(const call of message.tool_calls??[]){text(call.id,200);text(call.function?.name,100);text(call.function?.arguments,20000);}
 const usage=parsed.usage,counts=[usage?.total_tokens,usage?.prompt_tokens,usage?.completion_tokens].filter(n=>n!==undefined);
 if(!usage||!counts.length||counts.some(n=>!Number.isSafeInteger(n)||n!<0)||(usage.total_tokens===undefined&&(usage.prompt_tokens===undefined||usage.completion_tokens===undefined)))throw new HttpError(502,'Provider did not report valid token usage. Further calls stopped because the task budget cannot be tracked.');
 return {message,usage:{...usage,total_tokens:usage.total_tokens??usage.prompt_tokens!+usage.completion_tokens!}};
}
export async function listModels(p:Provider,key?:string){const r=await fetch(providers[p].models,{headers:key?{Authorization:`Bearer ${key}`}:{},signal:AbortSignal.timeout(15000)});if(!r.ok)throw new HttpError(502,`Models endpoint returned ${r.status}. Enter a model ID manually.`);const result=JSON.parse(await bounded(r,3000000)) as {data?:{id:string}[]};return (result.data??[]).map(x=>x.id).filter(x=>typeof x==='string').sort();}
