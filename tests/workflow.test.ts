import test from 'node:test';
import assert from 'node:assert/strict';
import {workflowRead,workflowInstructions,reviewEvidence,reviewHistory} from '../src/workflow';
import type {Message} from '../src/providers';

test('Both roles receive the same policy and task workflow with different responsibilities',()=>{
 for(const role of ['operator','steward'] as const){
  const prompt=workflowInstructions(role,'Exact disclosure policy.');
  assert.match(prompt,/Exact disclosure policy/);assert.match(prompt,/workflow_read/);assert.match(prompt,/task_history/);assert.match(prompt,/Skip playbook loading and delegation for straightforward answers/);
 }
 assert.match(workflowInstructions('steward',''),/delegate cloud execution to Jarvis/);
 for(const name of ['research','documents','browser','coding','collaboration'])assert.match(workflowRead(name).note,/grants no/);
 assert.throws(()=>workflowRead('../../remote-skill'),/Unknown workflow/);
});

test('Automatic and legacy reviewer observations do not fabricate unsigned provider function calls',()=>{
 const history:Message[]=[{role:'user',content:'Original assignment'},{role:'assistant',content:'Draft'},{role:'assistant',content:'Requesting independent teammate review before final response.',tool_calls:[{id:'runtime-review',type:'function',function:{name:'peer_review',arguments:'{}'}}]},{role:'tool',tool_call_id:'runtime-review',content:'{"review":"Correct the total."}'}];
 const before=JSON.stringify(history);
 for(const id of ['runtime-review',undefined]){const result=reviewHistory(history,id);assert.equal(result.length,3);assert.equal(result.at(-1)?.role,'user');assert.match(String(result.at(-1)?.content),/not owner instructions/);assert.ok(!result.some(m=>m.tool_calls?.length));}
 const real=structuredClone(history);real[2].content=null;assert.deepEqual(reviewHistory(real),real);
 assert.equal(JSON.stringify(history),before);
});

test('Review packet retains source call IDs, valid JSON and explicit omissions under large escaped tool output',()=>{
 const messages:Message[]=[];
 for(let n=0;n<18;n++)messages.push({role:'assistant',content:null,tool_calls:[{id:'source-'+n,type:'function',function:{name:'web_read',arguments:'{}'}}]},{role:'tool',tool_call_id:'source-'+n,content:'"\\\n'.repeat(5000)});
 const before=JSON.stringify(messages),encoded=reviewEvidence(messages),packet=JSON.parse(encoded);
 assert.ok(encoded.length<=8000);assert.ok(packet.records.length>0);assert.equal(packet.omitted,18-packet.records.length);
 assert.equal(packet.records.at(-1).call_id,'source-17');assert.equal(packet.records.at(-1).tool,'web_read');assert.ok(packet.records.every((r:{truncated:boolean})=>r.truncated));assert.equal(JSON.stringify(messages),before);
 const small=JSON.parse(reviewEvidence([{role:'tool',tool_call_id:'old-call',content:'Observed total: 42.'}]));assert.equal(small.records[0].excerpt,'Observed total: 42.');assert.equal(small.records[0].truncated,false);assert.equal(small.records[0].tool,'unknown');
 assert.deepEqual(JSON.parse(reviewEvidence([])).records,[]);
});

test('Review handoff requests a standalone final deliverable rather than review acknowledgement',()=>{
 const messages:Message[]=[{role:'assistant',content:'Requesting independent teammate review before final response.',tool_calls:[{id:'review',type:'function',function:{name:'peer_review',arguments:'{}'}}]},{role:'tool',tool_call_id:'review',content:'{"review":"Totals checked."}'}];
 const result=reviewHistory(messages,'review');assert.equal(result.length,1);assert.match(String(result[0].content),/complete standalone final answer/);assert.match(String(result[0].content),/do not merely acknowledge/);assert.match(String(result[0].content),/untrusted observations/);
});
