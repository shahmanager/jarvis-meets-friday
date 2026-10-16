# Remaining work and handoff

Start with [current workflow and harness direction](WORKFLOW_AND_HARNESS.md) and the [agent design review and prioritized handoff](AGENT_DESIGN_REVIEW.md). This roadmap is contextual, not a fixed contract. It describes gaps as of 14 October 2026. Credentials, external accounts, and deployment state can change independently.

## Cloud Codex activation

Native cloud Codex bridge is implemented; deploy it on an intentionally selected cloud host, configure its separate Responses model key and authenticated HTTPS origin, then run a real public artifact task before switching roles. No laptop Codex is needed. Test cancellation, denial, private recipient binding and measured usage. Active process restart currently fails closed rather than transparently resuming; implement explicit native-thread resume only with reconciliation tests. See [setup and limits](CLOUD_CODEX.md). Competitor public-client research is recorded in [REA findings](REA_PRODUCT_RESEARCH.md); sampled bundles do not reveal backend architecture.

## Finish production deployment and supervised runs

One real artifact smoke run succeeded through each configured model role, and one delegated child task returned its result for a verified combined team artifact. That run included owner denial of an unavailable VM write and recovery after a development restart; it is not an uninterrupted autonomous benchmark. Cloudflare production deployment, live provider integration breadth, and a current Worker-to-executor path remain unverified. AWS executor VM was stopped at last check. Choose a host only when ready to incur cost; configure authenticated HTTPS from Worker to executor and verify proxy DNS pinning/public-only policy, redirects/subresources, metadata rejection, workspace persistence, cancellation, restart recovery, and artifacts from that host.

Then run an owner-supervised task through Jarvis: public retrieval, artifact creation, one approved consequential action, restart recovery, cancellation, and uncertain-outcome reconciliation. Run a separate Friday task against selected local evidence; verify only reviewed excerpts reach the configured provider. Record provider/model IDs, quality, latency, token/cost, privacy, approvals, and failures without secrets or private content. Existing component checks and stubbed integration tests do not establish live task quality or deployment readiness.

## Verify external integrations with owner accounts

Telegram pairing retry/ready-state recovery and Gmail canonical callback/profile-retry paths now have regression coverage with provider stubs. Test them with dedicated owner-controlled Telegram and Google accounts: bot pairing, same-app retry, foreign webhook refusal, webhook reachability, delivery, reconnect, OAuth consent/redirect, token refresh, Gmail read/send/reply, and ambiguous delivery. Stubs do not prove real provider behavior, account policy, HTTPS reachability, or message delivery.

## Complete bounded capability surfaces

Remote MCP tool connections exist for Streamable HTTP with bearer auth, per-role/tool grants, manually attested read-only exceptions, and uncertain-side-effect reconciliation. Current limits: no MCP OAuth, resources, prompts, subscriptions, local stdio, or executor stdio; stored schemas are loaded as a catalog at connection time. Add only capabilities backed by concrete workflows. Preserve independent deterministic grants; never trust remote descriptions or annotations as authorization.

The office world, in-world task/work overlays, accessible controls, mobile layout, Settings, task context stats, and state-driven `waiting_peer` status are implemented. Desktop/mobile screenshot checks fit; Settings/preferences were reviewed without browser console errors. Continue keyboard/focus, reduced-motion, and backend-state transition checks. Keep visual activity tied to actual state; do not imply unobserved work.

The companion has a local private FTS index for supported documents with provenance and reviewed excerpt release. Improve parsers/OCR only when file-type demand justifies extra dependencies and parser risk. A private upload path must use a local picker; dashboard upload is cloud disclosure at transfer time. Optional local disclosure grants are implemented: one task and recipient, selected root and source hashes, ten-minute expiry, bounded excerpts, and revocation on source/recipient changes. Cloud staging of owner-approved chunks and source-backed multi-document corrections remain design work. A knowledge graph stays optional: require multi-hop/temporal retrieval evidence before accepting its privacy and maintenance cost.

## Measure before expanding the harness

Build versioned evaluation fixtures for task success, citation/evidence correctness, privacy leakage, approval compliance, latency, tokens/cost, restart recovery, cancellation, and duplicate side effects. Compare Jarvis alone, Friday evidence, and Together review; report limits and failures. Do not claim competitor parity from feature lists.

The Worker now allows two active task turns, bounded independent read batches (default 3; Settings range 1–8), context compaction (default 60,000 characters; range 20,000–180,000), delegated teammate waiting/results, family-shared configured budgets, and cancellation propagation. Sandbox autonomy remains opt-in and excludes private-context tasks. Collect traces before considering larger DAG scheduling, prompt/result caching, or additional model routing. Keep task/token caps null by default unless owner configures them.

## Operational gaps

On-demand executor wake, genuine idle shutdown, backup/restore, schema-upgrade coverage, export/deletion policy, and recoverable device re-pairing remain. Existing AWS timer is fixed from boot, not idle-aware; stopped compute can still leave storage, logs, and addresses that cost money. Any wake controller should deduplicate starts, expose booting/health, respect task leases, and handle cancellation during boot.

Email artifact attachments, isolated HTML preview, text PDFs and Google grounding adapters now exist; see [capability limits and verification gates](CAPABILITIES.md). No on-device reasoning model, local graph index, broad voice/desktop control, inbox monitoring, or general connector ecosystem is implemented. Pick these from actual user tasks and evaluation results.
