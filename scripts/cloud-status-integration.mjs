import assert from 'node:assert/strict';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
let probes=0;
const password='synthetic-cloud-monitor-password',token='synthetic-harness-secret';
const mf=new Miniflare(await convertV4MiniflareOptions({modules:true,scriptPath:'work/build/index.js',compatibilityDate:'2026-10-12',compatibilityFlags:['nodejs_compat'],durableObjects:{RELAY:{className:'Relay',useSQLite:true}},bindings:{ADMIN_PASSWORD:password,EXECUTOR_URL:'https://executor.example',EXECUTOR_SECRET:'synthetic-executor-secret',CODEX_HARNESS_URL:'https://harness.example',CODEX_HARNESS_TOKEN:token},outboundService:async request=>{probes++;const u=new URL(request.url);assert.equal(request.method,'GET');assert.ok(request.headers.get('authorization')?.startsWith('Bearer '));if(u.pathname==='/health')return Response.json({service:'relay-executor'});if(u.pathname==='/v1/models')return Response.json({data:[{id:'fixture-model'}]});if(u.pathname==='/metrics')return Response.json({cpuCount:2,load1:0.25,memoryTotalBytes:2048,memoryFreeBytes:1024,uptimeSeconds:20,activeOperations:0,secret:'must-not-leak'});throw Error('Unexpected request');}}));
try{
 assert.equal((await mf.dispatchFetch('https://office.test/api/cloud-status')).status,401);
 const login=await mf.dispatchFetch('https://office.test/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})}),cookie=login.headers.get('set-cookie').split(';')[0];
 await mf.dispatchFetch('https://office.test/api/settings',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({main:{provider:'codex',model:'fixture-model'}})});
 const response=await mf.dispatchFetch('https://office.test/api/cloud-status',{headers:{Cookie:cookie}}),data=await response.json();assert.equal(response.status,200);assert.equal(data.executor.status,'online');assert.equal(data.harness.status,'online');assert.equal(data.harness.selectedModelAllowed,true);assert.equal(data.resources.cpuCount,2);assert.ok(!JSON.stringify(data).includes('must-not-leak'));assert.ok(!JSON.stringify(data).includes(token));assert.equal(probes,3);
 await mf.dispatchFetch('https://office.test/api/cloud-status',{headers:{Cookie:cookie}});assert.equal(probes,3,'Repeated reads reuse the 15-second snapshot');
 console.log('PASS: authenticated cloud probes, real Worker fetch semantics, resource filtering and snapshot caching. No model calls.');
}finally{await mf.dispose();}
