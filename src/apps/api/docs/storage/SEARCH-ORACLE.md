# Search Oracle

Nine terms drawn from a real collection, each pinning a distinct way a search predicate can go right or
wrong, asserted against `SqliteIndexStore.SearchAsync` — the new store's FTS5-backed search — rather than
the current in-memory `BaseStorageCache.Search`. That current predicate is what this oracle replaces as a
reference: it is a case-insensitive `Contains` over `Title`, `Name`, `Creator`, `Path.Value`, and
`Description` on every live `LaunchableItem`, and it cannot itself serve as ground truth because its
`Description` falls back to generated boilerplate the moment a file has no real metadata — which, on the
collection below, makes one ordinary word match 41,285 files. This document is what the next iteration
reads before changing search; each row explains what its case pins and why, not just what its term is.

## The collection these terms came from

| | |
|---|---|
| Device | `L5ZMCNBR`, SD |
| Files | 64,658 (64,081 distinct content identities, 1,979 directories) |
| Metadata | HVSC export `SIDlist_82_UTF8.csv` — 59,221 identities got a real creator, 17,992 got real STIL commentary |
| Seeded through | `IndexFixtureSeeder` → `SqliteIndexStore` → `MetadataProjection` → `FtsQuery`, the production path |

Every count in this document and in `search-oracle.json` was produced by a live run over that collection.
None is estimated. The counts belong to that card *and* that HVSC export, so `search-oracle.json` names
both under `collection`, and `SearchOracleTests` skips — rather than fails — on a machine whose fixture or
HVSC export is a different one.

The inputs themselves are not committed: the fixture is a listing of a personal collection and the HVSC
export is a 20 MB third-party database. What is committed is the oracle they produced.

### Reproducing or re-curating on another card

1. Extract a fixture from the device's own index file using the fixture seeder or a prior copy of the
   `TeensyRom.Tools.IndexExtractor` tool (which has been removed from the repository; restore it from git
   history if needed). The fixture should be written to `src/apps/api/.local-fixtures/Sd-<device>.tsv`.
2. Point `TEENSYROM_DATA_DIR` at the data directory holding both `Assets/System/Cache/` (the index file the
   equivalence suite compares against) and `Assets/Music/SidList/` (the HVSC CSV the projection enriches from).
3. Run `SearchOracleTests`. It will skip, naming this card and export as not the ones the oracle describes.
4. Replace `collection` and re-measure each case's counts against the new card, then update `cases`.

Step 3's skip is the whole point of the `collection` block: exact counts drawn from one card say nothing
about another, so the suite refuses to pretend otherwise. Seeding and projecting 64,658 files takes about
47 minutes, so this is a deliberate, occasional act, not something a normal test run pays.

## Cases

| Term | Results | Mechanism |
|---|---|---|
| `Mroczkowski` | 239 | Creator that lives only in projected metadata: the composer's real name, where every path uses his handle (`/MUSICIANS/S/Surgeon/`). The word appears in no filename, path, or description |
| `Abyssonaut` | 2 | Word from a filename, via `file_search.name` — and it finds both a `.crt` and a `.sid`, so the match is not a file-type accident |
| `MultiLoad64` | 149 | Word from a directory segment that appears in no filename at all: every hit is `file_search.path`, and 149 is exactly the file count of `/games/MultiLoad64/` |
| `Korg` | 2 | Word from genuine per-file STIL commentary (two JCH worktunes describing the synth they sampled), present in no name, path, or creator |
| `Hubbard Commando` | 45 | Multi-word term whose parts live in different tables — `Hubbard` in `content_search`, `Commando` in `file_search` — so both tokens must land on the same row for FTS5's implicit AND to succeed |
| `demoscene` | 9 | Word from the generated type-description boilerplate. **The case that proves the change** — see below |
| `10th Frame` | 1 | The file and its favourite are the only two copies; the favourites tree is excluded from every scoped read, so the original comes back and the copy does not |
| `Blorpazoid` | 0 | Term matching nothing: no results, no throw |
| `Hubbard-"*` | 492 | Term full of FTS5 operator characters (`"`, `-`, `*`) that must be handled, not throw. `FtsQuery` quotes the whole token, so FTS5 reads it as a phrase and the `unicode61` tokenizer strips the punctuation out of it — leaving a prefix match on `hubbard` and the same 492 results the bare term returns |

## The boilerplate case, in detail

`SongItem.Description` falls back to a fixed, multi-hundred-word paragraph about the SID format whenever a
song has no real description — a paragraph containing the word "demoscene". Today's predicate reads
`Description` off the live entity, so it matches every song that has no real description.

Measured live against this collection, both sides in the same run
(`SearchOracleTests.Search_ForTheBoilerplateTerm_AnswersOrdersOfMagnitudeSmallerThanTodaysPredicate`):

- **Today's predicate** (`SimpleStorageCache` over the device's real index file): **41,285 of 64,658 files** —
  roughly two thirds of the card, for a word that describes none of them.
- **The new store**: **9** — the files whose STIL commentary genuinely says "demoscene".

`MetadataProjection` builds one enriched and one unenriched instance of each identity's type and persists a
field only when enrichment actually changed it (`DerivedValueProbe.IsDerived`). When nothing changed, the
fallback is recognised as the type's own generated text and written as empty rather than carried into the
search index, so the boilerplate is never there to match.

## Why there is no "title" case

`content_search.title` is empty for all 64,081 identities on this card, and that is correct behaviour
today rather than a projection bug: `SongItem.Title` and `GameItem.Title` are computed from the filename
with no settable backing field (`Title => $"{Name[..Name.LastIndexOf('.')]}"`), so `ProbeOrNull` always
finds the enriched and unenriched instances agree and drops `Title` as derived — the behaviour
`MetadataProjectionTests.ProjectAsync_TitleAndMeta1_AreNeverPersisted_EvenWithGenuineMetadata` pins. HVSC
titles therefore reach neither `content_metadata` nor the search index, and a term drawn from one would be
asserting a behaviour the system does not have. When an enrichment source can set a title independently of
the filename, that is the moment to add the case.

## Reading the bounds

`minResults`/`maxResults` bound the result count; `expectedPaths` are files that must appear;
`mustNotMatch` are files that must not. Every case here has an exact count (`minResults == maxResults`)
because the collection is pinned by the `collection` block — a re-curation should keep that discipline and
widen a band only where the count is genuinely unstable.
