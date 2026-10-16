import assert from 'node:assert/strict';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {setTimeout as sleep} from 'node:timers/promises';
const cancelled=[],sessions=new Set();let cookie='',calls=0;
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,scriptPath:'work/build/index.js',compatibilityDate:'2026-10-12',compatibilityFlags:['nodejs_compat'],durableObjects:{RELAY:{className:'Relay',useSQLite:true}},bindings:{ADMIN_PASSWORD:'harness-owner-fixture-long-enough',CODEX_HARNESS_URL:'https://cloud-harness.example',CODEX_HARNESS_TOKEN:'cloud-auth-fixture-long-enough'},outboundService:async request=>{
 assert.equal(request.headers.get('authorization'),'Bearer cloud-auth-fixture-long-enough');const url=new URL(request.url);assert.equal(url.hostname,'cloud-harness.example');
 if(url.pathname==='/v1/models')return Response.json({data:[{id:'cloud-model'}]});
 const input=await request.json();if(url.pathname==='/v1/cancel'){cancelled.push(input.session_id);return Response.json({cancelled:true});}
 assert.equal(url.pathname,'/v1/step');assert.ok(!JSON.stringify(input).includes('cloud-auth-fixture-long-enough'));sessions.add(input.session_id);calls++;
 const result=input.messages.findLast(m=>m.role==='tool'),prompt=input.messages.find(m=>m.role==='user')?.content??'';
 if(prompt.includes('Synthetic harness failure'))return Response.json({error:'Synthetic failure'},{status:502});
 const tool=prompt.includes('Friday artifact')?'artifact_create':'memory_write';
 const args=tool==='artifact_create'?{name:'friday-evidence.md',content:'Synthetic evidence.'}:{title:'Synthetic preference',content:'Fixture only.'};
 return Response.json({model:'cloud-model',choices:[{message:result?{role:'assistant',content:'Cloud harness result checked.'}:{role:'assistant',content:null,tool_calls:[{id:'cloud-operation',type:'function',function:{name:tool,arguments:JSON.stringify(args)}}]}}],usage:result?{total_tokens:24}:{total_tokens:null,deferred:true}});
}}));
async function req(path,method='GET',body){const r=await mf.dispatchFetch('https://office.example/api/'+path,{method,headers:{Cookie:cookie,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,redirect:'manual'});return {r,data:await r.json().catch(()=>null)};}
async function until(id,status){for(let n=0;n<150;n++){const t=(await req('tasks/'+id)).data;if(t.status===status)return t;if(t.status==='failed'&&status!=='failed')throw new Error(t.error);await sleep(40);}throw new Error('Cloud fixture timed out.');}
try{
 cookie=(await req('login','POST',{password:'harness-owner-fixture-long-enough'})).r.headers.get('set-cookie').split(';')[0];
 await req('settings','POST',{main:{provider:'codex',model:'cloud-model'},steward:{provider:'codex',model:'cloud-model'},preferences:{teamReview:false,telegramTeam:false,memory:'builtin'}});
 assert.equal((await req('settings')).data.configured.codex,true);assert.deepEqual((await req('models?provider=codex')).data.models,['cloud-model']);
 const main=(await req('tasks','POST',{prompt:'Synthetic memory change',assignee:'operator'})).data,pending=await until(main.id,'waiting_approval');
 assert.equal(pending.pending.call.function.name,'memory_write');assert.equal(pending.usagePending,true);assert.equal(pending.tokens,0,'Pending usage is an unknown amount, not measured zero');assert.equal(calls,1,'A model request must pause at the office approval boundary');assert.ok(!(await req('memory')).data.memories.some(m=>m.title==='Synthetic preference'));
 await req('tasks/'+main.id+'/approval','POST',{request_id:pending.pending.id,approved:false});const completed=await until(main.id,'completed');assert.equal(completed.tokens,24);assert.equal(completed.usagePending,false);assert.ok(!(await req('memory')).data.memories.some(m=>m.title==='Synthetic preference'),'Declined change must not happen');
 const friday=(await req('tasks','POST',{prompt:'Friday artifact',assignee:'steward'})).data,done=await until(friday.id,'completed');assert.equal(done.artifacts[0].name,'friday-evidence.md');assert.ok(sessions.has(main.id)&&sessions.has(friday.id),'Agents must use distinct cloud sessions');
 for(let n=0;n<50&&!cancelled.includes(friday.id);n++)await sleep(20);assert.ok(cancelled.includes(main.id)&&cancelled.includes(friday.id),'Completed tasks release their cloud agent processes');
 const broken=(await req('tasks','POST',{prompt:'Synthetic harness failure',assignee:'operator'})).data;await until(broken.id,'failed');for(let n=0;n<50&&!cancelled.includes(broken.id);n++)await sleep(20);assert.ok(cancelled.includes(broken.id),'Failed tasks release cloud sessions');
 console.log('PASS: Worker routes both roles to cloud Codex, preserves exact approvals/denials, counts usage, creates artifacts and releases sessions. Cloud gateway responses were explicit stubs.');
}finally{await mf.dispose();}
