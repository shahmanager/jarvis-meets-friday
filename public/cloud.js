// Cloud console, edge chip and theme toggle. Runs beside app.js and never touches its state.
// Live panels read /api/cloud (owner-authenticated, read-only). The scaling lab is a labelled
// client-side simulation and never calls the server.
(()=>{
'use strict';
const q=s=>document.querySelector(s);
const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined&&text!==null)e.textContent=String(text);return e;};
const svg=(tag,attrs={})=>{const e=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,String(v));return e;};
const store={get(k){try{return localStorage.getItem(k);}catch{return null;}},set(k,v){try{localStorage.setItem(k,v);}catch{}}};
const cssVar=name=>getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/* ---------- formatting ---------- */
const nf=new Intl.NumberFormat();
const compact=n=>n>=1e6?(n/1e6).toFixed(n>=1e7?0:1)+'M':n>=1e4?(n/1e3).toFixed(n>=1e5?0:1)+'k':nf.format(Math.round(n));
const bytes=n=>{if(!Number.isFinite(n))return '—';const u=['B','KB','MB','GB'];let i=0;while(n>=1024&&i<u.length-1){n/=1024;i++;}return (i?n.toFixed(n>=100?0:1):n)+' '+u[i];};
const secs=s=>s===null||s===undefined?'—':s<60?Math.round(s)+' s':s<3600?(s/60).toFixed(s<600?1:0)+' min':(s/3600).toFixed(1)+' h';
const rel=ms=>{if(!ms)return '—';const d=ms-Date.now(),a=Math.abs(d)/1000,txt=a<60?Math.round(a)+' s':a<3600?Math.round(a/60)+' min':a<86400?Math.round(a/3600)+' h':Math.round(a/86400)+' d';return d>=0?'in '+txt:txt+' ago';};
const clock=iso=>{const d=new Date(iso);return isNaN(d)?'—':d.toLocaleString([], {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});};
const median=a=>{if(!a.length)return null;const s=[...a].sort((x,y)=>x-y);return s[Math.floor(s.length/2)];};

/* ---------- theme ---------- */
const themeButton=q('#theme-toggle');
function syncThemeLabel(){const light=document.documentElement.dataset.theme==='light';themeButton?.setAttribute('aria-label',light?'Switch to dark theme':'Switch to light theme');themeButton?.setAttribute('title',light?'Night shift (dark)':'Day shift (light)');}
if(themeButton){themeButton.onclick=()=>{const next=document.documentElement.dataset.theme==='light'?'dark':'light';document.documentElement.dataset.theme=next;store.set('jf-theme',next);syncThemeLabel();if(lab.drawn)lab.draw();};syncThemeLabel();}

/* ---------- data ---------- */
let data=null,loading=null,samples=[],tab='overview',autoTimer=null,edgeTimer=null;
async function load(){
 if(loading)return loading;
 loading=(async()=>{
  const started=performance.now();
  const r=await fetch('/api/cloud',{cache:'no-store',headers:{Accept:'application/json'}});
  const rtt=performance.now()-started;
  const body=await r.json().catch(()=>({}));
  if(!r.ok)throw Object.assign(new Error(body.error||`Cloud status failed (${r.status})`),{status:r.status});
  samples.push({t:Date.now(),ms:rtt});samples=samples.slice(-30);
  data=body;return body;
 })();
 try{return await loading;}finally{loading=null;}
}

/* ---------- edge chip in the top bar ---------- */
const chip=q('#edge-chip');
function paintChip(){
 if(!chip)return;
 if(!data){chip.dataset.state='error';q('#edge-colo').textContent='—';q('#edge-latency').textContent='unavailable';return;}
 chip.dataset.state='ok';
 q('#edge-colo').textContent=data.edge?.colo||'local';
 const last=samples.at(-1);q('#edge-latency').textContent=last?Math.round(last.ms)+' ms':'';
 chip.title=data.edge?.colo?`Served from Cloudflare ${data.edge.colo}${data.edge.city?' ('+data.edge.city+', '+data.edge.country+')':''}. Round trip ${Math.round(last?.ms??0)} ms.`:'Served by a local development runtime.';
}
async function edgeTick(){
 if(q('#app')?.hidden||document.hidden)return;
 try{await load();}catch{data=data??null;}
 paintChip();
}
if(chip){
 chip.onclick=()=>openConsole('overview');
 // Start once the office is visible (after sign-in); app.js owns sign-in.
 const appRoot=q('#app');
 const startEdge=()=>{if(edgeTimer||appRoot.hidden)return;edgeTick();edgeTimer=setInterval(edgeTick,60000);};
 new MutationObserver(()=>{if(appRoot.hidden){clearInterval(edgeTimer);edgeTimer=null;}else startEdge();}).observe(appRoot,{attributes:true,attributeFilter:['hidden']});
 startEdge();
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&edgeTimer)edgeTick();});
}

/* ---------- console shell ---------- */
const dialog=q('#cloud-dialog');
function openConsole(which){
 if(!dialog)return;
 if(!dialog.open)dialog.showModal();
 selectTab(which||tab);
 refresh();
 clearInterval(autoTimer);autoTimer=setInterval(()=>{if(dialog.open&&!document.hidden&&tab!=='lab')refresh();},15000);
}
q('#open-cloud')?.addEventListener('click',()=>openConsole());
q('#close-cloud')?.addEventListener('click',()=>dialog.close());
q('#cloud-refresh')?.addEventListener('click',()=>refresh());
dialog?.addEventListener('close',()=>{clearInterval(autoTimer);autoTimer=null;lab.pause(true);q('#open-cloud')?.focus();});
// Keep Escape scoped to this dialog so the work drawer underneath stays open.
dialog?.addEventListener('keydown',e=>{if(e.key==='Escape')e.stopPropagation();});

const tabs=[...document.querySelectorAll('[data-cloud-tab]')];
function selectTab(name){
 tab=name;
 for(const b of tabs){const on=b.dataset.cloudTab===name;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;q('#'+b.getAttribute('aria-controls')).hidden=!on;}
 if(name==='lab')lab.start();else lab.pause(true);
 if(data)render();
}
tabs.forEach((b,i)=>{
 b.onclick=()=>selectTab(b.dataset.cloudTab);
 b.onkeydown=e=>{const k=e.key;if(!['ArrowLeft','ArrowRight','Home','End'].includes(k))return;e.preventDefault();const n=k==='Home'?0:k==='End'?tabs.length-1:(i+(k==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[n].focus();selectTab(tabs[n].dataset.cloudTab);};
});

async function refresh(){
 const btn=q('#cloud-refresh');btn?.setAttribute('aria-busy','true');
 try{await load();q('#cloud-error').hidden=true;render();paintChip();}
 catch(e){const err=q('#cloud-error');err.hidden=false;err.textContent=e.status===401?'Your session ended. Close this console and sign in again.':e.message+' Check that the Worker is running, then refresh.';}
 finally{btn?.removeAttribute('aria-busy');}
}

function render(){
 if(!data)return;
 const o=data.runtime.object;
 const sub=q('#cloud-subtitle');sub.replaceChildren(document.createTextNode(`${data.runtime.platform} · Durable Object ${o.class} `),Object.assign(el('code'),{textContent:o.id.slice(0,12)+'…'}),document.createTextNode(` · updated ${new Date(data.serverTime).toLocaleTimeString()}`));
 if(tab==='overview')renderOverview(data);
 if(tab==='architecture')renderArchitecture(data);
 if(tab==='security')renderSecurity(data);
}

/* ---------- overview ---------- */
function readout(label,value,unit,subText,opts={}){
 const w=el('dl','readout');if(opts.tone)w.dataset.tone=opts.tone;
 w.append(el('dt',null,label));const dd=el('dd',opts.mono?'mono':null,value);if(unit)dd.append(el('small',null,unit));w.append(dd);
 if(subText)w.append(el('span','sub',subText));return w;
}
const STORE_NAMES={task:'Missions',artifact:'Files',memory:'Memory notes','memory-sync':'Memory sync queue',job:'Routines',device:'Paired laptops',mcp:'MCP connectors',notification:'Telegram outbox',delivery:'Delivery receipts',settings:'Settings (keys sealed)',connections:'Connections (sealed)','login-attempts':'Sign-in throttle',pair:'Pairing codes','telegram-pair':'Telegram pairing'};

function renderOverview(d){
 const t=d.tasks,last=samples.at(-1);
 const finished=(t.byStatus.completed??0)+(t.byStatus.failed??0);
 q('#cloud-readouts').replaceChildren(
  readout('Edge location',d.edge?.colo||'local',null,d.edge?.city?`${d.edge.city}, ${d.edge.country}`:'Development runtime',{mono:true}),
  readout('Round trip',last?Math.round(last.ms):'—','ms',`median ${Math.round(median(samples.map(s=>s.ms))??0)} ms · ${samples.length} sample${samples.length===1?'':'s'}`),
  readout('Durable storage',bytes(d.runtime.databaseBytes),null,`${nf.format(d.storage.breakdown.reduce((n,r)=>n+r.records,0))} records`),
  readout('Open missions',`${t.open}`,`/ ${d.control.openLimit}`,`${t.running} running of ${d.control.concurrencyLimit} slots`,{tone:t.open>=d.control.openLimit?'alert':null}),
  readout('Success rate',t.successRate===null?'—':Math.round(t.successRate*100)+'%',null,finished?`${t.byStatus.completed??0} done · ${t.byStatus.failed??0} failed`:'No finished missions yet',{tone:t.successRate===null?null:t.successRate>=.8?'ok':t.successRate<.5?'alert':null}),
  readout('Tokens used',compact(t.tokens),null,`${nf.format(t.modelCalls)} model calls`)
 );
 drawThroughput(t.days);
 drawLatency();
 const c=d.control,kv=q('#control-list');kv.replaceChildren();
 const row=(k,v)=>{kv.append(el('dt',null,k),el('dd',null,v));};
 row('Admission control',`${c.openLimit} open missions max (${t.open} now)`);
 row('Concurrency',`${c.concurrencyLimit} missions run at once`);
 row('Parallel reads per step',String(c.readConcurrency));
 row('Context budget',`${nf.format(c.contextChars)} characters`);
 row('Per-mission limits',c.maxSteps||c.maxTokens?[c.maxSteps?c.maxSteps+' calls':null,c.maxTokens?compact(c.maxTokens)+' tokens':null].filter(Boolean).join(' · '):'No app limit');
 row('Next scheduler alarm',d.runtime.nextAlarm?rel(d.runtime.nextAlarm):'Idle (nothing scheduled)');
 row('Routines',c.routines?`${c.routines} active · next ${rel(c.nextRoutine)}`:'None');
 row('Median time to result',`${secs(t.medianSeconds)}${t.p90Seconds!==null?' · p90 '+secs(t.p90Seconds):''}`);
 renderStorage(d.storage);
 renderServices(d);
 renderCost(t.tokens);
 const lastBackup=store.get('jf-last-backup');q('#backup-note').textContent=lastBackup?'Last export from this browser: '+rel(Number(lastBackup)):'No export from this browser yet.';
}

function drawThroughput(days){
 const box=q('#throughput-chart');box.replaceChildren();
 const W=Math.max(300,Math.round(box.clientWidth||640)),H=200,pad={l:28,r:6,t:8,b:26},iw=W-pad.l-pad.r,ih=H-pad.t-pad.b;
 const max=Math.max(1,...days.map(d=>d.created));const top=max<=4?max:Math.ceil(max/4)*4;
 const s=svg('svg',{viewBox:`0 0 ${W} ${H}`,role:'img','aria-label':`Missions created per day over the last 14 days; peak ${max}.`});
 const grid=svg('g',{class:'grid'}),axis=svg('g',{class:'axis'});
 const ticks=top<=4?Array.from({length:top+1},(_,i)=>i):[0,top/4,top/2,3*top/4,top];
 for(const v of ticks){const y=pad.t+ih-(v/top)*ih;grid.append(svg('line',{x1:pad.l,x2:W-pad.r,y1:y,y2:y}));const tx=svg('text',{x:pad.l-8,y:y+4,'text-anchor':'end'});tx.textContent=String(v);axis.append(tx);}
 s.append(grid,axis);
 const step=iw/days.length,bw=Math.min(26,step*.62);
 const colors={completed:cssVar('--ok'),failed:cssVar('--alert'),other:cssVar('--faint')};
 const tip=el('div','chart-tip');tip.hidden=true;
 days.forEach((d,i)=>{
  const g=svg('g',{class:'day'}),x=pad.l+i*step+(step-bw)/2;
  const other=d.created-d.completed-d.failed;let y=pad.t+ih;
  const parts=[['completed',d.completed],['failed',d.failed],['other',other]].filter(p=>p[1]>0);
  parts.forEach(([k,v],j)=>{const h=(v/top)*ih,gap=j<parts.length-1?0:0;y-=h;const topmost=j===parts.length-1;const r=svg('rect',{x,y:y+(j?1:0),width:bw,height:Math.max(0,h-(j?1:0)-gap),fill:colors[k],rx:topmost?4:0});if(topmost&&h>4){/* rounded data end only on top */const square=svg('rect',{x,y:y+Math.min(4,h/2)+(j?1:0),width:bw,height:Math.max(0,h-Math.min(4,h/2)-(j?1:0)),fill:colors[k]});g.append(r,square);}else g.append(r);});
  const date=new Date(d.day+'T00:00:00Z');
  const every=Math.max(1,Math.ceil(46/step));if(i===days.length-1||((days.length-1-i)%every===0&&days.length-1-i>=every)){const lbl=svg('text',{x:pad.l+i*step+step/2,y:H-8,'text-anchor':'middle'});lbl.textContent=i===days.length-1?'Today':date.toLocaleDateString([], {day:'numeric',month:'short',timeZone:'UTC'});axis.append(lbl);}
  const hit=svg('rect',{class:'hit',x:pad.l+i*step,y:pad.t,width:step,height:ih});
  hit.addEventListener('pointerenter',()=>{tip.hidden=false;tip.replaceChildren(el('b',null,date.toLocaleDateString([], {weekday:'short',day:'numeric',month:'short',timeZone:'UTC'})));for(const [k,label,v]of [['completed','Completed',d.completed],['failed','Failed',d.failed],['other','Open or stopped',other]]){const sp=el('span');const sw=el('i');sw.style.background=colors[k];sp.append(sw,document.createTextNode(`${label}: ${v}`));tip.append(sp);}const rect=box.getBoundingClientRect(),sx=rect.width/W;tip.style.left=((pad.l+i*step+step/2)*sx)+'px';tip.style.top=((pad.t+ih-(d.created/top)*ih)*sx)+'px';});
  hit.addEventListener('pointerleave',()=>{tip.hidden=true;});
  s.append(g,hit);
 });
 if(!days.some(d=>d.created)){const n=svg('text',{class:'empty-note',x:pad.l+iw/2,y:pad.t+ih/2,'text-anchor':'middle'});n.textContent='No missions in the last 14 days. Send one from the office.';s.append(n);}
 box.append(s,tip);
 const lg=q('#throughput-legend');lg.replaceChildren();
 for(const [cls,label]of [['sw-ok','Completed'],['sw-alert','Failed'],['sw-other','Open or stopped']]){const sp=el('span');sp.append(el('i',cls),document.createTextNode(label));lg.append(sp);}
}

function drawLatency(){
 const box=q('#latency-chart');box.replaceChildren();
 const pts=samples.slice(-20),W=320,H=84;
 const s=svg('svg',{viewBox:`0 0 ${W} ${H}`,preserveAspectRatio:'none',role:'img','aria-label':`Round-trip times for the last ${pts.length} refreshes`});
 s.append(svg('line',{class:'spark-base',x1:0,x2:W,y1:H-1,y2:H-1}));
 if(pts.length){
  const max=Math.max(...pts.map(p=>p.ms))*1.15||1,x=i=>pts.length===1?W/2:i*(W-6)/(pts.length-1)+3,y=v=>H-4-(v/max)*(H-12);
  const d=pts.map((p,i)=>`${i?'L':'M'}${x(i).toFixed(1)} ${y(p.ms).toFixed(1)}`).join(' ');
  if(pts.length>1)s.append(svg('path',{class:'spark-area',d:`${d} L${x(pts.length-1)} ${H-1} L${x(0)} ${H-1}Z`}),svg('path',{class:'spark-line',d}));
  s.append(svg('circle',{class:'spark-dot',cx:x(pts.length-1),cy:y(pts.at(-1).ms),r:4}));
 }
 box.append(s);
 const ms=samples.map(p=>p.ms),kv=q('#latency-stats');kv.replaceChildren();
 const add=(k,v)=>kv.append(el('dt',null,k),el('dd',null,v));
 add('Latest',ms.length?Math.round(ms.at(-1))+' ms':'—');add('Median',ms.length?Math.round(median(ms))+' ms':'—');add('Fastest · slowest',ms.length?`${Math.round(Math.min(...ms))} · ${Math.round(Math.max(...ms))} ms`:'—');
 if(data?.edge?.httpProtocol)add('Protocol',`${data.edge.httpProtocol}${data.edge.tlsVersion?' · '+data.edge.tlsVersion:''}`);
}

function renderStorage(st){
 const rows=st.breakdown,max=Math.max(1,...rows.map(r=>r.bytes));
 const table=el('table','data-table'),head=el('tr');
 for(const [h,n]of [['Record type'],['Records','num'],['Size','num'],['']])head.append(el('th',n,h));
 const thead=el('thead');thead.append(head);const tb=el('tbody');
 if(!rows.length){const tr=el('tr'),td=el('td','quiet','Nothing stored yet.');td.colSpan=4;tr.append(td);tb.append(tr);}
 for(const r of rows){const tr=el('tr'),name=el('td');name.append(document.createTextNode(STORE_NAMES[r.prefix]||r.prefix),el('code',null,r.prefix+':'));const m=el('span','meter'),f=el('span');f.style.width=Math.max(2,r.bytes/max*100)+'%';m.append(f);const mt=el('td');mt.append(m);tr.append(name,el('td','num',nf.format(r.records)),el('td','num',bytes(r.bytes)),mt);tb.append(tr);}
 table.append(thead,tb);
 const note=el('p','quiet',st.artifacts==='s3'?'Files are stored in a private S3 bucket through the executor, encrypted with SSE-AES256.':'Files are stored inside this Durable Object’s SQLite database.');note.style.marginTop='10px';
 q('#storage-table').replaceChildren(table,note);
}

let probe=null;
function renderServices(d){
 const sv=d.services,list=q('#services-list');list.replaceChildren();
 const item=(state,title,detail,action)=>{const li=el('li'),dot=el('span','dot');dot.dataset.s=state;const body=el('div');body.append(el('strong',null,title),el('small',null,detail));li.append(dot,body);if(action)li.append(action);list.append(li);};
 const model=m=>m?`${m.provider} · ${m.model}`:'No model chosen. Set one in Settings.';
 item(sv.models.operator?'on':'off','Jarvis model',model(sv.models.operator));
 item(sv.models.steward?'on':'off','Friday model',model(sv.models.steward));
 let action=null;
 if(sv.executor){action=el('button',null,probe?.busy?'Checking…':'Check now');action.type='button';action.disabled=!!probe?.busy;action.onclick=runProbe;}
 const probeText=!sv.executor?'Not connected. Browser and Python tools are off.':probe?.result?probe.result.ok?`Healthy · ${probe.result.latencyMs} ms from the Durable Object${probe.result.service?' · '+probe.result.service:''}`:`Unhealthy: ${probe.result.error||'HTTP '+probe.result.status}`:'Configured. Check health on demand.';
 item(!sv.executor?'off':probe?.result?(probe.result.ok?'on':'alert'):'warn','Linux executor (AWS EC2 · Docker)',probeText,action);
 item(sv.memoryService?'on':'off','Long-term memory service',sv.memoryService?'AgentMemory connected.':'Built-in memory only.');
 item(sv.codexHarness?'on':'off','Cloud Codex harness',sv.codexHarness?'Configured.':'Not configured.');
 item(sv.telegram?'on':'off','Telegram',sv.telegram?'Bot connected.':'Not connected.');
 item(sv.gmail?'on':'off','Gmail',sv.gmail?'OAuth client configured.':'Not connected.');
 item(sv.mcp?'on':'off','MCP tool servers',sv.mcp?`${sv.mcp} connected.`:'None.');
 item(sv.devices?'on':'off','Laptop companion',sv.devices?`${sv.devices} paired.`:'No laptop paired.');
}
async function runProbe(){
 probe={busy:true};if(data)renderServices(data);
 try{const r=await fetch('/api/cloud/probe',{cache:'no-store'});probe={result:await r.json()};}
 catch{probe={result:{ok:false,error:'Request failed.'}};}
 if(data)renderServices(data);
}

const priceInput=q('#token-price');
function renderCost(tokens){
 const price=Number(priceInput.value),out=q('#cost-result');out.replaceChildren();
 if(!priceInput.value||!Number.isFinite(price)||price<0){out.textContent=`${nf.format(tokens)} tokens so far. Enter a price to estimate spend.`;return;}
 const usd=tokens/1e6*price;out.append(el('b',null,usd<0.01&&usd>0?'< $0.01':'$'+usd.toFixed(usd<10?2:0)),document.createTextNode(`for ${nf.format(tokens)} tokens at $${price}/1M`));
}
if(priceInput){priceInput.value=store.get('jf-token-price')??'';priceInput.oninput=()=>{store.set('jf-token-price',priceInput.value);if(data)renderCost(data.tasks.tokens);};}
q('#cloud-backup')?.addEventListener('click',()=>{store.set('jf-last-backup',String(Date.now()));setTimeout(()=>{if(data)q('#backup-note').textContent='Export started. Keep the file somewhere other than this deployment.';},50);});

/* ---------- architecture ---------- */
function renderArchitecture(d){
 const sv=d.services,edge=d.edge,last=samples.at(-1);
 const hops=[
  ['Your browser',`Round trip ${last?Math.round(last.ms)+' ms':'—'}`,null],
  ['Cloudflare edge',edge?.colo?`${edge.city?edge.city+', ':''}${edge.country??''} · ${edge.httpProtocol??''}${edge.tlsVersion?' · '+edge.tlsVersion:''}`:'Local runtime (wrangler dev)',edge?.colo||'dev'],
  ['Worker (V8 isolate)','Serves the office and routes /api/* to one Durable Object.',null],
  ['Durable Object',`Single-writer actor for all missions. ID ${d.runtime.object.id.slice(0,8)}…`,d.runtime.object.class],
  ['SQLite storage',`${bytes(d.runtime.databaseBytes)} stored with the object`,null],
  ['Linux executor',sv.executor?'AWS EC2 host running Docker sandboxes for browser and Python tools':'Not connected in this deployment',sv.executor?'EC2':null,!sv.executor]
 ];
 const ol=q('#request-path');ol.replaceChildren();
 for(const [title,detail,code,off]of hops){const li=el('li');if(off)li.dataset.off='';const st=el('strong',null,title+' ');if(code)st.append(el('code',null,code));li.append(st,el('small',null,detail));ol.append(li);}
 const records=d.storage.breakdown.reduce((n,r)=>n+r.records,0);
 const L=[
  {unit:'Unit 2 · CO1',name:'Physical layer',about:'Compute, storage and network hardware the service runs on.',items:[
   ['Edge data centre',edge?.colo?'Requests land in the nearest Cloudflare PoP.':'Local machine in development.','wrangler.jsonc',edge?.colo?`PoP ${edge.colo}`:'local','on'],
   ['Durable Object storage','SQLite database co-located with the object; survives restarts.','src/index.ts · Relay',`${bytes(d.runtime.databaseBytes)} · ${records} records`,'on'],
   ['EC2 compute host','Linux VM that hosts the Docker executor.','infra/aws-template.mjs',sv.executor?'configured':'not connected',sv.executor?'on':'off'],
   ['S3 object storage','Private bucket for files; SSE-AES256, public access blocked.','executor/artifacts.mjs',d.storage.artifacts==='s3'?'in use':'not in use (SQLite)',d.storage.artifacts==='s3'?'on':'off'],
   ['Laptop companion','Owner’s machine holds the private corpus; never uploaded wholesale.','companion/companion.py',`${sv.devices} paired`,sv.devices?'on':'off']]},
  {unit:'Unit 3 · CO2',name:'Virtual layer',about:'Abstractions that pool and isolate the physical resources.',items:[
   ['V8 isolates','The Worker runs in a lightweight isolate, not a VM or container: millisecond cold starts.','src/index.ts · default export','Workers runtime','on'],
   ['Durable Object instance','One named object (“personal-owner”) gives strongly consistent state for the whole office.','wrangler.jsonc · durable_objects',d.runtime.object.id.slice(0,10)+'…','on'],
   ['Docker sibling containers','Each browser/Python job runs in its own container on the EC2 host; no Docker socket inside.','executor/Dockerfile · executor/server.mjs',sv.executor?'available':'executor offline',sv.executor?'on':'off'],
   ['Codex harness container','Optional containerised agent runtime reached over HTTPS.','harness/Dockerfile',sv.codexHarness?'configured':'not configured',sv.codexHarness?'on':'off']]},
  {unit:'Unit 4 · CO3',name:'Control layer',about:'Scheduling, admission, rate control and monitoring of the virtual resources.',items:[
   ['Alarm scheduler','Durable Object alarms wake the task loop, retries and routines.','src/index.ts · wake()',d.runtime.nextAlarm?'next '+rel(d.runtime.nextAlarm):'idle','on'],
   ['Admission control','At most 5 open missions; at most 2 run concurrently.','src/index.ts · createTask()',`${d.tasks.open}/${d.control.openLimit} open · ${d.tasks.running}/${d.control.concurrencyLimit} running`,'on'],
   ['Rate-limit back-off','Honours provider Retry-After and retries temporary 429/503s.','src/providers.ts','up to 3 retries','on'],
   ['Bounded parallel reads','Independent reads fan out with a fixed concurrency limit.','src/index.ts · parallel_reads',`${d.control.readConcurrency} at a time`,'on'],
   ['Context budget','Long histories are compacted to stay inside the model window.','src/context.ts',`${nf.format(d.control.contextChars)} chars`,'on'],
   ['Monitoring','Workers observability on; CloudWatch log group for the VM.','wrangler.jsonc · infra/aws-template.mjs','logs enabled','on']]},
  {unit:'Unit 5 · CO4',name:'Security',about:'Identity, encryption and policy around every layer.',items:[
   ['Signed sessions','HMAC-SHA256 cookie, HttpOnly + SameSite=Strict, 8-hour expiry.','src/security.ts · session()',d.transport.protocol==='https'?'Secure cookie':'HTTP (dev)',d.transport.protocol==='https'?'on':'warn'],
   ['Sealed secrets','API keys and tokens encrypted with AES-256-GCM before storage.','src/security.ts · seal()','AES-GCM','on'],
   ['Exact approvals','Side-effecting tool calls wait for owner approval of their exact arguments.','src/tools.ts · needsApproval()',`${d.security.events.filter(e=>e.kind==='approved').length} approved recently`,'on'],
   ['Egress policy','Sandbox can reach public IPv4 only; metadata and private ranges blocked.','executor/network.mjs · executor/policy.mjs','DNS pinned','on'],
   ['IAM instance role','The VM gets scoped S3/log permissions; no long-lived keys on disk.','infra/aws-template.mjs',sv.executor?'attached':'n/a',sv.executor?'on':'off']]},
  {unit:'Unit 6 · CO5',name:'Orchestration',about:'Automation that deploys, wires and coordinates everything.',items:[
   ['Infrastructure as code','CloudFormation template creates the VM, security group, IAM role, bucket and logs.','infra/aws-template.mjs · infra/deploy-aws.ps1','CloudFormation','on'],
   ['Edge deployment','Declarative Worker + Durable Object config; one command deploys globally.','wrangler.jsonc','wrangler deploy','on'],
   ['CI pipeline','Every push runs type checks, unit and integration suites.','.github/workflows/checks.yml','GitHub Actions','on'],
   ['Agent delegation','Jarvis hands focused checks to Friday and waits on the result.','src/workflow.ts · delegate_task',`${d.tasks.delegated} delegated task${d.tasks.delegated===1?'':'s'}`,'on'],
   ['Routines','Recurring missions on a schedule, driven by the alarm scheduler.','src/persistence.ts',d.control.routines?`${d.control.routines} active`:'none','on']]}
 ];
 const stack=q('#layer-stack');stack.replaceChildren();
 for(const layer of L){
  const sec=el('section','layer'),head=el('div','layer-head');head.append(el('span','unit',layer.unit),el('h4',null,layer.name),el('p',null,layer.about));
  const items=el('div','layer-items');
  for(const [name,desc,file,live,state]of layer.items){const it=el('div','layer-item'),dot=el('span','dot');dot.dataset.s=state;const body=el('div');body.append(el('strong',null,name),el('p',null,desc),el('code',null,file));const lv=el('span','live',live);body.append(el('br'),lv);it.append(dot,body);items.append(it);}
  sec.append(head,items);stack.append(sec);
 }
}

/* ---------- security ---------- */
const STATUS_TEXT={pass:'✓ Pass',warn:'! Review',info:'i Note'};
function renderSecurity(d){
 const checks=d.security.checks,count=s=>checks.filter(c=>c.status===s).length,pass=count('pass'),warn=count('warn'),info=count('info');
 const sum=q('#security-summary');sum.replaceChildren();
 const score=el('div','score',`${pass}`);score.append(el('small',null,`of ${checks.length} passing`));
 const bar=el('div','security-bar');bar.setAttribute('role','img');bar.setAttribute('aria-label',`${pass} pass, ${warn} to review, ${info} notes`);
 for(const [n,v]of [['--ok',pass],['--warn',warn],['--faint',info]])if(v){const s=el('span');s.style.flex=String(v);s.style.background=`var(${n})`;bar.append(s);}
 sum.append(score,bar,el('p',null,warn?`${warn} item${warn===1?'':'s'} to review. Warnings are honest gaps in this prototype, ordered by area below; none of them exposes a secret on its own.`:'No open warnings for this configuration.'));
 const box=q('#security-checks');box.replaceChildren();
 const areas=[...new Set(checks.map(c=>c.area))];
 for(const a of areas){const g=el('div','check-group');g.append(el('h4',null,a));for(const c of checks.filter(c=>c.area===a)){const r=el('div','check-row'),pill=el('span','pill',STATUS_TEXT[c.status]);pill.dataset.s=c.status;r.append(pill,el('strong',null,c.label),el('p',null,c.detail));g.append(r);}box.append(g);}
 const shared=q('#shared-model');shared.replaceChildren();
 for(const [who,items]of [['Cloudflare secures',['Edge data centres and network','Isolate runtime and patching','DDoS absorption and TLS termination']],['AWS secures',['EC2 hypervisor and hardware','S3 durability and encryption service','IAM service itself']],['You secure',['Admin password and model keys','Which actions you approve','Executor OS patches and Docker images','Which MCP servers and laptops you trust']]]){const s=el('section');s.append(el('h4',null,who));const ul=el('ul');for(const i of items)ul.append(el('li',null,i));s.append(ul);shared.append(s);}
 const ev=q('#security-events');ev.replaceChildren();
 if(!d.security.events.length){ev.append(el('p','quiet','No protected actions yet. Approvals, denials and stops will be listed here.'));return;}
 const table=el('table','data-table'),hr=el('tr');for(const h of ['When','Decision','Action','Mission'])hr.append(el('th',null,h));const th=el('thead');th.append(hr);const tb=el('tbody');
 const kindText={approval:'Asked',approved:'Approved',denied:'Declined',ambiguous:'Unclear outcome',reconciled:'Reconciled',cancelled:'Stopped'};
 for(const e of d.security.events){const tr=el('tr'),k=el('span','event-kind',kindText[e.kind]||e.kind);k.dataset.k=e.kind;const kt=el('td');kt.append(k);tr.append(el('td',null,clock(e.time)),kt,el('td',null,e.text),el('td','quiet',e.mission));tb.append(tr);}
 table.append(th,tb);const wrap=el('div','table-scroll');wrap.append(table);ev.append(wrap);
}

/* ---------- scaling lab (simulation) ---------- */
const lab=(()=>{
 const DT=30,BOOT=8,QUEUE_SECONDS=20,HISTORY=240,TICK_MS=280;
 const inp=id=>q('#lab-'+id);
 let S=null,timer=null,paused=false,hover=null;
 const cfg=()=>({pattern:inp('pattern').value,rate:+inp('rate').value,algo:inp('algo').value,cap:+inp('capacity').value,auto:inp('autoscale').checked,target:+inp('target').value/100,min:Math.max(1,+inp('min').value||1),max:Math.max(1,+inp('max').value||1),cooldown:+inp('cooldown').value,price:Math.max(0,+inp('price').value||0)});
 let nextId=1;
 const server=(c,state='up')=>{const size=c.algo==='weighted'&&nextId%3===0?2:1;return {id:nextId++,size,state,boot:state==='booting'?BOOT:0,backlog:0,util:0,offered:0,lat:0,cw:0,failedAt:null};};
 function reset(){nextId=1;const c=cfg();S={t:0,servers:Array.from({length:Math.min(c.max,c.min)},()=>server(c)),desired:Math.min(c.max,c.min),lastScale:-999,rr:0,demand:[],capacity:[],served:0,dropped:0,cost:0,recentDrop:[],events:[]};draw();paint();}
 function demandAt(c,t){
  const R=c.rate,phase=t%HISTORY,noise=1+(Math.sin(t*1.7)+Math.sin(t*0.37))*0.03;
  if(c.pattern==='steady')return R*noise;
  if(c.pattern==='diurnal')return R*(0.55+0.45*Math.sin((phase/HISTORY)*2*Math.PI-Math.PI/2))*noise+R*0.1;
  if(c.pattern==='spike')return R*(phase>=70&&phase<100?2.8:phase>=100&&phase<115?1.6:0.7)*noise;
  return R*Math.min(2.6,0.35+phase/HISTORY*2.6)*noise;
 }
 function pick(live,c){
  if(c.algo==='random')return live[Math.floor(Math.random()*live.length)];
  if(c.algo==='least-conn'){let best=live[0];for(const s of live)if((s.backlog+s.offered)/(c.cap*s.size)<(best.backlog+best.offered)/(c.cap*best.size))best=s;return best;}
  if(c.algo==='weighted'){let total=0,best=null;for(const s of live){s.cw+=s.size;total+=s.size;if(!best||s.cw>best.cw)best=s;}best.cw-=total;return best;}
  S.rr=(S.rr+1)%live.length;return live[S.rr];
 }
 function step(){
  const c=cfg();S.t++;
  for(const s of S.servers){if(s.state==='booting'&&--s.boot<=0)s.state='up';}
  S.servers=S.servers.filter(s=>!(s.state==='failed'&&S.t-s.failedAt>=2));
  const live=S.servers.filter(s=>s.state==='up');
  const demand=demandAt(c,S.t),incoming=demand*DT;
  for(const s of S.servers){s.offered=0;}
  let dropped=0;
  if(!live.length)dropped=incoming;
  else{const chunks=Math.max(live.length*12,60),size=incoming/chunks;for(let i=0;i<chunks;i++)pick(live,c).offered+=size;}
  let served=0,latW=0,maxLat=0;
  for(const s of live){const capTick=c.cap*s.size*DT,work=s.backlog+s.offered,done=Math.min(work,capTick);s.backlog=work-done;const limit=c.cap*s.size*QUEUE_SECONDS;if(s.backlog>limit){dropped+=s.backlog-limit;s.backlog=limit;}s.util=done/capTick;s.load=s.offered/capTick;s.lat=40+s.backlog/(c.cap*s.size)*1000;served+=done;latW+=s.lat*s.offered;if(s.offered>0)maxLat=Math.max(maxLat,s.lat);}
  for(const s of S.servers)if(s.state!=='up'){s.util=0;s.load=0;}
  const avgLoad=live.length?live.reduce((n,s)=>n+s.load*s.size,0)/live.reduce((n,s)=>n+s.size,0):1;
  // Autoscaler: target tracking on offered load; scale out proportionally, scale in one at a time.
  if(c.auto&&S.t-S.lastScale>=c.cooldown/DT){
   const inService=live.length,pending=S.servers.filter(s=>s.state==='booting').length;
   let want=S.desired;
   if(avgLoad>c.target*1.05&&inService)want=Math.max(S.desired,Math.ceil(inService*avgLoad/c.target)+0);
   else if(!inService)want=Math.max(S.desired,c.min);
   else if(avgLoad<c.target*0.7&&!pending)want=S.desired-1;
   want=Math.max(c.min,Math.min(c.max,want));
   if(want!==S.desired){S.desired=want;S.lastScale=S.t;}
  }
  if(c.auto){
   const healthy=S.servers.filter(s=>s.state!=='failed');
   for(let n=healthy.length;n<S.desired;n++)S.servers.push(server(c,'booting'));
   if(healthy.length>S.desired){const victims=[...healthy].sort((a,b)=>(a.state==='booting'?-1:0)-(b.state==='booting'?-1:0)||a.backlog-b.backlog).slice(0,healthy.length-S.desired);S.servers=S.servers.filter(s=>!victims.includes(s));}
  }
  const running=S.servers.filter(s=>s.state!=='failed').reduce((n,s)=>n+s.size,0);
  S.cost+=running*DT/3600*c.price;S.served+=served;S.dropped+=dropped;
  S.recentDrop.push({in:incoming,drop:dropped});S.recentDrop=S.recentDrop.slice(-10);
  S.demand.push(demand);S.capacity.push(live.reduce((n,s)=>n+c.cap*s.size,0));S.demand=S.demand.slice(-HISTORY);S.capacity=S.capacity.slice(-HISTORY);
  S.lat={avg:served?latW/Math.max(1,live.reduce((n,s)=>n+s.offered,0)):0,max:maxLat};S.avgUtil=live.length?live.reduce((n,s)=>n+s.util*s.size,0)/live.reduce((n,s)=>n+s.size,0):0;S.price=running*c.price;
  draw();paint();
 }
 function paint(){
  const c=cfg(),live=S.servers.filter(s=>s.state==='up').length,boot=S.servers.filter(s=>s.state==='booting').length;
  const rd=S.recentDrop.reduce((a,r)=>({in:a.in+r.in,drop:a.drop+r.drop}),{in:0,drop:0}),dropPct=rd.in?rd.drop/rd.in*100:0;
  const hours=Math.floor(S.t*DT/3600),mins=Math.floor(S.t*DT%3600/60);
  q('#lab-metrics').replaceChildren(
   readout('Demand',S.demand.length?nf.format(Math.round(S.demand.at(-1))):'—','req/s',`sim clock ${hours}h ${String(mins).padStart(2,'0')}m`),
   readout('Servers',String(live),boot?`+${boot} booting`:null,c.auto?`desired ${S.desired} (${c.min}–${c.max})`:'fixed fleet'),
   readout('Utilisation',S.t?Math.round(S.avgUtil*100)+'%':'—',null,`target ${Math.round(c.target*100)}%`,{tone:S.avgUtil>0.95?'alert':null}),
   readout('Latency',S.t?nf.format(Math.round(S.lat.avg)):'—','ms',S.t?`worst ${nf.format(Math.round(S.lat.max))} ms`:'',{tone:S.t&&S.lat.avg>1000?'alert':null}),
   readout('Dropped',S.t?(dropPct<0.1&&dropPct>0?'<0.1':dropPct.toFixed(dropPct<10?1:0))+'%':'—',null,'last 5 sim minutes',{tone:dropPct>1?'alert':S.t?'ok':null}),
   readout('Cost so far','$'+S.cost.toFixed(S.cost<10?3:2),null,`$${(S.price||0).toFixed(3)}/hour now`)
  );
  const fleet=q('#lab-fleet');fleet.replaceChildren();
  for(const s of S.servers){const d=el('div','server');d.dataset.state=s.state;if(s.size===2)d.dataset.size='2';if(s.state==='up'&&s.util>0.9)d.dataset.hot='';const b=el('b');b.append(el('span',null,'srv-'+String(s.id).padStart(2,'0')),el('span',null,s.state==='up'?Math.round(s.util*100)+'%':''));const bar=el('span','bar'),f=el('span');f.style.width=(s.state==='booting'?(1-s.boot/BOOT)*100:s.util*100)+'%';bar.append(f);d.append(b,bar,el('span','state',s.state==='booting'?'booting · health check pending':s.state==='failed'?'failed · out of rotation':s.size===2?'large · weight 2':'in service'));fleet.append(d);}
  q('#fleet-caption').textContent=`${algoName(c.algo)} across ${live} in-service server${live===1?'':'s'}.`;
  q('#lab-run').textContent=paused?'Resume':'Pause';
 }
 const algoName=a=>({'round-robin':'Round robin','least-conn':'Least connections','weighted':'Weighted round robin','random':'Random'}[a]);
 const canvas=q('#lab-chart'),tipBox=el('div','chart-tip');tipBox.hidden=true;
 function draw(){
  if(!canvas||!S)return;
  api.drawn=true;
  const dpr=window.devicePixelRatio||1,w=canvas.clientWidth||600,h=canvas.clientHeight||220;
  if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
  const g=canvas.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,w,h);
  const pad={l:48,r:8,t:10,b:24},iw=w-pad.l-pad.r,ih=h-pad.t-pad.b;
  const max=Math.max(100,...S.demand,...S.capacity)*1.1,nice=Math.pow(10,Math.floor(Math.log10(max/4))),stepV=Math.ceil(max/4/nice)*nice,top=stepV*4;
  const font=getComputedStyle(document.body).fontFamily;
  g.font=`11px ${font}`;g.fillStyle=cssVar('--muted');g.strokeStyle=cssVar('--line');g.lineWidth=1;g.textAlign='right';g.textBaseline='middle';
  for(let i=0;i<=4;i++){const y=pad.t+ih-(i/4)*ih;g.beginPath();g.moveTo(pad.l,Math.round(y)+.5);g.lineTo(w-pad.r,Math.round(y)+.5);g.stroke();g.fillText(compact(stepV*i),pad.l-8,y);}
  g.textBaseline='alphabetic';
  g.textAlign='center';g.fillText('−2 h',pad.l+8,h-6);g.fillText('−1 h',pad.l+iw/2,h-6);g.textAlign='right';g.fillText('now',w-pad.r,h-6);
  const x=i=>pad.l+(i+(HISTORY-S.demand.length))/(HISTORY-1)*iw,y=v=>pad.t+ih-(v/top)*ih;
  const line=(arr,color,stepped,dash)=>{if(arr.length<2)return;g.strokeStyle=color;g.lineWidth=2;g.lineJoin='round';g.setLineDash(dash||[]);g.beginPath();arr.forEach((v,i)=>{if(!i)g.moveTo(x(i),y(v));else if(stepped){g.lineTo(x(i),y(arr[i-1]));g.lineTo(x(i),y(v));}else g.lineTo(x(i),y(v));});g.stroke();g.setLineDash([]);};
  line(S.capacity,cssVar('--series-1'),true);
  line(S.demand,cssVar('--series-2'),false);
  if(hover!==null&&hover<S.demand.length){const hx=x(hover);g.strokeStyle=cssVar('--faint');g.lineWidth=1;g.beginPath();g.moveTo(hx,pad.t);g.lineTo(hx,pad.t+ih);g.stroke();for(const [arr,col]of [[S.capacity,'--series-1'],[S.demand,'--series-2']]){g.fillStyle=cssVar(col);g.strokeStyle=cssVar('--panel');g.lineWidth=2;g.beginPath();g.arc(hx,y(arr[hover]),4.5,0,Math.PI*2);g.fill();g.stroke();}}
  const lg=q('#lab-legend');if(!lg.childElementCount){for(const [cls,label]of [['sw-s2 line','Demand'],['sw-s1 line','In-service capacity']]){const sp=el('span');sp.append(el('i',cls),document.createTextNode(label));lg.append(sp);}}
 }
 if(canvas){
  canvas.parentElement.style.position='relative';canvas.parentElement.append(tipBox);
  canvas.addEventListener('pointermove',e=>{if(!S||S.demand.length<2)return;const r=canvas.getBoundingClientRect(),w=r.width,iw=w-56,px=e.clientX-r.left-48;const i=Math.round(px/iw*(HISTORY-1))-(HISTORY-S.demand.length);if(i<0||i>=S.demand.length){hover=null;tipBox.hidden=true;draw();return;}hover=i;draw();const ago=(S.demand.length-1-i)*DT/60;tipBox.hidden=false;tipBox.replaceChildren(el('b',null,ago<1?'Now':`${Math.round(ago)} min ago`));for(const [cls,label,v]of [['sw-s2','Demand',S.demand[i]],['sw-s1','Capacity',S.capacity[i]]]){const sp=el('span');sp.append(el('i',cls),document.createTextNode(`${label}: ${nf.format(Math.round(v))} req/s`));tipBox.append(sp);}tipBox.style.left=(canvas.offsetLeft+e.clientX-r.left)+'px';tipBox.style.top=(canvas.offsetTop+Math.min(e.clientY-r.top,60))+'px';});
  canvas.addEventListener('pointerleave',()=>{hover=null;tipBox.hidden=true;draw();});
  new ResizeObserver(()=>{if(S)draw();}).observe(canvas);
 }
 const outputs=()=>{q('#lab-rate-out').textContent=inp('rate').value+' req/s';q('#lab-capacity-out').textContent=inp('capacity').value+' req/s';q('#lab-target-out').textContent=inp('target').value+'%';q('#lab-cooldown-out').textContent=inp('cooldown').value+' s';};
 for(const id of ['rate','capacity','target','cooldown'])inp(id)?.addEventListener('input',()=>{outputs();if(S)paint();});
 for(const id of ['pattern','algo','autoscale','min','max','price'])inp(id)?.addEventListener('change',()=>{if(!S)return;const c=cfg();if(id==='algo'){for(const s of S.servers)s.cw=0;}if(id==='min'||id==='max'||id==='autoscale'){S.desired=Math.max(c.min,Math.min(c.max,c.auto?S.desired:S.servers.filter(s=>s.state!=='failed').length));}paint();});
 q('#lab-form')?.addEventListener('submit',e=>e.preventDefault());
 q('#lab-run')?.addEventListener('click',()=>{paused=!paused;if(paused)stop();else run();paint();});
 q('#lab-reset')?.addEventListener('click',()=>{reset();});
 q('#lab-fail')?.addEventListener('click',()=>{if(!S)return;const up=S.servers.filter(s=>s.state==='up');if(!up.length)return;const v=up[Math.floor(Math.random()*up.length)];v.state='failed';v.failedAt=S.t;v.backlog=0;paint();});
 function run(){if(timer||paused)return;timer=setInterval(()=>{if(document.hidden)return;step();},TICK_MS);}
 function stop(){clearInterval(timer);timer=null;}
 const api={drawn:false,draw:()=>draw(),start(){outputs();if(!S)reset();run();},pause(soft){stop();if(!soft)paused=true;}};
 return api;
})();

})();
