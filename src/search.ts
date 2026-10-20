import { bounded, HttpError, text } from './security';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/';
const MAX_RESPONSE = 1_000_000;
const MAX_ANSWER = 40_000;

export type GroundedCitation = { index: number; title: string; url: string };
export type GroundingSupport = { startIndex: number; endIndex: number; text: string; sourceIndices: number[] };
export type SearchResult = {
  query: string;
  usageTokens?: number;
  answer: string;
  grounded: boolean;
  citations: GroundedCitation[];
  attribution: { provider: string; searchEntryPointHtml: string | null };
};
export type GeminiSearchResult = SearchResult & {
  supports: GroundingSupport[];
  searchQueries: string[];
  attribution: { provider: 'Google Search'; searchEntryPointHtml: string | null };
};

function httpsUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 2048) return;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || !url.hostname ||
        url.hostname === 'localhost' || url.hostname.endsWith('.localhost') || /^\d+(?:\.\d+){3}$/.test(url.hostname) || url.hostname.includes(':')) return;
    return url.toString();
  } catch { return; }
}

function strings(value: unknown, cap: number, length: number): string[] {
  if (!Array.isArray(value)) return [];
  if (value.length > cap || value.some(item => typeof item !== 'string' || item.length > length)) throw new HttpError(502, 'Gemini Search metadata exceeds output limits.');
  return value as string[];
}

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

/** Grounds a query through OpenRouter's web-search plugin (Parallel turbo engine, $0.001 per search billed to OpenRouter credits). */
export async function openrouterSearch(apiKey: string, model: string, query: string): Promise<SearchResult> {
  if (typeof apiKey !== 'string' || !apiKey.trim() || apiKey.length > 8192 || /[\r\n]/.test(apiKey)) throw new HttpError(400, 'Configure a valid OpenRouter API key.');
  text(model, 100);
  query = text(query, 8000).trim();
  if (!query) throw new HttpError(400, 'Search query is required.');

  let response: Response;
  try {
    response = await fetch(OPENROUTER_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: [{role:'system',content:'Return concise sourced research notes, aiming for 250 words. Include relevant facts, dates, source links and uncertainty. Do not write a full report or itinerary. Prices are estimates unless an exact dated quote is verified.'}, { role: 'user', content: query }], plugins: [{ id: 'web', engine: 'parallel', mode: 'turbo', max_results: 5 }] }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch { throw new HttpError(502, 'OpenRouter search request failed or timed out.'); }

  let raw:string;
  try { raw = await bounded(response, MAX_RESPONSE); } catch(error) { if(error instanceof HttpError)throw error;throw new HttpError(502,'OpenRouter search response interrupted or timed out. No complete search result was received.'); }
  if (!response.ok) throw new HttpError(response.status === 429 ? 429 : 502, `OpenRouter search returned HTTP ${response.status}.`);
  let payload: any;
  try { payload = JSON.parse(raw); } catch { throw new HttpError(502, 'OpenRouter search returned invalid JSON.'); }

  const message = payload?.choices?.[0]?.message;
  const answer = typeof message?.content === 'string' ? message.content : '';
  if (!answer) throw new HttpError(502, 'OpenRouter search returned no text answer.');
  if (answer.length > MAX_ANSWER) throw new HttpError(502, 'OpenRouter search answer exceeds output limits.');

  const annotations = Array.isArray(message.annotations) ? message.annotations : [];
  if (annotations.length > 40) throw new HttpError(502, 'OpenRouter search returned too many citations.');
  const citations: GroundedCitation[] = [];
  annotations.forEach((annotation: any, index: number) => {
    const citation = annotation?.url_citation;
    const url = httpsUrl(citation?.url);
    if (url && typeof citation.title === 'string' && citation.title.length <= 300) citations.push({ index, title: citation.title, url });
  });

  return {
    query,
    usageTokens: Number.isSafeInteger(payload?.usage?.total_tokens) && payload.usage.total_tokens >= 0 ? payload.usage.total_tokens : undefined,
    answer,
    grounded: citations.length > 0,
    citations,
    attribution: { provider: 'OpenRouter web search', searchEntryPointHtml: null },
  };
}

/** Calls Gemini's built-in Google Search grounding. The caller owns disclosure approval for private queries. */
export async function geminiSearch(apiKey: string, model: string, query: string): Promise<GeminiSearchResult> {
  if (typeof apiKey !== 'string' || !apiKey.trim() || apiKey.length > 8192 || /[\r\n]/.test(apiKey)) throw new HttpError(400, 'Configure a valid Gemini API key.');
  text(model, 100);
  if (!/^[A-Za-z0-9._-]+$/.test(model)) throw new HttpError(400, 'Invalid Gemini model ID.');
  query = text(query, 8000).trim();
  if (!query) throw new HttpError(400, 'Search query is required.');

  let response: Response;
  try {
    response = await fetch(`${ENDPOINT}${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: query }] }], tools: [{ google_search: {} }] }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch { throw new HttpError(502, 'Gemini Search request failed or timed out.'); }

  let raw:string;
  try { raw = await bounded(response, MAX_RESPONSE); } catch(error) { if(error instanceof HttpError)throw error;throw new HttpError(502,'Gemini Search response interrupted or timed out. No complete search result was received.'); }
  if (!response.ok) throw new HttpError(response.status === 429 ? 429 : 502, `Gemini Search returned HTTP ${response.status}.`);
  let payload: any;
  try { payload = JSON.parse(raw); } catch { throw new HttpError(502, 'Gemini Search returned invalid JSON.'); }

  const candidate = payload?.candidates?.[0];
  const parts = candidate?.content?.parts;
  const answer = Array.isArray(parts) ? parts.filter((part: any) => typeof part?.text === 'string').map((part: any) => part.text).join('') : '';
  if (!answer) throw new HttpError(502, 'Gemini Search returned no text answer.');
  if (answer.length > MAX_ANSWER) throw new HttpError(502, 'Gemini Search answer exceeds output limits.');

  const metadata = candidate?.groundingMetadata;
  const chunks = Array.isArray(metadata?.groundingChunks) ? metadata.groundingChunks : [];
  if (chunks.length > 40) throw new HttpError(502, 'Gemini Search returned too many citations.');
  const citations: GroundedCitation[] = [];
  for (let index = 0; index < chunks.length; index++) {
    const web = chunks[index]?.web;
    const url = httpsUrl(web?.uri);
    if (url && typeof web.title === 'string' && web.title.length <= 300) citations.push({ index, title: web.title, url });
  }
  const citationIndices = new Set(citations.map(citation => citation.index));
  const rawSupports = Array.isArray(metadata?.groundingSupports) ? metadata.groundingSupports : [];
  if (rawSupports.length > 200) throw new HttpError(502, 'Gemini Search returned too many citation supports.');
  const supports: GroundingSupport[] = rawSupports.flatMap((item: any) => {
    const segment = item?.segment;
    if (!Number.isSafeInteger(segment?.startIndex) || !Number.isSafeInteger(segment?.endIndex) || segment.startIndex < 0 || segment.endIndex < segment.startIndex) return [];
    const sourceIndices = Array.isArray(item.groundingChunkIndices) ? item.groundingChunkIndices.filter((index: unknown): index is number => typeof index === 'number' && Number.isSafeInteger(index) && citationIndices.has(index)).slice(0, 20) : [];
    return sourceIndices.length && typeof segment.text === 'string' && segment.text.length <= 4000 ? [{ startIndex: segment.startIndex, endIndex: segment.endIndex, text: segment.text, sourceIndices }] : [];
  });
  const renderedContent = metadata?.searchEntryPoint?.renderedContent;
  if (typeof renderedContent === 'string' && renderedContent.length > 30_000) throw new HttpError(502, 'Google Search attribution metadata exceeds output limits.');

  return {
    query,
    usageTokens: Number.isSafeInteger(payload?.usageMetadata?.totalTokenCount)&&payload.usageMetadata.totalTokenCount>=0?payload.usageMetadata.totalTokenCount:undefined,
    answer,
    grounded: citations.length > 0,
    citations,
    supports,
    searchQueries: strings(metadata?.webSearchQueries, 20, 1000),
    attribution: {
      provider: 'Google Search',
      searchEntryPointHtml: typeof renderedContent === 'string' ? renderedContent : null,
    },
  };
}
