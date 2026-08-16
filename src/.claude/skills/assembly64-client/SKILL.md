---
name: assembly64-client
description: 'Assembly64 API and its generated TypeScript client for TeensyROM. Use when querying, browsing, or downloading Commodore 64 scene content (SIDs, CRTs, PRGs, disk images) from Assembly64, working with libs/data-access/asm-64-client, constructing AQL search queries, distinguishing single-file vs multi-disk releases, or downloading binary files/zips from the API.'
---

# Assembly64 Client Skill

[Assembly64](https://hackerswithstyle.se/leet) is a community-run database and API cataloging Commodore 64 scene content — demos, cracktros/intros, games, and SID music — aggregated from archives like CSDB, HVSC, Gamebase64, and others. Content is organized as **releases** (a demo, game, or tune), each owning one or more **files** (disk images, cartridge dumps, `.prg`s, `.sid`s). A release can be a single file or a multi-disk "flip" set.

A generated TypeScript client lives at `libs/data-access/asm-64-client`, built the same way as the main `.NET` API client (OpenAPI Generator, `typescript-fetch`, `*Api` → `*ApiService`) — see the [api-client-generation](../api-client-generation/SKILL.md) skill for the regeneration workflow. **Status: exploratory only** — confirmed working against the live API, but not yet wired into infrastructure/domain layers.

## When to Use This Skill

- Calling the Assembly64 client (`SearchFacadeApiService`, `SearchAdvancedFacadeApiService`, `MetadataFacadeApiService`, etc.)
- Building an AQL search query (`repo:hvsc category:music`, `type:crt`, ...)
- Telling a single-file release apart from a multi-disk one
- Downloading a single file or a whole release as a zip
- Running one of the reference scripts in `scripts/`

## Quick Start

```ts
import { Configuration, SearchFacadeApiService } from '@teensyrom-nx/data-access/asm-64-client';

const configuration = new Configuration({
  headers: { 'client-id': process.env.ASM64_CLIENT_ID ?? 'swagger' },
});
const searchApi = new SearchFacadeApiService(configuration);

const results = await searchApi.aqlQuery2({ offset: 0, limit: 5, query: 'repo:hvsc category:music' });
```

No formal auth — `client-id` is an optional header identifying the calling app (this project's id lives in the `ASM64_CLIENT_ID` env var, set locally per developer, never committed). Every `*ApiService` method has a `*Raw` sibling returning the underlying `Response`; reach for it when you need headers or raw bytes instead of the parsed value (see the binary-download gotcha below).

## Reference Docs

- **[API_REFERENCE.md](references/API_REFERENCE.md)** — every endpoint by service class, the domain model (`ContentItem`, `ContentEntryV2`, ...), and the full AQL query vocabulary (`repo`/`category`/`subcat`/`type`/`rating`/`date`/`sort`/...).
- **[WORKFLOWS.md](references/WORKFLOWS.md)** — worked examples (search → list files → download), the single-file-vs-multi-disk check, the three download paths, and the Windows script-running workaround. Links to the runnable scripts in `scripts/`.

## Runnable Scripts

`scripts/01` through `06` are throwaway-but-verified examples (not production code) covering, in order: discovering the AQL vocabulary, running a search, the single-vs-multi-disk check, downloading one file, downloading a whole release as a zip, and a broader facet survey. Each was run against the live API while building this skill — see [WORKFLOWS.md](references/WORKFLOWS.md) for exact output and the run command.

## Critical Gotchas

1. **Binary downloads decode as text by default.** `getFile1`/`getFile`/`getFile2` are typed `Promise<string>` and call `response.text()` on non-JSON content — this corrupts binary bytes. Always call the `*Raw` variant and read `response.raw.arrayBuffer()` yourself. Pattern: [scripts/04-download-single-file.ts](scripts/04-download-single-file.ts).
2. **`npx ts-node` doesn't work** for scripts importing this client — the repo's `"type": "module"` forces strict ESM resolution, but the generated code uses extensionless imports. Compile to CommonJS with `tsc` first, then run with plain `node`. Exact command: [WORKFLOWS.md](references/WORKFLOWS.md#running-a-script-on-windows).
3. **Never edit generated code** in `src/lib/` — it's overwritten by `pnpm run generate:asm-64-client`.
4. **Go easy on the live API.** It's a real third-party service with no API key/quota system visible to us — prefer small `limit`s, sequential (not concurrent) calls, and a short pause between requests when sampling multiple items.
