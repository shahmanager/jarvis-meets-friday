# Decision 003: Keep the existing agent harness

Status: accepted for current prototype. Date: 14 October 2026.

## Context

Jarvis and Friday need model tool loops, task persistence, approvals, cancellation, delegated work, and a local evidence boundary. The Worker already uses one SQLite Durable Object as authoritative task state. Replacing that loop is a product/runtime choice, not a prerequisite for autonomous behavior. Each role may plan and choose tools, including teammate delegation; deterministic code controls grants, budgets, approvals, and persisted outcomes. No fixed workflow guarantees task success.

## Options reviewed

- [Pi](https://github.com/earendil-works/pi): agent toolkit with unified model API, agent loop, TUI, and coding-agent CLI. Good reference for a reusable harness and interactive coding workflow; adopting its runtime would not replace this app's owner-scoped persistence or local disclosure protocol.
- [Vercel AI SDK agents](https://ai-sdk.dev/docs/agents/overview): `ToolLoopAgent` provides model/tool looping, context management, and stop conditions; lower-level core functions support explicit structured workflows. Useful option if provider/tool adapters become the main maintenance burden.
- [Cloudflare Agents](https://developers.cloudflare.com/agents/): platform-native stateful agent framework on Workers/Durable Objects. Natural candidate if real-time sessions, framework lifecycle, or its built-in integrations remove meaningful custom code.
- Existing custom TypeScript Worker + Durable Object: already owns checkpoints, per-task tool policy, task-family budgets, approval records, messages, alarms/recovery, and current integration routes.

## Decision and rationale

Keep existing custom harness. Its state model is already the core product boundary, and current requirements remain small enough to inspect directly. Framework adoption now would duplicate or migrate durable state and approval semantics without evidence that a framework removes more complexity than it adds. This is a maintainability decision, not a measured speed, quality, or token-efficiency claim.

Retain autonomous model planning and tool choice; do not turn Jarvis/Friday into a hard-coded sequence. Keep authorization, role grants, task-family budgets, side-effect approval, cancellation, and uncertain-outcome reconciliation deterministic and outside model judgment.

## Revisit when

Reconsider only when traces or feature needs show concrete pain: multiple durable workflow branches, repeated adapter boilerplate, framework-supported MCP lifecycle, or recovery semantics that are hard to maintain. Compare on the same task fixtures for recovery, approval compliance, task quality, latency, token/cost, and migration burden. Do not infer a benefit from framework popularity alone.
