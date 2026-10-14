# Dual Agent: current product specification

Dual Agent is a personal virtual two-agent office with a dashboard, a cloud executor, an optional local companion, persistent memory, and owner-controlled integrations. The office has two named roles: Jarvis (cloud operator) and Friday (local steward/peer). The owner assigns each task to Jarvis, Friday, or Together. Together tasks use shared task state and teammate chat; optional draft review lets Friday critique Jarvis and Jarvis revise. This is a practical two-role workflow, not literal bot-to-bot Telegram messaging.

## Product behavior

The dashboard is the primary control surface. Settings is the one place to configure providers, model IDs, optional task limits, Telegram/Gmail connections, and team preferences. Steps and token caps default to null until the owner sets them. Token usage is checked between calls and one call may exceed a cap. These controls are not a dollar spending limit.

Tasks default to all public websites (`*`). The Linux executor accepts HTTP(S) on standard ports, resolves and pins public IPv4 addresses, and blocks private, reserved, and metadata destinations. Exact domain restrictions can still be supplied for a task. Web content remains untrusted input. Writes, execution, browser changes, local disclosures, and outbound messages use deterministic authorization and approval flows.

Friday's cloud model tools are limited to memory lookup/read, local-context requests, and artifact creation. The optional laptop companion is a separate Python/Tkinter program with selected-folder policy and user review before disclosure. It does not control arbitrary desktop apps.

## Implemented capabilities and evidence

| Capability | Current behavior / evidence |
| --- | --- |
| Office and task assignment | Dashboard creates Jarvis, Friday, or Together tasks; shared chat and task status persist in the Durable Object. |
| Model loop | Worker/Durable Object resumes tasks through alarms; integration model output is stubbed. |
| Public browsing | Browser and text retrieval go through executor policy; public IPv4 DNS is pinned and private/reserved addresses are rejected. |
| Linux execution | Separate Docker Python and Chromium containers; AWS EC2 verification is historical and that VM is stopped. |
| Local context | Selected folder only; user reviews exact text before release. |
| Memory | Durable Object memory is authoritative; AgentMemory is an optional local BM25 recall index keyed by source IDs. Real remember/search/forget runtime was verified. |
| Telegram and Gmail | Owner pairing/webhook and Gmail OAuth/read/send flows implemented; live credentials and delivery remain owner-configured. |
| Task caps | Null by default; configurable in Settings. Checks occur between model calls. |

## Limits and remaining deployment work

Cloudflare production credentials, provider keys, live inference, Telegram/Gmail setup, and the HTTPS Worker-to-executor deployment require owner configuration. Current integration tests use provider stubs. The previously verified AWS host is stopped; this update did not start or provision cloud resources. Executor proxy policy has automated checks but has not been revalidated on a currently running VM.

No arbitrary laptop application control, unrestricted shell, purchases, multi-owner tenancy, Kubernetes, autoscaling, or hardened public multi-tenant isolation is claimed. Docker containers share their host kernel. Local disclosure review and regex masking are not formal confidentiality guarantees. A completed external side effect cannot always be undone.

See [architecture](architecture.md), [memory](office-memory.md), and [messaging](messaging.md).
