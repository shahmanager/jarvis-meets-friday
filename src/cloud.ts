// Cloud console: read-only, owner-authenticated views of the deployment this office runs on.
// Every value here is measured from the running Worker/Durable Object or derived from configuration.
// Nothing is simulated server-side; the scaling lab is a separate, clearly labelled client simulation.
import {HttpError,securityHeaders,bounded} from './security';
import {preferences} from './preferences';

export const EDGE_HEADER='x-relay-edge';
const EDGE_FIELDS=['colo','country','city','region','continent','timezone','httpProtocol','tlsVersion','asOrganization','clientTcpRtt'] as const;

// The front Worker is the only writer of the edge header. It always replaces any client-sent value,
// and only for /api/cloud routes, so other API requests pass through unchanged.
export function withEdgeContext(request:Request){
 const cf=(request as Request & {cf?:Record<string,unknown>}).cf??{};
 const edge:Record<string,unknown>={};
 for(const field of EDGE_FIELDS){const value=cf[field];if(typeof value==='string'||typeof value==='number')edge[field]=typeof value==='string'?value.slice(0,120):value;}
 const headers=new Headers(request.headers);headers.set(EDGE_HEADER,JSON.stringify(edge));
 return new Request(request,{headers});
}

type Status='pass'|'warn'|'info';
type Check={id:string;area:string;label:string;status:Status;detail:string};
type Sealed={iv:number[],data:number[]};
type TaskLike={id:string;prompt:string;status:string;created:string;updated:string;assignee?:string;tokens:number;steps:number;stewardCalls?:number;searchCalls?:number;delegatedBy?:string;answer?:string;error?:string;reviewStatus?:string;artifacts?:{id:string;name:string;bytes:number}[];events?:{time:string;kind:string;text:string}[]};
type DeviceLike={id:string;name:string;seen:string;revoked?:boolean};
type McpLike={id:string;name:string;url:string;secret?:Sealed};
type SettingsLike={main?:{provider:string;model:string};steward?:{provider:string;model:string};keys?:Record<string,Sealed|undefined>;preferences?:unknown};
type ConnectionLike={telegram?:{secret?:Sealed};google?:{secret?:Sealed}};

export type CloudHost={
 sql:SqlStorage;
 storage:DurableObjectStorage;
 env:Env;
 objectId:string;
 get<T>(key:string):T|undefined;
 list<T>(prefix:string):T[];
};

// Admission-control constants mirrored from the task loop in index.ts (createTask and wake).
export const OPEN_TASK_LIMIT=5,CONCURRENT_TASK_LIMIT=2;
const OPEN=['queued','running','executing','waiting_peer','waiting_local','waiting_approval','ambiguous'];
const SECURITY_EVENTS=new Set(['approval','approved','denied','ambiguous','reconciled','cancelled']);

const json=(value:unknown,status=200,extra:Record<string,string>={})=>Response.json(value,{status,headers:{'Cache-Control':'no-store',...securityHeaders(),...extra}});

function edgeContext(request:Request){
 try{const raw=request.headers.get(EDGE_HEADER);if(!raw||raw.length>2000)return null;const value=JSON.parse(raw);return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;}catch{return null;}
}

function sessionExpiry(request:Request){
 const token=request.headers.get('Cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith('relay_session='))?.slice(14)??'';
 const exp=Number(token.split('.')[0]);return Number.isFinite(exp)&&exp>0?exp:null;
}

export function storageBreakdown(sql:SqlStorage){
 const rows=sql.exec<{prefix:string;records:number;bytes:number}>("SELECT CASE WHEN instr(key,':')>0 THEN substr(key,1,instr(key,':')-1) ELSE key END AS prefix, count(*) AS records, sum(length(key)+length(value)) AS bytes FROM records GROUP BY prefix ORDER BY bytes DESC").toArray();
 return rows.map(r=>({prefix:String(r.prefix),records:Number(r.records),bytes:Number(r.bytes)}));
}

export function taskAnalytics(tasks:TaskLike[],today=new Date()){
 const byStatus:Record<string,number>={};for(const t of tasks)byStatus[t.status]=(byStatus[t.status]??0)+1;
 const finished=tasks.filter(t=>['completed','failed'].includes(t.status));
 const completed=tasks.filter(t=>t.status==='completed');
 const durations=completed.map(t=>(Date.parse(t.updated)-Date.parse(t.created))/1000).filter(n=>Number.isFinite(n)&&n>=0).sort((a,b)=>a-b);
 const days:{day:string;created:number;completed:number;failed:number}[]=[];
 for(let i=13;i>=0;i--){const d=new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),today.getUTCDate()-i));days.push({day:d.toISOString().slice(0,10),created:0,completed:0,failed:0});}
 const index=new Map(days.map((d,i)=>[d.day,i]));
 for(const t of tasks){const i=index.get(String(t.created).slice(0,10));if(i===undefined)continue;days[i].created++;if(t.status==='completed')days[i].completed++;if(t.status==='failed')days[i].failed++;}
 const pct=(p:number)=>durations.length?durations[Math.min(durations.length-1,Math.floor(p*durations.length))]:null;
 return {
  total:tasks.length,
  missions:tasks.filter(t=>!t.delegatedBy).length,
  delegated:tasks.filter(t=>!!t.delegatedBy).length,
  byStatus,
  open:tasks.filter(t=>OPEN.includes(t.status)).length,
  running:tasks.filter(t=>['running','executing'].includes(t.status)).length,
  successRate:finished.length?completed.length/finished.length:null,
  medianSeconds:pct(0.5),
  p90Seconds:pct(0.9),
  tokens:tasks.reduce((n,t)=>n+(t.tokens||0),0),
  modelCalls:tasks.reduce((n,t)=>n+(t.steps||0)+(t.stewardCalls??0)+(t.searchCalls??0),0),
  artifacts:tasks.reduce((n,t)=>n+(t.artifacts?.length??0),0),
  artifactBytes:tasks.reduce((n,t)=>n+(t.artifacts??[]).reduce((m,a)=>m+(a.bytes||0),0),0),
  days
 };
}

export function securityChecks(input:{url:URL;env:Env;settings:SettingsLike|undefined;connections:ConnectionLike|undefined;devices:DeviceLike[];mcp:McpLike[];sessionExp:number|null;now?:number}):Check[]{
 const {url,env,settings,connections,devices,mcp}=input,now=input.now??Date.now(),checks:Check[]=[];
 const https=url.protocol==='https:',password=String(env.ADMIN_PASSWORD??'');
 checks.push({id:'admin-password',area:'Identity',label:'Workspace password strength',status:password.length>=32?'pass':'info',detail:password.length>=32?`Long secret (${password.length >= 48 ? '48+' : '32+'} characters). The server refuses to start below 24.`:'Meets the enforced 24-character minimum. 32+ characters is recommended for a shared deployment.'});
 checks.push({id:'session',area:'Identity',label:'Session cookie',status:https?'pass':'warn',detail:`HMAC-SHA256 signed, HttpOnly, SameSite=Strict, 8-hour lifetime${https?', Secure (HTTPS only).':'. Served over HTTP here, so the Secure flag is off; production must use HTTPS.'}`+(input.sessionExp?` This session ends in ${Math.max(0,Math.round((input.sessionExp-now)/60000))} min.`:'')});
 checks.push({id:'throttle',area:'Identity',label:'Brute-force protection',status:'pass',detail:'Sign-in is limited to 8 attempts per minute (HTTP 429 after that); password comparison is constant-time.'});
 checks.push({id:'mfa',area:'Identity',label:'Multi-factor sign-in',status:'warn',detail:'Single shared password; no second factor. Put the app behind an identity provider (for example Cloudflare Access with OIDC) before sharing the URL.'});
 checks.push({id:'transport',area:'Network',label:'Transport encryption',status:https?'pass':'warn',detail:https?'Request arrived over HTTPS; TLS terminates at the edge.':'Plain HTTP (local development). Cloudflare deployments serve HTTPS by default.'});
 checks.push({id:'headers',area:'Network',label:'Browser security headers',status:'pass',detail:'Content-Security-Policy (self only, no inline script), X-Frame-Options DENY, nosniff and no-referrer on every response.'});
 checks.push({id:'csrf',area:'Network',label:'Cross-site request forgery',status:'pass',detail:'State-changing requests with a foreign Origin header are rejected (403).'});
 const sealed=Object.values(settings?.keys??{}).filter(Boolean).length+(connections?.telegram?.secret?1:0)+(connections?.google?.secret?1:0)+mcp.filter(m=>m.secret).length;
 checks.push({id:'secrets',area:'Data',label:'Secrets at rest',status:'pass',detail:`${sealed} stored credential${sealed===1?'':'s'} sealed with AES-256-GCM and a random 96-bit IV. Keys are never returned to the browser.`});
 checks.push({id:'kdf',area:'Data',label:'Encryption key derivation',status:'warn',detail:'The AES key is one SHA-256 of the admin password: no salt, no work factor. A password KDF such as PBKDF2 with a stored salt would slow offline guessing if the database leaked.'});
 const executor=!!env.EXECUTOR_URL,executorSecret=String(env.EXECUTOR_SECRET??'');
 if(!executor)checks.push({id:'executor',area:'Compute',label:'Executor link',status:'info',detail:'No Linux executor configured. Browser and Python tools are unavailable, so no remote sandbox is exposed.'});
 else{
  const executorHttps=String(env.EXECUTOR_URL).startsWith('https://');
  checks.push({id:'executor',area:'Compute',label:'Executor link',status:executorSecret.length>=24&&executorHttps?'pass':'warn',detail:`Bearer-token authenticated (${executorSecret.length>=24?'strong token':'token shorter than 24 characters'}), ${executorHttps?'HTTPS transport':'not HTTPS: the token crosses the network in clear text'}.`});
 }
 checks.push({id:'egress',area:'Compute',label:'Sandbox network egress',status:'pass',detail:'Executor resolves and pins public IPv4 only, standard ports only; private, reserved and cloud-metadata ranges are blocked.'});
 const autonomy=preferences(settings?.preferences).sandboxAutonomy;
 checks.push({id:'autonomy',area:'Access',label:'Autonomous sandbox actions',status:'info',detail:autonomy?'On for public tasks. Messages, remote writes and private disclosures still need exact approval.':'Off. Every sandbox code, file and browser action needs approval.'});
 const active=devices.filter(d=>!d.revoked),stale=active.filter(d=>now-Date.parse(d.seen)>30*86400000);
 checks.push({id:'devices',area:'Access',label:'Paired laptops',status:stale.length?'warn':'pass',detail:active.length?`${active.length} active pairing${active.length===1?'':'s'}${stale.length?`; ${stale.length} unseen for 30+ days. Revoke unused devices in Settings → Laptop.`:', all seen in the last 30 days.'}`:'No laptop pairings. Private files cannot be requested.'});
 const insecureMcp=mcp.filter(m=>!String(m.url).startsWith('https://'));
 checks.push({id:'mcp',area:'Access',label:'Remote tool servers',status:insecureMcp.length?'warn':'pass',detail:mcp.length?`${mcp.length} connector${mcp.length===1?'':'s'}${insecureMcp.length?`; ${insecureMcp.length} not on HTTPS.`:', all HTTPS. Each tool needs approval unless attested read-only.'}`:'No MCP connectors. Nothing outside the office can be called as a tool.'});
 if(String(env.ALLOW_DEMO)==='true')checks.push({id:'demo',area:'Access',label:'Offline demo mode',status:'warn',detail:'ALLOW_DEMO is on. Turn it off in production so canned tasks cannot be created.'});
 return checks;
}

export function securityEvents(tasks:TaskLike[],limit=24){
 return tasks.flatMap(t=>(t.events??[]).filter(e=>SECURITY_EVENTS.has(e.kind)).map(e=>({time:e.time,kind:e.kind,text:e.text.slice(0,240),task:t.id,mission:t.prompt.slice(0,90)}))).sort((a,b)=>b.time.localeCompare(a.time)).slice(0,limit);
}

export function backupSnapshot(host:Pick<CloudHost,'list'|'get'>,objectId:string,time=new Date()){
 const tasks=host.list<TaskLike>('task:').map(t=>({id:t.id,prompt:t.prompt,status:t.status,assignee:t.assignee,created:t.created,updated:t.updated,delegatedBy:t.delegatedBy,reviewStatus:t.reviewStatus,tokens:t.tokens,steps:t.steps,answer:t.answer,error:t.error,artifacts:(t.artifacts??[]).map(a=>({id:a.id,name:a.name,bytes:a.bytes}))}));
 return {
  format:'jarvis-friday-backup/1',
  exportedAt:time.toISOString(),
  source:{platform:'Cloudflare Durable Object',object:objectId},
  excludes:['model and connector credentials','paired-device token hashes','artifact file bytes','raw model message history'],
  tasks,
  memory:host.list<unknown>('memory:'),
  routines:host.list<unknown>('job:')
 };
}

export async function cloudRoute(request:Request,url:URL,host:CloudHost):Promise<Response>{
 const p=url.pathname;
 if(request.method!=='GET'){await bounded(request,100000);throw new HttpError(405,'Cloud console endpoints are read-only.');}
 if(p==='/api/cloud'){
  const tasks=host.list<TaskLike>('task:'),settings=host.get<SettingsLike>('settings'),connections=host.get<ConnectionLike>('connections');
  const devices=host.list<DeviceLike>('device:'),mcp=host.list<McpLike>('mcp:'),jobs=host.list<{enabled?:boolean;nextRun?:number;name?:string}>('job:');
  const prefs=preferences(settings?.preferences),alarm=await host.storage.getAlarm();
  const nextJob=jobs.filter(j=>j.enabled&&j.nextRun).sort((a,b)=>(a.nextRun??0)-(b.nextRun??0))[0];
  return json({
   serverTime:new Date().toISOString(),
   edge:edgeContext(request),
   transport:{protocol:url.protocol.replace(':',''),host:url.host},
   runtime:{
    platform:'Cloudflare Workers',
    object:{class:'Relay',name:'personal-owner',id:host.objectId},
    databaseBytes:host.sql.databaseSize,
    nextAlarm:alarm,
    observability:true
   },
   storage:{breakdown:storageBreakdown(host.sql),artifacts:String(host.env.ARTIFACT_STORAGE)==='executor'?'s3':'sqlite'},
   tasks:taskAnalytics(tasks),
   control:{openLimit:OPEN_TASK_LIMIT,concurrencyLimit:CONCURRENT_TASK_LIMIT,readConcurrency:prefs.readConcurrency,contextChars:prefs.contextChars,maxSteps:prefs.maxSteps,maxTokens:prefs.maxTokens,routines:jobs.filter(j=>j.enabled).length,nextRoutine:nextJob?.nextRun??null},
   services:{
    executor:!!host.env.EXECUTOR_URL,
    memoryService:!!host.env.AGENTMEMORY_URL,
    codexHarness:!!host.env.CODEX_HARNESS_URL,
    telegram:!!connections?.telegram||!!host.env.TELEGRAM_BOT_TOKEN,
    gmail:!!connections?.google||!!host.env.GOOGLE_CLIENT_ID,
    mcp:mcp.length,
    devices:devices.filter(d=>!d.revoked).length,
    models:{operator:settings?.main?.model?{provider:settings.main.provider,model:settings.main.model}:null,steward:settings?.steward?.model?{provider:settings.steward.provider,model:settings.steward.model}:null}
   },
   security:{checks:securityChecks({url,env:host.env,settings,connections,devices,mcp,sessionExp:sessionExpiry(request)}),events:securityEvents(tasks)}
  });
 }
 if(p==='/api/cloud/probe'){
  if(!host.env.EXECUTOR_URL)return json({configured:false});
  const started=Date.now();
  try{
   const r=await fetch(String(host.env.EXECUTOR_URL).replace(/\/+$/,'')+'/health',{signal:AbortSignal.timeout(4000),redirect:'manual'});
   const latencyMs=Date.now()-started;let service:string|null=null;
   try{const body=JSON.parse(await bounded(r,16000)) as {service?:unknown};service=typeof body.service==='string'?body.service.slice(0,80):null;}catch{}
   return json({configured:true,ok:r.ok,status:r.status,latencyMs,service});
  }catch(e){return json({configured:true,ok:false,status:null,latencyMs:Date.now()-started,error:e instanceof Error&&e.name==='TimeoutError'?'No response within 4 seconds.':'Executor unreachable.'});}
 }
 if(p==='/api/cloud/backup'){
  const stamp=new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
  return json(backupSnapshot(host,host.objectId),200,{'Content-Disposition':`attachment; filename="jarvis-friday-backup-${stamp}.json"`});
 }
 throw new HttpError(404,'Endpoint not found.');
}
