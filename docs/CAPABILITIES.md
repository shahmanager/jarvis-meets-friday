# General agent capabilities and required connections

Status: 15 October 2026. These are tool surfaces, not guaranteed task success. Trip planning is an example, not a separate application or fixed workflow.

| Task | Implemented path | Current requirement or limit |
| --- | --- | --- |
| Public research, option comparison, sourced briefs, itinerary drafts | `web_search`: Gemini with Google Search grounding; Google answer, source links and Search Suggestions in Work | Gemini key and working Google grounding quota. Live grounding requests with the supplied key returned HTTP 429; no successful live Google search is claimed. Public RSS remains a narrower fallback for news. |
| Exact current fares or other purchasable offers | Not implemented | Needs a live inventory/offers API and reprice step with currency, taxes, baggage, passengers and retrieval time. Search snippets are not bookable quotes. |
| HTML reports and static microsites | `artifact_create` with `.html`; Preview in Work | Self-contained CSS/data images. Preview uses an authenticated opaque sandbox with scripts, forms, external requests and embedding blocked. Download retains original HTML. |
| PDF reports | `artifact_create` with `.pdf`; valid paginated PDF bytes generated with pdf-lib | Plain text, 60k input characters, 200 KB output; Latin/WinAnsi only, no emoji/RTL. This is not arbitrary HTML-to-PDF or a designed multilingual publishing system. PDF payloads currently remain in Durable Object storage even when text artifacts use the executor/object-store adapter. |
| Email a report or reply with files | `email_send` / `email_reply`, optional `artifact_ids` | Gmail OAuth connection and exact approval of recipient, body and attachment manifest. Up to 3 files, 200 KB each, 450 KB total. Filename, MIME, size and SHA-256 are frozen; bytes are rechecked before delivery. Real attachment delivery was not exercised. |
| Analyse selected private documents | Paired Python companion, local FTS, reviewed releases | Companion must be paired/running. Actual content disclosure remains explicit; memory discovery returns opaque handles only. |
| Python, workspace files and browser actions | Isolated Linux executor | Executor is not connected in current local settings; no AWS auto-wake controller exists. |
| Memory, routines, Telegram, remote MCP | Existing respective tools | Each needs its connection/grants. Scheduling is for an explicit scheduling request, not a substitute for missing search. |

## Models and runtime

Both roles can use capable models; a small model is optional, not part of an authorization boundary. The supplied Gemini key was validated and stored encrypted in local settings. Gemini 2.5 was rejected for this account; Gemini 3.8 tool calling initially worked but later requests hit transient errors. Gemini 3.5 and 3.7 tool-call probes worked. Both roles were then pinned to `gemini-3.7-flash` rather than the random OpenRouter free router/2.6B split. This is an availability choice, not a measured quality ranking. Quotas and service capacity still apply.

The coordinator is currently local Wrangler/Miniflare on the laptop. Reasoning is remote model API inference. The laptop file companion is a separate optional process, and Linux execution is a separate optional service. No model is running on EC2. No cloud deployment or AWS compute start was performed for these changes. The latest attempted AWS state check could not authenticate; last verified EC2 state was stopped.

## Safe data and delivery flow

The owner requests a result; the agent chooses tools and may delegate useful independent work. Public search sends a query to Google. A task with private context requires approval of the exact query and pinned Gemini model before Google receives it. A five-minute cooldown follows quota exhaustion; credentials can be replaced in Settings to clear stale cooldown state. Grounding inference calls and reported tokens count toward task-family budgets. Missing usage stops further model calls.

Complete grounded responses and citation metadata stay in task state and load on demand in Work; routine task polling carries only a revision ID. Google-provided Search Suggestion HTML is served from an authenticated, scriptless sandbox document, never injected into the application DOM. Generated HTML previews have an even stricter sandbox. The main app's frame/credential policy remains unchanged.

For email, the model selects existing artifact IDs; it cannot submit arbitrary attachment bytes. The app reads and hashes the files for the approval manifest, then reads/checks the same bytes immediately before sending. A changed file needs a fresh approval. MIME is validated before persisting a sending intent; uncertain actual sends retain the existing reconciliation/receipt boundary. No real email is sent by the automated test suites.

## Verification and useful next work

`npm run test:capabilities` covers grounded-source metadata and usage accounting, real PDF parsing, preview CSP, attachment mutation rejection, multipart MIME bytes, receipt replay protection, quota cooldown and private-query denial, with explicit external-service stubs. Component and existing integration suites remain required. Live Google grounding and Gmail attachment delivery are separate verification gates; do not relabel stubs as successful integrations.

Measure real tasks before expanding: research quality/citation accuracy, unsupported claims, steps, total model and search tokens, latency split between inference/tools/approval, and recovery. Reviewer calls should add evidence-based value; they are not obligatory ceremony. See [incident diagnosis](INCIDENT_NEWS_STALL.md), [agent design review](AGENT_DESIGN_REVIEW.md), [Google grounding setup](search-and-travel.md), and [messaging setup](messaging.md).

Delegated children receive only the selected prompt/context; they do not automatically reload unrelated core memories into the recipient model. Private delegation still requires the existing exact disclosure approval. Inline preview is HTML-only: Chromium blocks its native PDF viewer inside the strict sandbox, so PDFs are offered as downloads rather than a broken preview.

A live Gemini 3.7 Flash task created HTML and PDF deliverables in 46.9 seconds, including one 30-second provider retry delay (8,314 reported tokens). The HTML rendered in the app sandbox; the downloaded PDF parsed successfully as a one-page PDF. Both roles are configured for Gemini 3.7 Flash, but this fixture did not measure peer collaboration. Google Search still returned HTTP 429 with this key, and real Gmail delivery was not exercised. [Artifact preview](images/artifact-preview.png).
