# Agent design review and next engineering work

Review date: 15 October 2026. This is a source-grounded handoff, not an implemented redesign of the backend. Read alongside [current architecture](architecture.md), [validation evidence](VALIDATION.md), and [remaining work](REMAINING_WORK.md).

## Verdict

The current design is a reasonable small prototype: one durable coordinator, two model roles, an isolated execution service, and a local evidence boundary. Autonomous planning exists: models choose tools and may delegate, work independently, wait, and review. A second model is not inherently more capable or cheaper. The product has not demonstrated Grok Bot, Muse, or Codex performance. Deployment, browser reliability, task quality, long-running recovery and evaluation matter more than adding a named framework.

Today both reasoning roles run through configured online APIs from the Worker. The laptop runs deterministic retrieval and owner approval, not Friday's model. The repo does not provide each role an independent VM or a general laptop-control agent. Keeping one authority for state and permission is useful; do not split it into microservices just to make the characters look independent.

## What happens today

1. The owner assigns Jarvis, Friday, or Together. Together starts Jarvis and optionally requests Friday's review, depending on Settings. It does not force every task to use both models.
2. Jarvis can call `delegate_task` with a focused prompt and selected context. Friday gets a child task and separately configured model. Friday can delegate back, within the depth guard. Private context requires disclosure approval; delegation is not permission expansion.
3. The parent can do independent work, request `teammate_result`, or persist `wait_for_teammate`. Completion wakes the waiting task. The root family shares configured step/token limits and cancellation.
4. The scheduler permits two active turns. Selected independent reads run in bounded batches. This is not arbitrary concurrent browser control: the small executor currently supports one browser workspace at a time, and side-effecting actions are serialized.
5. `peer_review` gives another model's opinion on selected draft/evidence. It is not an independent factual proof or an automatic permission to act. Avoid review on every trivial task.
6. Durable records preserve conversations, calls, approvals and results. Active context prunes complete older tool groups; `context_note` and `task_history` retain/recover useful working evidence. Character motion reflects task state; it is not evidence of model thinking.

## Local files and current disclosure

The owner pairs the native Python companion, selects a folder, and keeps it running. No VM, Docker or hypervisor is created on the laptop. The companion builds a bounded SQLite FTS index over supported text/DOCX/PDF files; PDF support needs optional `pypdf`. It records hashes and source locations, and revalidates source versions. No OCR or knowledge graph is present.

A model can request `local_request(search|read|aggregate, purpose, ...)`. Both roles can use that boundary; Friday is not currently a compulsory privacy gateway. The companion prepares bounded excerpts, masks some obvious credential/email patterns, shows the proposed release, and asks the owner. Approval sends that excerpt and provenance to the Worker and the pinned provider/model. An online SLM is a third-party recipient even if called from the laptop. Regex masking is assistance, not a privacy guarantee.

An optional in-memory grant lasts ten minutes, bound to the same task, recipient role/provider/model, selected root and source hashes. It permits bounded prepared excerpts without repeated clicks after an initial explicit release. Changes, expiry or revocation invalidate it. Source documents/index stay local; **released excerpts and transcripts are cloud data** and currently need a stronger retention/deletion design. Revocation stops future access; it cannot unsend provider inputs.

There is no general private document upload in the web dashboard. A future browser upload would disclose bytes to the cloud immediately. Do not market it as a local-vault path. Prefer opening the companion's local picker for private materials.

## What “data negotiation” should become

Current behavior is a scoped request and owner-controlled release, not an autonomous negotiation protocol. Add a small evidence exchange to existing task records, not another agent framework:

| Exchange | Agent chooses | Deterministic boundary |
| --- | --- | --- |
| Request | Question, purpose, required evidence, preferred form | Task ID, recipient, size/scope limits; no authority from document text |
| Local offer | Aggregate, redacted excerpt, narrower scope, or unavailable | Offer stays local until allowed; filenames/metadata may also be sensitive |
| Counteroffer | Ask for less data or explain why more is necessary | No repeated denied request with cosmetic wording; grant is not broadened |
| Grant or denial | Owner decides; SLM can recommend | Exact task, source/version, fields, recipient, operation, expiry and byte limit |
| Release receipt | Evidence IDs and uncertainty | Validate grant before sending; bind hashes, source anchors, redactions and recipient |
| Verify | Friday challenges claims; Jarvis revises or reports missing evidence | Released evidence only; no hidden whole-corpus access or fabricated citations |

Example: Jarvis asks for evidence supporting a college report's dates. Local Friday offers three date/source pairs instead of an entire private folder. Jarvis may ask for one supporting paragraph. The owner can narrow or deny it. On a source change, require a new release decision. If the laptop sleeps, public work continues and the evidence-dependent portion waits visibly.

The SLM proposes extraction and counteroffers; deterministic local policy enforces disclosure. To keep raw data private from every cloud provider, extraction over raw text must stay deterministic or use on-device inference. Sending the whole document to an online SLM first defeats that goal.

## Capability comparison: surfaces, not performance

Official references checked 15 October 2026: [Grok Bot computer and apps](https://docs.x.ai/grok-bot/computer-and-apps), [Grok Bot design](https://x.ai/news/designing-grok-bot), [Meta Muse introduction](https://about.fb.com/news/2026/09/introducing-muse-personal-ai-agent/), [Codex cloud environments](https://developers.openai.com/codex/cloud/environments), and [Codex source](https://github.com/openai/codex). Vendor descriptions establish advertised surfaces, not success rates. Muse here means Meta Muse.

| Surface | This project now | Material gap and next proof |
| --- | --- | --- |
| Computer/browser work | Chromium navigate/read/screenshot/click/fill plus Python and scoped workspace files on a separate Linux executor | Executor stopped; no general desktop, drag/upload/download workflow, resilient visual grounding, or broad authenticated-site evaluation. Grok/Muse describe dedicated computers. |
| Coding work | Python and workspace tools; text artifacts | No mature edit/search/shell/test/Git workflow comparable to Codex; no coding benchmark. |
| Persistence | Durable tasks, alarms, memory, routines, provider backoff | Production wake/idle leases, backups, migration tests, deletion/retention and long-duration recovery still needed. |
| Teamwork | Role-based delegation, waiting/results, optional review; two turns and bounded read batches | No measured benefit, general DAG, independent browser sessions or resource-level write leases. |
| Private evidence | Local index, provenance, reviewed releases, short scoped grants | No complete request/offer/counteroffer protocol, claim-level verification, local inference or retroactive deletion guarantee. |
| Integrations | Remote MCP tools; Gmail and Telegram implementation | Live owner-account messaging remains unverified. No MCP OAuth, stdio bridge, resources or attachments. |
| General capability | Depends on provider/model, connected tools and approval policy | A free router and 2.6B SLM are a development baseline; tool presence does not imply commercial-agent reliability. |

No website automation can promise every website/action: login, account policy, CAPTCHA, browser restrictions and unsupported controls still constrain it. Show blocked states instead of inventing success.

## Priorities for the next contributor

**First: make one complete production path reliable.** Connect the existing coordinator to an authenticated executor, keep AWS stopped until an owner-supervised run, then add explicit start/health/lease/idle shutdown if that is the selected host. Never mistake a fixed boot timer for idle shutdown. Prove restart, cancellation and uncertain side-effect reconciliation before broadening tools. Preserve the single durable state owner.

**Second: improve browser and coding tools against actual tasks.** Give browser calls bounded accessibility/DOM observations and stable target IDs, with screenshot fallback for inaccessible controls, per-session write serialization, explicit upload/download and login handoff. Add narrowly scoped shell/edit/search/test capabilities only in the sandbox, with workspace snapshots and output bounds. Prefer installed/runtime primitives over another wrapper. Record evidence of action outcomes, not just HTTP success.

**Third: complete evidence negotiation.** Implement the exchange above over the current companion channel. Add source-backed claim checking and expiry/revocation/retention tests. Scope each outgoing recipient independently; a Friday grant must not automatically authorize Jarvis, Telegram, email, MCP or an artifact download.

**Fourth: make collaboration earn its cost.** Start with a focused task brief and compact result: conclusion, evidence IDs, unresolved questions, artifacts. Delegate only useful independent work. Review when consequence or evidence uncertainty warrants it. Route easy extraction/classification to the SLM only when fixtures show reliable outputs; escalate tool/schema failures or ambiguous reasoning to the stronger model. Keep model routing separate from authorization. Do not copy full transcripts between roles.

**Fifth: evaluate, then expand orchestration.** Use synthetic public fixtures and explicitly approved private fixtures. Measure success, citation correctness, disclosure bytes/recipients, approval compliance, latency, reported tokens, recovery and duplicate effects. Compare Jarvis alone, Jarvis+retrieval, and Jarvis+Friday review with fixed model IDs and repeated runs; free router results vary by upstream. The existing arithmetic team smoke consumed 17,294 reported parent tokens across seven parent calls, plus child work. It proves a working path, not efficiency. Cheap tasks should not routinely pay that coordination cost.

Keep the current native TypeScript/Durable Object harness while these boundaries are small enough to maintain. Revisit Cloudflare Agents or a portable open-source harness when a concrete feature removes more code than its migration adds. Avoid adding LangGraph merely to claim agent maturity. Knowledge graph retrieval is optional: introduce it only when multi-hop/time-based fixtures beat FTS/hybrid retrieval enough to justify the extra state and privacy surface.

## Handoff checks

For each increment, leave one regression check that fails on the relevant boundary: denied/expired grants, changed source, wrong recipient, laptop disconnect, concurrent browser mutations, cancellation, interrupted side effect, duplicate delivery, or context recovery. Run existing suites for affected paths. Publish measured evidence and known limits; do not replace this contextual plan with a rigid contract or declare parity from a feature list.
