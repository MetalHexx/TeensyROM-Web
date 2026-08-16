---
name: api-client-generation
description: 'API client generation and architecture for TeensyROM. Use when asked to regenerate the API client, update TypeScript HTTP clients, work with OpenAPI specs, understand API client architecture, or fix API-related import/type issues. Covers build-time client generation workflow, infrastructure layer consumption rules, and *ApiService naming conventions.'
---

# API Client Generation Skill

TypeScript HTTP client generation from the .NET backend API using OpenAPI Generator.

## When to Use This Skill

- Regenerating TypeScript API clients after backend changes
- Understanding API client architecture and consumption rules
- Fixing API client import errors or type mismatches
- Working with `*ApiService` classes in infrastructure layer

## Architecture Overview

**Location**:
- `libs/data-access/api-client` - generated TypeScript fetch client for the .NET backend
- `libs/data-access/asm-64-client` - generated TypeScript fetch client for the third-party Assembly64 API (exploratory; not yet wired to the application)

Both are generated the same way (OpenAPI Generator, `typescript-fetch`, `*Api` classes renamed to `*ApiService`), but from different generation scripts:

| | `api-client` | `asm-64-client` |
|---|---|---|
| Spec source | Local build artifact (`apps/api/.../TeensyRom.Api.json`) | Fetched live from `https://hackerswithstyle.se/leet/v3/api-docs` at generation time |
| Trigger | `pnpm run generate:api-client` | `pnpm run generate:asm-64-client` |
| Script | `scripts/generate-client.js` | `scripts/generate-asm64-client.js` (standalone sibling, not a shared/refactored script — the async network fetch and error handling differ enough to keep the two scripts independent) |
| Notes | Prerequisite: `dotnet build` | No prerequisite, but fails loudly if the external server is unreachable. Never vendor/commit the spec. |

**Security note**: several Assembly64 endpoints embed credentials directly in the URL path (e.g. `GET /user/login/{email}/{password}`) — this is a characteristic of the third-party API, not something to fix here, but a reason infrastructure code must never log full request URLs once this client is wired up.

**Consumption Rules** (enforced by ESLint):
- API clients are consumed **ONLY** by the infrastructure layer
- Infrastructure services map API DTOs to domain models
- Features/Application layers use domain contracts, never API clients directly

```
┌─────────────────────────────────────────────────────────┐
│  Features / Application                                 │
│  ├── Uses: Domain contracts (IDeviceService)            │
│  └── Does NOT import: *ApiService                       │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  Infrastructure                                         │
│  ├── Imports: DevicesApiService (generated)             │
│  ├── Implements: IDeviceService (domain contract)       │
│  └── Maps: API DTOs → Domain models                     │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  libs/data-access/api-client (generated)                │
│  └── DevicesApiService, FilesApiService, etc.           │
└─────────────────────────────────────────────────────────┘
```

## Generation Workflow

See [references/API_CLIENT_GENERATION.md](references/API_CLIENT_GENERATION.md) for detailed steps.

**Quick Reference**:

```bash
# 1. Build backend (generates OpenAPI spec)
dotnet build src/apps/api/src/TeensyRom.Api/TeensyRom.Api.csproj

# 2. Generate TypeScript client (from src/ directory)
pnpm run generate:api-client
```

## Critical Rules

1. **Never edit generated code** - Files in `libs/data-access/api-client/src/lib/` are overwritten on regeneration
2. **Never import API clients outside infrastructure** - ESLint enforces this boundary
3. **Always use domain contracts** - Inject `DEVICE_SERVICE`, not `DevicesApiService`
4. **Map API types to domain** - Infrastructure mappers convert DTOs ↔ domain models

## Scripts

- [scripts/generate-client.js](scripts/generate-client.js) - Post-processes generated code, renames `*Api` to `*ApiService`
- [scripts/generate-asm64-client.js](scripts/generate-asm64-client.js) - Same post-processing, plus a live fetch of the Assembly64 OpenAPI spec to a temp file before generation

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Type mismatch after API change | Regenerate: `pnpm run generate:api-client` |
| Missing API method | Ensure backend is built first: `dotnet build` |
| ESLint boundary violation | Move API client usage to infrastructure layer |
| `*Api` vs `*ApiService` confusion | Script auto-renames; always use `*ApiService` |
