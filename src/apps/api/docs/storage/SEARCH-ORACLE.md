<!--
Data provenance: the real 270,972-file collection this oracle was meant to be drawn from (the
Sd-*.json/Usb-*.json index file plus its matching .tsv fixture, per STORAGE-1-TASK-P01-T02) is not
present on the machine that curated this file, the same gap P01-T01, P01-T02, and P04-T01 already
recorded. Every case below is instead curated against a small, self-contained synthetic collection —
6 named files plus 50 filler files, 56 total — seeded by
TeensyRom.Core.Storage.Tests.Integration.SearchOracleTests through the real production write,
projection, and search paths (SqliteIndexStore, MetadataProjection, FtsQuery), with a controlled HVSC
stub standing in for the real metadata databases. Every count recorded here was produced by an actual
`dotnet test` run against that dataset, not estimated. Re-curate this file against the real collection,
with genuine HVSC/DeepSID data, the first time both are available on a machine — and at that point point
SearchOracleTests at SeededCollectionFixture instead, per the design this task was handed.
-->

# Search Oracle

Nine terms, each pinning a distinct way a search predicate can go right or wrong, asserted against
`SqliteIndexStore.SearchAsync` — the new store's real FTS5-backed search — rather than the current
in-memory `BaseStorageCache.Search`. That current predicate is what this oracle replaces as a reference:
it is a case-insensitive `Contains` over `Title`, `Name`, `Creator`, `Path.Value`, and `Description` on
every live `LaunchableItem`, and it cannot itself serve as ground truth because its `Description` field
falls back to tens of thousands of words of generated boilerplate the moment a file has no real metadata
(see the boilerplate case below). This document is what the next iteration reads before changing search;
each row explains what its case pins and why, not just what its term is.

## The synthetic dataset

| Path | Type | What makes it distinct |
|---|---|---|
| `/music/mob/theme1.sid` | Song | HVSC record sets `Creator = "Rob Hubbard"`, no commentary |
| `/music/mob/opus7.sid` | Song | `content_search.title` set directly to `"Stardust Reverie"` (see the title-only case) |
| `/music/mob/zorbatron.sid` | Song | No enrichment; distinctive filename only |
| `/music/mob/twilight.sid` | Song | HVSC record's `StilEntry` is genuine commentary mentioning "Frostbyte" |
| `/games/GALAXIANS/blaster.prg` | Game | No enrichment; distinctive directory segment, ordinary filename |
| `/games/NEBULA/quantum.prg` | Game | No enrichment; distinctive filename *and* distinctive directory segment |
| `/music/filler/track001.sid` … `track050.sid` (50 files) | Song | No enrichment at all — plain boilerplate carriers |

Every file without an HVSC record falls back to `SongItem`/`GameItem`'s own generated description —
the exact mechanism the boilerplate case pins.

## Cases

| Term | Intent | Mechanism |
|---|---|---|
| `Hubbard` | Creator name that lives only in projected metadata | Matches `content_search.creator` for `theme1.sid` only; the word appears in no filename or path |
| `Stardust` | Title that lives only in projected metadata | Matches `content_search.title` for `opus7.sid`. **Deviation**: `MetadataProjection` never actually persists a title differently from the filename today — see "Why the title case is written directly", below |
| `Zorbatron` | Word from a filename | Matches `file_search.name` |
| `Galaxians` | Word from a path segment, absent from every filename | Matches `file_search.path` only |
| `Quantum Nebula` | Multi-word term whose parts live in different `file_search` columns | `Quantum` matches the filename, `Nebula` matches only the enclosing directory; both tokens must match the same row for FTS5's implicit AND to succeed |
| `Frostbyte` | Word from genuine per-file commentary | Matches `content_search.description` for `twilight.sid`, whose STIL-style entry differs from the type's generated fallback and is therefore persisted, not dropped |
| `demoscene` | Word from the generated type-description boilerplate | **The case that proves the change** — see below |
| `Blorpazoid` | Term matching nothing | Zero results, no throw |
| `Hubbard-"*` | Term containing FTS5 operator characters (`"`, `-`, `*`) | Must not throw. `FtsQuery` quotes the whole token, so FTS5 treats it as a phrase; the `unicode61` tokenizer strips the punctuation from that phrase before matching, leaving a prefix match on `hubbard` — so this one **still finds** `theme1.sid`, demonstrating that the operator characters are neutralised rather than crashing the query or being read as FTS5 syntax |

## The boilerplate case, in detail

`SongItem.Description` falls back to a fixed, multi-hundred-word paragraph about the SID format
whenever a song has no real description — a paragraph that contains the word "demoscene". Today's
predicate (`BaseStorageCache.Search`) reads `Description` off the live entity, so it matches every song
that has no real description, regardless of how many that is.

Run live against this task's synthetic dataset (`SearchOracleTests.TodaysPredicate_ForTheBoilerplateTerm_MatchesEveryFileWhoseDescriptionWasNeverOverridden`):

- **Today's predicate**: matches **53 of the dataset's 56 seeded files** — every file except `twilight.sid`
  (real commentary overrides the boilerplate) and the two `.prg` files (`GameItem`'s boilerplate text
  doesn't contain "demoscene"). In other words: every ordinary, unenriched `.sid` file.
- **The new store**: matches **0**. `MetadataProjection` builds one enriched and one unenriched instance
  of each file's type and only persists a field into `content_metadata`/`content_search` when enrichment
  actually changed it (`DerivedValueProbe.IsDerived`); when nothing changed, the fallback is recognised as
  the type's own generated text and is written as empty rather than carried into the search index. The
  boilerplate is never there to match.

Against the real 270,972-file collection the same mechanism applies to every unenriched file of a given
type, which is what turns an ordinary boilerplate word into a match count in the tens of thousands today.
This dataset's 53-of-56 is the same failure mode at a scale small enough to seed in milliseconds and
verify exactly.

## Why the title case is written directly

`SearchOracle`'s "title that lives only in projected metadata" behaviour cannot be produced through
`MetadataProjection` as it stands: both `SongItem.Title` and `GameItem.Title` are computed directly from
the filename with no settable backing field (`Title => $"{Name[..Name.LastIndexOf('.')]}"`), so
`ProbeOrNull` always finds the enriched and unenriched instances agree and drops `Title` as derived —
confirmed by the existing unit test
`MetadataProjectionTests.ProjectAsync_TitleAndMeta1_AreNeverPersisted_EvenWithGenuineMetadata`. Since
`content_search.title` is real, load-bearing schema (used exactly like `creator` and `description`), the
fixture writes it directly for `opus7.sid` rather than dropping the case: it proves the search
mechanism's title-column behaviour, forward-compatible with a future enrichment source that can actually
set a title independent of the filename. It is not a claim about what today's production pipeline
currently produces.

## Reading the bounds

`minResults`/`maxResults` bound the result count; `expectedPaths` are files that must appear;
`mustNotMatch` are files that must not. Every positive case here has an exact, verified count
(`minResults == maxResults`) because the dataset is small and fully controlled — a real-collection
re-curation should keep the same discipline where the count is knowable, and use a wider band only where
collection churn makes an exact count unstable.
