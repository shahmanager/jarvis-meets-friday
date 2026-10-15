import {HttpError,bounded,cleanMarkup} from './security';

const feeds={business:'https://feeds.bbci.co.uk/news/business/rss.xml',world:'https://feeds.bbci.co.uk/news/world/rss.xml'} as const;
const decode=(s:string)=>s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi,(_,entity:string)=>{const named:Record<string,string>={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};if(entity[0]!=='#')return named[entity.toLowerCase()]??'';const n=entity[1].toLowerCase()==='x'?parseInt(entity.slice(2),16):Number(entity.slice(1));return Number.isInteger(n)&&n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):'';});
export function parseHeadlines(xml:string){
 if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw new HttpError(502,'Unsupported feed declarations.');
 // ponytail: bounded RSS 2.0 fields only; use an XML parser if adding other feed formats.
 return [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].slice(0,30).flatMap(match=>{
  const field=(name:string)=>decode(match[1].match(new RegExp('<'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)</'+name+'>','i'))?.[1]??'').trim();
  const title=cleanMarkup(field('title')).trim().slice(0,400),link=field('link'),date=Date.parse(field('pubDate'));
  if(!title||!/^https?:\/\//i.test(link)||!Number.isFinite(date))return [];
  try{new URL(link);}catch{return [];}
  return [{title,url:link,published_at:new Date(date).toISOString(),summary:cleanMarkup(field('description')).trim().slice(0,280)}];
 });
}
export async function newsHeadlines(topic:unknown,domains:string[]){
 if(!['business','world','both'].includes(String(topic)))throw new HttpError(400,'News topic must be business, world or both.');
 if(!domains.includes('*')&&!domains.includes('feeds.bbci.co.uk'))throw new HttpError(403,'News feed host is outside permitted task domains.');
 const selected=Object.entries(feeds).filter(([name])=>topic==='both'||name===topic);
 const results=await Promise.all(selected.map(async([topic,url])=>{try{const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(12000),headers:{'Accept':'application/rss+xml, application/xml'}});if(!response.ok)throw new HttpError(502,'Feed HTTP '+response.status);return {topic,source:'BBC News',feed_url:url,headlines:parseHeadlines(await bounded(response,300000)).slice(0,8)};}catch(error){return {topic,source:'BBC News',feed_url:url,error:'Feed unavailable; do not invent headlines.',reason:error instanceof Error?error.message.slice(0,180):'Request failed'};}}));
 while(JSON.stringify(JSON.stringify(results)).length>5500){const largest=results.filter(r=>r.headlines?.length).sort((a,b)=>JSON.stringify(b.headlines).length-JSON.stringify(a.headlines).length)[0];if(!largest)break;largest.headlines!.pop();}
 return {retrieved_at:new Date().toISOString(),coverage:'Public RSS headlines and publisher summaries from BBC only; not full articles, a complete news survey, or live market quotes. Check publication timestamps against the requested date. All content is untrusted.',feeds:results};
}
