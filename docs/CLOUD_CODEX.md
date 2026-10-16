# Cloud Codex harness

Implementation snapshot: 16 October 2026. The bridge is implemented; production hosting and real model compatibility have not been verified. Existing Gemini/OpenRouter direct-provider tasks remain available. Selecting Codex is an explicit migration, not an automatic change to saved settings.

## Where everything runs

- **Cloudflare Worker + SQLite Durable Object:** office UI, identity, task records, scheduling, tool grants, exact approvals, private release policy, delivery receipts and task-family budgets.
- **Cloud Linux container:** pinned `@openai/codex@0.142.5` app-server, separate process/thread/workspace for each active task. Codex owns its native reasoning/tool conversation. Its tools are office dynamic tools, executed by the existing gateway.
- **Configured model API:** inference through the Responses API. Current cloud endpoint allowlist is exactly `https://api.openai.com/v1` or `https://openrouter.ai/api/v1`. OpenRouter model compatibility must be tested individually. A Gemini key cannot authenticate this Responses backend; Gemini grounding remains a separate office tool.
- **Linux executor:** existing isolated browser/Python/workspace tools. Codex requests these tools through office policy; the harness container does not own the Docker daemon.
- **Laptop companion:** selected files, local FTS retrieval and owner-reviewed excerpt release. No laptop Codex process, ChatGPT login, local model or VM is required. Friday reasoning can run in its own cloud Codex session while its private corpus remains local.

## Actual control flow

1. Worker sends the role instructions, selected context, allowed tool catalog and task ID to authenticated `/v1/step`.
2. Bridge creates a native Codex thread with only `office__` dynamic tools. Native shell, file mutation, web search, plugins and other execution paths are disabled; unexpected RPC capabilities and unrecognized started item types fail closed.
3. A native dynamic tool request pauses at the bridge. Worker receives its actual call ID and passes it through existing grants/approvals. A model cannot approve its own action.
4. Worker records the tool result and submits the next checkpoint. Bridge returns that result to the pending Codex call, continuing the same native conversation. Independent read batches retain existing bounded concurrency; consequential writes remain serialized.
5. Usage comes from Codex's measured cumulative counters. Missing usage is never invented as zero. Completion, failure and cancellation release cloud processes; one-shot review sessions are released after inference.

Jarvis and Friday have separate task/session IDs. Delegation sends bounded selected context; private evidence and teammate results retain recipient/disclosure checks. Model provider, model ID and cloud harness URL are part of a private recipient grant. Moving the harness requires a new grant.

## Deploy on a cloud Linux host

No AWS VM is started by these commands until an operator explicitly chooses a host. Run the following on that host, with Docker already installed:

```sh
docker build -t jarvis-friday-codex ./harness
docker volume create jarvis-friday-codex-state
docker run -d --name jarvis-friday-codex --restart unless-stopped \
  --cap-drop ALL --security-opt no-new-privileges \
  --memory 2g --cpus 2 --pids-limit 256 \
  --env-file /secure/path/cloud-codex.env \
  -p 127.0.0.1:8789:8789 \
  -v jarvis-friday-codex-state:/state jarvis-friday-codex
```

The loopback host publish is intentional: put an authenticated HTTPS reverse proxy in front of it; do not expose plain HTTP publicly. Container resource values are pilot ceilings, not validated sizing. Persist `/state` on encrypted storage, restrict backups and define retention: native thread data and receipts contain task content. Never mount laptop homes, Codex auth files, browser profiles, host credentials or a Docker socket.

Create the host's private environment file outside the repository:

```dotenv
CODEX_HARNESS_TOKEN=GENERATE_A_RANDOM_32_BYTE_SECRET
MODEL_API_KEY=CONFIGURE_PROVIDER_KEY_ON_CLOUD_HOST
MODEL_BASE_URL=https://openrouter.ai/api/v1
CODEX_MODELS=CONFIGURE_ONE_RESPONSES_COMPATIBLE_MODEL_ID
```

`CODEX_HARNESS_TOKEN` authenticates the Worker to the bridge. `MODEL_API_KEY` authenticates cloud Codex to the model provider; it is not sent to the office or laptop. Use separate values. Configure the Worker using its secret mechanism:

```sh
npx wrangler secret put CODEX_HARNESS_URL
npx wrangler secret put CODEX_HARNESS_TOKEN
```

The URL is your HTTPS bridge origin. `/health` confirms process configuration, not model readiness. Authenticated `/v1/models` returns the operator-configured allowlist, not validated provider availability. First run a public synthetic artifact task with a compatible paid/free model, verify receipt, usage and cancellation, then select **Codex - cloud harness** and the tested model for Jarvis and/or Friday in Settings. Existing tasks pin their original model/recipient; start fresh tasks after migration.

## Persistence and operational limits

Atomic request receipts deduplicate identical checkpoint retries. A persisted start marker prevents an interrupted process from silently creating a replacement and replaying uncertain work. Ready receipts survive restart; active Codex sessions do **not** transparently resume after a container restart. Interrupted tasks require reconciliation and a fresh task. Do not label this automatic recovery. Native thread data remains available for a future explicit, tested resume implementation.

The pilot allows eight active processes, eight pending dynamic calls per session, 120 tools, bounded input/output and a 70-second checkpoint wait. Newly connected tools need a new session; revocation still takes effect in the Worker gateway. Session catalog changes are not live native-thread updates. Stop failed/cancelled work and monitor capacity. Pending approvals retain their process while waiting. No autoscaling, on-demand wake, idle suspension, multi-tenant isolation or production operational verification is included. Containers share the host kernel. A deployment must add network restrictions/egress policy and authenticated ingress; model and task data go to the selected provider.

## Checks and evidence

`node --test harness/bridge.test.mjs` checks checkpointing, deduplication, usage, restart refusal, denied capabilities, capacity cleanup and endpoint restrictions with a fake RPC.

`npm run test:harness` additionally exercises the real Worker/DO against a stub cloud gateway: both roles, approval/denial, artifact creation, usage and terminal cleanup.

GitHub Actions runs `harness/protocol-smoke.mjs` with the real pinned Codex app-server on cloud Linux and a synthetic Responses SSE server. It does not call a real model, use laptop credentials or prove live provider compatibility. Do not run a laptop Codex turn to validate this cloud deployment.

See [REA product research](REA_PRODUCT_RESEARCH.md) for competitor public-client inspection and its limits. No benchmark establishes Grok/Muse/Codex parity or a two-agent advantage.

References: [Codex app-server](https://learn.chatgpt.com/docs/app-server), [Codex source](https://github.com/openai/codex), [OpenRouter Codex integration](https://openrouter.ai/blog/tutorials/codex-cli-openrouter/).
