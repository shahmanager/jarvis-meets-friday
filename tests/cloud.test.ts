import test from 'node:test';
import assert from 'node:assert/strict';
import {taskAnalytics,securityChecks,securityEvents,backupSnapshot,withEdgeContext,EDGE_HEADER} from '../src/cloud';

const task=(over:Record<string,unknown>)=>({id:'t',prompt:'Compare cloud regions',status:'completed',created:'2026-10-20T10:00:00.000Z',updated:'2026-10-20T10:01:00.000Z',tokens:100,steps:2,events:[],...over}) as any;

test('Task analytics measure real outcomes and leave rates empty when nothing finished',()=>{
 const empty=taskAnalytics([],new Date('2026-10-21T00:00:00Z'));
 assert.equal(empty.successRate,null);assert.equal(empty.medianSeconds,null);assert.equal(empty.days.length,14);
 const a=taskAnalytics([task({id:'a'}),task({id:'b',status:'failed',updated:'2026-10-20T10:05:00.000Z'}),task({id:'c',status:'running',delegatedBy:'a'})],new Date('2026-10-21T00:00:00Z'));
 assert.equal(a.total,3);assert.equal(a.missions,2);assert.equal(a.delegated,1);assert.equal(a.running,1);assert.equal(a.open,1);
 assert.equal(a.successRate,0.5);assert.equal(a.medianSeconds,60);assert.equal(a.tokens,300);
 assert.deepEqual(a.days.at(-2),{day:'2026-10-20',created:3,completed:1,failed:1});
});

test('Security checks report HTTP, weak executor links and stale devices honestly',()=>{
 const now=Date.parse('2026-10-21T00:00:00Z');
 const checks=securityChecks({url:new URL('http://localhost:8787/api/cloud'),env:{ADMIN_PASSWORD:'x'.repeat(24),EXECUTOR_URL:'http://10.0.0.5:8080',EXECUTOR_SECRET:'short',ALLOW_DEMO:'true'} as any,settings:{keys:{openrouter:{iv:[1],data:[2]}}},connections:undefined,devices:[{id:'d',name:'Laptop',seen:'2026-08-01T00:00:00Z'}],mcp:[{id:'m',name:'Tools',url:'http://tools.example/mcp'}],sessionExp:now+30*60000,now});
 const by=Object.fromEntries(checks.map(c=>[c.id,c]));
 assert.equal(by.transport.status,'warn');assert.equal(by.session.status,'warn');assert.match(by.session.detail,/ends in 30 min/);
 assert.equal(by.executor.status,'warn');assert.match(by.executor.detail,/not HTTPS/);
 assert.equal(by.devices.status,'warn');assert.equal(by.mcp.status,'warn');assert.equal(by.demo.status,'warn');
 assert.equal(by.kdf.status,'warn');assert.equal(by.mfa.status,'warn');
 assert.match(by.secrets.detail,/^1 stored credential sealed/);
 assert.ok(!JSON.stringify(checks).includes('x'.repeat(24)),'Checks must never echo the password.');
});

test('Security checks pass a hardened HTTPS deployment without inventing an executor',()=>{
 const checks=securityChecks({url:new URL('https://office.example/api/cloud'),env:{ADMIN_PASSWORD:'y'.repeat(40)} as any,settings:undefined,connections:undefined,devices:[],mcp:[],sessionExp:null});
 const by=Object.fromEntries(checks.map(c=>[c.id,c]));
 assert.equal(by.transport.status,'pass');assert.equal(by.session.status,'pass');assert.equal(by['admin-password'].status,'pass');
 assert.equal(by.executor.status,'info');assert.equal(by.demo,undefined);
});

test('Security events list approvals newest first and skip ordinary activity',()=>{
 const events=securityEvents([task({events:[{time:'2026-10-20T10:00:00Z',kind:'tool',text:'web_search'},{time:'2026-10-20T10:00:01Z',kind:'approval',text:'send_email needs approval'},{time:'2026-10-20T10:00:05Z',kind:'approved',text:'Approved this exact tool call.'}]})]);
 assert.deepEqual(events.map(e=>e.kind),['approved','approval']);
});

test('Backup snapshot keeps owner data and excludes credentials and message history',()=>{
 const records:Record<string,unknown[]>={'task:':[task({messages:[{role:'system',content:'secret system prompt'}],pending:{args:{token:'abc'}}})],'memory:':[{id:'m',title:'Note'}],'job:':[]};
 const snap=backupSnapshot({list:(p:string)=>records[p]??[],get:()=>undefined} as any,'object-id',new Date('2026-10-21T00:00:00Z'));
 assert.equal(snap.tasks.length,1);assert.equal(snap.memory.length,1);
 const text=JSON.stringify(snap);
 assert.ok(!text.includes('secret system prompt'));assert.ok(!text.includes('abc'));
});

test('Edge context replaces any client-supplied header',()=>{
 const spoofed=new Request('https://office.example/api/cloud',{headers:{[EDGE_HEADER]:'{"colo":"FAKE"}'}});
 Object.defineProperty(spoofed,'cf',{value:{colo:'BOM',country:'IN',tlsVersion:'TLSv1.3',unrelated:{nested:true}}});
 const edge=JSON.parse(withEdgeContext(spoofed).headers.get(EDGE_HEADER)!);
 assert.deepEqual(edge,{colo:'BOM',country:'IN',tlsVersion:'TLSv1.3'});
 const local=JSON.parse(withEdgeContext(new Request('https://office.example/api/cloud',{headers:{[EDGE_HEADER]:'{"colo":"FAKE"}'}})).headers.get(EDGE_HEADER)!);
 assert.deepEqual(local,{});
});
