# Performance review — 21 October 2026

## Measured failure

The existing NSE-breadth task took 278.6 seconds, 13 Jarvis checkpoints and six searches. Search tools consumed about 144 seconds, including one 60-second timeout. Reported aggregate usage was 227,199 tokens for a 905-character final answer. Friday review and delegation did not run in this task. These measurements describe the old run, not a benchmark of the patch.

The answer covered a restricted F&O basket, then selected two rising stocks without establishing business quality, a one-week catalyst or an evidence-backed rebound setup. It did not adequately answer the request.

## Causes and changes

- Search was another model invocation, not a raw search index lookup. The configured DeepSeek V4 Flash catalog reports high reasoning as its default. Evidence extraction now explicitly disables reasoning and requests at most 1,200 completion tokens. Jarvis still does the substantive reasoning. Parallel turbo remains the configured search engine. This bounds synthesis output, not search-plugin input or provider latency.
- Worker transcript trimming does not trim an already running native Codex thread. Native Codex now receives a 2,000-token per-observation retention setting and a 32,000-token automatic-compaction threshold. This is context management, not a task token/step limit. Full office tool receipts remain persisted; omitted facts need retrieval before use. Compaction itself can require an additional model call.
- Research guidance now requires coverage appropriate to the requested decision, separate evidence for quality and near-term strength, explicit universe/timestamp, and named gaps before further searches. Prompts guide behavior; they do not guarantee analytical quality.
- The owner's delegation removal is retained. Friday is an optional evidence checker, with automatic review off in the current deployment. No extra Friday VM or Codex runtime is required.

## Prompt caching and accounting

The app does not implement a separate KV token cache. Eligible model-provider prefix caching is provider controlled. Keeping the native session and stable instruction/tool prefix can support caching; it does not prove a hit. Caching reduces eligible input cost/processing and does not eliminate redundant work or make total reported tokens equal billed full-price tokens.

Native Codex token receipts now preserve input, output and cached-input deltas when the complete validated counters are available. The office records these as `token_usage` events. Missing detail is left unknown, never replaced by zero. Aggregate task tokens still include search and review calls; the component event is for the corresponding main-model receipt only. Search component/cost breakdown, historical backfill and a full usage dashboard remain separate work. No exact invoice or savings percentage is claimed.

References: [Codex configuration](https://learn.chatgpt.com/docs/config-file/config-reference), [OpenAI prefix caching](https://developers.openai.com/api/docs/guides/prompt-caching), [OpenRouter reasoning controls](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens).

## Verification and demo limits

Synthetic tests cover search request settings, tool receipts, cache counters, replay without double accounting, role/tool availability and workflow guidance. No paid inference task was run to validate this patch. New-model latency, automatic compaction through the configured provider and analytical improvement still need the owner's real test. The cloud UI, executor and native harness health can be checked without inference. Healthy infrastructure is not proof of answer quality.

Cloud console is the labelled header button, also reachable at `/#cloud` after sign-in. Its scaling lab is a simulation; the actual AWS deployment is one fixed EC2 host with timed shutdown. On-demand wake and safe idle shutdown remain unimplemented.

## Live infrastructure verification

After deployment, native Codex initialization accepted the new configuration without starting inference. Both cloud service health endpoints and the authenticated model catalog responded. AWS EC2 was running; S3 accepted a synthetic 34-byte write/read/delete round trip, and bucket default encryption was AES256. The active Worker artifact backend remains SQLite. Existing S3 artifact objects do not mean every new HTML/PDF is currently written there. Switching the backend requires testing supported file formats and download behavior; this review did not change storage placement.
