# Third-party notices

## `@agentmemory/agentmemory` 0.9.30

The optional memory service installs this package under `memory/node_modules` from the pinned npm dependency. Its package declares Apache License 2.0. Source and license: [rohitg00/agentmemory](https://github.com/rohitg00/agentmemory). The upstream release used here is pinned as commit `45b556e56497c04129e193be744a4d312eb05281`; the Apache 2.0 license text is included in `licenses/agentmemory-APACHE-2.0.txt`.

## `iii` engine 0.22.1

`memory/start.mjs` downloads the x64 Windows or Linux archive from the official [iii v0.22.1 release](https://github.com/iii-hq/iii/releases/tag/iii/v0.22.1) and checks its SHA-256 before extraction. The engine is not committed or bundled. The engine is licensed under Elastic License 2.0; its license copy is in `licenses/iii-engine-ELv2.txt`. Review its restrictions before redistributing or offering the engine as a hosted service. Its source is not part of the application package.

## `@iii-dev/helpers` 0.24.1

The memory package pins this transitive dependency through npm `overrides` to resolve the audited dependency issue. It is installed under `memory/node_modules`; consult the package's distributed license and notice files there for its exact terms.

## Dashboard character art

The dashboard includes character sprite assets from Claw Empire at commit `66a24ea7df2435ef897c48c147deb7ec572c01c2`, licensed Apache License 2.0. The license copy is in `licenses/claw-empire-APACHE-2.0.txt`.

Other dependencies remain governed by their respective package licenses. See their package metadata and distributed license files.
