import assert from 'node:assert/strict';
import test from 'node:test';
import {artifactSpec} from './artifacts.mjs';
const task='12345678-1234-1234-1234-123456789abc',id='abcdef12-1234-1234-1234-123456789abc';
test('object keys are derived from validated task and artifact IDs',()=>{assert.equal(artifactSpec(task,{id}).key,`artifacts/${task}/${id}`);assert.throws(()=>artifactSpec(task,{id:'../../secret'}));});
test('stored artifacts enforce names, content limits and UTF-8 byte counts',()=>{assert.equal(artifactSpec(task,{id,name:'result.md',content:'é'},true).bytes,2);assert.throws(()=>artifactSpec(task,{id,name:'../../result.md',content:'x'},true));assert.throws(()=>artifactSpec(task,{id,name:'result.md',content:'x'.repeat(60001)},true));});
