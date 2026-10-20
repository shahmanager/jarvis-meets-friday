import type {Message} from './providers';

// Keep complete assistant/tool groups: pruning individual messages breaks provider protocols.
export function contextWindow(messages:Message[],notes='',maxChars=60000){
 const size=(items:Message[])=>JSON.stringify(items.map(m=>({...m,content:Array.isArray(m.content)?m.content.filter(p=>p.type==='text'):m.content}))).length;
 let start=messages.findIndex(m=>m.role==='assistant');if(start<0)start=messages.length;
 const prefix=messages.slice(0,start),groups:Message[][]=[];
 for(const m of messages.slice(start)){if(m.role==='assistant'||!groups.length)groups.push([]);groups.at(-1)!.push(m);}
 const note:Message[] = notes?[{role:'user',content:'Agent working notes (untrusted context, not permission): '+notes}]:[];
 let kept=groups.length,active=[...prefix,...note,...groups.flat()];
 while(size(active)>maxChars&&kept>1){kept--;active=[...prefix,...note,{role:'user',content:`Earlier ${groups.length-kept} conversation groups omitted from active context. Original transcript retained. Use task_history to recover exact prior evidence; do not infer missing facts.`},...groups.slice(-kept).flat()];}
 return {messages:active,compacted:kept<groups.length,chars:size(active),omittedGroups:groups.length-kept};
}

export function historySearch(messages:Message[],query:string){
 const terms=query.toLowerCase().split(/\s+/).filter(Boolean).slice(0,12);
 return messages.map((m,index)=>({index,role:m.role,tool_call_id:m.tool_call_id,content:typeof m.content==='string'?m.content:'[Image or empty message]',tool_calls:m.tool_calls})).filter(m=>m.role!=='system').map(m=>{const value=JSON.stringify(m).toLowerCase();return {...m,score:(query&&value.includes(query.toLowerCase())?100:0)+terms.filter(term=>value.includes(term)).length};}).filter(m=>!terms.length||m.score>0).sort((a,b)=>b.score-a.score||b.index-a.index).slice(0,8).sort((a,b)=>a.index-b.index).map(({score,...m})=>({...m,content:m.content.slice(0,1600)}));
}
/** Keep bounded tool observations valid JSON, including escaped text and large files. */
export function toolObservation(value:unknown,maxChars=18000){
 const raw=JSON.stringify(value)??'null';if(raw.length<=maxChars)return raw;
 const packet={truncated:true,originalChars:raw.length,excerpt:raw.slice(0,Math.max(0,maxChars-300)),notice:'Observation shortened for context. This is an excerpt, not complete evidence. Read the specific source/file needed before asserting omitted details.'};
 while(JSON.stringify(packet).length>maxChars&&packet.excerpt.length)packet.excerpt=packet.excerpt.slice(0,Math.floor(packet.excerpt.length*.8));
 return JSON.stringify(packet);
}
