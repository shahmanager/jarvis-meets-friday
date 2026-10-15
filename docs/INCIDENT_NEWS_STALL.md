# Incident: current-news task stalled on approvals

15 October 2026. The owner's request was a one-off market/geopolitical update. The failed run took 31m46s, ten model calls and 26,727 reported tokens. Three ten-minute approval expirations account for approximately thirty minutes. The rest included model latency, unnecessary tool calls and scheduling overhead. No news retrieval succeeded in that original run.

## Confirmed causes

- The local Worker emulator had no `EXECUTOR_URL`. Wildcard public browsing was correctly hidden, but there was no executor-independent news path. The agent then chose inappropriate substitutes.
- `memory_search` returned full stored memories and always marked a task private, even with zero results. This created false privacy approval waits; nonempty recall also unnecessarily brought old personal/task data into a public-news task.
- The system prompt encouraged recall, delegation and artifacts too broadly. It did not clearly distinguish current news from stored context or one-off work from scheduling.
- Automatic review followed an inability/denial response and incurred another disclosure approval wait. Review was not useful collaboration in that run.
- A bad artifact filename raised a fatal task error instead of a tool result the model could correct.
- The free router is not a fixed strong model. New logs show the successful retest's main turns used different upstream model IDs, including the same 2.6B model configured for Friday. Stronger-main/smaller-reviewer separation was not guaranteed.

## Changes

Memory search now returns only opaque IDs and kinds, without titles/content or automatic privacy taint. `memory_read` remains the explicit content boundary and marks the task private. Core context and actual private retrieval remain protected; private tasks are not silently declassified. Regression checks cover empty recall, opaque matching results, and public delegation without a false approval.

Invalid artifact arguments now return a correctable tool error. A declined/expired action suppresses the subsequent forced automatic review; it does not authorize any new action. Prompt guidance prioritizes current sources, discourages unnecessary recall/delegation, and forbids using scheduling as a workaround for a one-off request. Prompt guidance is not a reliability guarantee.

`news_headlines` retrieves bounded BBC business/world RSS headlines and publisher summaries from fixed endpoints. Both roles can use it without a browser VM or extra API key. It sends no private query, respects task domain restrictions, rejects feed declarations, avoids following redirects, includes publication timestamps and source links, and reports source failures. Parallel fetches cover the two topics. This is a limited news feed, not full-web research, article verification, or live market quotes. Unsupported Workers `redirect: error` was found in an initial retest and replaced with manual redirect rejection.

Returned news evidence is bounded for model/peer-review context rather than copying a large feed. Model-result events now record upstream model ID when reported, response duration and reported tokens; missing IDs fall back to the requested model. No keys or prompts are logged by these events.

## Evidence and limits

A new task using the same owner prompt completed with public headlines and a Friday review in 40.3 seconds, three parent calls plus one review, 16,953 reported total tokens, no approval wait, and no executor. This was before the final tighter feed-evidence bound; reduced token cost after that bound has not been measured. Two earlier diagnostic retests exposed feed incompatibility and unnecessary private recall; one was cancelled instead of approving disclosure. These failures are part of the evidence, not successful runs.

The local coordinator was Wrangler/Miniflare on the laptop; inference was OpenRouter-hosted. AWS does not host these models. No executor start-on-trigger controller exists. AWS compute was last verified stopped; the 15 October EC2 check failed because CLI credentials expired, so current account state was not independently confirmed. No AWS start/provision call was made for this incident.

Tests: component suite, base integrations, teamwork and autonomy regressions. The news endpoints returned live feeds during diagnosis. No claim of broad agent quality, commercial parity or stable latency follows from this one successful retest. A stable evaluated main model, bounded selective collaboration, better search/market-data adapters and repeated task evaluations remain necessary. See [agent design review](AGENT_DESIGN_REVIEW.md).
