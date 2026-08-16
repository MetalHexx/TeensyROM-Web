# API Client Generation

Simple steps to regenerate the TypeScript HTTP client from the .NET API.

## Prerequisites

- .NET 9 API configured for build-time OpenAPI generation
- Node.js and OpenAPI Generator CLI installed
- pnpm package manager

## Steps

### 1. Build the API Project

From the repository root or any directory:

```bash
dotnet build src/apps/api/src/TeensyRom.Api/TeensyRom.Api.csproj
```

This generates the OpenAPI specification file during the build process.

### 2. Generate the HTTP Client

From the `src` directory:

```bash
pnpm run generate:api-client
```

This runs the generation script at `../scripts/generate-client.js` (relative to this file).

## What the Script Does

1. **Cleans** the output directory (`libs/data-access/api-client/src/lib/`)
2. **Generates** TypeScript fetch client using OpenAPI Generator
3. **Renames** classes from `*Api` to `*ApiService` (e.g., `DevicesApi` → `DevicesApiService`)
4. **Patches** barrel exports to use new naming convention

## Output Location

- Generated models: `libs/data-access/api-client/src/lib/models/`
- Generated services: `libs/data-access/api-client/src/lib/apis/`

## Notes

- The OpenAPI spec is generated to `apps/api/src/TeensyRom.Api/api-spec/TeensyRom.Api.json` during build
- Build-time generation requires no running server
- Never edit generated files - they are overwritten on regeneration
- Generated services use `*ApiService` naming convention for clarity

## Architecture Context

The generated API client is consumed **only** by the infrastructure layer:

```
Features/Application → Domain Contracts → Infrastructure → API Client
```

See [../SKILL.md](../SKILL.md) for architecture details and consumption rules.

## Assembly64 Client (Third-Party, Live Spec)

`libs/data-access/asm-64-client` is generated the same way, but from a third-party API
(`hackerswithstyle.se/leet`), not the .NET backend. Currently exploratory only — not wired
to the application.

### Generate

From the `src` directory, single step (no `dotnet build` prerequisite):

```bash
pnpm run generate:asm-64-client
```

This runs `../scripts/generate-asm64-client.js` (relative to this file), which:

1. **Fetches** the live OpenAPI spec from `https://hackerswithstyle.se/leet/v3/api-docs` to a temp file (`os.tmpdir()` — never committed to the repo)
2. **Cleans** the output directory (`libs/data-access/asm-64-client/src/lib/`)
3. **Generates** the TypeScript fetch client using OpenAPI Generator
4. **Renames** classes from `*Api` to `*ApiService`, same as the primary client
5. **Patches** barrel exports, same as the primary client
6. **Deletes** the temp spec file

Because generation depends on live network access to an external, unauthenticated server,
it fails loudly (a clear thrown error) rather than silently producing a stale client if the
server is unreachable, slow (>15s), or returns something unexpected.

### Output Location

- Generated models: `libs/data-access/asm-64-client/src/lib/models/`
- Generated services: `libs/data-access/asm-64-client/src/lib/apis/`

### `client-id` header

Assembly64 has no formal auth scheme — it identifies calling applications via an optional
`client-id` header (defaults to `"swagger"` if omitted). This app's registered id must never
be committed to source control; it is supplied via the `ASM64_CLIENT_ID` environment
variable, set locally by the developer, and read at runtime:

```ts
new Configuration({ headers: { 'client-id': process.env.ASM64_CLIENT_ID ?? 'swagger' } })
```

A throwaway exploration script at `libs/data-access/asm-64-client/explore/explore.ts`
demonstrates this wiring against a couple of read-only endpoints — see the comment header
in that file for how to run it (plain `npx ts-node` does not work in this repo; see the
comment for why and the working alternative).
