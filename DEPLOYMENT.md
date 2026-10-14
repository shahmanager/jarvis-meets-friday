# Deployment status — 13 October 2026

The office application and portable Linux executor are implemented. Public deployment and live provider operation still need owner credentials and setup. The AWS demonstration stack was verified earlier; its EC2 instance is stopped. This update did not start or provision AWS resources.

## Historical AWS demo (use your own stack outputs)

| Resource | Identifier/state |
| --- | --- |
| CloudFormation stack | `STACK_NAME` |
| EC2 | `INSTANCE_ID`, stopped, `ap-south-1`, `t3.small` |
| Root storage | Encrypted 25 GiB gp3 EBS, retained while stopped |
| Artifact bucket | `ARTIFACT_BUCKET_FROM_STACK_OUTPUT`, private/versioned |
| CloudWatch | `LOG_GROUP_FROM_STACK_OUTPUT` |
| Management | Systems Manager; no inbound SSH |

Identifiers in this public document are placeholders; use your own ignored deployment record. VM state is historical, not a live account check. Retained storage and logs may continue to incur charges. AWS account balance and expiry details from older status reports are omitted because they can change.

## Local office and memory

```powershell
npm ci
npm run dev
```

Set `ADMIN_PASSWORD` and `EXECUTOR_SECRET` in ignored `.dev.vars` (24+ characters). Configure providers and Jarvis/Friday model IDs in Settings. Optional task limits are also in Settings and default to unset. Public domain policy defaults to `*`.

To run the optional AgentMemory service locally:

```powershell
npm run memory:install
npm run memory:start
```

The launcher writes `AGENTMEMORY_URL` and a generated `AGENTMEMORY_SECRET` to ignored `.dev.vars`. It downloads iii v0.22.1 for x64 Windows/Linux and verifies its pinned SHA-256. The service binds loopback ports 3111 and 49134. Check `memory/data/runtime.log` if it fails. Restart a running Wrangler dev process after those `.dev.vars` values change. The service stores an index, while the Durable Object remains the source of truth.

This local loopback service is reachable by local Wrangler, not by a remote Cloudflare Worker. Production memory remains unconfigured. It needs a private host and authenticated HTTPS path (for example, an Access-protected tunnel or reverse proxy), then runtime verification from the deployed Worker.

## Linux executor

Run `executor/server.mjs` on a dedicated Linux Docker host. Use the existing AWS stack or another Linux VM and configure the same `EXECUTOR_SECRET` as the Worker. Put an authenticated HTTPS transport in front of the loopback supervisor; set `EXECUTOR_URL` and `EXECUTOR_SECRET` as Worker secrets/bindings. Keep the Docker socket and supervisor away from sandboxed code.

For a manually managed Linux host, from the repository root:

```sh
docker build -t relay-sandbox:0.1 executor
cd executor
npm ci
cp .env.example .env
# Edit .env locally: use the same strong EXECUTOR_SECRET as the Worker.
node --env-file=.env server.mjs
```

The supervisor binds loopback by default. A remote Worker cannot reach that address; deploy and verify an authenticated HTTPS proxy/tunnel before setting EXECUTOR_URL. The public repository does not create that transport automatically. Do not commit executor/.env or expose port 8790 to the Internet. See [AWS provisioning](infra/README.md) for the alternative managed-host path.

For browser tasks with `*`, configure `BROWSER_PROXY_PORT` (default 8790) on the supervisor host and allow executor containers to reach the host proxy. It authenticates each browser lease and DNS-pins public IPv4 destinations. HTTP(S) standard ports are supported; private/reserved and metadata destinations are blocked. Exact-domain task policies bypass the public proxy and pin permitted domains. Automated policy tests do not replace verification on the target VM.

The AWS instance has a two-hour stop timer after boot. Starting it is an explicit owner action:

```powershell
aws ec2 start-instances --instance-ids INSTANCE_ID --profile YOUR_AWS_PROFILE --region ap-south-1 --no-cli-pager
```

## Cloudflare and external integrations

Authenticate Wrangler, configure `ADMIN_PASSWORD`, `EXECUTOR_SECRET`, and any provider keys as Worker secrets, set the authenticated executor URL, then deploy:

```powershell
npx wrangler login
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put EXECUTOR_SECRET
npx wrangler secret put OPENROUTER_API_KEY
npm run deploy
```

Use NVIDIA or Gemini keys instead when selecting those providers. The app also supports pairing Telegram from Settings and connecting Gmail using an app-owned OAuth client; see [messaging setup](docs/messaging.md). Never put credentials in Git, Docker images, or chat.

The 32 component checks comprise 15 TypeScript, 9 executor, and 8 companion tests. Integration tests use explicit provider stubs. They do not prove live inference, live messaging, production deployment, or current executor availability. AgentMemory indexing/forgetting and memory recall after service restart were exercised against the real local runtime; remote Worker hosting remains unverified.
