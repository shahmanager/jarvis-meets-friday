import test from 'node:test';
import assert from 'node:assert/strict';
import {completion,listModels} from '../src/providers';
import {harnessURL,modelRecipient,cancelHarness} from '../src/codex';

test('Codex provider uses a configured cloud harness, scoped session and measured usage',async t=>{
 let seen:any;
 t.mock.method(globalThis,'fetch',async(url:any,options:any)=>{seen={url,options,body:options.body?JSON.parse(options.body):null};return Response.json({model:'configured-model',choices:[{message:{role:'assistant',content:null,tool_calls:[{id:'cloud-call',type:'function',function:{name:'artifact_create',arguments:'{"name":"report.md","content":"Checked"}'}}]}}],usage:{total_tokens:23}});});
 const config={provider:'codex' as const,model:'configured-model',key:'bridge-auth-fixture',harnessUrl:'https://harness.example',harnessSession:'owner-task'};
 const result=await completion(config,[{role:'user',content:'Synthetic assignment'}],[]);assert.equal(result.usage.total_tokens,23);assert.equal(seen.url,'https://harness.example/v1/step');assert.equal(seen.body.session_id,'owner-task');assert.equal(seen.options.headers.Authorization,'Bearer bridge-auth-fixture');assert.equal(seen.body.key,undefined);
 await cancelHarness(config,'owner-task');assert.equal(seen.url,'https://harness.example/v1/cancel');assert.deepEqual(seen.body,{session_id:'owner-task'});
});
test('Cloud recipient snapshot includes endpoint but no key; model catalog comes from configured service',async t=>{
 const recipient=modelRecipient({provider:'codex',model:'configured',harnessUrl:'https://harness.example/'});assert.deepEqual(recipient,{provider:'codex',model:'configured',harnessUrl:'https://harness.example'});
 assert.throws(()=>harnessURL('http://remote.example'),/HTTPS/);assert.throws(()=>harnessURL('https://user:secret@example.com'),/HTTPS/);assert.throws(()=>harnessURL(),/Configure/);
 assert.deepEqual(modelRecipient({provider:'gemini',model:'existing'}),{provider:'gemini',model:'existing'});
 t.mock.method(globalThis,'fetch',async(url:any)=>{assert.equal(url,'https://harness.example/v1/models');return Response.json({data:[{id:'configured'}]});});assert.deepEqual(await listModels('codex','fixture','https://harness.example'),['configured']);
});

test('Codex tool checkpoint can explicitly defer usage, but final answers cannot',async t=>{
 let calls=true;
 t.mock.method(globalThis,'fetch',async()=>Response.json({choices:[{message:{role:'assistant',content:null,...(calls?{tool_calls:[{id:'pending',type:'function',function:{name:'artifact_create',arguments:'{}'}}]}:{})}}],usage:{total_tokens:null,deferred:true}}));
 const config={provider:'codex' as const,model:'fixture',key:'fixture',harnessUrl:'https://harness.example',harnessSession:'fixture'};
 assert.equal((await completion(config,[],[])).usage.total_tokens,null);calls=false;await assert.rejects(completion(config,[],[]),/valid token usage/);
});
