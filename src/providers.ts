import {bounded,HttpError,text} from './security';
import {codexCompletion,harnessURL} from './codex';
export const providers={codex:{label:'Codex cloud harness',url:'',models:''},openrouter:{label:'OpenRouter',url:'https://openrouter.ai/api/v1/chat/completions',models:'https://openrouter.ai/api/v1/models'},nvidia:{label:'NVIDIA',url:'https://integrate.api.nvidia.com/v1/chat/completions',models:'https://integrate.api.nvidia.com/v1/models'},gemini:{label:'Gemini',url:'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',models:'https://generativelanguage.googleapis.com/v1beta/openai/models'}};
export type Provider=keyof typeof providers;
export interface ToolCall {id:string;type:'function';function:{name:string;arguments:string}}
export interface Message {role:'system'|'user'|'assistant'|'tool';content:string|null|({type:'text';text:string}|{type:'image_url';image_url:{url:string;detail:'low'}})[];tool_calls?:ToolCall[];tool_call_id?:string}
export interface ModelConfig {provider:Provider;model:string;key?:string;harnessUrl?:string;harnessSession?:string}
export class ModelBusy extends HttpError{constructor(public retryMs:number){super(503,'Model temporarily busy or rate-limited. Retrying with backoff.');}}
let imageModels:{expires:number;ids:Set<string>}|undefined;
export async function modelMessages(config:ModelConfig,messages:Message[]):Promise<Message[]>{
 if(config.provider!=='openrouter'||!messages.some(m=>Array.isArray(m.content)&&m.content.some(p=>p.type==='image_url')))return messages;
 if(!imageModels||imageModels.expires<Date.now()){
  try{const r=await fetch(providers.openrouter.models,{signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error('Catalog unavailable');const catalog=JSON.parse(await bounded(r,3000000)) as {data:{id:string;architecture?:{input_modalities?:string[]}}[]};imageModels={expires:Date.now()+900000,ids:new Set(catalog.data.filter(m=>m.architecture?.input_modalities?.includes('image')).map(m=>m.id))};}catch{return withoutImages(messages);}
 }
 return imageModels.ids.has(config.model)?messages:withoutImages(messages);
}
function withoutImages(messages:Message[]):Message[]{return messages.map(m=>Array.isArray(m.content)?{...m,content:m.content.map(p=>p.type==='text'?p.text:'[Screenshot retained as a downloadable artifact. This model accepts text only; use browser read/elements for page evidence.]').join('\n')}:m);}
export function provider(value:unknown):Provider {if(typeof value!=='string'||!Object.hasOwn(providers,value))throw new HttpError(400,'Unknown provider.');return value as Provider;}
export async function completion(config:ModelConfig,messages:Message[],tools:unknown[],signal?:AbortSignal){
 if(!config.key)throw new HttpError(409,'Configure a provider API key in Settings.');
 messages=await modelMessages(config,messages);
 let response:Response,raw:string;try{if(config.provider==='codex'){raw=JSON.stringify(await codexCompletion(config,messages,tools,signal));response=new Response(raw);}else{response=await fetch(providers[config.provider].url,{method:'POST',headers:{Authorization:`Bearer ${config.key}`,'Content-Type':'application/json','HTTP-Referer':'https://relay-agent.example','X-Title':'Relay Computer Agent'},body:JSON.stringify({model:config.model,messages,tools:tools.length?tools:undefined,tool_choice:tools.length?'auto':undefined,parallel_tool_calls:true,stream:false}),signal:signal??AbortSignal.timeout(90000)});
 raw=await bounded(response,2000000);}}catch(e){if(e instanceof HttpError)throw e;const timedOut=e instanceof Error&&['TimeoutError','AbortError'].includes(e.name);throw new HttpError(timedOut?504:502,timedOut?'Model request timed out. Provider did not finish within the request deadline.':'Model network request failed. Check provider availability.');}if([429,503,529].includes(response.status)){const retry=Number(response.headers.get('retry-after'));throw new ModelBusy(Number.isFinite(retry)&&retry>0?Math.min(300000,Math.max(1000,retry*1000)):30000);}if(!response.ok)throw new HttpError(502,`Model provider returned HTTP ${response.status}. Check key, model, quota, and tool support.`);
 const parsed=JSON.parse(raw) as {model?:unknown;error?:{code?:number};choices?:{message?:Omit<Message,'content'>&{content:string|null}}[],usage?:{prompt_tokens?:number;completion_tokens?:number;total_tokens?:number|null;deferred?:boolean}};
 if(parsed.error){if([429,502,503,529].includes(Number(parsed.error.code)))throw new ModelBusy(30000);throw new HttpError(502,'Model provider returned an upstream error. Check selected model and quota.');}
 const message=parsed.choices?.[0]?.message;if(!message||message.role!=='assistant')throw new HttpError(502,'Provider returned no assistant message.');
 if(message.content===undefined)message.content=null;
 if(message.content!==null&&typeof message.content!=='string')throw new HttpError(502,'Unsupported model response format.');
 if(message.tool_calls&&(!Array.isArray(message.tool_calls)||message.tool_calls.length>8))throw new HttpError(502,'Too many tool calls.');
 const callIds=new Set<string>();for(const call of message.tool_calls??[]){text(call.id,200);if(call.type!=='function'||!call.id||callIds.has(call.id))throw new HttpError(502,'Provider returned invalid or duplicate tool call IDs.');callIds.add(call.id);text(call.function?.name,100);text(call.function?.arguments,140000);}
 const usage=parsed.usage;
 if(config.provider==='codex'&&usage?.deferred===true&&usage.total_tokens===null&&message.tool_calls?.length)return {message,model:config.model,usage:{total_tokens:null,deferred:true}};
 const counts=[usage?.total_tokens,usage?.prompt_tokens,usage?.completion_tokens].filter(n=>n!==undefined);
 if(!usage||!counts.length||counts.some(n=>!Number.isSafeInteger(n)||n!<0)||(usage.total_tokens===undefined&&(usage.prompt_tokens===undefined||usage.completion_tokens===undefined)))throw new HttpError(502,'Provider did not report valid token usage. Further calls stopped because the task budget cannot be tracked.');
 return {message,model:typeof parsed.model==='string'?parsed.model.slice(0,200):config.model,usage:{...usage,total_tokens:usage.total_tokens??usage.prompt_tokens!+usage.completion_tokens!}};
}
export async function listModels(p:Provider,key?:string,harnessUrl?:string){const r=await fetch(p==='codex'?harnessURL(harnessUrl)+'/v1/models':providers[p].models,{headers:key?{Authorization:`Bearer ${key}`}:{},signal:AbortSignal.timeout(15000)});if(!r.ok)throw new HttpError(502,`Models endpoint returned ${r.status}. Enter a model ID manually.`);const result=JSON.parse(await bounded(r,3000000)) as {data?:{id:string}[]};return (result.data??[]).map(x=>x.id).filter(x=>typeof x==='string').sort();}
