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

## Self-hosted typefaces

Space Grotesk and Pixelify Sans are distributed from the [Google Fonts repository](https://github.com/google/fonts) under SIL Open Font License 1.1. Their license notices are included beside the font files in `public/fonts/SpaceGrotesk-OFL.txt` and `public/fonts/PixelifySans-OFL.txt`.

Bricolage Grotesque (The Bricolage Grotesque Project Authors) and JetBrains Mono (The JetBrains Mono Project Authors) are self-hosted as WOFF2 files taken from the Fontsource 5.3.0 packages, under SIL Open Font License 1.1. License notices: `public/fonts/BricolageGrotesque-OFL.txt` and `public/fonts/JetBrainsMono-OFL.txt`.

## `pdf-lib` 1.17.1

PDF generation uses [pdf-lib](https://github.com/Hopding/pdf-lib), licensed MIT. License text is included in `licenses/pdf-lib-MIT.txt`.

## `@openai/codex` 0.142.5

The optional cloud harness Dockerfile installs the official [OpenAI Codex](https://github.com/openai/codex) CLI under Apache License 2.0. CLI source/binaries are not vendored in this repository. Preserve the package's distributed license and notices when distributing the container. Model access and API terms are separate from the open-source harness license.
