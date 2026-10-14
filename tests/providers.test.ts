import test from 'node:test';
import assert from 'node:assert/strict';
import {completion} from '../src/providers';
const config={provider:'openrouter' as const,model:'test-only',key:'test-key'};
test('provider token accounting rejects missing, negative and string counts',async t=>{
 for(const usage of [undefined,{total_tokens:-1},{total_tokens:'100'},{prompt_tokens:100}]){
  t.mock.method(globalThis,'fetch',async()=>Response.json({choices:[{message:{role:'assistant',content:'test'}}],usage}));
  await assert.rejects(completion(config,[],[]),/token usage/);t.mock.restoreAll();
 }
});
test('split usage is normalized without inventing measured tokens',async t=>{
 t.mock.method(globalThis,'fetch',async()=>Response.json({choices:[{message:{role:'assistant',content:'test'}}],usage:{prompt_tokens:12,completion_tokens:3}}));
 assert.equal((await completion(config,[],[])).usage.total_tokens,15);
});
