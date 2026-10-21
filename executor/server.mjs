import {cpus,loadavg,totalmem,freemem,uptime} from 'node:os';
import http from 'node:http';import crypto from 'node:crypto';import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {resolve4} from 'node:dns/promises';import {relativePath,publicIP,validateHost} from './policy.mjs';
import {createBrowserProxy,publicRead,restoredLease} from './network.mjs';
import {artifact} from './artifacts.mjs';
const run=promisify(execFile),secret=process.env.EXECUTOR_SECRET,image=process.env.SANDBOX_IMAGE||'relay-sandbox:0.1';
if(!secret||secret.length<24)throw new Error('Set EXECUTOR_SECRET with at least 24 characters.');
const locks=new Map(),cancelled=new Set(),leases=new Map();
createBrowserProxy(leases).listen(Number(process.env.BROWSER_PROXY_PORT||8790),process.env.BROWSER_PROXY_HOST||'0.0.0.0');
const names=task=>({volume:'relay-work-'+task,browser:'relay-browser-'+task,code:'relay-code-'+task});
async function docker(args,timeout=45000){try{const {stdout}=await run('docker',args,{timeout,maxBuffer:2000000,windowsHide:true});return stdout;}catch(e){throw new Error('Docker operation failed: '+String(e.stderr||e.message).slice(0,800));}}
async function exists(name){try{await docker(['inspect',name],5000);return true;}catch{return false;}}
async function initialize(task){const n=names(task);await docker(['volume','create',n.volume]);await docker(['run','--rm','--network','none','--user','0','--cap-drop','ALL','--cap-add','CHOWN','-v',n.volume+':/workspace',image,'chown','1000:1000','/workspace']);return n;}
async function pins(domains){if(!Array.isArray(domains)||domains.length>20)throw new Error('Invalid allowed domains.');const out={};for(const domain of domains){if(typeof domain!=='string'||!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(domain))throw new Error('Invalid allowed domain.');const ips=await resolve4(domain);if(!ips.length||ips.some(ip=>!publicIP(ip)))throw new Error('Domain resolves to a nonpublic address.');out[domain]=ips[0];}return out;}
async function cancel(task){cancelled.add(task);leases.delete(task);const n=names(task);for(const name of [n.code,n.browser])if(await exists(name))await docker(['rm','-f',name]);return {stopped:true,workspace_preserved:true};}
async function execute(payload){const {task_id:task,operation,args={},domains=[]}=payload;if(typeof task!=='string'||!/^[a-f0-9-]{36}$/.test(task))throw new Error('Invalid task ID.');if(operation==='cancel')return cancel(task);
 if(operation==='web_read')return publicRead(args.url,domains);
 if(operation==='artifact_write'||operation==='artifact_read')return artifact(task,args,operation==='artifact_write');
 if(cancelled.has(task))throw new Error('Task executor was cancelled.');
 if(!['workspace_list','workspace_read','workspace_write','python_run','browser'].includes(operation))throw new Error('Unknown operation.');const n=await initialize(task);
 if(cancelled.has(task))throw new Error('Task executor was cancelled.');
 if(operation==='browser'){
   if(args.action==='navigate')validateHost(args.url,domains);
   if(!await exists(n.browser)){if((await docker(['ps','--filter','label=relay.browser=true','--format','{{.Names}}'])).trim())throw new Error('The small executor supports one browser workspace at a time. Finish or cancel the other task.');const allPublic=domains.includes('*'),resolved=allPublic?{}:await pins(domains),token=crypto.randomBytes(24).toString('hex');if(allPublic)leases.set(task,{token,domains,expires:Date.now()+3600000});if(cancelled.has(task))throw new Error('Task executor was cancelled.');await docker(['run','-d','--name',n.browser,'--label','relay.browser=true','--user','1000:1000','--cap-drop','ALL','--security-opt','no-new-privileges','--pids-limit','160','--memory','1g','--cpus','1','--shm-size','256m','--read-only','--tmpfs','/tmp:rw,size=256m,uid=1000,gid=1000','-v',n.volume+':/workspace','-e','BROWSER_DOMAINS='+JSON.stringify(resolved),...(allPublic?['--add-host','host.docker.internal:host-gateway','-e','BROWSER_PUBLIC=1','-e','BROWSER_PROXY=http://host.docker.internal:'+String(process.env.BROWSER_PROXY_PORT||8790),'-e','BROWSER_PROXY_USER='+task,'-e','BROWSER_PROXY_PASSWORD='+token]:[]),image,'node','/opt/relay/browser.mjs']);if(cancelled.has(task)){await cancel(task);throw new Error('Task executor was cancelled.');}}
   if(domains.includes('*')&&!leases.has(task))leases.set(task,restoredLease(JSON.parse(await docker(['inspect','--format','{{json .Config.Env}}',n.browser])),task,domains));
   if(leases.has(task))leases.get(task).expires=Date.now()+3600000;const encoded=Buffer.from(JSON.stringify(args)).toString('base64url');let result;for(let attempt=0;attempt<12;attempt++){try{result=await docker(['exec',n.browser,'node','/opt/relay/browser-client.mjs',encoded]);break;}catch(e){if(attempt===11)throw e;await new Promise(r=>setTimeout(r,250));}}return JSON.parse(result);
 }
 if(operation==='python_run'){
   if(typeof args.code!=='string'||args.code.length>12000)throw new Error('Invalid Python input.');
   try{const {stdout,stderr}=await run('docker',['run','--rm','--name',n.code,'--network','none','--user','1000:1000','--cap-drop','ALL','--security-opt','no-new-privileges','--pids-limit','64','--memory','256m','--cpus','1','--read-only','--tmpfs','/tmp:rw,size=32m,uid=1000,gid=1000','-v',n.volume+':/workspace',image,'python3','-I','-c',args.code],{timeout:30000,maxBuffer:500000,windowsHide:true});return {stdout:stdout.slice(0,20000),stderr:stderr.slice(0,10000),exitCode:0};}catch(e){if(await exists(n.code))await docker(['rm','-f',n.code]);return {stdout:String(e.stdout||'').slice(0,20000),stderr:String(e.stderr||e.message).slice(0,10000),exitCode:typeof e.code==='number'?e.code:-1};}
 }
 if(operation!=='workspace_list')relativePath(args.path);if(operation==='workspace_write'&&(typeof args.content!=='string'||args.content.length>60000))throw new Error('Invalid file content.');
 const encoded=Buffer.from(JSON.stringify({operation,args})).toString('base64url');const output=await docker(['run','--rm','--network','none','--user','1000:1000','--cap-drop','ALL','--security-opt','no-new-privileges','--memory','128m','--read-only','--tmpfs','/tmp:rw,size=16m,uid=1000,gid=1000','-v',n.volume+':/workspace',image,'python3','/opt/relay/files.py',encoded]);return JSON.parse(output);
}
http.createServer(async(req,res)=>{res.setHeader('Content-Type','application/json');if(req.url==='/health'&&req.method==='GET'){res.end(JSON.stringify({service:'relay-executor',isolation:'Docker sibling containers',gpu_required:false}));return;}
 const provided=(req.headers.authorization||'').replace(/^Bearer /,'');const a=crypto.createHash('sha256').update(provided).digest(),b=crypto.createHash('sha256').update(secret).digest();if(!crypto.timingSafeEqual(a,b)){res.writeHead(401);res.end(JSON.stringify({error:'Unauthorized'}));return;}
 if(req.url==='/metrics'&&req.method==='GET'){res.end(JSON.stringify({cpuCount:cpus().length,load1:loadavg()[0],memoryTotalBytes:totalmem(),memoryFreeBytes:freemem(),uptimeSeconds:uptime(),activeOperations:locks.size}));return;}
 if(req.url!=='/execute'||req.method!=='POST'){res.writeHead(404);res.end('{}');return;}
 try{let raw='',size=0;for await(const chunk of req){size+=chunk.length;if(size>300000)throw new Error('Request too large.');raw+=chunk;}const data=JSON.parse(raw);const task=data.task_id;if(data.operation==='cancel'){res.end(JSON.stringify(await execute(data)));return;}
 const previous=locks.get(task)||Promise.resolve();const started=Date.now();const next=previous.catch(()=>{}).then(()=>execute(data));locks.set(task,next);try{res.end(JSON.stringify(await next));console.log(JSON.stringify({task,operation:data.operation,status:'completed',duration_ms:Date.now()-started}));}finally{if(locks.get(task)===next)locks.delete(task);}
 }catch(e){res.writeHead(400);res.end(JSON.stringify({error:String(e.message).slice(0,1000)}));}
}).listen(Number(process.env.PORT||8788),process.env.HOST||'127.0.0.1',()=>console.log('Relay executor listening; no credentials logged.'));
