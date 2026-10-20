# Harness decision for the demo

The current production runner is a custom durable checkpoint loop in the existing Relay Durable Object. It is not LangGraph, AI SDK ToolLoopAgent, or Cloudflare AIChatAgent. The optional cloud Codex bridge is not the active model route.

Recommended next harness: AI SDK ToolLoopAgent for model/tool iteration, hosted with Cloudflare Agents/AIChatAgent for persisted messages and resumable output. Official references:
- https://ai-sdk.dev/docs/agents/overview
- https://ai-sdk.dev/docs/agents/loop-control
- https://developers.cloudflare.com/agents/runtime/lifecycle/agent-class/

ToolLoopAgent supplies loop control and step preparation. AIChatAgent supplies persistence and resumable streaming. Neither automatically supplies our permissions, private disclosure negotiation, sandbox isolation, delivery reconciliation, artifact storage, or tool timeout recovery. Preserve those boundaries when adapting the harness.

Do not replace the existing production Durable Object class or storage namespace for a rushed demo migration. Prototype against synthetic providers and existing task snapshots, verify pause/resume/cancel and exact approvals, then move one role behind a configuration switch. Existing persisted tasks must keep their original runner until settled. The present change fixes the observed search response-body timeout and output visibility first; it does not claim a framework migration or competitor parity.

Demo limitations: exact bookable flights require dates and an actual dated quote, not search estimates; external app login handoff and Teams OAuth remain incomplete. HTML artifacts support inline CSS and native interactions; app preview blocks JavaScript. Browser/Python need the separately started executor. Cloud search and stored HTML/PDF do not need that executor.
