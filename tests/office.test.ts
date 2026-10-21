import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Exercise the actual renderer without starting polling, login or network requests.
const format=readFileSync(new URL('../public/format.js',import.meta.url),'utf8');
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const boundary=source.indexOf("$('#login-form').onsubmit");
assert.ok(boundary>0,'The renderer must be loaded before UI startup.');
function office(){
 const nodes=new Map<string,any>();
 const node=()=>({textContent:'',dataset:{},style:{},attributes:{} as Record<string,string>,setAttribute(name:string,value:string){this.attributes[name]=value;},removeAttribute(name:string){delete this.attributes[name];if(name==='src')delete (this as any).src;},hidden:false,children:[] as any[],classList:{toggle(){},add(){},remove(){}},replaceChildren(){this.children=[];},append(child:any){this.children.push(child);}});
 const context=vm.createContext({window:{innerWidth:1200},document:{querySelector(selector:string){if(!nodes.has(selector))nodes.set(selector,node());return nodes.get(selector);},createElement:node}});
 vm.runInContext(format+'\n'+source.slice(0,boundary)+`;settings={main:{provider:'openrouter',model:'test'},steward:{provider:'openrouter',model:'small'},configured:{openrouter:true}};`,context);
 return {nodes,context,render(tasks:unknown[]){context.fixture=tasks;vm.runInContext('tasks=fixture;renderOffice();',context);}};
}
test('Office activity opens the owner mission instead of a newer delegated internal prompt',()=>{
 const ui=office();
 ui.render([{id:'child',delegatedBy:'root',assignee:'steward',status:'completed',prompt:'Internal selected context',events:[]},{id:'root',assignee:'team',status:'waiting_peer',prompt:'Compare public sources',events:[]}]);
 assert.equal(ui.nodes.get('#peek-title').textContent,'Compare public sources');
 assert.equal(ui.nodes.get('#activity-peek').dataset.task,'root');
 assert.equal(ui.nodes.get('#peek-detail').textContent,'Waiting for teammate');
});
test('Empty office offers a task without inventing activity or enabling an unknown task link',()=>{
 const ui=office();ui.render([]);
 assert.equal(ui.nodes.get('#peek-title').textContent,'No mission yet');
 assert.equal(ui.nodes.get('#activity-peek').dataset.task,'');
 assert.equal(ui.nodes.get('#operator-status').textContent,'Available');
 assert.equal(ui.nodes.get('#steward-status').textContent,'Available');
 assert.equal(ui.nodes.get('#operator-desk').dataset.state,'idle');
 assert.equal(ui.nodes.get('.studio-stage').dataset.collaborating,'false');
});
test('Office collaboration motion follows peer work and clears after completion',()=>{
 const ui=office();
 ui.render([{id:'root',assignee:'team',status:'waiting_peer',prompt:'Review evidence',events:[]}]);
 assert.equal(ui.nodes.get('.studio-stage').dataset.collaborating,'true');
 assert.equal(ui.nodes.get('#steward-desk').dataset.state,'waiting_peer');
 ui.render([{id:'root',assignee:'team',status:'completed',prompt:'Review evidence',events:[]}]);
 assert.equal(ui.nodes.get('.studio-stage').dataset.collaborating,'false');
 assert.equal(ui.nodes.get('#operator-desk').dataset.state,'completed');
});

test('Agent insights prioritize deliverables and decisions rather than repeated chat',()=>{
 const ui=office();
 ui.render([{id:'root',assignee:'team',status:'completed',prompt:'Research current cloud architecture options',artifacts:[{name:'research.html'}],answer:'Done',chat:[{from:'operator',text:'Steward, please independently check this draft.'}],events:[]}]);
 assert.match(ui.nodes.get('#operator-preview').textContent,/research.html/);
 assert.doesNotMatch(ui.nodes.get('#operator-preview').textContent,/Steward/);
 ui.render([{id:'root',assignee:'team',status:'waiting_approval',prompt:'Research',pending:{call:{function:{name:'email_send'}}},events:[]}]);
 assert.match(ui.nodes.get('#operator-preview').textContent,/Needs your decision: email send/);
});

test('Work panel resizing clamps to viewport bounds and exposes the current accessible value',()=>{
 const ui=office();vm.runInContext('panelWidth(-100)',ui.context);
 assert.equal(ui.nodes.get('#work-drawer').style.width,'320px');
 vm.runInContext('panelWidth(800)',ui.context);assert.equal(ui.nodes.get('#panel-resize').attributes['aria-valuenow'],'800');
 vm.runInContext('panelWidth(99999)',ui.context);assert.equal(ui.nodes.get('#work-drawer').style.width,'1164px');
 vm.runInContext('window.innerWidth=300;panelWidth(800)',ui.context);assert.equal(ui.nodes.get('#work-drawer').style.width,'264px');assert.equal(ui.nodes.get('#panel-resize').attributes['aria-valuemin'],'264');
});

 test('Browser mirror clears terminal images and ignores late responses from a different mission',()=>{const ui=office();vm.runInContext("selected='current';renderMirror({id:'current',status:'running'},{active:true,image:'data:image/jpeg;base64,test',url:'https://example.com'});",ui.context);const img=ui.nodes.get('#mirror-img');assert.equal(img.hidden,false);assert.match(img.src,/base64/);vm.runInContext("renderMirror({id:'old',status:'running'},{active:true,image:'wrong',url:'https://old.example'});",ui.context);assert.notEqual(img.src,'wrong');vm.runInContext("renderMirror({id:'current',status:'completed'},{active:true,image:'stale',url:'https://example.com'});",ui.context);assert.equal(img.hidden,true);assert.equal(img.src,undefined);assert.match(ui.nodes.get('#mirror-note').textContent,/Browser stopped/);});

test('Result view hides execution details, supports switching, and places files before activity',()=>{const ui=office();vm.runInContext("setWorkView('result')",ui.context);assert.equal(ui.nodes.get('#result-panel').hidden,false);assert.equal(ui.nodes.get('#activity-panel').hidden,true);assert.equal(ui.nodes.get('#result-tab').attributes['aria-selected'],'true');vm.runInContext("setWorkView('activity')",ui.context);assert.equal(ui.nodes.get('#result-panel').hidden,true);assert.equal(ui.nodes.get('#activity-panel').hidden,false);assert.equal(ui.nodes.get('#activity-tab').tabIndex,0);const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');assert.ok(html.indexOf('id="artifacts"')<html.indexOf('id="activity-panel" role="tabpanel"'));assert.ok(html.indexOf('id="answer"')<html.indexOf('id="agent-mirror"'));assert.match(html,/id="activity-panel" role="tabpanel" aria-labelledby="activity-tab" hidden/);});

test('Unchanged mission polling preserves task buttons instead of detaching click targets',async()=>{const ui=office(),task={id:'root',assignee:'operator',status:'completed',prompt:'Existing report',answer:'Verified result',artifacts:[],events:[]};ui.context.fetch=async()=>({ok:true,json:async()=>({tasks:[task]})});vm.runInContext("document.querySelector('#work-drawer').hidden=true",ui.context);await vm.runInContext('refresh()',ui.context);await vm.runInContext('refresh()',ui.context);const first=ui.nodes.get('#task-list').children[0];await vm.runInContext('refresh()',ui.context);assert.equal(ui.nodes.get('#task-list').children[0],first);task.status='failed';await vm.runInContext('refresh()',ui.context);assert.notEqual(ui.nodes.get('#task-list').children[0],first);});

test('Desk hover shows owner brief and role-specific output without the review ritual',()=>{const ui=office();ui.render([{id:'child',delegatedBy:'root',rootTaskId:'root',assignee:'steward',status:'completed',prompt:'Internal check',answer:'Verified official source and found a mismatch.',artifacts:[],events:[]},{id:'root',assignee:'team',status:'waiting_peer',prompt:'Plan December travel from Mumbai',chat:[{from:'operator',text:'Steward, please independently check this draft.'}],events:[]}]);assert.equal(ui.nodes.get('#steward-brief').textContent,'Plan December travel from Mumbai');assert.match(ui.nodes.get('#steward-output').textContent,/mismatch/);assert.doesNotMatch(ui.nodes.get('#operator-output').textContent,/Steward/);assert.equal(ui.nodes.get('#steward-output-label').textContent,'Output');});

test('Legacy failure points to the observed failed tool rather than blaming credentials',()=>{const ui=office();ui.context.fixture={error:'Execution failed. Check provider configuration or tool arguments.',events:[{kind:'tool',text:'web_search'}]};assert.match(vm.runInContext('failureDetail(fixture)',ui.context),/Stopped during web search/);assert.doesNotMatch(vm.runInContext('failureDetail(fixture)',ui.context),/provider configuration/);});
test('Desk research preview uses stored evidence without making inference requests',async()=>{const ui=office();ui.render([{id:'research',assignee:'operator',status:'failed',prompt:'Plan travel',error:'Stopped',researchVersion:'v1',artifacts:[],events:[]}]);let calls=0;ui.context.fetch=async(url:string)=>{calls++;assert.match(url,/tasks\/research\/research$/);return {ok:true,json:async()=>({results:[{answer:'Verified source notes; prices unconfirmed.'}]})};};await vm.runInContext("loadDeskEvidence('operator')",ui.context);assert.match(ui.nodes.get('#operator-output').textContent,/source notes/);assert.equal(ui.nodes.get('#operator-output-label').textContent,'Research notes · unreviewed');await vm.runInContext("loadDeskEvidence('operator')",ui.context);assert.equal(calls,1);});

test('Gmail authorization failures expose repair form and visible feedback inside settings',async()=>{const ui=office();vm.runInContext(source.slice(source.indexOf('function googleSetup('),source.indexOf("$('#disconnect-gmail')",source.indexOf('function googleSetup(')))+";api=async()=>{throw Error('Invalid OAuth client');};",ui.context);const input=ui.nodes.get('#google-id')||vm.runInContext("$('#google-id')",ui.context);input.focus=()=>{};const form=vm.runInContext("$('#google-form')",ui.context);form.hidden=true;form.scrollIntoView=()=>{};await vm.runInContext('connectGmail()',ui.context);assert.equal(form.hidden,false);assert.equal(ui.nodes.get('#gmail-feedback').textContent,'Invalid OAuth client');assert.equal(ui.nodes.get('#connect-gmail').disabled,false);});
