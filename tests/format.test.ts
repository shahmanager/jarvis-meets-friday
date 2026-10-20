import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function renderer(){
 const node=(tag:string)=>({tag,textContent:'',children:[] as any[],classList:{add(){}},append(...children:any[]){this.children.push(...children);},replaceChildren(){this.children=[];}});
 const context=vm.createContext({document:{createElement:node,createTextNode:(text:string)=>({...node('#text'),textContent:text})}});
 vm.runInContext(readFileSync(new URL('../public/format.js',import.meta.url),'utf8'),context);
 const root=node('main');context.root=root;
 return {root,render(text:string){context.input=text;vm.runInContext('renderRichText(root,input)',context);},title(prompt:string){context.input=prompt;return vm.runInContext('missionTitle({prompt:input})',context);}};
}
test('Results render headings, lists, safe artifact links, tables and code as DOM',()=>{
 const ui=renderer();ui.render('## Findings\n\n**Verified**\n\n- First\n- Second\n\n[Brief](/api/artifacts/996c775a-6aca-414f-b834-3cfcb613847b)\n\n| Option | Cost |\n| --- | --- |\n| A | 20 |\n\n```python\nprint(1)\n```');
 const serialized=JSON.stringify(ui.root);
 for(const tag of ['h3','strong','ul','li','a','table','th','td','pre','code'])assert.ok(serialized.includes('"tag":"'+tag+'"'),tag);
 assert.ok(serialized.includes('"href":"/api/artifacts/996c775a-6aca-414f-b834-3cfcb613847b"'));
});
test('Untrusted result HTML stays text and executable links never become anchors',()=>{
 const ui=renderer();ui.render('<img src=x onerror=alert(1)>\n\n[Run](javascript:alert) [File](data:text/html,hello) [Read](https://example.com)');
 const serialized=JSON.stringify(ui.root);
 assert.ok(serialized.includes('<img src=x onerror=alert(1)>'));
 assert.equal((serialized.match(/"tag":"a"/g)||[]).length,1);
 assert.ok(serialized.includes('noopener noreferrer'));
});
test('Mission headings stay bounded while retaining a short original request',()=>{
 const ui=renderer();assert.equal(ui.title('Compare cloud options\nVery long execution instructions'), 'Compare cloud options');assert.ok(ui.title('x'.repeat(1000)).length<=95);
});
