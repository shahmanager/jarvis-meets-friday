# Cloud console

Added 21 October 2026. Open it with **Cloud** in the top bar, or by clicking the edge chip (for example `Edge BOM · 38 ms`). It has four tabs. The first three read the live deployment; the fourth is a labelled simulation.

## What is live and what is simulated

| Tab | Source | Endpoint |
| --- | --- | --- |
| Overview | Measured from the running Worker and Durable Object | `GET /api/cloud` |
| Architecture | Same data, mapped onto the course's cloud reference model | `GET /api/cloud` |
| Security | Posture checks computed from configuration; approval audit trail from task events | `GET /api/cloud` |
| Scaling lab | **Client-side simulation only**; never calls the server and never creates or bills infrastructure | none |

Server endpoints (all owner-authenticated and read-only; any other method returns 405):

- `GET /api/cloud`: edge location (Cloudflare `request.cf`: PoP, city, HTTP protocol, TLS version), Durable Object ID and SQLite size (`ctx.storage.sql.databaseSize`), the next alarm, record counts and bytes by type, task analytics (14-day outcomes, success rate, median/p90 time to result, tokens), control-plane limits, service configuration, security checks and security events.
- `GET /api/cloud/probe`: calls the executor's `/health` from the Durable Object with a 4-second timeout and returns status and latency. If no executor is configured it returns `{configured:false}`.
- `GET /api/cloud/backup`: downloads a JSON snapshot of missions (prompt, status, answer, file names), memory notes and routines. It leaves out model and connector credentials, device token hashes, artifact bytes and raw model history.

The front Worker attaches edge data only to `/api/cloud*` requests, through the `x-relay-edge` header, and always overwrites any client-supplied value. Other API requests pass through unchanged.

## Illustrative course outcome mapping (verify against your syllabus)

| Feature | Unit / CO | Lab link |
| --- | --- | --- |
| Edge PoP, request path, storage by record type, S3/SQLite artifact mode | Unit 2 Physical layer · CO1 | Labs 1–4 (global infrastructure, storage, networking) |
| Isolates vs. containers vs. VMs in the reference-model map | Unit 3 Virtual layer · CO2 | Lab 13 (virtualisation and containers) |
| Admission control (5 open / 2 concurrent), alarms, back-off, parallel-read pool, round-trip monitoring, executor health probe | Unit 4 Control layer · CO3 | Lab 5 (monitoring, elasticity) |
| Load-balancing algorithms, target-tracking auto scaling, boot lag, health-check failover, cost per server-hour (Scaling lab) | Unit 4 · CO3 | Labs 5 and 13 (Auto Scaling, load balancing, Cloud Analyst-style modelling) |
| Posture checks, shared responsibility model, approval audit trail | Unit 5 Security · CO4 | Labs 2 and 5 (IAM, encryption, permissions) |
| IaC, edge deployment, CI pipeline, agent delegation, routines in the reference-model map | Unit 6 Orchestration · CO5 | Labs 6, 8 and 9 (CloudFormation, decoupling, serverless) |
| Backup export and recovery point | Unit 4 · CO3 | Lab 11 (planning for disaster) |
| Model spend estimate (tokens × your own price) | Course objective 4 (business models) | none |

## Honest limits

- Security warnings are real gaps, not decoration. Two are always present today: there is no second sign-in factor, and the AES key is one SHA-256 of the admin password (no salt or work factor). Fixing either changes authentication or storage, so it was left for an owner decision.
- Round-trip time is measured from the viewer's browser on each refresh. It is not server-side telemetry.
- Backups are manual and export-only. There is no restore endpoint yet, and artifact bytes are excluded. It is a partial export, not a complete restorable disaster-recovery backup.
- The spend estimate uses a price you enter; the app does not know your provider's rates.
- In `wrangler dev`, the edge object is Miniflare's mock (it typically reports `DFW`). Real PoP data appears only on a Cloudflare deployment.

## Checks

`tests/cloud.test.ts` covers analytics, security checks (HTTP, weak executor link, stale devices, demo mode, no password echo), event filtering, backup exclusions and edge-header spoofing. `scripts/integration.mjs` covers the real Worker/Durable Object path: authenticated status matching `/api/metrics`, 401 without a session, 405 on POST, 404 on unknown routes, executor probe when none is configured, and backup headers and exclusions.

PR integration review: keeps the Gmail repair UI and requested-model preset, combines live AWS host telemetry into this console, counts search calls, and drains bounded rejected request bodies before returning 405. This avoids a reproducible follow-up connection reset under the Worker integration runtime. Missing edge metadata is labelled unreported, not assumed local hosting.
