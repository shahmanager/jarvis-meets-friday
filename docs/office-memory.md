# Office memory

Durable Object records are the authoritative office memory. Owners can save, search, and forget approved memories. The optional AgentMemory service adds BM25 retrieval; it is an index, not the canonical store.

Install and launch from the repository root:

```powershell
npm run memory:install
npm run memory:start
```

The `memory/` package pins `@agentmemory/agentmemory` 0.9.30 from [rohitg00/agentmemory](https://github.com/rohitg00/agentmemory), commit `45b556e56497c04129e193be744a4d312eb05281`, and overrides `@iii-dev/helpers` to 0.24.1. The launcher fetches the official iii v0.22.1 x64 Windows/Linux release and validates its fixed SHA-256 before extraction. The service binds only to `127.0.0.1:3111` and the engine to `127.0.0.1:49134`. It writes its URL and random bearer secret to ignored `.dev.vars`; keep that file private. Restart an already-running local Wrangler process after changing these bindings.

Recall is keyless BM25. Embedding providers, semantic recall, graph extraction, consolidation, telemetry, and Agent SDK access are disabled. No model inference key is passed to this service. It stores source IDs with text needed for retrieval. On recall, the Worker resolves hits to current Durable Object records and returns only records still present. This prevents an old index hit from restoring forgotten content. Forgetting removes the corresponding remote entry; queued updates use a version marker and retry after temporary errors.

If the service is unavailable, the app can use its built-in keyword recall. Remote index data is still a separate copy and should be treated as sensitive. `memory/data/` contains the local database and logs; protect or delete it when appropriate. Remember/search/forget and memory recall after a service restart were verified against the actual runtime, including startup with the pinned `@iii-dev/helpers` override. There are 32 component checks (15 TypeScript, 9 executor, and 8 companion). Production hosting is not configured: a remote Worker cannot reach a loopback-only service. For production, host AgentMemory on a private VM/home server and expose it to the Worker over authenticated HTTPS, such as through an Access-protected tunnel or reverse proxy. This deployment remains to be configured and tested.

Package and engine notices: [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).
