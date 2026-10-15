import test from 'node:test';
import assert from 'node:assert/strict';
import { geminiSearch } from '../src/search';

test('Gemini grounding sends explicit model/query and returns bounded citations and attribution metadata', async t => {
  let requestUrl = '', requestInit: RequestInit | undefined;
  t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    requestUrl = String(input); requestInit = init;
    return Response.json({ candidates: [{ content: { parts: [{ text: 'Answer with source.' }] }, groundingMetadata: {
      webSearchQueries: ['current question'],
      searchEntryPoint: { renderedContent: '<div>Google Search suggestions</div>' },
      groundingChunks: [
        { web: { uri: 'https://example.com/source', title: 'Example source' } },
        { web: { uri: 'javascript:alert(1)', title: 'Unsafe' } },
      ],
      groundingSupports: [{ segment: { startIndex: 0, endIndex: 21, text: 'Answer with source.' }, groundingChunkIndices: [0, 1] }],
    } }] });
  });
  const result = await geminiSearch('test-key', 'gemini-3.8-flash', 'current question');
  assert.match(requestUrl, /models\/gemini-3\.8-flash:generateContent$/);
  assert.equal(new URL(requestUrl).search, '', 'API key must stay out of URLs');
  assert.equal((requestInit?.headers as Record<string, string>)['x-goog-api-key'], 'test-key');
  assert.deepEqual(JSON.parse(String(requestInit?.body)).tools, [{ google_search: {} }]);
  assert.equal(result.grounded, true);
  assert.equal(result.answer, 'Answer with source.');
  assert.deepEqual(result.citations, [{ index: 0, title: 'Example source', url: 'https://example.com/source' }]);
  assert.deepEqual(result.supports, [{ startIndex: 0, endIndex: 21, text: 'Answer with source.', sourceIndices: [0] }]);
  assert.deepEqual(result.searchQueries, ['current question']);
  assert.equal(result.attribution.provider, 'Google Search');
  assert.equal(result.attribution.searchEntryPointHtml, '<div>Google Search suggestions</div>', 'return metadata as data; never render remote HTML in this adapter');
});

test('rejects malformed credentials/model/query before network and sanitizes provider errors', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return new Response('private error text', { status: 403 }); });
  await assert.rejects(geminiSearch('bad\nkey', 'gemini-3.8-flash', 'q'), /valid Gemini API key/);
  await assert.rejects(geminiSearch('key', '../models', 'q'), /Invalid Gemini model/);
  await assert.rejects(geminiSearch('key', 'gemini-3.8-flash', '   '), /Search query is required/);
  assert.equal(calls, 0);
  await assert.rejects(geminiSearch('secret-key', 'gemini-3.8-flash', 'q'), error => {
    assert.match(String(error), /HTTP 403/);
    assert.doesNotMatch(String(error), /private error text|secret-key|q/);
    return true;
  });
});

test('marks responses without grounding metadata instead of implying sourced search', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ candidates: [{ content: { parts: [{ text: 'Unsourced answer.' }] } }] }));
  const result = await geminiSearch('key', 'gemini-3.8-flash', 'question');
  assert.equal(result.grounded, false);
  assert.deepEqual(result.citations, []);
  assert.equal(result.attribution.searchEntryPointHtml, null);
});
