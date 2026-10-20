import test from 'node:test';
import assert from 'node:assert/strict';
import { geminiSearch, openrouterSearch } from '../src/search';

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

test('OpenRouter web search sends the plugin, parses standard citations and keeps key out of errors', async t => {
  let requestUrl = '', requestInit: RequestInit | undefined;
  t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    requestUrl = String(input); requestInit = init;
    return Response.json({ choices: [{ message: { role: 'assistant', content: 'Sourced answer.', annotations: [
      { type: 'url_citation', url_citation: { url: 'https://example.com/web', title: 'Web source' } },
      { type: 'url_citation', url_citation: { url: 'http://insecure.example/path', title: 'Insecure' } },
    ] } }], usage: { total_tokens: 33 } });
  });
  const result = await openrouterSearch('test-key', 'deepseek/deepseek-chat-v3.1', 'current question');
  assert.equal(requestUrl, 'https://openrouter.ai/api/v1/chat/completions');
  assert.equal((requestInit?.headers as Record<string, string>).authorization, 'Bearer test-key');
  assert.deepEqual(JSON.parse(String(requestInit?.body)).plugins, [{ id: 'web', engine: 'parallel', mode: 'turbo', max_results: 5 }]);
  assert.equal(result.usageTokens, 33);
  assert.equal(result.answer, 'Sourced answer.');
  assert.equal(result.grounded, true);
  assert.deepEqual(result.citations, [{ index: 0, title: 'Web source', url: 'https://example.com/web' }], 'only https citations survive');
  assert.equal(result.attribution.provider, 'OpenRouter web search');
});

test('rejects malformed OpenRouter search inputs before network and reports quota clearly', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return new Response('unpaid credits', { status: 429 }); });
  await assert.rejects(openrouterSearch('bad\nkey', 'deepseek/deepseek-chat-v3.1', 'q'), /valid OpenRouter API key/);
  await assert.rejects(openrouterSearch('key', 'any-model', '   '), /Search query is required/);
  assert.equal(calls, 0);
  await assert.rejects(openrouterSearch('key', 'any-model', 'q'), error => {
    assert.match(String(error), /HTTP 429/);
    assert.doesNotMatch(String(error), /unpaid credits|secret-key/);
    return true;
  });
  assert.equal(calls, 1, 'exactly one network attempt happened');
});
