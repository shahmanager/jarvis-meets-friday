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
