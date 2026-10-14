import test from 'node:test';import assert from 'node:assert/strict';
import {contextWindow,historySearch} from '../src/context';import type {Message} from '../src/providers';
test('Context pruning preserves original request, working notes and complete tool groups without mutating transcript',()=>{
 const messages:Message[]=[{role:'system',content:'Policy'},{role:'user',content:'Original owner request'}];
 for(let n=0;n<12;n++)messages.push({role:'assistant',content:'Plan '+n,tool_calls:[{id:'call'+n,type:'function',function:{name:'web_read',arguments:'{}'}}]},{role:'tool',tool_call_id:'call'+n,content:'source '+n+(n===2?' needle-2':'')+' '+'.'.repeat(900)});
 const before=JSON.stringify(messages),result=contextWindow(messages,'Keep source 2 citation',3000);
 assert.ok(result.compacted);assert.equal(result.messages[1].content,'Original owner request');assert.ok(result.messages.some(m=>String(m.content).includes('Keep source 2')));
 for(const m of result.messages.filter(m=>m.role==='tool'))assert.ok(result.messages.some(a=>a.tool_calls?.some(c=>c.id===m.tool_call_id)));
 assert.equal(JSON.stringify(messages),before);assert.ok(historySearch(messages,'needle-2').some(m=>m.content.startsWith('source 2')));
});

test('Compaction keeps all responses for same-name calls in one assistant group',()=>{
 const messages:Message[]=[{role:'user',content:'Original request'}];
 for(let n=0;n<8;n++)messages.push(
  {role:'assistant',content:'',tool_calls:[
   {id:`same-${n}-a`,type:'function',function:{name:'read',arguments:'{"path":"a"}'}},
   {id:`same-${n}-b`,type:'function',function:{name:'read',arguments:'{"path":"b"}'}},
  ]},
  {role:'tool',tool_call_id:`same-${n}-a`,content:'a'.repeat(500)},
  {role:'tool',tool_call_id:`same-${n}-b`,content:'b'.repeat(500)},
 );
 const result=contextWindow(messages,'',1800);
 assert.ok(result.compacted);
 const assistant=result.messages.filter(m=>m.role==='assistant'&&m.tool_calls?.length);
 for(const m of assistant)for(const call of m.tool_calls??[])assert.ok(result.messages.some(r=>r.role==='tool'&&r.tool_call_id===call.id));
 for(const m of result.messages.filter(m=>m.role==='tool'))assert.ok(assistant.some(a=>a.tool_calls?.some(c=>c.id===m.tool_call_id)));
 assert.ok(result.messages.some(m=>m.content==='Original request'));
});

test('An irreducibly large original request survives even when it alone exceeds context budget',()=>{
 const request='Owner request: '+('keep this exact request. '.repeat(80));
 const result=contextWindow([{role:'system',content:'Policy'},{role:'user',content:request}], 'notes', 32);
 assert.ok(result.messages.some(m=>m.role==='user'&&m.content===request));
 assert.equal(result.chars,JSON.stringify(result.messages).length);
 assert.ok(result.chars>32);
});

test('History search preserves disambiguating call IDs for repeated tool names',()=>{
 const messages:Message[]=[
  {role:'assistant',content:null,tool_calls:[
   {id:'read-a',type:'function',function:{name:'read',arguments:'{"path":"alpha"}'}},
   {id:'read-b',type:'function',function:{name:'read',arguments:'{"path":"beta"}'}},
  ]},
  {role:'tool',tool_call_id:'read-a',content:'alpha result'},
  {role:'tool',tool_call_id:'read-b',content:'beta result'},
 ];
 const results=historySearch(messages,'read');
 assert.deepEqual(results.filter(m=>m.role==='tool').map(m=>m.tool_call_id),['read-a','read-b']);
 assert.deepEqual(results[0].tool_calls?.map(c=>c.id),['read-a','read-b']);
});
