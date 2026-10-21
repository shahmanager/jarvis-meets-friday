import assert from 'node:assert/strict';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {PDFDocument} from 'pdf-lib';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
const persist=await mkdtemp(join(tmpdir(),'dual-capabilities-')),password='capability-fixture-password-long';
let mf,cookie='',artifactIds=[],mailCalls=0,mailRaw='',searchCalls=0,quota=false;
const remote=new Map();
const call=(id,name,args)=>({id,type:'function',function:{name,arguments:JSON.stringify(args)}});
const options={modules:true,scriptPath:'work/build/index.js',compatibilityDate:'2026-10-12',compatibilityFlags:['nodejs_compat'],durableObjects:{RELAY:{className:'Relay',useSQLite:true}},resourcePersistencePath:persist,bindings:{ADMIN_PASSWORD:password,OPENROUTER_API_KEY:'stub',GEMINI_API_KEY:'stub',EXECUTOR_URL:'https://executor.example.com',EXECUTOR_SECRET:'fixture',ARTIFACT_STORAGE:'executor',APP_URL:'https://office.example.com',GOOGLE_CLIENT_ID:'123-synthetic.apps.googleusercontent.com',GOOGLE_CLIENT_SECRET:'fixture'},outboundService:async request=>{
 const u=new URL(request.url);
 if(u.hostname==='oauth2.googleapis.com')return Response.json({access_token:'fixture',refresh_token:'fixture'});
 if(u.hostname==='gmail.googleapis.com'){
  if(u.pathname.endsWith('/profile'))return Response.json({emailAddress:'owner@example.com'});
  if(u.pathname.endsWith('/messages/send')){mailCalls++;mailRaw=(await request.json()).raw;return Response.json({id:'mail-receipt'});}
 }
 if(u.hostname==='executor.example.com'){const b=await request.json();if(b.operation==='artifact_write'){remote.set(b.args.id,b.args.content);return Response.json({stored:true});}if(b.operation==='artifact_read')return Response.json({content_base64:Buffer.from(remote.get(b.args.id)).toString('base64')});if(b.operation==='cancel')return Response.json({stopped:true});throw new Error('Unexpected executor operation');}
 if(u.hostname==='generativelanguage.googleapis.com'){
  searchCalls++;if(quota)return Response.json({error:{code:429}},{status:429});return Response.json({usageMetadata:{totalTokenCount:17},candidates:[{content:{parts:[{text:'Synthetic source-backed research.'}]},groundingMetadata:{webSearchQueries:['fixture'],searchEntryPoint:{renderedContent:'<a target="_blank" href="https://www.google.com/search?q=fixture">Google Search</a><script>parent.document.body.dataset.compromised="yes"</script>'},groundingChunks:[{web:{title:'Public fixture source',uri:'https://example.com/source'}}],groundingSupports:[]}}]});
 }
 if(u.hostname==='openrouter.ai'){
  const b=await request.json(),prompt=b.messages.findLast(m=>m.role==='user')?.content??'',tool=b.messages.findLast(m=>m.role==='tool');let message;
  if(!b.tools?.length)message={role:'assistant',content:'Review: synthetic evidence checked.'};
  else if(prompt.includes('email artifacts')&&!tool)message={role:'assistant',content:null,tool_calls:[call('email-files','email_send',{to:'recipient@example.com',subject:'Generated reports',body:'Attached generated reports.',artifact_ids:artifactIds})]};
  else if(prompt.includes('private search')&&!tool)message={role:'assistant',content:null,tool_calls:[call('private-search','web_search',{query:'Synthetic private query'})]};
  else if(prompt.includes('quota search')&&!tool)message={role:'assistant',content:null,tool_calls:[call('quota-search','web_search',{query:'Public fixture'})]};
  else if(prompt.includes('research and files')&&!tool)message={role:'assistant',content:null,tool_calls:[call('search','web_search',{query:'Public fixture research'})]};
  else if(prompt.includes('research and files')&&tool?.tool_call_id==='search')message={role:'assistant',content:null,tool_calls:[call('html','artifact_create',{name:'report.html',content:'<!doctype html><style>body{background:#eae4d5;color:#21303a;font:22px sans-serif;padding:28px}</style><h1>Delivery pipeline check</h1><p>Self-contained report.</p><script>parent.document.body.dataset.compromised="yes"</script>'}),call('pdf','artifact_create',{name:'report.pdf',content:'Delivery pipeline check\nSynthetic report with source verification.'})]};
  else message={role:'assistant',content:'Task complete; verified outputs only.'};
  return Response.json({model:'fixture',choices:[{message}],usage:{total_tokens:10}});
 }
 throw new Error('Unexpected host '+u.hostname);
}};
async function req(path,method='GET',body){const response=await mf.dispatchFetch('https://office.example.com/api/'+path,{method,headers:{Cookie:cookie,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,redirect:'manual'});return {response,data:await response.clone().json().catch(()=>null)};}
async function until(id,status){for(let n=0;n<250;n++){const t=(await req('tasks/'+id)).data;if(t.status===status)return t;if(t.status==='failed')throw new Error(t.error);await sleep(30);}throw new Error('Task wait timed out');}
try{
 mf=new Miniflare(convertV4MiniflareOptions(options));cookie=(await req('login','POST',{password})).response.headers.get('set-cookie').split(';')[0];await req('settings','POST',{main:{provider:'openrouter',model:'main'},steward:{provider:'openrouter',model:'reviewer'},preferences:{teamReview:false,memory:'builtin'}});
 const pipeline=(await req('tasks','POST',{prompt:'research and files',teamReview:true})).data,done=await until(pipeline.id,'completed');assert.equal(done.searchCalls,1);assert.ok(done.tokens>=17);assert.equal(done.privateContext,false);assert.equal(done.artifacts.length,2);artifactIds=done.artifacts.map(a=>a.id);assert.equal(done.groundings,undefined,'Polling summaries must not copy full search payloads');assert.ok((await req('tasks/'+pipeline.id+'/research')).data.results[0].grounded);
 const html=done.artifacts.find(a=>a.name.endsWith('.html')),pdf=done.artifacts.find(a=>a.name.endsWith('.pdf'));
 const htmlPreview=(await req('artifacts/'+html.id+'/preview')).response;assert.match(htmlPreview.headers.get('content-security-policy'),/^sandbox;/);assert.ok(!htmlPreview.headers.get('content-security-policy').includes('allow-scripts'));assert.equal(htmlPreview.headers.get('x-frame-options'),'SAMEORIGIN');assert.match(await htmlPreview.text(),/Delivery pipeline check/);
 const pdfPreview=(await req('artifacts/'+pdf.id+'/preview')).response;assert.equal(pdfPreview.status,200);assert.equal(pdfPreview.headers.get('content-type'),'application/pdf');assert.match(pdfPreview.headers.get('content-disposition'),/^inline;/);assert.equal(pdfPreview.headers.get('x-frame-options'),'SAMEORIGIN');assert.ok(!pdfPreview.headers.get('content-security-policy').includes('allow-scripts'));const pdfDownload=(await req('artifacts/'+pdf.id)).response,bytes=new Uint8Array(await pdfDownload.arrayBuffer());assert.equal(Buffer.from(bytes).subarray(0,5).toString(),'%PDF-');assert.equal((await PDFDocument.load(bytes)).getPageCount(),1);
 const suggestions=(await req('search-suggestions/'+pipeline.id+'/0')).response;assert.match(suggestions.headers.get('content-security-policy'),/^sandbox allow-popups /);assert.ok(!suggestions.headers.get('content-security-policy').includes('allow-scripts'));
 const oauth=(await req('gmail/connect','POST',{})).data,state=new URL(oauth.url).searchParams.get('state');assert.equal((await req('gmail/callback?state='+state+'&code=fixture')).response.status,303);
 const changed=(await req('tasks','POST',{prompt:'email artifacts'})).data,pending=await until(changed.id,'waiting_approval');assert.equal(pending.pending.args.attachment_manifest.length,2);assert.equal(pending.pending.args.attachments,undefined);remote.set(html.id,'Changed after approval');await req('tasks/'+changed.id+'/approval','POST',{request_id:pending.pending.id,approved:true});await until(changed.id,'completed');assert.equal(mailCalls,0,'Changed attachment must never send under an old approval');
 const email=(await req('tasks','POST',{prompt:'email artifacts'})).data,approval=await until(email.id,'waiting_approval');await req('tasks/'+email.id+'/approval','POST',{request_id:approval.pending.id,approved:true});await until(email.id,'completed');assert.equal(mailCalls,1);const mime=Buffer.from(mailRaw,'base64url').toString();assert.match(mime,/multipart\/mixed/);assert.match(mime,/filename="report.pdf"/);assert.match(mime,/filename="report.html"/);assert.equal((await req('tasks/'+email.id+'/approval','POST',{request_id:approval.pending.id,approved:true})).response.status,409);assert.equal(mailCalls,1);
 quota=true;const quotaTask=(await req('tasks','POST',{prompt:'quota search'})).data;await until(quotaTask.id,'completed');assert.ok((await req('settings')).data.googleSearchRetryAt>Date.now());const searchCount=searchCalls;
 await req('memory','POST',{kind:'core',title:'Private fixture',content:'Private context'});const privateTask=(await req('tasks','POST',{prompt:'private search'})).data,privateApproval=await until(privateTask.id,'waiting_approval');assert.equal(searchCalls,searchCount,'Private query must not reach Google before approval');await req('tasks/'+privateTask.id+'/approval','POST',{request_id:privateApproval.pending.id,approved:false});await until(privateTask.id,'completed'); assert.equal(searchCalls,searchCount);
 console.log('PASS: Google grounding + usage; isolated HTML preview and PDF download; real PDF bytes; exact attachment manifest approval, mutation rejection and MIME delivery receipts; quota cooldown; private-query denial. External services were stubs.');
}finally{await mf?.dispose();await rm(persist,{recursive:true,force:true});}

