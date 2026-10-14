# ADR-002: Keep the lightweight cloud/local runtime

Status: accepted for the college prototype. Date: 13 October 2026.

## Decision

Keep the existing TypeScript Worker/Durable Object state machine and standard-library Python companion. Add bounded memory, scheduled jobs, messaging and explicit small-model review to that runtime. Do not replace the project because a reference repository was supplied. Native platform persistence and HTTP APIs cover the present requirements without a new orchestration dependency.

## Framework review

`docs/frameworks.json` records GitHub API metadata retrieved on 13 October 2026. Stars indicate interest, not quality or suitability; this is a selected comparison, not a global ranking.

| Project | Stars at retrieval | Fit and reuse decision |
| --- | ---: | --- |
| [OpenClaw](https://github.com/openclaw/openclaw) | 391,821 | Closest personal-agent product reference. Its memory and channel architecture are useful design references. Adopting its full gateway would replace substantial existing runtime; revisit if its ready-made integrations become the main product requirement. |
| [LangChain](https://github.com/langchain-ai/langchain) | 147,726 | Broad model/tool integrations. Current native adapters already cover the three requested providers; no immediate dependency needed. |
| [LangGraph](https://github.com/langchain-ai/langgraph) | 43,167 | Valuable for complex branching, persistent graph execution and human interrupts. Existing actor already owns state and approvals. Reconsider if workflows grow beyond this small two-role loop; JavaScript has a separate implementation. |
| [OpenHands](https://github.com/OpenHands/OpenHands) | 90,766 | Strong coding-agent/runtime reference. Potential future execution backend, but integrating its whole service adds deployment cost and a larger trust boundary. |
| [Cloudflare Agents](https://github.com/cloudflare/agents) | 5,819 | Best platform-native framework candidate for expanded real-time/MCP features. Current custom Durable Object already implements required coordination. Migration should solve a concrete missing feature. |
| [OpenJarvis](https://github.com/open-jarvis/OpenJarvis) | 11,070 | Relevant local-first agent and evaluation stack, with energy/latency/cost measurement. Useful literature/benchmark reference. Local inference installation does not fit the current API-only lightweight-laptop constraint. |
| [Jarvis Desktop Voice Assistant](https://github.com/kishanrajput23/Jarvis-Desktop-Voice-Assistant) | 988 | Voice and predefined desktop commands, not a substitute for durable model-driven orchestration. Native platform speech features or narrow reviewed adapters can cover future voice requirements. |

OpenJarvis is Apache-2.0; the other listed repositories report MIT in GitHub metadata. No source files from these repositories have been copied into this release. If a component is reused later, pin its commit, inspect its dependencies and preserve the component's actual license/NOTICE requirements. Whole-repository metadata does not override individual file licensing.

Official references: [LangGraph overview](https://docs.langchain.com/oss/javascript/langgraph/overview), [Cloudflare Agents](https://developers.cloudflare.com/agents/), [OpenClaw memory](https://docs.openclaw.ai/concepts/memory), and the linked repositories. This comparison is engineering judgment, not a benchmark result.

## Trade-off

The small custom loop is easier to inspect and explain for this cloud computing project. We own its recovery and approval behavior, so those paths require meaningful tests. A larger framework might supply more integrations, but it would not by itself guarantee laptop privacy, secure tool execution, correct small-model reviews, or journal novelty.
