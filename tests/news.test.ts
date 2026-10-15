import test from 'node:test';import assert from 'node:assert/strict';
import {parseHeadlines,newsHeadlines} from '../src/news';
test('News RSS preserves source dates and safe links; does not execute HTML or resolve XML entities',()=>{
 const items=parseHeadlines('<rss><channel><item><title><![CDATA[Markets &amp; trade]]></title><link>https://www.bbc.com/news/business-1</link><pubDate>Thu, 15 Oct 2026 09:29:54 GMT</pubDate><description>&lt;b&gt;Publisher summary&lt;/b&gt;</description></item><item><title>Bad</title><link>javascript:alert(1)</link><pubDate>bad</pubDate></item></channel></rss>');
 assert.equal(items.length,1);assert.equal(items[0].title,'Markets & trade');assert.equal(items[0].published_at,'2026-10-15T09:29:54.000Z');assert.equal(items[0].summary,'Publisher summary');
 assert.throws(()=>parseHeadlines('<!DOCTYPE rss><rss/>'));assert.deepEqual(parseHeadlines('<rss/>'),[]);
});
test('News fixed endpoints respect task domain scope and topic before network access',async()=>{
 await assert.rejects(newsHeadlines('both',['example.com']),/outside permitted/);await assert.rejects(newsHeadlines('private arbitrary query',['*']),/News topic/);
});
test('News evidence stays compact enough for complete peer-review input, with both feed topics retained',async t=>{
 const xml='<rss><channel>'+Array.from({length:25},(_,i)=>`<item><title>${'Headline &quot;'.repeat(40)}</title><link>https://www.bbc.com/news/${i}</link><pubDate>Thu, 15 Oct 2026 09:29:54 GMT</pubDate><description>${'Summary &quot;'.repeat(80)}</description></item>`).join('')+'</channel></rss>';
 t.mock.method(globalThis,'fetch',async()=>new Response(xml));
 const result=await newsHeadlines('both',['*']);assert.ok(JSON.stringify(JSON.stringify(result)).length<7000);assert.equal(result.feeds.length,2);assert.ok(result.feeds.every(f=>f.headlines?.length));
});
