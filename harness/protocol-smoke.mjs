// Run in CI/cloud with the pinned Codex CLI. Provider is a synthetic local Responses server, never a real model.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createBridge} from './bridge.mjs';
import {CodexRpc} from './codex-rpc.mjs';

let calls=0;
const provider=createServer(async(req,res)=>{
 try{
  let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw);calls++;console.log("Synthetic Responses request",calls);
  assert.ok(!JSON.stringify(body.tools).includes('exec_command'),'Native host execution must be disabled');
  const finished=JSON.stringify(body.input).includes('fixture-artifact-receipt');
  const item=finished?{type:'message',id:'msg-fixture',role:'assistant',status:'completed',content:[{type:'output_text',text:'Verified fixture-artifact-receipt.',annotations:[]}]}:{type:'function_call',id:'fc-fixture',call_id:'fixture-cloud-call',name:'office__artifact_create',arguments:JSON.stringify({name:'fixture.md',content:'Synthetic artifact.'}),status:'completed'};
  const response={id:'resp-fixture-'+calls,object:'response',created_at:1,status:'completed',model:'gpt-6.1-sol',output:[item],usage:{input_tokens:10,output_tokens:5,total_tokens:15}};
  res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache'});
  const event=(type,data)=>res.write('event: '+type+'\ndata: '+JSON.stringify({type,...data})+'\n\n');
  event('response.created',{response:{...response,status:'in_progress',output:[]}});
  event('response.output_item.added',{output_index:0,item:finished?{...item,content:[],status:'in_progress'}:{...item,arguments:'',status:'in_progress'}});
  if(finished){event('response.content_part.added',{item_id:item.id,output_index:0,content_index:0,part:{type:'output_text',text:'',annotations:[]}});event('response.output_text.delta',{item_id:item.id,output_index:0,content_index:0,delta:item.content[0].text});event('response.output_text.done',{item_id:item.id,output_index:0,content_index:0,text:item.content[0].text});}
  else{event('response.function_call_arguments.delta',{item_id:item.id,output_index:0,delta:item.arguments});event('response.function_call_arguments.done',{item_id:item.id,output_index:0,arguments:item.arguments});}
  event('response.output_item.done',{output_index:0,item});event('response.completed',{response});res.end();
 }catch(e){console.error('Synthetic provider error:',e.message);res.writeHead(500);res.end('Synthetic provider validation failed.');}
});
await new Promise(r=>provider.listen(0,'127.0.0.1',r));
const dir=await mkdtemp(join(tmpdir(),'codex-cloud-protocol-'));
const bridge=createBridge({token:'synthetic-bridge-token-long-enough',apiKey:'synthetic-provider-key',baseUrl:'http://127.0.0.1:'+provider.address().port+'/v1',models:['gpt-6.1-sol'],stateDir:dir,testOnlyAllowLoopback:true,rpcFactory:options=>{const rpc=new CodexRpc(options);rpc.on('message',m=>console.log('Synthetic RPC event',m.method,m.params?.item?.type??'',JSON.stringify(m.params?.tokenUsage??'')));rpc.on('diagnostic',line=>process.stderr.write('[Synthetic cloud fixture] '+line));return rpc;}});
try{
 const input={session_id:'cloud-ci-fixture',model:'gpt-6.1-sol',messages:[{role:'system',content:'Use artifact_create to create fixture.md, then verify its returned receipt. Do not use any other tools.'},{role:'user',content:'Create the synthetic fixture artifact.'}],tools:[{type:'function',function:{name:'artifact_create',description:'Create a synthetic text artifact.',parameters:{type:'object',properties:{name:{type:'string'},content:{type:'string'}},required:['name','content'],additionalProperties:false}}}]};
 const first=await bridge.step(input);assert.equal(first.choices[0].message.tool_calls[0].function.name,'artifact_create');assert.equal(first.usage.total_tokens,null);
 const result=await bridge.step({...input,messages:[...input.messages,first.choices[0].message,{role:'tool',tool_call_id:'fixture-cloud-call',content:'{"artifact_id":"fixture-artifact-receipt"}'}]});
 assert.match(result.choices[0].message.content,/Verified/);assert.equal(result.usage.total_tokens,30);assert.equal(calls,2);
 console.log('PASS: real Codex app-server in cloud CI, dynamic tool pause/resume, final output and measured usage. Responses backend was a synthetic fixture; no live inference or laptop credentials.');
}finally{await bridge.close();await new Promise(r=>provider.close(r));await rm(dir,{recursive:true,force:true});}
