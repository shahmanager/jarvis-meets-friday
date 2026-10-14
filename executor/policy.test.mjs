import {test} from 'node:test';import assert from 'node:assert/strict';
import {relativePath,validateHost,publicIP} from './policy.mjs';
test('executor paths reject traversal, absolute paths and shell-shaped inputs',()=>{for(const s of ['../a','/a','a/../b','a;rm','a//b','C:\\a'])assert.throws(()=>relativePath(s));assert.equal(relativePath('report.md'),'report.md');});
test('public addresses exclude metadata, loopback, LAN and IPv6 local space',()=>{for(const s of ['127.0.0.1','10.1.2.3','169.254.169.254','172.17.0.1','192.168.1.2','0.0.0.0','::1','fc00::1','fe80::1','::ffff:127.0.0.1'])assert.equal(publicIP(s),false,s);assert.equal(publicIP('93.184.216.34'),true);});
test('URL permissions apply to all browser operations',()=>{assert.equal(validateHost('https://example.com/a',['example.com']).hostname,'example.com');assert.throws(()=>validateHost('https://other.com',['example.com']));assert.throws(()=>validateHost('http://example.com',['example.com']));});
