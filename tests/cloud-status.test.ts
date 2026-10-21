import test from 'node:test';
import assert from 'node:assert/strict';
import {cloudProbe,resourceSample} from '../src/cloud-status';

test('Cloud probes are bounded authenticated GETs and never expose transport errors',async t=>{
 let request:any;
 t.mock.method(globalThis,'fetch',async(url:any,options:any)=>{request={url,options};return Response.json({service:'fixture'});});
 assert.equal((await cloudProbe('https://executor.example','fixture-token','/metrics')).status,'online');
 assert.equal(request.options.headers.Authorization,'Bearer fixture-token');assert.equal(request.options.body,undefined);assert.equal(request.options.redirect,'manual');
 t.mock.method(globalThis,'fetch',async()=>new Response('',{status:401}));assert.equal((await cloudProbe('https://executor.example','fixture-token','/metrics')).status,'authentication_failed');
 t.mock.method(globalThis,'fetch',async()=>{throw Error('private endpoint and token');});assert.equal((await cloudProbe('https://executor.example','fixture-token','/metrics')).status,'unreachable');
 assert.equal((await cloudProbe(undefined,undefined,'/health')).status,'not_configured');
});
test('Resource telemetry publishes only finite nonnegative numeric fields',()=>{
 assert.deepEqual(resourceSample({cpuCount:2,memoryTotalBytes:2048,memoryFreeBytes:-1,load1:NaN,secret:'private'}),{cpuCount:2,memoryTotalBytes:2048});
 assert.equal(resourceSample(null),null);
});
