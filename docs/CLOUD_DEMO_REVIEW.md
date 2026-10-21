# Cloud demo review — 21 October 2026

## What makes this a cloud-computing project

Cloudflare Workers serves the authenticated office/API without a web VM. A SQLite-backed Durable Object serializes and persists tasks, checkpoints, permissions, artifacts and delivery records. AWS EC2 hosts native Codex and a Docker execution supervisor. Chromium and Python run with resource limits and network restrictions. S3 supports private deployment bundles and an optional artifact path; current report artifacts use SQLite. EBS persists host volumes. SSM manages the host; outbound Cloudflare tunnels avoid inbound SSH exposure. These are implemented boundaries, not just service names in a diagram.

The current executor is one VM. There is no Kubernetes, Lambda execution, automatic idle wake, autoscaling group or transparent native-session failover. A fixed stop timer limits runtime; it does not make the VM elastic. Existing storage can remain billable after stopping.

## Live resource monitor

The header's **Cloud status** opens a read-only monitor. `/api/cloud-status` requires office authentication, caches a snapshot for 15 seconds, and probes the configured executor and authenticated Codex model catalog without inference. It shows service reachability/round-trip latency, task states, artifacts, model-call counts and reported token totals. A successful probe is not a new end-to-end agent benchmark.

The updated executor exposes authenticated `/metrics`: CPU count, one-minute load, total/free host memory, uptime and active supervisor operations. No AWS credentials or Docker command access are exposed. Memory usage includes OS/cache; load average is not CPU utilization percentage. Old or stopped executors show telemetry unavailable, never fake zero values. This is application/host telemetry, not an AWS billing or CloudWatch dashboard. Host deployment requires refreshed AWS access.

## Codex and models

Native cloud Codex CLI 0.142.5 is active for Jarvis. The earlier real trip completed through this runtime after TLS/retry/HTML-size fixes, reusing earlier collected sources. Context usage was excessive; this does not establish competitor parity or reliable task efficiency.

Requested configuration: Jarvis `openai/gpt-6-luna` via cloud Codex; Friday `deepseek/deepseek-v4-flash` via OpenRouter. Both IDs were verified in the provider catalog without paid inference. Friday's live setting was changed. Jarvis remains on its working GPT-5.4-mini until AWS access permits updating the harness allowlist; selecting an unsupported model would break the demo. The preset checks that allowlist before filling the requested models.

## Is Friday useful?

Jarvis owns execution and the consolidated result. Friday can independently inspect a bounded claim, source packet, contradiction or calculation. Its finding should identify the claim, evidence and correction, rather than repeat planning. Automatic duplicate review is off. Direct Friday inference is a separate API model, not another full native Codex host. Both roles' office state is in the cloud; optional private document retrieval needs the paired laptop companion and owner-reviewed disclosure.

The architecture supports collaboration, but no controlled benchmark yet proves better quality per token than Jarvis alone. Demonstrate Friday only for a specific useful verification; do not imply that two avatars prove teamwork.

## Gmail diagnosis and repair

The saved client did not have a project-number prefix or `.apps.googleusercontent.com` suffix. Google returned `401 invalid_client` / `Client missing a project id`. That happens before Gmail consent and is an OAuth configuration blocker, not model behavior.

1. Select a Google Cloud project and enable Gmail API.
2. Configure Google Auth Platform branding, audience and scopes. If the app is in Testing, add the presenting Google account as a test user.
3. Create an OAuth client of type **Web application**. Register the exact callback URI displayed in Settings.
4. In **Settings → Connections → Gmail → OAuth setup / fix**, enter that OAuth client ID and its matching secret from the same project. A Gemini API key, Gmail address or project ID will not work.
5. Save and connect; complete Google's consent yourself. Sending email still requires exact approval. A valid-looking ID is not proof that Google recognizes the client or that live delivery works.

Malformed IDs are now rejected before any OAuth state is created. Inline progress/errors appear inside the settings dialog, and saved configuration can be replaced even when Google was previously marked configured. Secrets remain encrypted and are never returned by the status API.

## Release gate

The monitor/Gmail changes are deployed. Live authenticated status returned online for Worker, SQLite, AWS executor and Codex, and the Gmail route rejected the malformed saved client before redirect. The host telemetry endpoint is not on the current executor yet and correctly reports unavailable. Activating host telemetry/GPT-6 Luna requires refreshed AWS credentials. Cloudflare deployment succeeded on retry; its earlier login request is no longer needed.

Checks: 74 unit tests, TypeScript, office/capabilities/team integration suites, authenticated executor telemetry test, and a Worker-runtime cloud-status integration with caching/authentication checks. External model/Gmail services in integration suites were synthetic. No paid model tasks were run for this review. No Chrome integration was used after the owner's instruction. Live consent and delivery remain unverified until the OAuth configuration is replaced.

References: [Google server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server), [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), [DeepSeek V4 Flash](https://openrouter.ai/deepseek/deepseek-v4-flash).
