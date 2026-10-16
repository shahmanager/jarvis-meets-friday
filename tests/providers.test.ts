import test from 'node:test';
import assert from 'node:assert/strict';
import {completion,ModelBusy} from '../src/providers';
const config={provider:'openrouter' as const,model:'test-only',key:'test-key'};
test('Rate limits honor bounded Retry-After and HTTP-200 upstream errors trigger backoff',async t=>{
 t.mock.method(globalThis,'fetch',async()=>new Response('{}',{status:429,headers:{'Retry-After':'1'}}));
 await assert.rejects(completion(config,[],[]),e=>e instanceof ModelBusy&&e.retryMs===1000);t.mock.restoreAll();
 t.mock.method(globalThis,'fetch',async()=>Response.json({error:{code:503}}));await assert.rejects(completion(config,[],[]),ModelBusy);
});
test('Duplicate provider call IDs are rejected before any parallel tool executes',async t=>{
 const call={id:'duplicate',type:'function',function:{name:'web_read',arguments:'{}'}};
 t.mock.method(globalThis,'fetch',async()=>Response.json({choices:[{message:{role:'assistant',content:null,tool_calls:[call,call]}}],usage:{total_tokens:20}}));
 await assert.rejects(completion(config,[],[]),/duplicate tool call IDs/);
});
test('provider token accounting rejects missing, negative and string counts',async t=>{
 for(const usage of [undefined,{total_tokens:-1},{total_tokens:'100'},{prompt_tokens:100}]){
  t.mock.method(globalThis,'fetch',async()=>Response.json({choices:[{message:{role:'assistant',content:'test'}}],usage}));
  await assert.rejects(completion(config,[],[]),/token usage/);t.mock.restoreAll();
 }
});
test('split usage is normalized without inventing measured tokens',async t=>{
 t.mock.method(globalThis,'fetch',async()=>Response.json({choices:[{message:{role:'assistant',content:'test'}}],usage:{prompt_tokens:12,completion_tokens:3}}));
 assert.equal((await completion(config,[],[])).usage.total_tokens,15);
});

test('Valid tool-only provider messages may omit content',async t=>{
 t.mock.method(globalThis,'fetch',async()=>Response.json({model:'gemini-fixture',choices:[{message:{role:'assistant',tool_calls:[{id:'tool-only',type:'function',function:{name:'artifact_create',arguments:'{"name":"report.html","content":"<h1>Report</h1>"}'}}]}}],usage:{total_tokens:20}}));
 const result=await completion(config,[],[]);assert.equal(result.message.content,null);assert.equal(result.message.tool_calls?.[0].function.name,'artifact_create');assert.equal(result.model,'gemini-fixture');
});

test('Provider timeout and network errors report their cause without exposing raw request details',async t=>{
 for(const [error,expected]of [[new DOMException('raw details','TimeoutError'),/Model request timed out/],[new TypeError('secret URL or token'),/Model network request failed/]] as const){
  t.mock.method(globalThis,'fetch',async()=>{throw error;});await assert.rejects(completion(config,[],[]),expected);t.mock.restoreAll();
 }
});
