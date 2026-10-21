import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {setTimeout as sleep} from 'node:timers/promises';

async function freePort(){const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));return port;}
test('Host telemetry requires authentication and performs no Docker/model operations',async()=>{
 const port=await freePort(),proxyPort=await freePort(),secret='synthetic-telemetry-test-secret';
 const child=spawn(process.execPath,['executor/server.mjs'],{env:{...process.env,PORT:String(port),HOST:'127.0.0.1',BROWSER_PROXY_PORT:String(proxyPort),BROWSER_PROXY_HOST:'127.0.0.1',EXECUTOR_SECRET:secret},windowsHide:true,stdio:'ignore'});
 try{
  let ready=false;for(let n=0;n<40;n++){try{if((await fetch('http://127.0.0.1:'+port+'/health')).ok){ready=true;break;}}catch{}await sleep(100);}assert.ok(ready,'Executor must start');
  const url='http://127.0.0.1:'+port+'/metrics';assert.equal((await fetch(url)).status,401);
  const response=await fetch(url,{headers:{Authorization:'Bearer '+secret}}),data=await response.json();assert.equal(response.status,200);assert.ok(data.cpuCount>0);assert.ok(data.memoryTotalBytes>0);assert.ok(data.memoryFreeBytes>=0);assert.equal(data.activeOperations,0);assert.ok(!JSON.stringify(data).includes(secret));
 }finally{child.kill();}
});
