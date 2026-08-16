# Assembly64 Workflows

Worked, verified examples for the endpoints described in [API_REFERENCE.md](API_REFERENCE.md). Every call below was actually run against the live API while building this skill. Runnable versions live in [`../scripts/`](../scripts/).

## Setup

Set `ASM64_CLIENT_ID` in your shell environment (never commit it — it's this app's registered client id with Assembly64, distinct from any user login):

```
ASM64_CLIENT_ID=<your-registered-client-id>
```

If unset, the client falls back to the generic `'swagger'` client-id.

## Running a Script on Windows

`npx ts-node` does not work for scripts that import this generated client. This repo's root `package.json` sets `"type": "module"`, so `ts-node` runs under Node's strict ESM resolver, which requires explicit file extensions on relative imports — but the openapi-generator output (`runtime.ts`, `apis/*`, `models/*`) uses extensionless bundler-style imports, so ESM resolution fails deep inside generated code, not just in your script.

Workaround: compile the script's dependency graph to CommonJS with a one-off `tsc` invocation (CJS `require` resolves extensionless specifiers natively), then run the plain `.js` output with plain `node`:

```
npx tsc .claude/skills/assembly64-client/scripts/<script>.ts \
  --outDir /tmp/asm64-build --module commonjs --target es2020 \
  --moduleResolution node --esModuleInterop --skipLibCheck --rootDir .

ASM64_CLIENT_ID=<your-registered-client-id> node /tmp/asm64-build/.claude/skills/assembly64-client/scripts/<script>.js
```

Run both commands from the `src/` repo root. This affects any throwaway TS script that imports generated API client code in this repo, not just these scripts.

## Workflow 1 — Discover the AQL Vocabulary

```
Script: scripts/01-presets.ts
Call:   SearchFacadeApiService.presets()
```

Returns every valid AQL facet key and its legal values live from the server — this is how [API_REFERENCE.md](API_REFERENCE.md)'s vocabulary table was built. Run this instead of guessing a facet's valid values.

## Workflow 2 — Search

```
Script: scripts/02-search.ts
Call:   SearchFacadeApiService.aqlQuery2({ offset: 0, limit: 5, query: 'repo:hvsc category:music' })
```

Query syntax is space-separated `key:value` pairs. Confirmed working examples from this pass:

| Query | Result |
|---|---|
| `repo:hvsc category:music` | 5 HVSC tunes, `category: 20` (subcat `hvscdemos`, grouped under Music) |
| `type:crt category:games` | Recent CRT-format game releases; top hit had a real `.crt` file inside |
| `type:prg category:games` | Recent PRG-format game releases; top hit had a real `.prg` file inside |
| `category:intros` | C64.org-style cracktro intros — deliberately tiny |

`aqlQuery2` is the one to reach for by default — it's the only variant with both `offset` and `limit`, so you control result size instead of guessing at the unpaginated `aqlQuery`.

## Workflow 3 — Single-File vs. Multi-Disk Check

```
Script: scripts/03-content-entries.ts
Call:   SearchFacadeApiService.getContentEntry1({ itemId, categoryId })
```

A search hit (`ContentItem`) doesn't tell you file count directly — fetch its entry container and check the length:

- `Nice_Tune_07` (HVSC, itemId `4294718104`, categoryId `20`) → **1 entry**: `Nice_Tune_07.sid`, 11,346 bytes.
- `Uncensored` (CSDB demo, itemId `133934`, categoryId `1`, a known flip/multi-disk release) → **4 entries**: `boozedemo1.d64`, `boozedemo2.d64`, `Uncensored_1.d64`, `Uncensored_2.d64` (174,848 bytes each).

`contentEntry.length === 1` reliably identifies a single-file/single-disk release, regardless of category or repo.

## Workflow 4 — Download a Single File

```
Script: scripts/04-download-single-file.ts
Call:   SearchFacadeApiService.getFile1Raw({ itemId, categoryId, fileId })
```

Use the entry's own `id` (from Workflow 3's container) as `fileId`. Verified against `Nice_Tune_07.sid`:

- Status 200, `content-type: application/octet-stream`
- 11,346 bytes received — matches the entry's `size` field exactly
- First 4 bytes: `PSID` — the correct magic header for a PlaySID-format tune, confirming the download wasn't corrupted

### Binary Downloads: the `*Raw` + `arrayBuffer()` requirement

`getFile1`/`getFile`/`getFile2` are all typed `Promise<string>`. Internally, the generated code checks the response's content-type: if it's JSON, it parses as JSON; **otherwise it calls `response.text()`** — which decodes the byte stream as a string, corrupting anything that isn't valid UTF-8 text (i.e., every binary file this API serves, since binary responses come back as `application/octet-stream`, not JSON).

Fix: call the `*Raw` method (returns `runtime.ApiResponse<string>`, which exposes the original `Response` as `.raw` and hasn't consumed the body yet) and read the bytes yourself:

```ts
const response = await searchApi.getFile1Raw({ itemId, categoryId, fileId });
const buffer = Buffer.from(await response.raw.arrayBuffer());
```

This applies to all three binary-download methods — `getFile1` (single file), `getFile` (zip), `getFile2` (single file by flat id) — since they share the same generated `TextApiResponse` fallback.

## Workflow 5 — Download a Whole Release as a Zip

```
Script: scripts/05-download-zip.ts
Call:   SearchAdvancedFacadeApiService.getFileRaw({ itemId, categoryId })
```

No `fileId` — this bundles every file in the release into a zip server-side. Verified against a real intro, `"007"` (itemId `2375`, categoryId `11`): a 1,623-byte raw `.prg` came back as a 1,874-byte zip with a valid `50 4B 03 04` (`PK..`) signature. Same `*Raw` + `arrayBuffer()` requirement as Workflow 4.

## Workflow 6 — Facet Survey (Metadata, Compo Types)

```
Script: scripts/06-facets-survey.ts
```

Chains a `type:crt` search, a `type:prg` search, `MetadataFacadeApiService.getMetadata()`, and `SearchAdvancedFacadeApiService.getCompoTypes()` in one pass, with a short pause between calls. Key finding: `getMetadata` is mostly empty (`name`/`group`/`handle` only) for casual uploads — it only carries `releaseDate`/`event`/`rating`/`images` for releases actually submitted to a tracked demoscene event. Don't assume it's populated.

## Etiquette

There's no visible API-key or quota system on this third-party service. Be a good citizen: keep `limit`s small, run calls sequentially (not with `Promise.all`), and add a short pause (e.g. `sleep(400)`) between calls when sampling more than one item in a script, as `scripts/06-facets-survey.ts` does.
