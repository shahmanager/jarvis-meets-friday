# Workflow, meaningful teamwork and harness direction

Reviewed 16 October 2026. This distinguishes changes implemented now from an integration recommendation. It supersedes the earlier implication that a small custom loop is sufficient for commercial-agent capability.

## Current implementation

The runtime is a custom TypeScript model/tool loop in a SQLite Durable Object. JSON is the transport and storage format, not an agent architecture. It already has persisted tasks, scoped tools, approvals, cancellation, limited parallel reads, delegation, working notes and transcript pruning. These are useful foundations, but not evidence of strong planning, reliable computer use or a performance advantage.

This increment adds shared workflow guidance for both roles, application-owned playbooks loaded with `workflow_read`, claim-level review instructions, review packets retaining tool-call IDs and explicit truncation/omission markers, and approval snapshots covering delegated artifact metadata. Previous automatic review cut serialized tool evidence at an arbitrary character boundary; the replacement remains valid JSON and tells the reviewer what is missing. Existing task system messages are preserved; new tasks receive the updated role instructions.

Playbooks cover research, documents, browser actions, coding and collaboration. Models choose whether to load them and how to adapt the plan. Simple tasks can finish directly. Tool policy, not a playbook, controls authority. This is progressive guidance, not a claim of a new reasoning algorithm or automatic verification. Browser/coding playbooks cannot create absent execution capabilities.

## What reverse-skill contributes

The requested [reverse-skill repository](https://github.com/zhaoxuya520/reverse-skill) is a reverse-engineering/security workflow pack. Its [routing entry](https://github.com/zhaoxuya520/reverse-skill/blob/main/skills/MASTER-ROUTING.md) and [case review skill](https://github.com/zhaoxuya520/reverse-skill/blob/main/skills/case-review/SKILL.md) make scope, specialist responsibility, evidence references and review explicit. Those principles informed this application-specific workflow.

Its full security toolchain, bootstrap scripts and target-analysis procedures are not installed or executed. The upstream case-review command applies to its case-package format, not this application's task database. Our playbooks are independently written for the office; this is adaptation of a design pattern, not an integrated reverse-skill runner. Untrusted sites or skills cannot install tools, expand grants or change policy.

## Harness recommendation

| Choice | Useful contribution | Fit and limit |
| --- | --- | --- |
| Codex app-server | Persistent agent threads, event streaming, interruption, tool and approval lifecycle | Strong candidate for a Codex-powered execution worker. Requires its own process/environment, compatible model authentication and a bridge to office policies. It is not a Gemini Chat Completions drop-in. |
| Deep Agents on LangGraph | Planning, filesystem context offload, subagents, summarization and sandbox backends | Preferred general-purpose harness pilot for the existing Gemini/provider-independent direction. Requires compatible model adapters, durable checkpointing and carefully scoped tool backends. |
| LangChain alone | Model/tool integrations and a standard agent loop | Useful building blocks; not by itself an execution environment or a guarantee of correct delegation. |
| LangGraph alone | Durable execution, branching, interrupts, streaming | Good underlying runtime; does not supply a complete general-purpose harness on its own. A graph can contain autonomous model-driven decisions. |
| AutoGen | Agent messaging and team patterns | Relevant if richer conversational teams become necessary; not selected as a second simultaneous orchestration layer. |

Sources: [Codex open harness](https://developers.openai.com/blog/codex-as-a-platform), [Codex app-server](https://learn.chatgpt.com/docs/app-server), [Deep Agents](https://docs.langchain.com/oss/javascript/deepagents/overview), [models](https://docs.langchain.com/oss/javascript/deepagents/models), [LangGraph](https://docs.langchain.com/oss/javascript/langgraph/overview), [AutoGen AgentChat](https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/).

Codex's harness is open source; model weights and access are separate. Official app-server integration uses JSON-RPC too. Changing JSON to a framework is a category mistake; the useful change is adopting better context, execution, recovery and evaluation behavior. Provider compatibility and tool behavior must be verified rather than inferred from an OpenAI-compatible label.

**Decision:** retain the working path while testing Deep Agents as the next general harness; consider Codex as an alternative execution backend when Codex model access is intentionally selected. Neither integration is implemented in this increment. Do not stack all frameworks or present a planning-only document as a completed migration.

## Deployment and ownership

Keep the office UI, owner identity, task records, grants, exact private disclosures and delivery ledger in the control plane. A Node/Linux execution service hosts the selected harness and isolated task workspace. Its harness session/checkpoint ID is linked to an office task; its conversational state does not become a competing authority for permissions. The laptop companion retains selected private files and the local index. With API reasoning, released excerpts still reach the chosen model provider.

For a pilot, use a separate package/process and synthetic fixtures. Connect tools through the existing deterministic gateway; do not expose raw host shell, credentials, unrestricted private files or a Docker socket to the agent. Keep cancellation, operation IDs and uncertain-action reconciliation across the bridge. Bridge approval requests back to the owner instead of globally approving them. Codex-specific built-in tool access must satisfy the same boundary before activation.

Do not provision AWS to compare frameworks. Start with a local isolated execution service; cloud hosting is a separate deployment choice. Production wake/idle leases and authenticated HTTPS remain unimplemented.

## How two agents earn their cost

1. Jarvis identifies the requested result and available capabilities. For short tasks it acts directly.
2. For useful independent work, it sends Friday a bounded question with selected context, expected output and acceptance checks, then continues independent work.
3. Friday contributes approved private evidence, a separate source check or a concrete critique. It returns conclusions, evidence references, artifacts and uncertainty, not the whole conversation.
4. Jarvis checks contradictions, fixes the output and states unresolved gaps. Reviewer agreement does not establish truth; claims require underlying observations.
5. A consequential external action uses exact owner authorization and a provider receipt. Neither agent can negotiate away a denial.

The full local request/offer/counteroffer evidence protocol remains future work; current local release is owner-controlled. Review is still text produced by a model, not a deterministic factual validator. The optional Together review preference remains in force; benchmark whether its cost is justified before adding automatic reviewers everywhere.

## Evaluation

`npm run eval:collaboration` runs one versioned public synthetic supplier-selection fixture in Jarvis-alone and Together modes. It checks arithmetic, quantity/discount eligibility and the chosen supplier without an LLM judge. It records actual model configuration, family call/token counts, elapsed time and failure status under `work/evals/`. Fixture tasks have explicit local step/token/deadline bounds; owner defaults are unchanged. The runner never auto-approves requests, sends messages or starts cloud resources, and cancels its own still-pending fixture on timeout/blockage.

Set `DUAL_AGENT_URL` and `DUAL_AGENT_PASSWORD` in the process environment for your own office; do not commit them. `node scripts/eval-collaboration.mjs --self-test` checks the grader without credentials or inference. This is a starting diagnostic, not a quality benchmark. Provider retries and quota failures are recorded as limitations, not hidden from results.

Before a harness migration, expand to source-conflict research, stale dates, multi-file coding, browser recovery, selected private evidence, denied grants, restart and uncertain delivery. Compare the same fixed model with each harness; separately compare model upgrades. Use repeated trials and report success, supported claims, disclosure, latency and tokens. A useful target is a measurable advantage on selected private-evidence workflows; no broad Codex/Claude/Grok/Muse superiority is established.

## Live diagnostic on 16 October

The first supplier fixture did not demonstrate a teamwork improvement. Jarvis-alone reached the 150-second deadline after two provider backoffs and an unnecessary history lookup (4 attempts, 4,740 reported tokens before cancellation). Together generated the correct draft and a reviewer confirmed its arithmetic, then the final composition call failed with HTTP 400 (3 calls including review, 5,536 reported tokens). These are failed runs, not passes; canceled in-flight requests can incur tokens not reflected in the stored total.

Inspection exposed a harness protocol defect: automatic review was represented as a client-invented assistant function call. [Gemini requires signatures on model function calls](https://ai.google.dev/gemini-api/docs/generate-content/thought-signatures). The revised provider history presents automatic review as untrusted application observations, preserving genuine model messages and signatures. The original task transcript and exact disclosure approval remain intact. Legacy automatic-review records are normalized at the request boundary too. Component and integration checks cover the distinction; live recovery results are recorded in validation.
