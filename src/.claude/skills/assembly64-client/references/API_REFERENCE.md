# Assembly64 API Reference

Endpoint-by-endpoint reference for the generated client at `libs/data-access/asm-64-client`. For setup, worked examples, and gotchas, see [SKILL.md](../SKILL.md) and [WORKFLOWS.md](WORKFLOWS.md).

## Domain Model

| Type | Shape | Meaning |
|---|---|---|
| `ContentItem` | `name, id, category, siteCategory, siteRating, group, handle, year, country, event, rating, updated, released, place, compo` | A **release** — a search result. `id` + `category` (the subcat id) together key everything else. |
| `ContentEntryContainerV2` | `{ contentEntry: ContentEntryV2[] }` | The list of physical files that make up a release. |
| `ContentEntryV2` | `path, id, size, date` | One physical file. Its `id` is the per-release `fileId` used by `getFile1`. |
| `Metadata` | `name, group, handle, releaseDate, event, eventType, rating, place, url, images, siteImage` | Extended info — only populated for releases actually submitted to a tracked demoscene event. Casual uploads (e.g. most HVSC tunes) only have `name`/`group`/`handle`. |
| `CompoType` | `id, name` | Static reference table of demoscene competition categories (`C64 DEMO`, `C64 GAME`, `C64 4K INTRO`, `C64 2SID`, ...). What a release's `compo` field points to — distinct from the `type` file-format facet. |
| `CategoryMapping` | `id, name, type, description, groupingName` | One row from `getCategories()` — a "subcat" (e.g. id 18 = `hvscmusic`, "HVSC Music", grouped under "Music"). |
| `Preset` | `type, description, values[]` | One AQL facet's valid values, from `presets()`. See *AQL Query Vocabulary* below. |
| `FlipInfoEntry` | `diskName, length, id, category, name, group, event, year` | One disk-swap record from `getAllFlipEntries()` — tracks known multi-disk "flip" releases. |

**Single-file vs. multi-disk**: fetch `getContentEntry1({itemId, categoryId})` and check `contentEntry.length`. `1` = single file/disk; `>1` = multi-disk or a "flip" release. Verified against a real pair: an HVSC tune (`4294718104`/`20`) returned 1 entry, while a known flip-tracked demo, "Uncensored" (`133934`/`1`), returned 4 (two disks under two different filename variants). See [scripts/03-content-entries.ts](../scripts/03-content-entries.ts).

## AQL Query Vocabulary

`aqlQuery`/`aqlQuery1`/`aqlQuery2` accept a free-text `query` string built from space-separated `key:value` pairs, e.g. `repo:hvsc category:music`, `type:crt category:games`, `category:intros`. The full set of valid keys/values is discoverable live via `presets()` — captured here as of 2026-08-16:

| Key | Example values |
|---|---|
| `repo` | `csdb`, `gamebase`, `oneload`, `utape`, `c64com`, `tapes`, `guybrush`, `seuck`, `mayhem`, `pres`, `hvsc`, `c64orgintro` |
| `category` | `demos`, `games`, `intros`, `c128`, `bbs`, `charts`, `mags`, `easyflash`, `graphics`, `misc`, `music`, `reu`, `tools` |
| `subcat` | 29 specific subcategory ids, e.g. `hvscmusic` (id 18), `gamebase` (id 16), `games` (id 0, CSDB) — full list via `getCategories()` |
| `type` | `bin`, `crt`, `d64`, `d71`, `d81`, `g64`, `prg`, `sid`, `t64`, `tap` — genuinely filters by the file format inside `contentEntry`, confirmed empirically |
| `rating` | `>=1` through `>=10` |
| `date` | `1980`–`2026` (a specific year) |
| `latest` | `1days`, `2days`, `4days`, `1week`, `2weeks`, `3weeks`, `1month`, `2months`, `3months`, `6months`, `1year`, `2years` |
| `sort` | `name`, `group`, `handle`, `event`, `year`, `rating` |
| `order` | `asc`, `desc` |

`category` and `subcat` overlap in purpose: `category` matches a subcat's `groupingName` (broad bucket), `subcat` targets one specific subcategory by its `aqlKey`/id.

## Service Classes

### `SearchFacadeApiService` — primary search & single-file download

| Method | Path | Returns | Notes |
|---|---|---|---|
| `aqlQuery({query?})` | `GET /search/aql` | `ContentItem[]` | No pagination. |
| `aqlQuery1({offset, query?})` | `GET /search/aql/{offset}` | `ContentItem[]` | Offset only. |
| `aqlQuery2({offset, limit, query?})` | `GET /search/aql/{offset}/{limit}` | `ContentItem[]` | Preferred — full pagination control. |
| `getCategories()` | `GET /search/categories` | `CategoryMapping[]` | All subcats with id/type/description/groupingName. |
| `getContentEntry1({itemId, categoryId})` | `GET /search/entries/{itemId}/{categoryId}` | `ContentEntryContainerV2` | The file list for a release. |
| `getFile1({itemId, categoryId, fileId})` | `GET /search/bin/{itemId}/{categoryId}/{fileId}` | binary | Download one file. **Use `getFile1Raw` + `arrayBuffer()`** — see gotcha in [SKILL.md](../SKILL.md). |
| `presets()` | `GET /search/aql/presets` | `Preset[]` | The AQL vocabulary, live. |

### `SearchAdvancedFacadeApiService` — lookups, whole-release zip, alt single-file download

| Method | Path | Returns | Notes |
|---|---|---|---|
| `fileExist({itemId, categoryId, fileId})` | `GET /search/{itemId}/{categoryId}/{fileId}/exist` | `string` | |
| `fileExistAsDirectContent({itemId, categoryId})` | `GET /search/{itemId}/{categoryId}/exist` | `string` | |
| `getCompoTypes()` | `GET /search/compotypes` | `CompoType[]` | Static reference table. |
| `getContentEntry({itemId, categoryId, fileId})` | `GET /search/entry/{itemId}/{categoryId}/{fileId}` | `ContentEntryV2` | One entry, vs. `getContentEntry1`'s full container. |
| `getFile({itemId, categoryId})` | `GET /search/zip/{itemId}/{categoryId}` | binary (zip) | Downloads the **whole release** as a zip — no `fileId`. Same `Raw` + `arrayBuffer()` gotcha applies. Verified against a real intro: valid `PK\x03\x04` zip signature. |
| `getFile2({itemEntryId})` | `GET /search/bin/{itemEntryId}` | binary | Alt single-file download by a flat numeric id. **Not yet empirically verified** in this pass — unclear if `itemEntryId` is the same id space as `ContentEntryV2.id` or a separate global id; confirm before relying on it. |
| `getGroupsByName({groupname, category})` | `GET /search/groups/{groupname}/{category}` | `string[]` | |
| `getGroupsByNameAndYear({groupname, category, year})` | `GET /search/groups/{groupname}/{category}/{year}` | `string[]` | |
| `getGroupsByRelease({release, category})` | `GET /search/releases/{release}/{category}` | `string[]` | |
| `getHandlesByName({handle, category})` | `GET /search/handles/{handle}/{category}` | `string[]` | |
| `getMetadataForItem({id, category})` | `GET /search/meta/{id}/{category}` | `ContentItem` | |
| `getReleaseGroupForRelease({release, category})` | `GET /search/releasegroup/{release}/{category}` | `ContentItem[]` | |

### `MetadataFacadeApiService` — extended metadata & flip (multi-disk) info

| Method | Path | Returns | Notes |
|---|---|---|---|
| `getMetadata({id, category})` | `GET /metadata/{id}/{category}` | `Metadata` | Sparse unless the release was submitted to a tracked event. |
| `getAllFlipEntries()` | `GET /metadata/flipinfo` | `FlipInfoEntry[]` | All known multi-disk flip records. |
| `createFlipInfo({id, category, flipInfoEntry})` | `PUT /metadata/flipinfo/{id}/{category}` | `void` | Write endpoint — not explored. |
| `deleteFlipInfo({id, category})` | `DELETE /metadata/flipinfo/{id}/{category}` | `void` | Write endpoint — not explored. |

### `ContentCollectionsFacadeApiService` — user playlists/collections (needs a logged-in user)

Full CRUD on user-owned collections: `createCollection`, `alterCollection`, `copyCollection`, `deleteCollection`, `getCollections`, `getPublicCollections`, `getCollection`, `getCollectionData`, `getCollectionInfo`, `getCollectionItemIds`, `getCollectionNamesForItemId`, `getChecksums`, `addContentToCollection`, `addContentListToCollection`, `deleteContentFromCollection`, `deleteContentListToCollection`, `changeOrder`, `moveSong`, `subscribeToCollection`, `unsubscribeToCollection`. Not explored — irrelevant to anonymous browse/download flows.

### `UserFacadeApiService` — accounts

`login`, `loginLite`, `tokenLogin`, `logout`, `register`, `forgotpwd`, `validate`, `validatePassword`, `getSettings`, `storeSettings`, `getAvatar`, `getAvatarImageName`, `uploadAvatar`, `storeAlias`, `getAliasForPublicPlayslists`, `getUsersOnline`, `heroes`, `backers`, `feedback`, `listUsers`, `userSystemNotification`. Not explored. Note: some endpoints embed credentials in the URL path (e.g. login-by-path-param patterns) — a characteristic of the third-party API; avoid logging full request URLs if this ever gets wired up.
