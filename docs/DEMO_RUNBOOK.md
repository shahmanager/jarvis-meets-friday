# Cloud demo - 21 October 2026

The demo must work from another device. The presenter laptop is a browser client, not an application server. Voice is deferred.

## Intended deployed path

Browser -> authenticated Cloudflare Worker office -> SQLite Durable Object tasks/approvals -> Gemini model API. Separately configured Jarvis and Friday roles use Gemini initially because the current OpenRouter key returned HTTP 402 for both Mercury and DeepSeek. Do not imply that choosing OpenRouter activates Codex: the direct provider loop and optional cloud Codex service are different runtime paths.

The office is deployed at https://relay-computer-agent.devam-vantage.workers.dev . Use the existing workspace password; never put it in this document or slides. Both roles currently use `gemini-3.1-flash-lite`; Gemini 3.7 produced an artifact but its final call timed out, while the resumed Flash-Lite final call completed. Provider quota/backoff still affects rehearsal. Gemini credentials are Worker secrets. Local .dev.vars values are not loaded by cloud Workers. Local task history and private files are not automatically uploaded.

Cloud browser/Python execution requires the dedicated AWS Linux Docker executor and an authenticated HTTPS connection from the Worker. This connection is a deployment gate, not a feature established by stub tests. Confirm its health, public network policy and screenshot before presenting. The existing VM auto-stop timer is fixed from boot, not genuine idle shutdown; check it against the presentation time. No on-demand wake is implemented.

Friday reasoning runs in the cloud for this demo. A laptop companion is optional for selected private files and is excluded from the cloud-only core demo. Do not pretend local-file retrieval works when that companion is disconnected. Use public synthetic evidence for collaboration.

## Rehearsal, in order

1. On another device or a clean browser profile, open the cloud URL, sign in and confirm both models are configured. Close the development server: the cloud office must keep working.
2. Assign Jarvis: create a short HTML report using facts supplied in the task. Confirm a real artifact ID, download and isolated preview. Ask for a text PDF separately and open the actual PDF.
3. Assign Together: compare two public synthetic supplier quotes supplied in the prompt. Ask Friday to check arithmetic and exclusions; expect evidence or a concrete correction. Watch the real delegated/review trace. Agreement alone is not proof.
4. With the cloud executor connected, ask Jarvis to navigate a public page, list its actual controls, follow one harmless link and summarize the observed page. Confirm the live mirror changes and the final source URL. No purchases, logins or real form submissions in rehearsal.
5. Test stop, a declined approval and page refresh. Do not blindly repeat a click or external send after an uncertain result.
6. Optional email: configure the Google OAuth client with the cloud callback URL shown in Settings, connect Gmail, create an artifact, then approve the exact recipient/body/attachment. Verify the provider receipt and actual mailbox. Telegram likewise needs cloud webhook pairing. These need the owner's accounts; never claim live delivery from stubs.

## Go/no-go

Required: cloud login; available real model quota; real HTML/PDF; useful two-role trace; healthy cloud executor for the browser segment; second-device check. Optional: Gmail/Telegram only after live verification. A failed external dependency must be identified clearly rather than replaced by fabricated activity or an offline demonstration labelled AI.

Keep a previously generated artifact and a short recording of an actual successful run as a labelled backup. Do not disguise a recording or offline fixture as live inference.

## Still deferred

Voice, streaming speech/model output, general inbox monitoring, connector expansion, DAG scheduling, parallel writes, transparent native Codex recovery, autoscaling and idle-aware VM wake/shutdown. The deployable cloud Codex bridge exists but is not the active Gemini demo runtime.
