# Research evaluation plan — no study results yet

The defensible research question is whether a small-model steward reduces unnecessary disclosure at comparable task utility, and what latency/token overhead it introduces. The contribution must be demonstrated by controlled experiments. A new browser, two agents, or a different cloud provider alone is not evidence of novelty or journal acceptance.

## Baselines

Use only synthetic personal documents with known facts and seeded confidential canaries. Keep the main model, tasks, tool permissions, user approvals, and cloud executor constant.

1. Cloud agent with the full synthetic context, establishing the utility/reference disclosure ceiling.
2. Cloud agent with deterministic selected-folder retrieval and the same human review used in the product.
3. The same retrieval and review, with a small model proposing a minimal answer before release.

Separate optional infrastructure experiments from the privacy experiment. For example, compare cold versus warm executor latency using the same task and model. Do not attribute a faster response to the steward if different models, task difficulty, prompts, or cache states explain it.

## Measures

| Measure | How to score it |
| --- | --- |
| Task utility | Independent ground-truth checks on required facts or created artifacts; task status alone is insufficient |
| Confidential disclosure | Seeded forbidden facts/canaries in released text and final artifacts; report false negatives and false positives |
| Disclosure size | UTF-8 bytes/facts released, normalized by required facts |
| Model usage | Main and steward input/output/total tokens from provider reports; mark unavailable measurements, never invent them |
| Latency | End-to-end and separate retrieval, review, inference, executor and storage durations |
| Reliability | Failure, timeout, replay rejection, denied operations and completed tasks across all attempts |
| Cost | Actual provider price applicable at run time plus verified cloud usage; distinguish credits from zero infrastructure cost |

Version the synthetic dataset and prompts. Record code version, model/provider IDs, parameters supported by each provider, dates, cloud region, cold/warm state, hardware and all attempts. Repeat runs, randomize experiment order and report uncertainty. Human-review duration is a separate variable; scripted releases in a synthetic benchmark do not demonstrate usability or real human privacy decisions.

Potential hypotheses are lower disclosure with the steward, similar utility relative to deterministic retrieval, and added latency that may erase the token savings. Negative results are useful. Investigate adversarial document instructions, insufficient evidence, irrelevant sensitive facts, and competing requests. The system should fail safely when information is missing or approval is denied.

Before claiming an open gap, review work on privacy-preserving personal agents, contextual integrity, data minimization, local/cloud model routing, prompt injection defenses and tool authorization. This document does not establish that no prior work exists. Real model runs and a literature review remain pending; current test results establish software behavior only.

## Teammate-review ablation

Hold retrieval, permissions, main model and dataset constant. Compare the same tasks with final-draft review disabled versus enabled; vary only the small-model reviewer. Score corrected errors, introduced errors, remaining unsupported claims, disclosure bytes, tokens and latency. Include weak reviewers and denied reviews. Review can make answers worse; do not treat additional agents as automatic improvement.

OpenJarvis is relevant prior work on local-first agents and resource-aware evaluation, not evidence of an untouched research gap. Review its linked paper and related systems before positioning a contribution. Candidate contribution: measured trade-offs from explicit disclosure boundaries and independent review in a resumable hybrid cloud/local personal agent. This remains a hypothesis until controlled experiments and a literature review establish it.
