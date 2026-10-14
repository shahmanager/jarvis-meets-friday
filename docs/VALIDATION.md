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

Latest reported suite inventory: 29 TypeScript tests, 9 executor tests, and 23 Python companion tests (22 passed, one skipped on Windows). One Windows symlink case is skipped where the platform does not support the fixture. Commands are listed in [README checks](../README.md#checks).

A Windows in-process Miniflare MCP-resume test observed `ECONNRESET` after a mocked outbound HTTP 404. Recreating Miniflare with the same persistence lets the resume/reconciliation checks pass. The outbound bridge lifecycle is a suspected cause, not a confirmed diagnosis. Same-process MCP resume and production restart behavior still need independent live verification.

## Still unverified

Cloudflare production deployment, authenticated HTTPS to a running executor VM, real Telegram and Gmail setup/delivery, on-demand executor wake and idle shutdown, and end-to-end private evidence disclosure under live provider credentials remain outstanding. AWS compute was stopped at the last check. No cloud resource was started for these checks.
