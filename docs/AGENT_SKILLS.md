# App-owned task skills

The agents can load concise, reviewed instructions using `workflow_read`. This is a small lazy-loaded skill catalog in `src/workflow.ts`, not a remotely executable plugin system. Downloaded text cannot replace policy, grant tools or authorize disclosure.

- `research`: current primary sources, dates, cross-checks, citations and uncertainty.
- `browser`: actual page observations, visible selectors, a single page per task and explicit action verification.
- `coding`: inspect, make the smallest complete change, run checks, report real results.
- `documents`: preserve evidence and generate supported, verified files.
- `frontend_design`: intentional layout, light/high-contrast defaults, semantic structure, responsive inline CSS, source links, native interactive controls, reduced motion and preview compatibility.
- `data_analysis`: source fields/units, reproducible Python transforms and assertions, no invented measurements.
- `quality_check`: compare requested output with actual files/tool receipts; identify specific unsupported claims and corrections.
- `collaboration`: focused delegated questions, independent work, source-backed review, and a standalone consolidated answer.

HTML preview permits inline CSS but blocks scripts and external resources. Agents should use native details/summary, navigation anchors and CSS/SVG presentation; JavaScript applications need a separately reviewed execution/hosting feature. A design playbook improves guidance, not guaranteed design quality. Friday can use public page reads and sandbox Python to gather/check evidence, subject to the same private-context and sandbox autonomy rules. It cannot silently access the owner's laptop or send email.

New dashboard missions omit automatic core-memory injection. Agents can explicitly retrieve relevant saved context when needed; retrieving private data keeps disclosure approvals. Public teammate delegation/review already runs without approval. The mission panel combines actual related teammate chat; child prompts stay out of the owner-facing mission list.
