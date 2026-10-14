import {HttpError,bounded,id,now,object,text,seal,unseal,digest} from './security';
import type {Store} from './persistence';

declare global { interface Env {
 TELEGRAM_BOT_TOKEN?:string; TELEGRAM_WEBHOOK_SECRET?:string; TELEGRAM_OWNER_ID?:string;
 APP_URL?:string; GOOGLE_CLIENT_ID?:string; GOOGLE_CLIENT_SECRET?:string;
}}
export type Delivery={id:string;channel:'telegram'|'email';taskId:string;callId:string;state:'sending'|'sent'|'ambiguous';created:string;payloadHash:string;receipt?:string};
type GmailAccount={email:string;refresh:{iv:number[];data:number[]}};
export function address(value:unknown){const s=text(value,254).trim();if(!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(s))throw new HttpError(400,'Use one plain email address.');return s;}
export const b64=(value:string)=>btoa(String.fromCharCode(...new TextEncoder().encode(value))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const utf8=(value:string)=>new TextDecoder().decode(Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0)));
export function mime(from:string,args:Record<string,unknown>,messageId:string){
 const to=address(args.to),subject=text(args.subject,300),body=text(args.body,12000);if(/[\r\n]/.test(subject))throw new HttpError(400,'Subject cannot contain newlines.');
 const chars=Array.from(subject),words=[];for(let i=0;i<chars.length;i+=12){const encoded=b64(chars.slice(i,i+12).join(''));words.push('=?UTF-8?B?'+encoded.replaceAll('-','+').replaceAll('_','/')+'='.repeat((4-encoded.length%4)%4)+'?=');}
 const headers=[`From: ${address(from)}`,`To: ${to}`,`Subject: ${words.join('\r\n ')}`,`Message-ID: <${messageId}@dual-agent.invalid>`,'MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64'];
 for(const [key,field] of [['In-Reply-To','inReplyTo'],['References','references']])if(args[field]){const value=text(args[field],2000);if(!/^(?:<[^<>\s\r\n]+>\s*)+$/.test(value))throw new HttpError(400,'Invalid reply reference.');headers.push(`${key}: ${value.replace(/>\s*</g,'>\r\n <')}`);}
 const encoded=b64(body).replaceAll('-','+').replaceAll('_','/')+'='.repeat((4-b64(body).length%4)%4);
 return b64(headers.join('\r\n')+'\r\n\r\n'+(encoded.match(/.{1,76}/g)??[]).join('\r\n'));
}
export function telegramOwner(update:Record<string,unknown>,owner:string){
 const message=object(update.message),chat=object(message.chat),from=object(message.from);
 if(!/^\d+$/.test(owner)||chat.type!=='private'||String(chat.id)!==owner||String(from.id)!==owner||message.forward_origin||from.is_bot)throw new HttpError(403,'Only the configured owner can command this bot.');
 if(!Number.isSafeInteger(update.update_id)||Number(update.update_id)<0)throw new HttpError(400,'Invalid Telegram update.');
 return text(message.text??'',12000);
}
export class Messaging {
 constructor(private store:Store,private env:Env){}
 status(){return {telegram:!!(this.env.TELEGRAM_BOT_TOKEN&&this.env.TELEGRAM_WEBHOOK_SECRET&&this.env.TELEGRAM_OWNER_ID),email:this.store.get<GmailAccount>('gmail')?.email??null,google:!!(this.env.GOOGLE_CLIENT_ID&&this.env.GOOGLE_CLIENT_SECRET&&this.env.APP_URL)};}
 async telegram(method:string,payload:unknown){
  if(!this.env.TELEGRAM_BOT_TOKEN)throw new HttpError(409,'Configure Telegram secrets first.');
  let response:Response;try{response=await fetch('https://api.telegram.org/bot'+this.env.TELEGRAM_BOT_TOKEN+'/'+method,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)});}catch{throw new HttpError(502,'Telegram outcome unknown; check delivery history before retrying.');}
  const data=object(JSON.parse(await bounded(response,100000)));if(!response.ok||data.ok!==true)throw new HttpError(502,'Telegram rejected this request.');return data.result;
 }
 publicBase(){const u=new URL(this.env.APP_URL||'http://localhost');if((u.protocol!=='https:'&&!(u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)))||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw new HttpError(409,'Set APP_URL to the public HTTPS origin.');return u.origin;}
 async webhook(){const url=this.publicBase()+'/api/telegram/webhook';if(!url.startsWith('https:'))throw new HttpError(409,'Deploy the HTTPS app before connecting Telegram.');if(!this.env.TELEGRAM_WEBHOOK_SECRET||!/^[A-Za-z0-9_-]{24,256}$/.test(this.env.TELEGRAM_WEBHOOK_SECRET)||!/^\d+$/.test(this.env.TELEGRAM_OWNER_ID??''))throw new HttpError(409,'Configure a webhook secret and numeric owner ID.');return this.telegram('setWebhook',{url,secret_token:this.env.TELEGRAM_WEBHOOK_SECRET,allowed_updates:['message'],max_connections:1});}
 authorization(){
  if(!this.status().google)throw new HttpError(409,'Configure Google OAuth credentials and APP_URL first.');
  const state=id();this.store.put('oauth:'+state,{expires:Date.now()+600000,redirectURI:this.publicBase()+'/api/gmail/callback',clientId:this.env.GOOGLE_CLIENT_ID});
  const u=new URL('https://accounts.google.com/o/oauth2/v2/auth');u.search=new URLSearchParams({client_id:this.env.GOOGLE_CLIENT_ID!,redirect_uri:this.publicBase()+'/api/gmail/callback',response_type:'code',scope:'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send',access_type:'offline',prompt:'consent',state}).toString();return {url:u.href};
 }
 async token(params:Record<string,string>){
  let r:Response;try{r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({...params,client_id:this.env.GOOGLE_CLIENT_ID??'',client_secret:this.env.GOOGLE_CLIENT_SECRET??''}),signal:AbortSignal.timeout(20000)});}catch{throw new HttpError(502,'Google token endpoint unavailable.');}
  const data=object(JSON.parse(await bounded(r,20000)));if(!r.ok||typeof data.access_token!=='string')throw new HttpError(409,'Google authorization expired or was rejected. Reconnect Gmail.');return data;
 }
 async connect(code:string,state:string){
  const pending=this.store.get<{expires:number;redirectURI:string;clientId:string;exchangeStarted?:boolean;token?:{iv:number[],data:number[]}}>('oauth:'+state);if(!pending||pending.expires<Date.now())throw new HttpError(403,'OAuth state expired or already used.');if(pending.clientId!==this.env.GOOGLE_CLIENT_ID||pending.redirectURI!==this.publicBase()+'/api/gmail/callback')throw new HttpError(409,'OAuth configuration changed. Start Gmail consent again.');
  let token:Record<string,unknown>;
  if(pending.token)token=object(JSON.parse(await unseal(pending.token,this.env.ADMIN_PASSWORD)));
  else{if(pending.exchangeStarted)throw new HttpError(409,'Token exchange outcome uncertain. Start Gmail consent again.');pending.exchangeStarted=true;this.store.put('oauth:'+state,pending);token=await this.token({code,grant_type:'authorization_code',redirect_uri:pending.redirectURI});if(typeof token.refresh_token!=='string')throw new HttpError(409,'Google did not issue offline access. Reconnect with consent.');pending.token=await seal(JSON.stringify(token),this.env.ADMIN_PASSWORD);this.store.put('oauth:'+state,pending);}
  const profile=object(await this.gmail('profile',undefined,text(token.access_token,4000)));const email=address(profile.emailAddress);this.store.put('gmail',{email,refresh:await seal(text(token.refresh_token,4000),this.env.ADMIN_PASSWORD)} satisfies GmailAccount);this.store.remove('oauth:'+state);return email;
 }
 async gmail(path:string,body?:unknown,access?:string):Promise<unknown>{
  if(!access){const account=this.store.get<GmailAccount>('gmail');if(!account)throw new HttpError(409,'Connect Gmail in Settings.');const token=await this.token({refresh_token:await unseal(account.refresh,this.env.ADMIN_PASSWORD),grant_type:'refresh_token'});access=text(token.access_token,4000);}
  let r:Response;try{r=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+access,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});}catch{throw new HttpError(502,'Gmail outcome unknown; check delivery history before retrying.');}
  const data=JSON.parse(await bounded(r,1000000));if(!r.ok)throw new HttpError(502,'Gmail rejected this request.');return data;
 }
 async read(messageId:string){
  if(!/^[A-Za-z0-9_-]{1,100}$/.test(messageId))throw new HttpError(400,'Invalid Gmail message ID.');
  const data=object(await this.gmail('messages/'+messageId+'?format=full')),payload=object(data.payload),headers=Array.isArray(payload.headers)?payload.headers:[];
  const header=(name:string)=>text((headers.find((h:any)=>String(h.name).toLowerCase()===name.toLowerCase()) as any)?.value??'',4000);
  let content='';const visit=(part:any,depth=0)=>{if(depth>8||content.length>=12000)return;if(part.mimeType==='text/plain'&&typeof part.body?.data==='string')content+=utf8(part.body.data).slice(0,12000-content.length);if(Array.isArray(part.parts))part.parts.slice(0,40).forEach((p:any)=>visit(p,depth+1));};visit(payload);
  return {id:data.id,threadId:data.threadId,from:header('From'),replyTo:header('Reply-To'),to:header('To'),subject:header('Subject'),messageId:header('Message-ID'),references:header('References'),untrusted_content:content||text(data.snippet??'',4000)};
 }
 async reply(args:Record<string,unknown>){
  const message=await this.read(text(args.message_id,100));const recipient=message.replyTo||message.from;const bracket=recipient.match(/<([^<>]+)>$/);const to=address(bracket?bracket[1]:recipient);
  if(!/^<[^<>\s]+>$/.test(message.messageId))throw new HttpError(409,'Original email has no valid Message-ID; use a new email instead.');
  return {to,subject:message.subject,body:text(args.body,12000),threadId:message.threadId,inReplyTo:message.messageId,references:(message.references+' '+message.messageId).trim()};
 }
 async deliver(taskId:string,callId:string,channel:'telegram'|'email',args:Record<string,unknown>){
  if(channel==='email'&&args.from!==this.status().email)throw new HttpError(409,'Sending account changed. Request a new approval.');
  if(channel==='telegram'&&args.recipient!==undefined&&args.recipient!==this.env.TELEGRAM_OWNER_ID)throw new HttpError(409,'Telegram owner changed. Request a new approval.');
  const payloadHash=await digest(JSON.stringify(args)),key='delivery:'+taskId+':'+callId,previous=this.store.get<Delivery>(key);
  if(previous){if(previous.payloadHash!==payloadHash)throw new HttpError(409,'A tool-call ID was reused with different message arguments.');if(previous.state==='sent')return {delivered:true,receipt:previous.receipt};throw new HttpError(409,'Delivery outcome ambiguous. Check the provider before reconciling this delivery.');}
  const record:Delivery={id:taskId+':'+callId,taskId,callId,channel,state:'sending',created:now(),payloadHash};this.store.put(key,record);
  try{
   const result=channel==='telegram'?object(await this.telegram('sendMessage',{chat_id:this.env.TELEGRAM_OWNER_ID,text:text(args.text,4096)})):object(await this.gmail('messages/send',{raw:mime(this.store.get<GmailAccount>('gmail')?.email??'',args,id()),...(args.threadId?{threadId:text(args.threadId,100)}:{})}));
   const receipt=channel==='telegram'?result.message_id:result.id;if(receipt===undefined||receipt===null)throw new HttpError(502,'Provider returned no delivery receipt.');record.state='sent';record.receipt=String(receipt);this.store.put(key,record);return {delivered:true,receipt:record.receipt};
  }catch(e){record.state='ambiguous';this.store.put(key,record);throw e;}
 }
}
