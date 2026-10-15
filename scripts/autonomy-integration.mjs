import assert from 'node:assert/strict';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';

const persist=await mkdtemp(join(tmpdir(),'dual-agent-autonomy-'));
const password='autonomy-integration-password-long-enough';
let cookie='',mf,parallelNow=0,parallelPeak=0,executorReads=0,mcpExpired=false,mcpSessionCounter=0,mcpValidSession='',mcpToolCalls=0,mcpWriteCalls=0,mcpConnectorId='',transientBusyCalls=0,modelCalls=[];
const settings={main:{provider:'openrouter',model:'main'},steward:{provider:'openrouter',model:'small'},preferences:{teamReview:false,memory:'builtin',readConcurrency:2}};
const toolCall=(id,name,args)=>({id,type:'function',function:{name,arguments:JSON.stringify(args)}});
const rpc=(id,result,headers={})=>Response.json({jsonrpc:'2.0',id,result},{headers});
const options={modules:true,scriptPath:'work/build/index.js',compatibilityDate:'2026-10-12',compatibilityFlags:['nodejs_compat'],durableObjects:{RELAY:{className:'Relay',useSQLite:true}},resourcePersistencePath:persist,bindings:{ADMIN_PASSWORD:password,OPENROUTER_API_KEY:'stub',EXECUTOR_URL:'https://executor.example.com',EXECUTOR_SECRET:'executor-stub-secret',APP_URL:'https://office.example.com'},outboundService:async request=>{
 const u=new URL(request.url);
 if(u.hostname==='openrouter.ai'){
  const input=await request.json(),messages=input.messages,latestTool=messages.findLast(m=>m.role==='tool'),prompt=messages.findLast(m=>m.role==='user')?.content??'';
  modelCalls.push({model:input.model,prompt,tools:input.tools??[]});
  if(prompt.includes('transient model busy')&&transientBusyCalls++===0)return Response.json({error:{message:'rate limited'}},{status:429,headers:{'retry-after':'1'}});
  let message;
  if(prompt.includes('opaque memory discovery')&&!latestTool)message={role:'assistant',content:'',tool_calls:[toolCall('opaque-recall','memory_search',{query:'memoryHandleFixture'})]};
  else if(prompt.includes('opaque memory discovery'))message={role:'assistant',content:'Found handles only.'};
  else if(prompt.includes('empty memory delegation')&&!latestTool)message={role:'assistant',content:'',tool_calls:[toolCall('empty-recall','memory_search',{query:'unique-no-memory-hit-fixture'})]};
  else if(prompt.includes('empty memory delegation')&&latestTool?.tool_call_id==='empty-recall')message={role:'assistant',content:'',tool_calls:[toolCall('public-delegate','delegate_task',{prompt:'Friday context note flow'})]};
  else if(prompt.includes('empty memory delegation'))message={role:'assistant',content:'Public delegation succeeded without a false privacy approval.'};
  else if(prompt.includes('artifact recovery')&&!latestTool)message={role:'assistant',content:'',tool_calls:[toolCall('bad-artifact','artifact_create',{name:'report',content:'Synthetic report'})]};
  else if(prompt.includes('artifact recovery')&&latestTool?.tool_call_id==='bad-artifact')message={role:'assistant',content:'',tool_calls:[toolCall('fixed-artifact','artifact_create',{name:'report.md',content:'Synthetic report'})]};
  else if(prompt.includes('artifact recovery'))message={role:'assistant',content:'Corrected artifact name.'};
  else if(prompt.includes('denied schedule flow')&&!latestTool)message={role:'assistant',content:'',tool_calls:[toolCall('deny-schedule','schedule_task',{name:'Synthetic scheduled work',prompt:'Synthetic',run_at:new Date(Date.now()+86400000).toISOString()})]};
  else if(prompt.includes('denied schedule flow'))message={role:'assistant',content:'Owner declined; no action taken.'};
  else if(prompt.includes('duplicate read ids')&&!latestTool)message={role:'assistant',content:'',tool_calls:[toolCall('duplicate-id','web_read',{url:'https://example.com/one'}),toolCall('duplicate-id','web_read',{url:'https://example.com/two'})]};
  else if(prompt.includes('parallel public reads')&&!latestTool)message={role:'assistant',content:'',tool_calls:[toolCall('read-1','web_read',{url:'https://example.com/one'}),toolCall('read-2','web_read',{url:'https://example.com/two'})]};
  else if(prompt.includes('parent delegation flow')&&latestTool&&latestTool.content.includes('"result"'))message={role:'assistant',content:'Friday result checked; task complete.'};
  else if(prompt.includes('parent delegation flow')&&latestTool&&latestTool.content.includes('"status":"completed"')){
   const result=JSON.parse(latestTool.content);message={role:'assistant',content:'',tool_calls:[toolCall('result-1','teammate_result',{task_id:result.task_id})]};
  }else if(prompt.includes('parent delegation flow')&&latestTool&&latestTool.content.includes('task_id')){
   const result=JSON.parse(latestTool.content);message={role:'assistant',content:'',tool_calls:[toolCall('wait-1','wait_for_teammate',{task_id:result.task_id})]};
  }
  else if(prompt.includes('parent delegation flow'))message={role:'assistant',content:'',tool_calls:[toolCall('delegate-1','delegate_task',{prompt:'Friday context note flow'})]};
  else if(prompt.includes('Friday context note flow')&&!latestTool)message={role:'assistant',content:'',tool_calls:[toolCall('note-1','context_note',{notes:'Synthetic Friday progress.'})]};
  else if(prompt.includes('Friday context note flow'))message={role:'assistant',content:'Friday finished synthetic context work.'};
  else if(prompt.includes('cancel parent flow')&&latestTool&&latestTool.content.includes('task_id')){const result=JSON.parse(latestTool.content);message={role:'assistant',content:'',tool_calls:[toolCall('cancel-wait','wait_for_teammate',{task_id:result.task_id})]};}
  else if(prompt.includes('cancel parent flow'))message={role:'assistant',content:'',tool_calls:[toolCall('cancel-delegate','delegate_task',{prompt:'Friday long running child'})]};
  else if(prompt.includes('Friday long running child')){await sleep(350);message={role:'assistant',content:'Child finished.'};}
  else if(prompt.includes('MCP role deny')&&!latestTool)message={role:'assistant',content:'',tool_calls:[toolCall('mcp-deny',`mcp_${mcpConnectorId.slice(0,8)}_read`,{})]};
  else if(prompt.includes('MCP selected read')&&!latestTool)message={role:'assistant',content:'',tool_calls:[toolCall('mcp-call',`mcp_${mcpConnectorId.slice(0,8)}_read`,{})]};
  else if(prompt.includes('MCP expired call')&&!latestTool)message={role:'assistant',content:'',tool_calls:[toolCall('mcp-expired',`mcp_${mcpConnectorId.slice(0,8)}_read`,{})]};
  else if(prompt.includes('MCP expired write')&&!latestTool)message={role:'assistant',content:'',tool_calls:[toolCall('mcp-write',`mcp_${mcpConnectorId.slice(0,8)}_write`,{value:'synthetic'})]};
  else if(prompt.includes('MCP revoked call')&&!latestTool)message={role:'assistant',content:'',tool_calls:[toolCall('mcp-revoked',`mcp_${mcpConnectorId.slice(0,8)}_read`,{})]};
  else if(latestTool)message={role:'assistant',content:'Synthetic task complete.'};
  else message={role:'assistant',content:'Synthetic task complete.'};
  return Response.json({choices:[{message}],usage:{total_tokens:10}});
 }
 if(u.hostname==='executor.example.com'){
  const body=await request.json();if(body.operation==='cancel')return Response.json({ok:true});
  if(body.operation==='web_read'){
   executorReads++;parallelNow++;parallelPeak=Math.max(parallelPeak,parallelNow);await sleep(body.args.url.endsWith('/one')?150:20);parallelNow--;return Response.json({url:body.args.url,content:'Synthetic public page.'});
  }
  return Response.json({error:'unexpected executor operation'},{status:400});
 }
 if(u.hostname==='mcp.example.com'){
  const body=await request.json();
  if(body.method==='initialize'){mcpValidSession='fixture-session-'+(++mcpSessionCounter);return rpc(body.id,{protocolVersion:'2025-11-25',capabilities:{tools:{}},serverInfo:{name:'fixture',version:'1'}},{'mcp-session-id':mcpValidSession});}
  if(body.method==='notifications/initialized')return new Response(null,{status:202});
  if(body.method==='tools/list'){if(request.headers.get('mcp-session-id')!==mcpValidSession)return new Response('expired',{status:404});return rpc(body.id,{tools:[{name:'read',description:'Synthetic safe read.',inputSchema:{type:'object',properties:{},additionalProperties:false}},{name:'write',description:'Synthetic write.',inputSchema:{type:'object',properties:{value:{type:'string'}},required:['value'],additionalProperties:false}}]});}
  if(body.method==='tools/call'){
   mcpToolCalls++;if(body.params.name==='write')mcpWriteCalls++;if(request.headers.get('mcp-session-id')!==mcpValidSession||mcpExpired){mcpExpired=false;mcpValidSession='';return new Response('expired',{status:404});}
   return rpc(body.id,{content:[{type:'text',text:'Synthetic MCP result.'}]});
  }
  throw new Error('Unexpected MCP method: '+body.method);
 }
 throw new Error('Unexpected outbound host: '+u.hostname);
}};
async function req(path,method='GET',body){let response;try{response=await mf.dispatchFetch('https://office.example.com/api/'+path,{method,redirect:'manual',headers:{Cookie:cookie,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});}catch(error){throw new Error(`dispatch failed at ${path}; MCP calls=${mcpToolCalls}, session=${mcpSessionCounter}/${mcpValidSession}: ${error}`);}const data=await response.clone().json().catch(()=>null);return {response,data};}
async function until(taskId,status){for(let n=0;n<300;n++){const {data}=await req('tasks/'+taskId);if(data.status===status)return data;if(['failed','cancelled','ambiguous'].includes(data.status)&&data.status!==status)throw new Error(`Task ${taskId} reached ${data.status}: ${data.error??''}`);await sleep(30);}throw new Error(`Task ${taskId} did not reach ${status}; events=${JSON.stringify((await req('tasks/'+taskId)).data.events?.slice(-12))}; recent model calls=${JSON.stringify(modelCalls.slice(-8))}`);}

try{
 mf=new Miniflare(convertV4MiniflareOptions(options));
 cookie=(await req('login','POST',{password})).response.headers.get('set-cookie').split(';')[0];
 await req('settings','POST',settings);

 const memoryFixture=(await req('memory','POST',{kind:'episode',title:'memoryHandleFixture private title',content:'synthetic-private-payload-do-not-disclose'})).data;
 const discovery=(await req('tasks','POST',{prompt:'opaque memory discovery'})).data;const discovered=await until(discovery.id,'completed');assert.equal(discovered.privateContext,false);const discoveryMessages=(await req('tasks/'+discovery.id+'/transcript')).data.messages;const discoveryResult=discoveryMessages.find(m=>m.role==='tool');assert.ok(discoveryResult.content.includes(memoryFixture.id));assert.ok(!discoveryResult.content.includes('private title')&&!discoveryResult.content.includes('synthetic-private-payload'),'Search must not expose titles or contents');
 const emptyMemory=(await req('tasks','POST',{prompt:'empty memory delegation'})).data;const delegated=await until(emptyMemory.id,'completed');assert.equal(delegated.privateContext,false,'Empty recall must not make public delegation private');assert.ok(!delegated.events.some(e=>e.kind==='approval'),'No approval wait after empty recall');
 const repaired=(await req('tasks','POST',{prompt:'artifact recovery'})).data;const repairedTask=await until(repaired.id,'completed');assert.equal(repairedTask.artifacts[0].name,'report.md','Invalid artifact args return an error for correction instead of failing the task');
 const denied=(await req('tasks','POST',{prompt:'denied schedule flow',teamReview:true})).data,deniedApproval=await until(denied.id,'waiting_approval');await req('tasks/'+denied.id+'/approval','POST',{request_id:deniedApproval.pending.id,approved:false});const deniedDone=await until(denied.id,'completed');assert.equal(deniedDone.events.filter(e=>e.kind==='approval').length,1,'Owner denial must not trigger another automatic review approval');

 const parallel=(await req('tasks','POST',{prompt:'parallel public reads'})).data;
 await until(parallel.id,'completed');assert.ok(parallelPeak>=2,'web reads should overlap');
 const parallelTranscript=(await req('tasks/'+parallel.id+'/transcript')).data.messages;
 assert.deepEqual(parallelTranscript.filter(m=>m.role==='tool').map(m=>m.tool_call_id),['read-1','read-2'],'results remain in original tool-call order even when finishes differ');
 const busyStarted=Date.now(),busy=(await req('tasks','POST',{prompt:'transient model busy'})).data;await until(busy.id,'completed');assert.equal(transientBusyCalls,2,'429 with Retry-After must make one initial call and one retry');assert.ok(Date.now()-busyStarted>=900,'Retry-After backoff must be honored');assert.equal((await req('tasks/'+busy.id)).data.tokens,10,'failed rate-limit response must not charge tokens');
 const readsBeforeDuplicates=executorReads,duplicate=(await req('tasks','POST',{prompt:'duplicate read ids'})).data;
 let duplicateDone;for(let n=0;n<200;n++){duplicateDone=(await req('tasks/'+duplicate.id)).data;if(['completed','failed'].includes(duplicateDone.status))break;await sleep(25);}
 assert.equal(duplicateDone.status,'failed','duplicate model tool-call IDs must be rejected');assert.equal(executorReads,readsBeforeDuplicates,'invalid tool-call IDs must not dispatch reads');

 const parent=(await req('tasks','POST',{prompt:'parent delegation flow'})).data;
 const parentDone=await until(parent.id,'completed');assert.match(parentDone.answer,/Friday result checked/);
 const child=(await req('tasks')).data.tasks.find(t=>t.delegatedBy===parent.id);assert.ok(child);assert.equal(child.status,'completed');assert.ok(modelCalls.some(c=>c.model==='small'&&c.tools.some(t=>t.function.name==='context_note')));
 assert.ok(!parentDone.events.some(e=>e.kind==='approval'),'public delegation must not need extra approval');

 const countBeforeBudget=(await req('tasks')).data.tasks.length,budgeted=(await req('tasks','POST',{prompt:'parent delegation flow',maxTokens:10})).data;
 const budgetResult=await until(budgeted.id,'failed');assert.match(budgetResult.error,/budget/i);
 const afterBudgetTasks=(await req('tasks')).data.tasks;assert.equal(afterBudgetTasks.length,countBeforeBudget+1);assert.ok(!afterBudgetTasks.some(t=>t.delegatedBy===budgeted.id),'a parent at shared token budget must not create another child');

 const cancelledParent=(await req('tasks','POST',{prompt:'cancel parent flow'})).data;
 for(let n=0;n<100;n++){const rows=(await req('tasks')).data.tasks;const delegated=rows.find(t=>t.delegatedBy===cancelledParent.id);if(delegated){await req('tasks/'+cancelledParent.id+'/cancel','POST',{});assert.equal((await req('tasks/'+delegated.id)).data.status,'cancelled');break;}await sleep(25);if(n===99)throw new Error('Delegated child was not created');}

 const created=(await req('mcp','POST',{name:'Synthetic MCP',url:'https://mcp.example.com/mcp',roles:['operator']})).data;mcpConnectorId=created.id;
 await req('mcp/'+created.id,'PATCH',{selectedTools:['read'],readOnlyTools:['read'],roles:['operator']});
 const roleDenied=(await req('tasks','POST',{prompt:'MCP role deny',assignee:'steward'})).data;await until(roleDenied.id,'failed');assert.equal(mcpToolCalls,0,'steward role without grant must not reach server');
 const selected=(await req('tasks','POST',{prompt:'MCP selected read',assignee:'operator'})).data;await until(selected.id,'completed');assert.equal(mcpToolCalls,1);
 mcpExpired=true;const expired=(await req('tasks','POST',{prompt:'MCP expired call'})).data;await until(expired.id,'failed');assert.equal(mcpToolCalls,2,'expired tool call must not retry');assert.equal(mcpSessionCounter,1,'failed read call must not silently reinitialize and retry');
 await req('mcp/'+created.id+'/refresh','POST',{});assert.equal(mcpSessionCounter,2,'refresh must initialize a new session after expiry');
 // This Windows Miniflare fixture appears to retain its failed outbound-service bridge after a mocked 404; simulate an isolate restart while keeping Durable Object state.
 await mf.dispose();mf=new Miniflare(convertV4MiniflareOptions(options));await req('tasks/'+expired.id+'/resume','POST',{});await until(expired.id,'completed');assert.equal(mcpToolCalls,3,'owner-attested read can retry only after explicit task resume');
 await req('mcp/'+created.id,'PATCH',{selectedTools:['read','write'],readOnlyTools:['read'],roles:['operator']});
 mcpExpired=true;
 const uncertain=(await req('tasks','POST',{prompt:'MCP expired write'})).data,uncertainApproval=await until(uncertain.id,'waiting_approval');
 await req('tasks/'+uncertain.id+'/approval','POST',{request_id:uncertainApproval.pending.id,approved:true});await until(uncertain.id,'ambiguous');assert.equal(mcpWriteCalls,1);
 await req('tasks/'+uncertain.id+'/reconcile','POST',{received:true});await until(uncertain.id,'completed');assert.equal(mcpWriteCalls,1,'confirmed delivery must not retry');
 mcpExpired=true;const declinedUncertain=(await req('tasks','POST',{prompt:'MCP expired write'})).data,declinedApproval=await until(declinedUncertain.id,'waiting_approval');
 await req('tasks/'+declinedUncertain.id+'/approval','POST',{request_id:declinedApproval.pending.id,approved:true});await until(declinedUncertain.id,'ambiguous');assert.equal(mcpWriteCalls,2);
 await req('tasks/'+declinedUncertain.id+'/reconcile','POST',{received:false});const retryApproval=await until(declinedUncertain.id,'waiting_approval');
 mcpExpired=false;await req('tasks/'+declinedUncertain.id+'/approval','POST',{request_id:retryApproval.pending.id,approved:true});await until(declinedUncertain.id,'completed');assert.equal(mcpWriteCalls,3,'owner-confirmed non-delivery requires fresh exact approval before retry');
 await req('mcp/'+created.id,'PATCH',{selectedTools:[],readOnlyTools:[],roles:['operator']});const revoked=(await req('tasks','POST',{prompt:'MCP revoked call'})).data;await until(revoked.id,'failed');assert.equal(mcpToolCalls,6,'revoked capability must not reach server');
 await req('mcp/'+created.id,'DELETE');const afterDelete=(await req('tasks','POST',{prompt:'MCP revoked call'})).data;await until(afterDelete.id,'failed');assert.equal(mcpToolCalls,6,'disconnected endpoint must not be called');

 console.log('PASS: ordered parallel reads; unique call IDs; Retry-After model backoff; delegation/wait/result/budget/cancellation; MCP role/grant/revoke, expired read-session recovery, and uncertain-write reconciliation. Provider, executor, and MCP services were synthetic stubs.');
}finally{await mf?.dispose();await rm(persist,{recursive:true,force:true});}
