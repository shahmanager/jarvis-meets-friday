import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createBridge} from './bridge.mjs';
import {restrictedConfig} from './codex-rpc.mjs';

class FakeRpc extends EventEmitter{
 constructor(mode='tools'){super();this.mode=mode;this.responses=0;this.requests=[];}
 send(){}
 async request(method,params){this.requests.push({method,params});if(method==='thread/start')return {thread:{id:'cloud-thread'}};
  if(method==='turn/start')queueMicrotask(()=>{if(this.mode==='retry-notice')this.emit('message',{method:'error',params:{willRetry:true,error:{message:'Reconnecting'}}});if(this.mode==='bad-usage'){for(const totalTokens of [15,10])this.emit('message',{method:'thread/tokenUsage/updated',params:{tokenUsage:{total:{totalTokens}}}});return;}if(this.mode==='bad-arguments'){this.emit('message',{id:70,method:'item/tool/call',params:{threadId:'cloud-thread',callId:'cloud-call',tool:'office__artifact_create'}});return;}if(this.mode==='unknown'){this.emit('message',{method:'item/started',params:{item:{type:'futureHostCapability'}}});return;}this.emit('message',['tools','retry-notice'].includes(this.mode)?{id:70,method:'item/tool/call',params:{threadId:'cloud-thread',callId:'cloud-call',tool:'office__artifact_create',arguments:{name:'result.md',content:'Synthetic output.'}}}:{id:71,method:'item/commandExecution/requestApproval',params:{command:'forbidden'}});});return {};
 }
 respond(){this.responses++;queueMicrotask(()=>{this.emit('message',{method:'thread/tokenUsage/updated',params:{tokenUsage:{total:{totalTokens:25,inputTokens:20,outputTokens:5,cachedInputTokens:12}}}});this.emit('message',{method:'item/completed',params:{item:{type:'agentMessage',phase:'final_answer',text:'Artifact result checked.'}}});this.emit('message',{method:'turn/completed',params:{turn:{status:'completed'}}});});}
 reject(){this.rejected=true;}
 close(){this.emit('closed');}
}
const fixture={session_id:'fixture-task',model:'fixture-model',messages:[{role:'system',content:'Office scope.'},{role:'user',content:'Make a synthetic artifact.'}],tools:[{type:'function',function:{name:'artifact_create',description:'Create an artifact.',parameters:{type:'object',properties:{name:{type:'string'},content:{type:'string'}}}}}]};
test('Cloud Codex checkpoints tools, consumes results once, reports usage deltas and replays receipts after restart',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'cloud-codex-')),rpcs=[];const options={token:'fixture-token-24-characters-long',apiKey:'synthetic-only',baseUrl:'https://openrouter.ai/api/v1',models:['fixture-model'],stateDir:dir,rpcFactory:()=>{const rpc=new FakeRpc();rpcs.push(rpc);return rpc;}};
 let bridge=createBridge(options);
 try{
  const [first,same]=await Promise.all([bridge.step(fixture),bridge.step(fixture)]);assert.deepEqual(first,same);assert.equal(rpcs.length,1);assert.equal(first.usage.total_tokens,null);assert.equal(first.choices[0].message.tool_calls[0].function.name,'artifact_create');
  const startup=rpcs[0].requests.find(r=>r.method==='thread/start').params;assert.deepEqual(startup.environments,[]);assert.equal(startup.sandbox,'read-only');assert.ok(startup.dynamicTools.every(t=>t.name.startsWith('office__')));
  const next={...fixture,messages:[...fixture.messages,first.choices[0].message,{role:'tool',tool_call_id:'cloud-call',content:'{"artifact_id":"synthetic-receipt"}'}]};
  const final=await bridge.step(next);assert.equal(final.usage.total_tokens,25);assert.equal(final.usage.prompt_tokens,20);assert.equal(final.usage.completion_tokens,5);assert.equal(final.usage.prompt_tokens_details.cached_tokens,12);assert.deepEqual((await bridge.step(next)).usage,final.usage,'Receipt replay must not double-count cached usage');assert.match(final.choices[0].message.content,/checked/);assert.equal(rpcs[0].responses,1);assert.deepEqual(await bridge.step(next),final);assert.equal(rpcs[0].responses,1);
  await bridge.close();bridge=createBridge(options);assert.deepEqual(await bridge.step(next),final);assert.equal(rpcs.length,1,'Receipt replay must not start an agent');
  await assert.rejects(bridge.step({...next,messages:[...next.messages,{role:'user',content:'New observation after interruption'}]}),/session was interrupted/);assert.equal(rpcs.length,1,'Interrupted sessions must not silently restart and replay work');
 }finally{await bridge.close();await rm(dir,{recursive:true,force:true});}
});
test('Cloud Codex rejects native capabilities and unauthenticated gateway requests',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'cloud-codex-denial-'));let rpc;const bridge=createBridge({token:'fixture-token-24-characters-long',apiKey:'synthetic-only',baseUrl:'https://openrouter.ai/api/v1',models:['fixture-model'],stateDir:dir,rpcFactory:()=>rpc=new FakeRpc('native')});
 try{
  await assert.rejects(bridge.step(fixture),/Unexpected Codex capability/);assert.ok(rpc.rejected);
  await new Promise(r=>bridge.server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+bridge.server.address().port;
  assert.equal((await fetch(url+'/v1/models')).status,401);const r=await fetch(url+'/v1/models',{headers:{Authorization:'Bearer fixture-token-24-characters-long'}});assert.equal((await r.json()).data[0].id,'fixture-model');
  assert.equal(restrictedConfig['features.shell_tool'],false);assert.equal(restrictedConfig['features.apps'],false);assert.equal(restrictedConfig['features.hooks'],false);
 }finally{await bridge.close();await rm(dir,{recursive:true,force:true});}
});

test('Cloud Codex rejects unknown capabilities and private model endpoints',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'cloud-codex-unknown-'));
 const options={token:'fixture-token-24-characters-long',apiKey:'synthetic-only',baseUrl:'https://openrouter.ai/api/v1',models:['fixture-model'],stateDir:dir,rpcFactory:()=>new FakeRpc('unknown'),maxSessions:1};
 for(const baseUrl of ['https://127.0.0.1/v1','https://169.254.169.254/v1','https://openrouter.ai/api/v1?key=secret','https://other.example/v1'])assert.throws(()=>createBridge({...options,baseUrl}),/supported OpenAI or OpenRouter/);
 const bridge=createBridge(options);
 try{await assert.rejects(bridge.step(fixture),/unknown execution tool/);await assert.rejects(bridge.step({...fixture,session_id:'another-task'}),/unknown execution tool/,'Failure must release capacity');}
 finally{await bridge.close();await rm(dir,{recursive:true,force:true});}
});

test('Malformed tool arguments and decreasing usage counters stop the native session',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'cloud-codex-malformed-'));
 for(const mode of ['bad-usage','bad-arguments']){
  const bridge=createBridge({token:'fixture-token-24-characters-long',apiKey:'synthetic-only',baseUrl:'https://openrouter.ai/api/v1',models:['fixture-model'],stateDir:join(dir,mode),rpcFactory:()=>new FakeRpc(mode)});
  try{await assert.rejects(bridge.step(fixture),/valid cumulative token usage|tool batch exceeds limits/);}
  finally{await bridge.close();}
 }
 await rm(dir,{recursive:true,force:true});
});

test('Codex reconnect notices do not terminate a session before its tool checkpoint',async()=>{const dir=await mkdtemp(join(tmpdir(),'cloud-codex-reconnect-'));const bridge=createBridge({token:'fixture-token-24-characters-long',apiKey:'synthetic-only',baseUrl:'https://openrouter.ai/api/v1',models:['fixture-model'],stateDir:dir,rpcFactory:()=>new FakeRpc('retry-notice')});try{const first=await bridge.step(fixture);assert.equal(first.choices[0].message.tool_calls[0].function.name,'artifact_create');}finally{await bridge.close();await rm(dir,{recursive:true,force:true});}});

test('Missing cache counters stay unknown rather than inventing a zero cache hit',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'cloud-codex-usage-'));const rpc=new FakeRpc();rpc.respond=function(){this.responses++;queueMicrotask(()=>{this.emit('message',{method:'thread/tokenUsage/updated',params:{tokenUsage:{total:{totalTokens:25}}}});this.emit('message',{method:'turn/completed',params:{turn:{status:'completed'}}});});};
 const bridge=createBridge({token:'fixture-token-24-characters-long',apiKey:'synthetic-only',baseUrl:'https://openrouter.ai/api/v1',models:['fixture-model'],stateDir:dir,rpcFactory:()=>rpc});
 try{const first=await bridge.step(fixture);const final=await bridge.step({...fixture,messages:[...fixture.messages,first.choices[0].message,{role:'tool',tool_call_id:'cloud-call',content:'{}'}]});assert.equal(final.usage.total_tokens,25);assert.equal(final.usage.prompt_tokens_details,undefined);}
 finally{await bridge.close();await rm(dir,{recursive:true,force:true});}
});
