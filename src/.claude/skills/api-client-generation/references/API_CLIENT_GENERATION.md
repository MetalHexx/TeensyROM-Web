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
