import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Exercise the actual renderer without starting polling, login or network requests.
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const boundary=source.indexOf("$('#login-form').onsubmit");
assert.ok(boundary>0,'The renderer must be loaded before UI startup.');
function office(){
 const nodes=new Map<string,any>();
 const node=()=>({textContent:'',dataset:{},hidden:false,children:[] as any[],classList:{toggle(){}},replaceChildren(){this.children=[];},append(child:any){this.children.push(child);}});
 const context=vm.createContext({document:{querySelector(selector:string){if(!nodes.has(selector))nodes.set(selector,node());return nodes.get(selector);},createElement:node}});
 vm.runInContext(source.slice(0,boundary)+`;settings={main:{provider:'openrouter',model:'test'},steward:{provider:'openrouter',model:'small'},configured:{openrouter:true}};`,context);
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
 assert.equal(ui.nodes.get('#peek-title').textContent,'An idea starts here.');
 assert.equal(ui.nodes.get('#activity-peek').dataset.task,'');
 assert.equal(ui.nodes.get('#operator-status').textContent,'Configured');
 assert.equal(ui.nodes.get('#steward-status').textContent,'Configured');
});
