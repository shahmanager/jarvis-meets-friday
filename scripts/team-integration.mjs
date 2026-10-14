import assert from 'node:assert/strict';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
const persist=await mkdtemp(join(tmpdir(),'dual-agent-'));
let sends=0,emailSends=0,reviews=0,replyTo='original@example.com',cookie='',mf;
const options={modules:true,scriptPath:'work/build/index.js',compatibilityDate:'2026-10-12',compatibilityFlags:['nodejs_compat'],durableObjects:{RELAY:{className:'Relay',useSQLite:true,unsafeUniqueKey:'dual-agent-integration'}},resourcePersistencePath:persist,bindings:{ADMIN_PASSWORD:'integration-password-long-enough-123',ALLOW_DEMO:'true',OPENROUTER_API_KEY:'stub',APP_URL:'https://dual.test',TELEGRAM_BOT_TOKEN:'fake',TELEGRAM_WEBHOOK_SECRET:'test-webhook-secret-long-enough',TELEGRAM_OWNER_ID:'123',GOOGLE_CLIENT_ID:'fake',GOOGLE_CLIENT_SECRET:'fake'},outboundService:async request=>{
 const u=new URL(request.url),input=request.method==='POST'?(request.headers.get('content-type')?.includes('json')?await request.json():Object.fromEntries(new URLSearchParams(await request.text()))):{};
 if(u.hostname==='api.telegram.org'){if(u.pathname.endsWith('setWebhook'))return Response.json({ok:true,result:true});sends++;return Response.json({ok:true,result:{message_id:sends}});}
 if(u.hostname==='oauth2.googleapis.com')return Response.json({access_token:'stub-access',refresh_token:'stub-refresh'});
 if(u.hostname==='gmail.googleapis.com'){
  if(u.pathname.endsWith('profile'))return Response.json({emailAddress:'me@example.com'});
  if(u.pathname.endsWith('messages/send')){emailSends++;const mime=Buffer.from(input.raw,'base64url').toString();assert.match(mime,/To: original@example.com/);assert.match(mime,/In-Reply-To: <original@sender.example>/);assert.equal(input.threadId,'thread1');return Response.json({id:'sent1'});}
  return Response.json({id:'mail1',threadId:'thread1',payload:{mimeType:'text/plain',headers:[{name:'From',value:'Person <original@example.com>'},{name:'Reply-To',value:replyTo},{name:'Subject',value:'Project'},{name:'Message-ID',value:'<original@sender.example>'}],body:{data:Buffer.from('Original private message').toString('base64url')}}});
 }
 let message;
 if(!input.tools?.length){reviews++;message={role:'assistant',content:'Check arithmetic; corrected result is four.'};}
 else if(input.messages.at(-1).role==='tool')message={role:'assistant',content:'Revised verified answer: four.'};
 else if(input.messages.findLast(m=>m.role==='user')?.content==='reply email')message={role:'assistant',content:'Draft reply',tool_calls:[{id:'reply-call',type:'function',function:{name:'email_reply',arguments:JSON.stringify({message_id:'mail1',body:'Thanks for the project.'})}}]};
 else message={role:'assistant',content:'Draft answer: five.'};
 return Response.json({choices:[{message}],usage:{total_tokens:50}});
}};
async function req(path,method='GET',body,headers={}){const response=await mf.dispatchFetch('http://localhost/api/'+path,{method,redirect:'manual',headers:{Cookie:cookie,...headers,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const data=await response.clone().json().catch(()=>null);return {response,data};}
async function until(taskId,status){for(let n=0;n<120;n++){const {data}=await req('tasks/'+taskId);if(data.status===status)return data;if(data.status==='failed')throw new Error(data.error);await sleep(50);}throw new Error('Task did not reach '+status);}
try{
 mf=new Miniflare(convertV4MiniflareOptions(options));
 cookie=(await req('login','POST',{password:options.bindings.ADMIN_PASSWORD})).response.headers.get('set-cookie').split(';')[0];
 await req('settings','POST',{preferences:{teamReview:false,memory:'builtin'},main:{provider:'openrouter',model:'main'},steward:{provider:'openrouter',model:'small'}});
 const memory=(await req('memory','POST',{title:'College project',content:'Owner prefers concise reports.'})).data;
 const job=(await req('jobs','POST',{name:'Weekly summary',prompt:'Summarize recent tasks',every_minutes:10080})).data;
 assert.equal((await req('telegram/connect','POST',{})).response.status,200);
 assert.equal((await req('telegram/webhook','POST',{update_id:1,message:{text:'task',chat:{id:123,type:'private'},from:{id:123}}})).response.status,403);
 const update={update_id:1,message:{text:'telegram task',chat:{id:123,type:'private'},from:{id:123}}},headers={'X-Telegram-Bot-Api-Secret-Token':options.bindings.TELEGRAM_WEBHOOK_SECRET};
 await req('telegram/webhook','POST',update,headers);await req('telegram/webhook','POST',update,headers);
 assert.equal((await req('tasks')).data.tasks.filter(t=>t.prompt==='telegram task').length,1);
 const task=(await req('tasks','POST',{prompt:'Check two plus two',teamReview:true})).data;
 const waiting=await until(task.id,'waiting_approval');assert.equal(waiting.pending.args.model,'small');assert.match(waiting.pending.args.draft,/five/);assert.equal(reviews,0);
 await req('tasks/'+task.id+'/approval','POST',{request_id:waiting.pending.id,approved:true});const final=await until(task.id,'completed');assert.match(final.answer,/four/);assert.equal(reviews,1);assert.equal(final.stewardTokens,50);
 const oneShot=(await req('jobs','POST',{name:'Immediate test routine',prompt:'Scheduled synthetic task',run_at:new Date(Date.now()+500).toISOString()})).data;
 for(let n=0;n<100;n++){const jobs=(await req('jobs')).data.jobs,j=jobs.find(j=>j.id===oneShot.id);if(j.lastTask){assert.equal(j.enabled,false);await until(j.lastTask,'completed');break;}if(n===99)throw new Error('Routine alarm did not run');await sleep(50);}
 const auth=(await req('gmail/connect','POST',{})).data.url,state=new URL(auth).searchParams.get('state');
 assert.equal((await req('gmail/callback?state=bad&code=stub')).response.status,403);
 assert.equal((await req('gmail/callback?state='+state+'&code=stub')).response.status,303);
 assert.equal((await req('gmail/callback?state='+state+'&code=stub')).response.status,403);
 const email=(await req('tasks','POST',{prompt:'reply email'})).data,approval=await until(email.id,'waiting_approval');assert.equal(approval.pending.args.to,'original@example.com');assert.equal(emailSends,0);
 replyTo='changed@example.com';await req('tasks/'+email.id+'/approval','POST',{request_id:approval.pending.id,approved:true});await until(email.id,'completed');assert.equal(emailSends,1);
 assert.equal((await req('tasks/'+email.id+'/approval','POST',{request_id:approval.pending.id,approved:true})).response.status,409);
 await mf.dispose();mf=new Miniflare(convertV4MiniflareOptions(options));
 assert.ok((await req('memory?q=College')).data.memories.some(m=>m.id===memory.id));assert.ok((await req('jobs')).data.jobs.some(j=>j.id===job.id));assert.equal((await req('connections')).data.email,'me@example.com');
 assert.ok((await req('deliveries')).data.deliveries.some(d=>d.channel==='email'&&d.state==='sent'));
 await req('telegram/webhook','POST',update,headers);assert.equal((await req('tasks')).data.tasks.filter(t=>t.prompt==='telegram task').length,1);
 console.log('PASS: persistence survives Worker restart; Telegram owner checks/dedupe; Gmail OAuth/reply snapshots/receipts; exact peer-review approval and revision. External providers were test stubs.');
}finally{await mf?.dispose();await rm(persist,{recursive:true,force:true});}

