# tr-web API client

The CLI talks to the tr-web engine through a client generated from the engine's own OpenAPI spec, which lives in this repository.

| File | What it is |
|------|------------|
| `nswag.json` | Generator settings. Its input is the engine's spec, `src/apps/api/src/TeensyRom.Api/api-spec/TeensyRom.Api.json`, which every engine build rewrites. |
| `Generated/TeensyRomApiClient.g.cs` | Generated, committed. Never hand-edited. |
| `TeensyRomApiClient.Json.cs` | Hand-written half of the client: enums as strings, response bodies kept for error messages. |
| `EngineAddress.cs` | Where the CLI finds the engine. |

## When the engine's API changes

From `src/` (the Nx workspace), run `pnpm run generate:cli-api-client`, or `pwsh apps/cli/scripts/generate-api-client.ps1` from anywhere. It builds the engine to refresh the spec, restores the pinned NSwag tool and regenerates the client. It needs the .NET SDK only; no Java or Node.

1. On Windows, stop a running engine first (`pwsh apps/cli/scripts/test-api.ps1 stop`): it locks the files the build writes.
2. Run the script and commit the regenerated client with the engine change.
3. Regenerate the web client alongside it; see `src/AGENTS.md`.
4. Check that `LaunchOutcome.NoFilesFoundMessage` still equals the sentence tr-web's LaunchRandom endpoint sends when it finds no file; the CLI matches it by exact text.
5. Build and test.

Never hand-edit `Generated/`; change `nswag.json` or the hand-written partial instead and regenerate.
