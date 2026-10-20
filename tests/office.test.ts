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
 const node=()=>({textContent:'',dataset:{},style:{},attributes:{} as Record<string,string>,setAttribute(name:string,value:string){this.attributes[name]=value;},hidden:false,children:[] as any[],classList:{toggle(){}},replaceChildren(){this.children=[];},append(child:any){this.children.push(child);}});
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
