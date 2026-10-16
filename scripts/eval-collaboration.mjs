import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {setTimeout as sleep} from 'node:timers/promises';

function grade(answer){
 try{const output=JSON.parse(answer.replace(/^```(?:json)?\s*|\s*```$/g,''));return {passed:output.choice==='A'&&output.total_usd===498&&output.runner_up_total_usd===515&&output.saving_usd===17&&Array.isArray(output.excluded)&&output.excluded.includes('C'),output};}
 catch{return {passed:false,reason:'Final answer was not the requested JSON object.'};}
}

if(process.argv.includes('--self-test')){
 assert.equal(grade(JSON.stringify({choice:'A',total_usd:498,runner_up_total_usd:515,saving_usd:17,excluded:['C']})).passed,true);
 assert.equal(grade(JSON.stringify({choice:'B',total_usd:492,runner_up_total_usd:498,saving_usd:6,excluded:[]})).passed,false);
 assert.equal(grade('not JSON').passed,false);console.log('PASS: fixture grader accepts verified arithmetic and rejects wrong or malformed results.');
}else{
// Opt-in live evaluation. Uses the running app's configured models; no provider keys are read here.
const base=process.env.DUAL_AGENT_URL,password=process.env.DUAL_AGENT_PASSWORD;
if(!base||!password)throw new Error('Set DUAL_AGENT_URL and DUAL_AGENT_PASSWORD for your own running office.');
const url=new URL(base);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw new Error('Use an HTTP(S) office URL without embedded credentials.');
if(url.protocol!=='https:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw new Error('Use HTTPS for a remote office.');
let cookie='';
async function api(path,method='GET',body){
 const r=await fetch(new URL('api/'+path,url.href.endsWith('/')?url.href:url.href+'/'),{method,redirect:'error',headers:{Cookie:cookie,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
 if(path==='login'&&r.ok)cookie=r.headers.get('set-cookie')?.split(';')[0]??'';
 const value=await r.json();if(!r.ok)throw new Error(`Office ${path.split('/')[0]} returned HTTP ${r.status}.`);return value;
}
const prompt=`Synthetic public purchasing fixture; do not browse, recall private memory, schedule or send messages. All required evidence is in this assignment; no memory/history lookup is needed. Need exactly 40 units, no extras, delivery within 4 days. All prices USD; no tax. Source A: $12/unit, $18 delivery, arrives in 3 days. Source B: $11.50/unit, $55 delivery, arrives in 2 days; 5% goods-only discount applies only at quantity >=50. Source C: $10.90/unit, $29 delivery, arrives in 1 day, minimum order 50 units. Choose the cheapest eligible supplier and verify arithmetic and eligibility. Use a teammate only if it provides a useful independent check; do not create files. Final answer must be one JSON object with choice, total_usd, runner_up_total_usd, saving_usd, excluded (array of supplier letters), and checks (short explanations).`;
await api('login','POST',{password});
const config=await api('settings'),results=[];
for(const assignee of ['operator','team']){
 const started=Date.now(),task=await api('tasks','POST',{prompt,assignee,teamReview:assignee==='team',telegram:false,skipCoreMemory:true,maxSteps:8,maxTokens:24000});
 let current=task;
 try{
  while(!['completed','failed','cancelled','ambiguous','waiting_approval','waiting_local'].includes(current.status)&&Date.now()-started<150000){await sleep(750);current=await api('tasks/'+task.id);}
  const family=(await api('tasks')).tasks.filter(t=>t.id===task.id||t.rootTaskId===task.id);
  results.push({mode:assignee==='team'?'together':'jarvis-alone',status:current.status,elapsedMs:Date.now()-started,tokens:family.reduce((n,t)=>n+t.tokens,0),calls:family.reduce((n,t)=>n+t.steps+(t.stewardCalls??0)+(t.searchCalls??0),0),children:family.length-1,...(current.status==='completed'?grade(current.answer??''):{passed:false,reason:current.error??'Task blocked or deadline reached.'})});
 }finally{if(!['completed','failed','cancelled','ambiguous'].includes(current.status))await api('tasks/'+task.id+'/cancel','POST',{});}
}
const report={fixture:'supplier-eligibility-v1',promptSha256:createHash('sha256').update(prompt).digest('hex'),created:new Date().toISOString(),models:{jarvis:config.main,friday:config.steward},results,limits:'One public synthetic fixture per mode; no statistical quality or competitor claim. Calls include attempts. Tokens are provider-reported. Reviewer agreement is not independent evidence. Canceled in-flight requests may consume unreported tokens.'};
await mkdir('work/evals',{recursive:true});const path='work/evals/collaboration-'+Date.now()+'.json';await writeFile(path,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));console.log('Saved '+path);
if(results.some(r=>!r.passed))process.exitCode=1;

}
