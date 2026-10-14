import {HttpError,id,now,object,text} from './security';

export interface Store {
 get<T>(key:string):T|undefined;
 put(key:string,value:unknown):void;
 list<T>(prefix:string):T[];
 remove(key:string):void;
}
export type Memory={id:string;title:string;content:string;kind:'core'|'episode';approved:boolean;source:string;created:string;updated:string};
export type Job={id:string;name:string;prompt:string;domains:string;nextRun:number;everyMinutes?:number;enabled:boolean;lastTask?:string;retryAt?:number};

export function memoryWrite(store:Store,input:Record<string,unknown>,source:string,approved:boolean){
 const key=input.id===undefined?id():text(input.id,80);if(!/^[a-f0-9-]{36}$/.test(key))throw new HttpError(400,'Invalid memory ID.');
 const old=store.get<Memory>('memory:'+key),kind=input.kind==='episode'?'episode':'core';
 if(kind==='core'&&!approved)throw new HttpError(403,'Core memory requires owner approval.');
 const title=text(input.title,120).trim(),content=text(input.content,4000).trim();if(!title||!content)throw new HttpError(400,'Memory needs a title and content.');
 const entries=store.list<Memory>('memory:');
 if(!old&&kind==='core'&&entries.filter(m=>m.kind==='core').length>=200)throw new HttpError(409,'Core memory limit reached. Remove an unused entry first.');
 const entry:Memory={id:key,title,content,kind,approved,source,created:old?.created??now(),updated:now()};store.put('memory:'+key,entry);
 // ponytail: retain 200 recent episodes and at most 200 core notes; use FTS/vector retrieval if this personal archive grows.
 const episodes=entries.filter(m=>m.kind==='episode'&&m.id!==key).sort((a,b)=>b.updated.localeCompare(a.updated));
 for(const extra of episodes.slice(kind==='episode'?199:200))store.remove('memory:'+extra.id);
 return entry;
}
export function memorySearch(store:Store,query:string){
 const words=text(query,500).toLowerCase().split(/\s+/).filter(Boolean);
 return store.list<Memory>('memory:').map(m=>({m,score:words.reduce((n,w)=>n+(m.title.toLowerCase().includes(w)?3:0)+(m.content.toLowerCase().includes(w)?1:0),0)}))
  .filter(r=>!words.length||r.score>0).sort((a,b)=>b.score-a.score||b.m.updated.localeCompare(a.m.updated)).slice(0,8).map(r=>r.m);
}
export function coreContext(store:Store){return store.list<Memory>('memory:').filter(m=>m.kind==='core'&&m.approved).sort((a,b)=>b.updated.localeCompare(a.updated)).slice(0,8).map(m=>({id:m.id,title:m.title,content:m.content.slice(0,1000),source:m.source}));}

export function jobWrite(store:Store,input:Record<string,unknown>){
 const key=input.id===undefined?id():text(input.id,80);if(!/^[a-f0-9-]{36}$/.test(key))throw new HttpError(400,'Invalid routine ID.');
 if(input.id&&!store.get<Job>('job:'+key))throw new HttpError(404,'Routine not found.');
 if(!input.id&&store.list<Job>('job:').length>=10)throw new HttpError(409,'Keep at most ten routines.');
 const name=text(input.name,120).trim(),prompt=text(input.prompt,12000).trim(),domains=text(input.domains??'*',1000).trim();
 if(!name||!prompt)throw new HttpError(400,'A routine needs a name and task.');
 const every=input.every_minutes===undefined?undefined:Number(input.every_minutes);
 if(every!==undefined&&(!Number.isSafeInteger(every)||every<15||every>10080))throw new HttpError(400,'Repeat interval must be 15–10080 minutes.');
 const at=input.run_at===undefined?(every?Date.now()+every*60000:NaN):Date.parse(text(input.run_at,80));
 if(!Number.isFinite(at)||at<=Date.now()||at>Date.now()+366*86400000)throw new HttpError(400,'Choose a future ISO date within one year.');
 if(input.run_at!==undefined&&!/(Z|[+-]\d\d:\d\d)$/.test(String(input.run_at)))throw new HttpError(400,'Include the timezone offset in run_at.');
 const parsed=domains.split(/[\s,]+/).filter(Boolean);if(parsed.length>20||parsed.some(d=>d!=='*'&&!/^([a-z0-9-]+\.)+[a-z]{2,}$/i.test(d)))throw new HttpError(400,'Use exact domain names for this routine.');
 const job:Job={id:key,name,prompt,domains:parsed.join(', '),nextRun:at,everyMinutes:every,enabled:input.enabled!==false};store.put('job:'+key,job);return job;
}
export function jobAfterRun(job:Job,taskId:string,time=Date.now()){return {...job,lastTask:taskId,retryAt:undefined,enabled:!!job.everyMinutes,nextRun:job.everyMinutes?Math.max(time+job.everyMinutes*60000,job.nextRun+job.everyMinutes*60000):job.nextRun};}
