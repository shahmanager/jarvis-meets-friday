import test from 'node:test';
import assert from 'node:assert/strict';
import {needsApproval} from '../src/tools';
test('local disclosure makes new outbound URLs require exact approval',()=>{
 assert.equal(needsApproval('web_read',{url:'https://example.com/'}),false);
 assert.equal(needsApproval('web_read',{url:'https://example.com/private-fact'},true),true);
 assert.equal(needsApproval('browser',{action:'navigate',url:'https://example.com/'},true),true);
 assert.equal(needsApproval('browser',{action:'read'},true),false);
 assert.equal(needsApproval('browser',{action:'fill'},false),true);
});
