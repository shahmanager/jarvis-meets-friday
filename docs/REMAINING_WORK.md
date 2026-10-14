# Remaining work and handoff

This is an architecture handoff, not a fixed delivery contract. Reorder it to match the owner's priorities and evidence. It records the current gaps visible in the repository as of 14 October 2026; credentials, external accounts, and live deployment state can change independently.

## Close the live deployment loop

The app can run locally under Wrangler with stubbed providers. Production Cloudflare deployment and real model inference have not been demonstrated. The Linux Docker executor passed an earlier AWS verification, but the AWS VM was stopped at the last known check. Start or choose a host only when the owner is ready to incur the relevant cost, configure authenticated HTTPS from Worker to supervisor, and rerun the executor verification from that host. Confirm public browsing through the authenticated proxy, redirects/subresources, metadata rejection, workspace persistence, cancellation, and restart recovery. Do not infer live readiness from local tests.

Then run one owner-supervised end-to-end task through Jarvis: submit, retrieve public evidence, create an artifact, approve one consequential action, recover after a restart, and reconcile cancellation/uncertain outcomes. Run a separate Friday task that requests selected local evidence and verify that only the reviewed excerpt reaches its configured provider. Repeat with owner denial, revoked device, and unavailable companion. Record real provider/model IDs, task fixture, costs, latency, approvals, and failures without placing credentials or private content in the report.

## Fix and verify Telegram pairing

Settings pairing stores a bot token and generated webhook secret, gets the bot's updates to identify the owner, then registers the webhook. Telegram's [Bot API](https://core.telegram.org/bots/api) does not permit `getUpdates` while a webhook is set. The pair endpoint currently permits an existing webhook when its URL already matches this app, but verification still calls `getUpdates`; reconnecting or recovering a partially completed pairing can therefore fail. Make the sequence explicit and idempotent: remove or reject an existing matching webhook before polling, consume only the pairing update, persist the owner, and set the signed webhook once. Do not remove another application's webhook. Test first setup, same-app retry, foreign webhook refusal, duplicate updates, bot replacement, and failure between each step against a Telegram test bot.

Also verify notification delivery through the currently selected bot after pairing, token rotation, and Worker restart. The integration tests use provider stubs; they do not prove Telegram's real update offsets, webhook state, HTTPS reachability, or delivery receipts. Check that pairing and webhook failures remain visible in Settings instead of leaving a partial connection that looks ready.

## Fix and verify Gmail connection setup

The Settings page displays a callback URL from the browser's current origin. OAuth authorization uses `APP_URL` when configured, otherwise the app origin saved with the client credentials. Those values must match the Google OAuth client's registered redirect URI exactly. Make the effective URI a single surfaced value and test production behind any proxy/custom domain; a hostname mismatch breaks consent or the callback.

OAuth state is removed before the authorization-code exchange completes. If the exchange or profile lookup fails temporarily, the same callback cannot be retried and the user must start consent again. Decide whether to retain a short-lived in-progress state and consume it only after successful exchange while preventing replay. Verify reconnect, token refresh/expiry, disconnect/revoke, read, send approval, thread reply snapshot, and ambiguous delivery using an owner-controlled Google test account. Current tests stub OAuth and Gmail APIs and do not establish live consent, account policy, or mail delivery.

## Make operating policy and status legible

The current role names can sound more capable than the implementation. Keep product copy clear that Jarvis and Friday are two model/API roles coordinated by one Durable Object, and that Friday's local file access is a separate Python companion with exact user review. There is no on-device model, graph memory, MCP support, or concurrent tool batching. Add a visible status for provider reachability, companion last-seen/device revocation, executor availability, memory backend, and Telegram/Gmail connection state. Distinguish configured from tested and live.

The task caps default to null and are enforced between calls; document this in Settings and add usage visibility before inviting broader use. Consider safe owner-selected defaults, but do not add a hidden cap that changes task semantics. Keep public website browsing policy (`*`) paired with the executor's DNS-pinned public IPv4 and private/metadata protections.

## Finish the office-world interaction

Keep the existing two-room office frame, desks, and sprites as the page's visual anchor, then make it feel like a full-screen pixel/cartoon/LEGO-like workplace rather than a dashboard surrounded by empty browser chrome. Render task composer and Settings as room-aware overlays/dialogs that close back to the same world state. Clicking a character opens that agent's work; hover can preview the real recent transcript, status, and timestamp. Every hover action needs an equivalent keyboard-focus/click path, accessible name, and touch target; on mobile, use agent cards or a room switcher so no control requires hover. Support reduced-motion and clear queued/running/approval/local-wait/completed/failed/offline states.

All visual changes must reflect persisted backend status and messages. Do not create fabricated transcripts or progress animations that imply work happened. Mark stale status when the Worker/device/executor has not reported recently. Verify focus order, Escape/close behavior, small viewport layouts, reduced motion, and all state transitions with real integration-backed task records before calling the room complete. The current frame and task assignment already exist; this is refinement and completion, not a new backend claim.

## Add MCP connectors with separate trust boundaries

MCP is not implemented. If connectors are prioritized, use [Streamable HTTP](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports) for remote services and stdio subprocesses owned by a trusted bridge for local services. Implement initialization/capability negotiation, paginated tools/resources listing, lazy schema loading after a role/task selects a server, session expiry/reinitialization, clean disconnect/revocation, and output/time limits. Validate HTTP origins and authenticate remote sessions. Store OAuth secrets/refresh tokens encrypted; grant separate connector scopes per role and task.

Run local stdio servers only through the laptop companion and cloud stdio servers only through an allowlisted executor-VM bridge outside task containers. Owner selects executable/server and reviews requested scopes; model instructions cannot choose arbitrary commands. Require a preview and exact approval for consequential tool calls. Treat resource text, tool schemas, annotations, and provider output as untrusted; deterministic policy checks every call. Test malicious schemas/prompts, expired/revoked grants, cross-role access, origin abuse, pagination boundaries, oversized outputs, and server restarts before enabling a connector.

## Separate cloud uploads from private local retrieval

Make the data path obvious in the UI. If dashboard file upload is added, transfer to the cloud Worker is a disclosure at upload time and needs its own retention and delete behavior; it is not private retrieval. Private retrieval should use a local picker in the companion and keep sources and index on device. Begin with bounded PDF, DOCX, and text parsing; isolate parsers, cap files/pages/chunks, defend against archive bombs and malformed input, and make OCR a separately enabled step. Keep provenance for each chunk: source ID/hash, filename/path, page/paragraph, modification and ingest times, parser/OCR version, and content hash.

For the future Jarvis/Friday workflow: Jarvis sends a specific question, purpose, and requested scope; Friday returns available capabilities and candidate source metadata; the owner grants/narrows/denies an expiring task scope; local deterministic checks verify scope and source version; Friday may run optional redaction/extraction; only the approved subset and provenance is staged to the Worker; Jarvis answers with source references; Friday checks claims; the system stores only the permitted episode. Denial must not fall back to cloud upload. Staged evidence needs short TTL, explicit deletion on expiry/revoke, cleanup retries, and audit records. Tests must prove removed/changed sources and revoked grants cannot leak through stale chunks or caches.

## Build an evidence-based Friday direction

Start with the current privacy boundary and test suite before adding a new retrieval stack. For local-first document retrieval, define supported file types, size limits, OCR policy, chunk/source identity, version and timestamp provenance, deletion behavior, and what can be disclosed. Parse/index on device. Keep source files and any graph local; disclose only specific snippets or aggregates after approval. Returned evidence should identify the source and extraction time so Jarvis can cite it and Friday can challenge unsupported claims.

Design grant negotiation as an explicit protocol: Jarvis asks a question with purpose and requested scope; Friday explains which local sources it needs; the owner approves, narrows, expires, or denies; Friday returns only the allowed evidence and records the decision. Grants should be least-privilege, task-bound, and revocable. Tests should assert that denial, stale grants, changed files, or a missing companion never fall back to uploading the corpus.

Only after representative retrieval questions exist, compare basic lexical search with hybrid/vector/graph methods. A knowledge graph is optional, useful only if multi-hop and temporal questions justify its privacy, indexing, correction, and maintenance cost. Measure evidence recall, citation support, stale/conflicting facts, leakage, latency, and resource use on-device.

## Scale the task loop only from measured need

The current alarm loop handles one inference or tool call at a time. If traces show serial read operations dominate latency, consider a bounded DAG for independent read-only work. Keep writes, sends, browser actions with side effects, and approvals ordered. Include per-task concurrency and timeout bounds, deterministic result ordering, idempotent retries, cancellation, and restart tests before enabling it.

Track total model/tool token usage and cost by task. Consider caching only for stable, non-sensitive reads with documented freshness and invalidation. Evaluate small-model routing for narrow extraction or review tasks against the same fixtures and budgets. Compare Jarvis alone, Jarvis plus Friday evidence, and review-enabled Together runs. Report the tradeoff and error rate; do not claim general assistant parity without broad, reproducible evaluation.

Avoid re-sending full conversation and full corpus on every model call. Keep stable prompt prefixes reusable, batch related retrieval questions within a fixed bound, retrieve a small top-k evidence set with provenance, and summarize older context with source IDs. Cache only with explicit privacy scope, source/version hashes, expiry, revocation invalidation, and an owner-visible off switch. Measure token savings and whether reuse causes stale or cross-grant results. Keep any small-model redaction or routing advisory; deterministic code enforces grants and approval.

## Suggested order

Additional production gaps: an on-demand executor wake path, queue admission and genuine idle shutdown are not implemented. The existing AWS timer stops the VM after a fixed two hours from boot; it is not an idle detector. A future wake controller should deduplicate starts, expose a booting state, require a healthy authenticated executor before dispatch, and stop only after no active leases or queued work remain. Persist artifacts before stopping. Test overlapping requests and cancellation during boot. Retained EBS, stored objects/logs and allocated public addresses can still cost money while compute is stopped.

Add backup/restore and schema-upgrade checks for durable task state and the future local vault; define deletion/export and recoverable device re-pairing. Longer-term desktop control, voice, email attachments/monitoring, richer browser handling and connector breadth remain outside the current tested baseline. Choose these from real tasks rather than promising arbitrary laptop capability. No existing tests establish task quality with real models or competitor parity.

1. Resolve Telegram pairing and Gmail callback/configuration edge cases; add regression tests.
2. Make the chosen production endpoint available and finish one supervised cloud-to-executor-to-provider task, then test local disclosure and denial.
3. Add live connection/availability indicators and clarify current role boundaries in UI/help.
4. Complete office-world overlay, transcript, mobile, keyboard, and real-state behavior.
5. Establish evaluation fixtures and baseline quality, privacy, latency, token, cost, and recovery measures.
6. Prototype scoped Friday evidence grants and local document provenance against those fixtures.
7. Prioritize MCP connectors only with concrete user workflows; add transports and per-role grants behind the same deterministic approval boundary.
8. Add DAG execution, caching, local graph retrieval, or additional model routing only when measured results justify them.

The order is a useful starting point, not a commitment. External credentials, provider policies, deployment choices, and local hardware constraints need confirmation at implementation time.
