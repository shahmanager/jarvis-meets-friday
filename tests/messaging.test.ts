import test from 'node:test';
import assert from 'node:assert/strict';
import {address,mime,telegramOwner,Messaging} from '../src/messaging';
const owner={update_id:3,message:{text:'hello',chat:{id:123,type:'private'},from:{id:123}}};
test('Telegram accepts only direct private owner messages',()=>{
 assert.equal(telegramOwner(owner,'123'),'hello');assert.throws(()=>telegramOwner(owner,'124'));
 assert.throws(()=>telegramOwner({...owner,message:{...owner.message,forward_origin:{type:'user'}}},'123'));
 assert.throws(()=>telegramOwner({...owner,message:{...owner.message,chat:{id:123,type:'group'}}},'123'));
});
test('Gmail MIME preserves UTF-8 and prevents header injection',()=>{
 const raw=mime('me@example.com',{to:'you@example.com',subject:'Résumé',body:'Hello 🌍',inReplyTo:'<original@example.com>'},'test');
 const decoded=Buffer.from(raw,'base64url').toString();assert.match(decoded,/In-Reply-To: <original@example.com>/);assert.match(decoded,/Content-Transfer-Encoding: base64/);assert.match(decoded,/SGVsbG8g8J/);
 assert.throws(()=>address('you@example.com\r\nBcc: victim@example.com'));assert.throws(()=>mime('me@example.com',{to:'you@example.com',subject:'Hello\r\nBcc: victim@example.com',body:'hi'},'test'));
});
test('Delivery ledger blocks duplicate sends, including ambiguous network failures',async()=>{
 const entries=new Map<string,any>(),store={get:<T>(k:string)=>entries.get(k) as T,put:(k:string,v:unknown)=>entries.set(k,v),remove:(k:string)=>entries.delete(k),list:<T>(prefix:string)=>[...entries].filter(([k])=>k.startsWith(prefix)).map(([,v])=>v as T)};
 const original=globalThis.fetch;let sends=0;globalThis.fetch=async()=>{sends++;throw new Error('timeout');};
 try{const messaging=new Messaging(store,{TELEGRAM_BOT_TOKEN:'fake',TELEGRAM_OWNER_ID:'123'} as Env);await assert.rejects(messaging.deliver('task','call','telegram',{text:'hello'}));await assert.rejects(messaging.deliver('task','call','telegram',{text:'hello'}));assert.equal(sends,1);assert.equal(entries.get('delivery:task:call').state,'ambiguous');}finally{globalThis.fetch=original;}
});

test('A successful receipt is reused only for identical approved arguments',async()=>{
 const entries=new Map<string,any>(),store={get:<T>(k:string)=>entries.get(k) as T,put:(k:string,v:unknown)=>entries.set(k,v),remove:(k:string)=>entries.delete(k),list:<T>(prefix:string)=>[...entries].filter(([k])=>k.startsWith(prefix)).map(([,v])=>v as T)};
 const original=globalThis.fetch;let sends=0;globalThis.fetch=async()=>{sends++;return Response.json({ok:true,result:{message_id:42}});};
 try{const messaging=new Messaging(store,{TELEGRAM_BOT_TOKEN:'fake',TELEGRAM_OWNER_ID:'123'} as Env);assert.deepEqual(await messaging.deliver('task','call','telegram',{text:'hello'}),{delivered:true,receipt:'42'});await messaging.deliver('task','call','telegram',{text:'hello'});await assert.rejects(messaging.deliver('task','call','telegram',{text:'different'}));assert.equal(sends,1);}finally{globalThis.fetch=original;}
});
