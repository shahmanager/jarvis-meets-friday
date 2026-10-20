# Validation evidence and limits

Validation snapshot: 14 October 2026. Evidence below reflects local test runs and owner-configured smoke tasks; it is not a production readiness or comparative quality claim.

## Real model and team smoke tests

- Jarvis and Friday each produced a downloadable artifact through their configured model APIs; artifact contents were checked.
- One real delegation cycle completed a Friday child task, returned its result to Jarvis, and produced a downloadable `team-smoke.md` containing the checked answer 391. The run included owner denial of an unavailable VM write and resume after a development-server restart; it is recovery evidence, not an uninterrupted autonomous benchmark. The tool catalog now omits disconnected capabilities.
- Temporary rate limits use persisted backoff and up to three retries. Free API routes remain subject to provider quotas; retries do not ensure completion.
- These short runs establish that the exercised API paths can work. They do not establish broad task success, evidence quality, cost, or competitor parity.

## MCP and office checks

- A live remote Streamable HTTP MCP probe discovered three tools and completed a public read. In Settings, a saved connector starts with all tools disabled; owner must explicitly grant selected capabilities and roles.
- Desktop and mobile office layouts fit the reviewed screenshots. Settings and preference flows were reviewed; no browser console errors were observed.
- Broader keyboard/focus and reduced-motion review, and all backend state transitions still need additional verification.

## Automated suites

Latest reported suite inventory: 45 TypeScript tests, 9 executor tests, and 23 Python companion tests (22 passed, one skipped on Windows). One Windows symlink case is skipped where the platform does not support the fixture. Commands are listed in [README checks](../README.md#checks).

A Windows in-process Miniflare MCP-resume test observed `ECONNRESET` after a mocked outbound HTTP 404. Recreating Miniflare with the same persistence lets the resume/reconciliation checks pass. The outbound bridge lifecycle is a suspected cause, not a confirmed diagnosis. Same-process MCP resume and production restart behavior still need independent live verification.

## Still unverified

Cloudflare production deployment, authenticated HTTPS to a running executor VM, real Telegram and Gmail setup/delivery, on-demand executor wake and idle shutdown, and end-to-end private evidence disclosure under live provider credentials remain outstanding. AWS compute was stopped at the last check. No cloud resource was started for these checks.

## Workshop UI review â€” 15 October 2026

The redesigned cutaway workshop was checked in Chrome at observed CSS widths 320, 390, approximately 768, and 1600 pixels. Temporary viewport overrides were reset. The browser used 80% zoom, so requested device sizes were adjusted and CSS viewport dimensions were checked directly. No horizontal page overflow, missing images, or console warnings/errors were observed. Compact-height phones omit the duplicate activity note; desks and Work remain available.

Desk click opens a real transcript; Escape restores focus to the initiating desk. Settings fits the phone viewport without horizontal overflow. The library hotspot opens Laptop setup; shared-table activation selects Together and focuses the composer without dispatching. Existing office API integration passed with explicit provider stubs; 31 component tests passed, including root-mission activity selection and an empty-office renderer check. No live model call, message, cloud deployment or AWS compute start was needed for this UI pass.

CSS reduced-motion rules and the existing sprite preference check were inspected. OS-level reduced-motion emulation, full assistive-technology coverage and every browser/viewport combination were not exercised. [Desktop screenshot](images/office.png), [phone screenshot](images/office-mobile.png), [design notes](OFFICE_DESIGN.md).

The [current-news incident report](INCIDENT_NEWS_STALL.md) records the failed owner run, diagnostic failures, and one successful 40.3-second public-news/reviewer retest. Read its limits before treating earlier smoke-test evidence as useful agent performance.

The [capability matrix](CAPABILITIES.md) records Google quota failures and current model selection. The capabilities regression suite verifies source/usage handling, isolated HTML preview headers and PDF downloads, valid PDF bytes, exact email attachment manifests, changed-byte rejection, receipt replay protection and quota/private-query behavior with explicit external-service stubs. Gemini tool-only replies with omitted content now have a parser regression check.

A live Gemini 3.7 Flash task created HTML and PDF deliverables in 46.9 seconds, including one 30-second provider retry delay (8,314 reported tokens). The HTML rendered in the app sandbox; the downloaded PDF parsed successfully as a one-page PDF. Both roles are configured for Gemini 3.7 Flash, but this fixture did not measure peer collaboration. Google Search still returned HTTP 429 with this key, and real Gmail delivery was not exercised. [Artifact preview](images/artifact-preview.png).

## Workflow review — 16 October 2026

Shared role instructions, on-demand application playbooks and bounded evidence packets have component checks. Autonomy integration covers both-role playbook loading and exact approval of a private delegated result's artifact metadata. Automatic-review history conversion has a component check and the team integration rejects fabricated reviewer function calls in provider requests. External-provider integration tests remain explicit stubs.

The first live supplier-selection comparison failed: solo reached its 150-second deadline amid provider backoff; Together failed HTTP 400 after producing a correct draft/review. The resulting automatic-review protocol fix does not establish a general performance improvement. See [workflow and harness direction](WORKFLOW_AND_HARNESS.md) for measured limits and the opt-in runner.

After the protocol fix, the failed Together fixture resumed from its preserved draft/review and completed with the expected supplier A ($498), runner-up B ($515), $17 saving, and C excluded for its minimum quantity. The final Gemini call took 3.426 seconds and reported 4,684 tokens; cumulative recorded tokens were 10,220 including the earlier work. This is recovery evidence, not a fresh-run latency comparison or proof that the review improved an already-correct draft.

A fresh paired diagnostic after the review fix still failed operationally: solo timed out after about 91 seconds (one attempt, no usage returned), and Together reached the 150-second deadline with backoffs (six attempts including reviewer retries, 3,668 recorded tokens). The fixture text clarified that no history lookup was necessary, so these runs are not an exact before/after comparison of prompt effects. No quality or latency advantage is established. Provider timeout/network errors now have explicit sanitized messages and a regression check instead of the generic configuration/tool failure. No further live runs were attempted in this pass.

## Cloud Codex harness - 16 October 2026

Added a separately hosted Codex app-server bridge; the native process is never started on the laptop for this integration. The real pinned CLI ran in GitHub's Linux cloud runner against a synthetic Responses SSE server. Initial cloud runs exposed a genuine protocol deadlock: native Codex waits for tool completion before publishing usage. The corrected checkpoint explicitly defers usage and later accounts cumulative deltas. The native protocol job passed on [run 38871084361](https://github.com/shahmanager/jarvis-meets-friday/actions/runs/38871084361). This is actual app-server protocol evidence, not a real model or production deployment test.

Local checks passed: TypeScript compilation, 48 TypeScript tests, four bridge tests, 24 Python companion tests (one Windows skip), both artifact-storage integration modes, team, autonomy, capability and cloud-provider integration suites. Office integration's notification pacing assertion failed once while many Miniflare suites ran concurrently and passed in isolation; no Telegram live behavior is inferred from that rerun. Provider suites use explicit stubs. Cloud provider integration checks distinct Jarvis/Friday sessions, deferred usage, exact denial, artifacts and terminal cleanup.

Production bridge hosting, live OpenRouter/OpenAI Responses model compatibility, real model latency/quality, active-session restart/resume, and competitor parity remain unverified. Interrupted sessions fail closed; request receipts replay without re-running the agent. See [deployment and limitations](CLOUD_CODEX.md).

## Cloud rehearsal - 20 October 2026

The actual Cloudflare office was deployed and configured with Gemini secrets. Authenticated live model execution produced `cloud-demo.html`; the real download and sandboxed preview returned HTTP 200. The Gemini 3.7 run created the artifact but timed out on final composition; resuming with Gemini 3.1 Flash-Lite completed, with the last call taking 1,663 ms. This is one recovery smoke run, not a latency benchmark. A separate delegated Friday quote check returned the correct totals (4,100 vs 4,200, minimum-quantity discount ineligible); The delegated parent completed but initially returned only a review acknowledgement; the handoff guidance was corrected to require a complete standalone answer and a fresh live review check was queued. A real PDF artifact downloaded with HTTP 200 and parsed as one page. Free model quota/backoff occurred.

Component checks: 52 TypeScript tests, nine executor tests, 24 Python companion tests (one Windows skip), both storage integration modes, team, office, autonomy, capabilities and cloud-harness integration passed. The autonomy suite includes uncertain executor outcomes and refusal to restart a terminal task through the mirror. These suites use synthetic external services. Mercury/DeepSeek live probes returned HTTP 402, so neither was performance-validated. Voice was removed/deferred at the owner's request. AWS authorization is paused, and no live cloud executor/browser, Gmail/Telegram delivery or second-device rehearsal is claimed. See [demo gates](DEMO_RUNBOOK.md).

The local development server was stopped, and the independent Cloudflare office still returned HTTP 200. AWS login was cancelled at the owner’s request; the cloud browser executor remains a pending gate.

The fresh post-fix Together run completed with one automatic Friday review and a standalone final answer containing both correct totals, discount ineligibility and recommendation A (three lead checkpoints, 7,785 reported task tokens). This supplied-evidence fixture is a smoke test, not a general reasoning benchmark. A CI notification-spacing failure exposed pacing from reservation time rather than delivery completion; the fix reserves during delivery and sets the next send interval after completion, with a delayed-first-send regression fixture.


## 20 October 2026: live output fixes

Original office/2D sprites retained. Chrome verified an actual cloud PDF in inline and full-size native viewers, Markdown download links, keyboard panel resize (760 to 800 pixels), and original figures. A read-only development proxy used actual cloud task records, not model stubs. New Markdown rendering uses text/DOM nodes; untrusted HTML stays text.

The dedicated existing AWS executor was temporarily started and updated. Authenticated Docker Python returned its real runtime version. An outbound authenticated HTTPS tunnel connects the Worker; no EC2 ingress was opened. Its existing two-hour boot timer is still a runtime cap, not on-demand wake or idle shutdown.

Real failures were preserved: Gemini provider failures produced no deliverables; Mercury produced real browser screenshots but rejected image input, then a subsequent run exhausted its bounded rehearsal budget without final reports. The adapter now consults model image capabilities; text-only models get text observations and artifact references. The active lead/reviewer now use DeepSeek V3.2. Paid OpenRouter key validation and both Mercury/DeepSeek inference probes succeeded. Search uses OpenRouter Parallel Turbo; Gemini search quota was unavailable.

Navigation now returns page text and visible controls. Browser guidance names the single-page constraint, and non-navigation URL arguments are rejected rather than ignored. Friday can read public sources and run sandbox Python under existing policy. Private disclosure and outgoing send approval remain. Exhausted retries report a stopped task. A fresh DeepSeek research/browser/code/delegation run is recorded separately; previous failures do not establish task success or competitor parity.


Follow-up root cause: public `web_read` returned raw HTML alongside cleaned text, then the shared tool runner truncated JSON at 18,000 characters. Large observations could become invalid JSON with useful text beyond the cut. Friday's live trace repeatedly received such broken observations. The web adapter now discards raw HTML and bounds cleaned page text; the shared serializer always emits a valid bounded JSON observation or an explicit excerpt/truncation envelope. Unit and autonomy regressions cover escaping and a large scripted HTML page with a small verifiable fact. Earlier long runs using broken observations are not meaningful model-quality comparisons.


Live rollout confirmation: `/api/health` now reports `observationFormat: bounded-json-v2`; a fresh cloud task returns valid parsed web observations without raw HTML. A further real-source failure exposed gzip bytes decoded as UTF-8 by the executor. Public reads now decode gzip/deflate/Brotli with separate 700 KB wire and expanded-body bounds; a runnable compression/overflow/corruption regression covers this path. DNS pinning and public-only policy are unchanged.

The first bounded-JSON cloud run completed real parallel reads, Parallel Turbo search, browser inspection and screenshot, but was cancelled after Friday kept corroborating an already supported Node release and delegated another confirmation. No final deliverables were claimed. Both role prompts now explicitly stop at acceptance checks and discourage redundant corroboration/redelegation. This is guidance, not a fixed execution sequence or a task-success guarantee.

Result-first follow-up: the work drawer now defaults to Result with delivered files (including related teammate files) and the final answer; browser, sources, transcript and token diagnostics are under Activity. HTML opens as soon as created, unchanged file previews survive task polling, and late/terminal browser responses cannot display stale live images. Role instructions explicitly require actual artifact receipts for requested files. No further live model task tests were run after the owner asked to stop. Note: the attempted system-prompt rollout check was invalid because the transcript API intentionally omits system messages; its false result is not evidence of a stale deployment.

Draft visibility root cause: the lead model produced its draft, but the runner exposed only the eventual post-review answer. Drafts are now persisted separately and labelled while review is pending; completed answers supersede them. The existing stub-backed team regression checks pending draft visibility and final replacement. Hover transcript bubbles are removed; desk labels open Result. These are software checks with synthetic providers, not new OpenRouter tasks.

Chrome verified the deployed Result tab against an existing real cloud HTML artifact: the file opens inline with download/full-size controls and no execution log above it. Full-size preview opens its modal. No new inference was requested. Another UI defect was found: each poll replaced every mission button, detaching click targets; unchanged mission lists now retain their DOM nodes, covered by a runnable renderer regression.

Late 20 October trip failure: recorded main-call usage plus successful search totalled 10,629 tokens. The second search failed exactly at its 60-second deadline before artifact creation. Search response-body reads were outside the adapter catch; a body timeout bypassed revisable tool-error handling and became a generic task failure. Both search adapters now convert interrupted bodies to safe HttpError results, with a stream-error unit regression and stub-backed search-failure-to-HTML recovery scenario. OpenRouter search requests concise notes rather than another full report; loop observations retain at most 3,000 answer characters while full research remains stored. These changes do not establish live itinerary quality. No new paid task was started. Hover cards now expose owner brief, current work and role-specific output/update.

Final owner direction: keep the current custom harness; Codex is an optional bridge, not the active DeepSeek/OpenRouter loop. The failed trip recorded 3,014 initial-call tokens + 2,998 successful-search tokens + 4,617 follow-up tokens = 10,629. These totals include replayed input; the timed-out search has no complete usage receipt. Legacy generic failure text now identifies the last observed tool. Hover cards can load already-stored research notes on focus/hover, cached per research revision and labelled unreviewed, without inference. Renderer regressions cover role ownership, caching and failure presentation. No performance percentage or live itinerary success is claimed.
