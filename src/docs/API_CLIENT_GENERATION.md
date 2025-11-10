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

## Notes

- The OpenAPI spec is generated to `../api-spec/TeensyRom.Api.json` during build (relative to repo root)
- Client generation script is in `src/libs/data-access/api-client/scripts/generate-client.js`
- Generated services use `*ApiService` naming convention (e.g., `DevicesApiService`)
- Output location: `src/libs/data-access/api-client/src/lib/`
- Build-time generation requires no running server
- API projects are located in `src/apps/api/` as part of the NX workspace
