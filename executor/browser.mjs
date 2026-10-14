import http from 'node:http';import {chromium} from 'playwright';import {validateHost} from './policy.mjs';
const domains=JSON.parse(process.env.BROWSER_DOMAINS||'{}'),allowed=process.env.BROWSER_PUBLIC==='1'?['*']:Object.keys(domains);
const rules=[...Object.entries(domains).map(([host,ip])=>`MAP ${host} ${ip}`),'MAP * ~NOTFOUND'].join(',');
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_PROXY?{proxy:{server:process.env.BROWSER_PROXY,username:process.env.BROWSER_PROXY_USER,password:process.env.BROWSER_PROXY_PASSWORD}}:{}),args:['--proxy-bypass-list=<-loopback>','--disable-quic','--disable-dev-shm-usage','--force-webrtc-ip-handling-policy=disable_non_proxied_udp',...(process.env.BROWSER_PROXY?[]:['--host-resolver-rules='+rules])]});
const context=await browser.newContext({serviceWorkers:'block',acceptDownloads:false,viewport:{width:1280,height:800}});
await context.route('**/*',async route=>{try{validateHost(route.request().url(),allowed);await route.continue();}catch{await route.abort();}});
if(!process.env.BROWSER_PROXY)await context.routeWebSocket('**/*',ws=>ws.close());
const page=await context.newPage();
http.createServer(async(req,res)=>{try{let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>20000)throw new Error('Input too large.');}const a=JSON.parse(raw);let result;
 switch(a.action){
  case 'navigate':validateHost(a.url,allowed);await page.goto(a.url,{waitUntil:'domcontentloaded',timeout:25000});result={url:page.url(),title:await page.title()};break;
  case 'read':result={url:page.url(),title:await page.title(),untrusted_content:(await page.locator('body').innerText({timeout:10000})).slice(0,18000)};break;
  case 'screenshot':result={url:page.url(),image_base64:(await page.screenshot({type:'jpeg',quality:50})).toString('base64')};break;
  case 'click':if(typeof a.selector!=='string'||a.selector.length>500)throw new Error('Invalid selector.');validateHost(page.url(),allowed);await page.locator(a.selector).click({timeout:10000});result={url:page.url(),title:await page.title(),note:'Inspect the resulting page to verify the action.'};break;
  case 'fill':if(typeof a.selector!=='string'||a.selector.length>500||typeof a.value!=='string'||a.value.length>5000)throw new Error('Invalid fill.');validateHost(page.url(),allowed);await page.locator(a.selector).fill(a.value,{timeout:10000});result={filled:true};break;
  default:throw new Error('Unknown browser operation.');
 }res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));
 }catch(e){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}));}}).listen(8789,'127.0.0.1');
