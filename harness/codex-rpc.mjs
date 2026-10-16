import {EventEmitter} from 'node:events';
import {spawn} from 'node:child_process';

// No shell, user Codex home, browser profile, plugins or laptop credentials are inherited.
export const restrictedConfig={
 'features.shell_tool':false,'features.unified_exec':false,'features.apply_patch_freeform':false,
 'features.apps':false,'features.multi_agent':false,'features.remote_plugin':false,'features.hooks':false,
 'features.memories':false,'features.goals':false,'features.shell_snapshot':false,
 web_search:'disabled',project_doc_max_bytes:0,'shell_environment_policy.inherit':'none'
};
export class CodexRpc extends EventEmitter{
 constructor({binary='codex',home,cwd,baseUrl,apiKey,model}){
  super();this.pending=new Map();this.sequence=0;this.closed=false;
  const config={...restrictedConfig,model,model_provider:'office',
   'model_providers.office.name':'Office Responses provider','model_providers.office.base_url':baseUrl,
   'model_providers.office.env_key':'OFFICE_MODEL_KEY','model_providers.office.wire_api':'responses',
   'model_providers.office.requires_openai_auth':false,'model_providers.office.supports_websockets':false};
  this.child=spawn(binary,['app-server','--listen','stdio://',...Object.entries(config).flatMap(([k,v])=>['-c',k+'='+JSON.stringify(v)])],{
   cwd,windowsHide:true,stdio:['pipe','pipe','pipe'],env:{PATH:process.env.PATH,HOME:home,USERPROFILE:home,CODEX_HOME:home,OFFICE_MODEL_KEY:apiKey,...(process.platform==='win32'?{SystemRoot:process.env.SystemRoot}:{})}
  });
  let buffer='';this.child.stdout.setEncoding('utf8');this.child.stderr.on('data',chunk=>this.emit('diagnostic',String(chunk).slice(0,4000)));
  this.child.stdout.on('data',chunk=>{buffer+=chunk;if(buffer.length>4000000){this.close();return;}let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);if(!line.trim())continue;let m;try{m=JSON.parse(line);}catch{this.close();return;}if(m.id!==undefined&&!m.method){const p=this.pending.get(m.id);if(p){this.pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(new Error('Codex RPC request failed.')):p.resolve(m.result);}}else this.emit('message',m);}});
  this.child.on('error',()=>this.close());this.child.on('exit',()=>this.close());
 }
 send(message){if(this.closed)throw new Error('Codex process is unavailable.');this.child.stdin.write(JSON.stringify(message)+'\n');}
 request(method,params={}){return new Promise((resolve,reject)=>{const id=++this.sequence,timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('Codex RPC timed out.'));},30000);this.pending.set(id,{resolve,reject,timer});try{this.send({id,method,params});}catch(e){clearTimeout(timer);this.pending.delete(id);reject(e);}});}
 respond(id,result){this.send({id,result});}
 reject(id){this.send({id,error:{code:-32601,message:'Only office dynamic tools are supported.'}});}
 close(){if(this.closed)return;this.closed=true;this.child.kill();for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error('Codex process ended.'));}this.pending.clear();this.emit('closed');}
}
