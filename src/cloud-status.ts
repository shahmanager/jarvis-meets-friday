import {bounded} from './security';

/** Read-only probes; no inference, task execution, or cloud provisioning. */
export async function cloudProbe(url:string|undefined,token:string|undefined,path:string){
 if(!url)return {status:'not_configured',latencyMs:null,data:null};
 const started=Date.now();
 try{
  const r=await fetch(url.replace(/\/$/,'')+path,{headers:token?{Authorization:'Bearer '+token}:{},signal:AbortSignal.timeout(4000),redirect:'manual'});
  if(!r.ok)return {status:r.status===401?'authentication_failed':'unavailable',latencyMs:Date.now()-started,data:null};
  const data=JSON.parse(await bounded(r,16000));
  return {status:'online',latencyMs:Date.now()-started,data};
 }catch{return {status:'unreachable',latencyMs:Date.now()-started,data:null};}
}

export function resourceSample(data:unknown){
 const d=data as Record<string,unknown>|null;
 if(!d)return null;
 const fields=['cpuCount','load1','memoryTotalBytes','memoryFreeBytes','uptimeSeconds','activeOperations'];
 const values=Object.fromEntries(fields.filter(k=>typeof d[k]==='number'&&Number.isFinite(d[k])&&(d[k] as number)>=0).map(k=>[k,d[k]]));
 return Object.keys(values).length?values:null;
}
