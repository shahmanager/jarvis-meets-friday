# Dual Agent: capability upgrade plan

13 October 2026. This is a proposed next version, not a statement that these upgrades are implemented. Preserve the cloud operator/local steward direction. The supplied repositories are optional component and benchmark references.

## Current build versus target

Current: custom TypeScript tool loop in a Cloudflare Worker/SQLite Durable Object; Chromium/Playwright and constrained Python on an AWS VM; Python laptop companion for selected text; API-based main and small models; authoritative Durable Object notes plus an optional AgentMemory BM25 index; messaging, routines, approvals and receipts. Google Cloud was an earlier proposal, not the infrastructure deployed. Gemini and Gmail APIs do not mean the executor runs on Google Cloud. Real model capability remains unmeasured.

Target: an operator that can complete substantial browser/code/document tasks and a steward that contributes private retrieval, data minimization and independent evidence checks. A second agent must measurably improve outcomes; always adding another model call can increase cost and introduce mistakes.

## Browser upgrade: an adaptive engine choice

Add Kitesurf as an optional read/render backend; retain Chromium for persistent authenticated sessions and incompatible pages. Cloudflare documents Kitesurf as stateless and currently unsuitable for persistent authenticated sessions, video/WebGL and bot-challenge TLS handshakes. Its documented CPU/memory savings are vendor measurements on particular tasks, not proof of lower model tokens or faster completion on our workload. [Kitesurf documentation](https://developers.cloudflare.com/browser-run/kitesurf/).

Use the installed Playwright dependency for a stronger action protocol: accessible page observations, semantic element references, scroll, keyboard, select, frames, tabs and explicit waits. Add approved uploads/downloads with workspace path checks, dedicated encrypted session profiles and manual login handoff. Verify each action against a fresh observation; never retry an uncertain form submission automatically. A browser extension can later offer an optional connection to the owner's actual browser, without copying their entire browser profile into the cloud.

Replace per-task exact-domain friction with an explicit owner-configured browsing policy: broad public read-only navigation; reviewed access to logged-in origins; data-release and consequential-action approval. Website content never grants permission. Public traversal must still block private networks/metadata and constrain redirects, subresources and data-bearing URLs. No browser can guarantee access to every website; authentication, site compatibility and bot challenges remain real limits.

## Workflow and hosting

For the expanded scope, evaluate LangGraph for explicit plan → retrieve → execute → verify → revise transitions, branching and interrupted approvals. It provides orchestration and persistence primitives and does not require the full LangChain package. [LangGraph overview](https://docs.langchain.com/oss/javascript/langgraph/overview).

Cloudflare Agents SDK provides the hosted agent lifecycle, SQL state, real-time connections, scheduling and recovery on Durable Objects. It is separate from a model or browser engine. Current code uses Durable Objects directly, not the SDK's Agent class. [Cloudflare Agents](https://developers.cloudflare.com/agents/).

Keep one authoritative workflow checkpoint store. A LangGraph/SDK integration must pass compatibility and restart/approval-migration checks before replacing the existing loop. If a persistent Node operator runs on the VM, Cloudflare remains the dashboard/event/approval front door and the VM must be online for that operator. If the graph runs in the Worker, verify dependency compatibility, checkpoint serialization and execution limits first. Do not silently create three competing state machines.

## Memory and private data

Use hybrid retrieval: authoritative approved facts, searchable source/episode text, semantic retrieval, and a temporal entity/relationship graph where multi-hop questions justify it. Store provenance, validity dates, disclosure scope and correction links; include the underlying evidence with retrieved claims. Keep unreleased private corpus and its graph on the laptop. The cloud receives approved results and its own non-private task memory.

Graphiti/Zep is a relevant reusable temporal-graph candidate. Its reported results concern specific evaluation tasks; they do not establish a universally best memory design. Benchmark graph versus text/semantic retrieval on our own questions, including stale and contradictory facts. [Zep paper](https://arxiv.org/abs/2501.13956).

## Optional classifier

Evaluate Laya for a small label set: browser/code/document/private-context task routing, retrieval relevance and suggested risk category. Its typed decisions are not generative planning or evidence-based verification. Report CPU/GPU latency on the actual host; repository GPU numbers are not laptop performance. Keep permissions deterministic, and evaluate confidently wrong predictions as well as low-confidence fallback. [Laya repository](https://github.com/NandhaKishorM/laya).

Do not add a mandatory local model download to the lightweight companion. A classifier is an optional measured optimization; keep the existing small-model/API route as a baseline. Source licensing, checkpoint licensing and runtime dependencies must be checked before copying or bundling components.

## ChatGPT-plan integration

OpenAI now documents Sign in with ChatGPT for eligible requests in open-source/local applications. This is a separate OAuth-based provider route; it is not an API key for the current OpenAI-compatible adapter and does not grant ChatGPT conversation access. [Official overview](https://developers.openai.com/siwc/token-sharing-open-source).

The documented self-hosted VM procedure uses a distinct stable VM host ID, local OAuth authorization and secure transfer of protected credentials, with the VM managing subsequent refresh. Shared paid/hosted applications have a different onboarding path. [Self-hosted VM guide](https://developers.openai.com/siwc/token-sharing-open-source/self-hosted-vms).

Use either a Responses streaming adapter with our existing tools, or Codex app-server for a coding harness. Codex shell/MCP tools still require workspace confinement and our approval boundary. Plan access does not supply hosted native computer-use or all API tools; the browser remains our own tool. [App-server integration](https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server), [preview limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations). Availability and model access must be verified after actual consent; do not extract unrelated Codex login credentials or silently change providers.

## Order and acceptance

1. Build a reproducible task suite and establish real model baselines. Include browser navigation/forms, code artifacts, multi-session memory and approved private retrieval. Freeze task fixtures, budgets and comparator versions.
2. Improve browser observations and action verification; add session handling and Kitesurf fallback. Measure completion, latency, tokens, failures and duplicate side effects.
3. Give the steward independent access to permitted evidence and deterministic checks. Compare cloud-only, duo without review, and duo with review. Test that privacy rules and denial remain effective.
4. Introduce the chosen orchestration runtime behind restart/approval regression checks. Add hybrid memory with retrieval ablations.
5. Add optional Laya routing only if measured total latency/cost improves without unacceptable routing errors.
6. Add explicit ChatGPT-plan sign-in and test provider/tool compatibility on an eligible account.

Success means better performance on defined tasks under comparable resources, not an unsupported claim to outperform OpenClaw or Grok generally. Jarvis/Friday describes the interaction ambition; it is not the current capability level or a benchmark.
