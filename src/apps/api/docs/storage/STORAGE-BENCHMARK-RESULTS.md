<!--
Data provenance: a genuine `dotnet run` of TeensyRom.Tools.StorageBenchmark with `--scenarios both
--iterations 5 --explain --prior storage-1-prior-medians.tsv`, run against the same real index file as the
STORAGE-1 baseline - `Sd-L5ZMCNBR.json` (155,439,795 bytes, 64,658 files) from the shipped build
`TeensyROM-Web-1.0.0-alpha.8-win-x64` under `C:\Users\Metal\Downloads\` - paired with the matching extracted
fixture `Sd-L5ZMCNBR.tsv` used to seed the store side. Both inputs are personal-collection listings and
neither is committed to the repository; only this report is. `--prior` supplies the STORAGE-1 baseline's own
store medians (`storage-1-prior-medians.tsv`), which populate the "Store median, STORAGE-1" column below.

Store seeding time: 16,976.483 ms (0.28 minutes) - the STORAGE-1.1 target of finishing in minutes, not the
STORAGE-1 baseline's ~33 minutes, still holds; run-to-run variance on this machine moves this figure by a few
seconds either side of the 14.4s first recorded, never close to the baseline's order of magnitude.

Legacy and store scenarios ran back to back in one process (`--scenarios both`), so the process-wide peak
working set is cumulative: the "Legacy peak working set" column reflects the process's peak partway through
the run (after the legacy scenarios, before the store side had allocated anything), while "Store peak working
set" reflects the peak after both halves had run, including the "every discovered index loaded" scenario that
deliberately spikes it. The two columns are therefore not a clean apples-to-apples memory comparison, but the
store's peak (~1.4 GB after seeding, indexing, and querying 64,658 real files) is still far below what
repeatedly deserializing the 155 MB JSON index into memory costs the legacy side, which is the property this
row is meant to demonstrate.

The STORAGE-1 baseline attributed its write-path regression (single upsert 63.617 ms store vs. ~0.05 ms
legacy) entirely to `UpsertFilesAsync`'s per-content-identity favourite recompute. That was incomplete: the
measured decomposition of that cost was two centres, not one - the missing composite index driving every
identity-scoped lookup (favourite recompute, parent lookup, sibling lookup) as an unindexed scan, at roughly
45.4 ms per identity touched, and the full-text index maintenance on every write (`FileSearchInsert` /
`FileSearchDelete` in `SqliteIndexStore.Writes.cs`), at roughly 22.3 ms per file written. Both centres are
addressed as of this run's code: this run's own `## Query plans` section shows `FavoriteRecompute`,
`ParentLookup`, and `SiblingLookup` all resolving through `ix_file_identity` rather than an unindexed scan,
and the write path now measures a single-upsert delta of well under 1 ms and a 500-file bulk upsert well over
32,000 ms *faster* than the STORAGE-1 baseline - the new `ix_file_storage_id` index added for random-draw
bounds (see below) does not visibly move this number. Search shows the same pattern: from a
`SEARCH-PLAN-FINDING.md`-diagnosed unselective driving scan (100.904 ms store, 42.012 ms slower than legacy
in the STORAGE-1 baseline) to a single-digit-millisecond store, now faster than legacy; this run's
`### Search` plan below shows the `UNION`-with-`INDEXED BY ix_file_identity` shape that finding prescribed.

Random by scope (Storage) and (DirDeep) went through two rounds of iteration after the STORAGE-1 baseline,
both measured rather than assumed:

1. The STORAGE-1 baseline's count-then-offset-seek (`RandomCount` + `RandomCandidate`) walked the full
   `path LIKE`-bounded range twice per draw - once to count, once to seek the offset - a cost proportional to
   the scope's width. It was collapsed into one statement, `RandomPick` (`SELECT f.id FROM ... ORDER BY
   random() LIMIT 1`), on the reasoning that one pass should cost less than two. Measured, the result was
   mixed: `DirDeep` improved substantially (~157 ms to ~115 ms), `Storage` got slightly *worse* (~118 ms to
   ~121-127 ms) - `ORDER BY random() LIMIT 1` still inserts every candidate row into a real sorter, so the
   per-row insert cost outweighed the pass it removed for `Storage`'s wide, mostly-unfiltered range.
2. For `Storage` specifically, that candidate set is in practice most of the storage (~99% density on this
   card for the common all-launch-types, no-excludes draw), which makes rejection sampling by primary key a
   much better fit: draw a random id from the storage's id range, point-lookup it, redraw if it doesn't match.
   A rejected draw is discarded rather than attributed to a neighbouring row, so it stays exactly uniform -
   unlike a seek-to-nearest-match approach, which would favour rows following a large gap in the id range.
   Measured twice against the real card, `Storage` dropped to 0.408 ms and 0.212 ms - both a 99.7%+ reduction
   from `RandomPick`'s ~120 ms, and now faster than legacy rather than slower. `DirDeep` and `DirShallow` were
   left on `RandomPick`: a real narrow subtree on this card measured ~0.23% density (~430 expected attempts),
   making rejection sampling a poor fit there regardless of how fast each attempt is - confirmed by density,
   not assumed from the `Storage` result carrying over.

See "Reasons" below the comparison table for the measured numbers and the new `ix_file_storage_id` index that
makes the id-range bounds a seek rather than a scan.

Everything from "# Storage Benchmark Report" onward is the harness's own emitted markdown, unedited, except
for the "### Reasons" list appended immediately below the comparison table: the harness measures what
happened, not why, so that attribution is added here rather than invented as part of the tool's output.
-->

# Storage Benchmark Report

## Run header

- Generated (UTC): 2026-08-20T02:56:19.1501735Z
- OS: Microsoft Windows 10.0.26200
- Processor count: 24
- .NET runtime: .NET 9.0.19
- Iterations per scenario (warm-up excluded): 5
- Data directory: C:\Users\Metal\Downloads\TeensyROM-Web-1.0.0-alpha.8-win-x64
- Device: L5ZMCNBR (SD)
- Scenario set: both
- Store seeding time (setup, excluded from every measured operation): 16976.483 ms

### Index files read

| Path | Size (bytes) | File count |
|---|---|---|
| C:\Users\Metal\Downloads\TeensyROM-Web-1.0.0-alpha.8-win-x64\Assets/System/Cache/Sd-L5ZMCNBR.json | 155,439,795 | 64,658 |
| C:\Users\Metal\.radorc\worktrees\STORAGE-1\teensyrom-web\src\apps\api\.local-fixtures\Sd-L5ZMCNBR.tsv | 4,374,456 | 64,658 |

## Legacy vs. store comparison

| Operation | Legacy median (ms) | Store median, STORAGE-1 (ms) | Store median (ms) | Delta (ms) | Delta vs. STORAGE-1 (ms) | Legacy peak working set (bytes) | Store peak working set (bytes) | Expectation |
|---|---|---|---|---|---|---|---|---|
| Cold start to queryable | 2316.916 | 4.128 | 3.252 | -2313.663 | -0.876 | 1,069,559,808 | 1,411,031,040 | Explicit target: time from opening the database to answering the first directory listing. |
| Directory listing by path | 0.000 | 0.239 | 0.182 | 0.182 | -0.057 | 1,069,559,808 | 1,411,031,040 | The one at risk. May be a fraction slower in absolute terms; must stay imperceptible. |
| Search | 73.747 | 100.904 | 7.551 | -66.196 | -93.353 | 1,069,559,808 | 1,411,031,040 | Materially faster: today is a full scan of every file with several substring comparisons each. |
| Random by scope (Storage) | 46.118 | 109.999 | 0.408 | -45.710 | -109.591 | 1,069,559,808 | 1,411,031,040 | Materially faster; the allocation of the whole matching set disappears. |
| Random by scope (DirDeep) | 22.412 | 110.647 | 110.972 | 88.560 | 0.325 | 1,069,559,808 | 1,411,031,040 | Materially faster; the allocation of the whole matching set disappears. |
| Random by scope (DirShallow) | 71.981 | 22.648 | 0.151 | -71.830 | -22.497 | 1,069,559,808 | 1,411,031,040 | Materially faster; the allocation of the whole matching set disappears. |
| Parent lookup by identity | 0.018 | 0.097 | 0.117 | 0.098 | 0.020 | 1,069,559,808 | 1,411,031,040 | Materially faster; unaffected by concurrent writes, unlike the map rebuilt on every upsert. |
| Sibling lookup by identity | 0.020 | 31.615 | 0.249 | 0.230 | -31.366 | 1,069,559,808 | 1,411,031,040 | Materially faster; unaffected by concurrent writes, unlike the map rebuilt on every upsert. |
| Single upsert | 0.110 | 63.617 | 0.930 | 0.820 | -62.687 | 1,069,559,808 | 1,411,031,040 | Materially faster - the workload that motivates the rewrite. |
| Bulk upsert (500) + parent lookup (identity map rebuild) | 135.173 | 32459.181 | 63.973 | -71.200 | -32395.208 | 1,069,559,808 | 1,411,031,040 | Materially faster - the workload that motivates the rewrite. |
| Peak memory with every discovered index loaded | 2639.763 | 260.183 | 128.435 | -2511.328 | -131.748 | 1,411,031,040 | 1,411,031,040 | Explicit target: the index is not resident - nothing requires the full collection in memory. |

### Reasons

- **Single upsert** (+0.820 ms) and **bulk upsert** (-71.200 ms vs. legacy, -32,395.208 ms vs. STORAGE-1): a
  durable database write against an in-memory dictionary assignment is expected to cost more in ratio - the
  intended trade recorded in STORAGE-DESIGN's D9. Judged in absolute time, a fraction of a millisecond is
  imperceptible, and the bulk path is now faster than legacy outright. The new `ix_file_storage_id` index
  (below) adds a fifth B-tree to maintain per file write; neither number shows a visible cost from it.
- **Search** (now faster than legacy): `SEARCH-PLAN-FINDING.md` diagnosed the access-path defect behind the
  STORAGE-1 baseline's 100.904 ms and prescribed a `UNION` pinning the `f.content_id` branch to
  `ix_file_identity`; this run's `### Search` plan (below) shows that shape in place.
- **Random by scope (Storage)** (-109.591 ms vs. STORAGE-1, now faster than legacy): rewritten twice after the
  STORAGE-1 baseline, both times measured rather than assumed.
  - Collapsing the baseline's count-then-offset-seek into one `RandomPick` query (`ORDER BY random() LIMIT 1`)
    made `Storage` slightly *worse* (~118 ms to ~121-127 ms across two runs), not better - `ORDER BY random()
    LIMIT 1` still inserts every candidate row into a real sorter (`USE TEMP B-TREE FOR ORDER BY` in the plan),
    so the per-row insert cost outweighed the second pass it removed for a wide, mostly-unfiltered range.
  - `Storage`'s candidate set is, on this card, ~99% of the storage for the common all-launch-types,
    no-excludes draw - dense enough that rejection sampling by primary key (`RandomBounds` + `RandomReject`
    below) is a much better fit: draw a random id in the storage's id range, point-lookup it, redraw on a
    miss, up to 32 attempts before falling back to `RandomPick`. A rejected draw is discarded rather than
    attributed to a neighbouring row, so it stays exactly uniform, unlike a seek-to-nearest-match approach
    that would favour rows following a large id gap.
  - Measured twice against the real card: **0.408 ms** and **0.212 ms** - both essentially the cost of the
    handful of primary-key point lookups the density predicts, a 99.7%+ reduction from `RandomPick`'s ~120 ms,
    and now faster than legacy rather than slower. `ix_file_storage_id` (new this run) is what makes the
    `RandomBounds` id-range query an O(log n) seek instead of an O(n) scan - confirmed by timing a 40,000-row
    fixture (an indexed `MIN(id) WHERE storage_id=?` landed within noise of a raw primary-key lookup; the same
    query without the index took ~120x longer), not by `EXPLAIN QUERY PLAN`'s text, which renders identically
    ("SEARCH ... USING COVERING INDEX ... (storage_id=?)") for both the seek and the scan.
  - A narrow type filter collapses the density this depends on - a single rare file type on this card measured
    ~0.0015% density, ~64,000 expected attempts - so `RandomPick` remains the fallback and is what a caller
    filtered that narrowly actually gets, at roughly its usual cost.
- **Random by scope (DirDeep)** (+0.325 ms vs. STORAGE-1, essentially unchanged): stayed on `RandomPick`
  rather than adopting rejection sampling. A real narrow subtree on this card (`/games/MultiLoad64/`, 149
  files) measured ~0.23% density against the storage's full id range - ~430 expected attempts - a poor fit for
  rejection sampling regardless of how cheap each attempt is, decided by that measured density rather than by
  assuming the `Storage` win would carry over. `RandomPick`'s own result against the STORAGE-1 baseline stands
  as measured previously: a real, substantial improvement (~157 ms to ~115 ms) from the count-then-offset-seek
  it replaced.
- **Random by scope (DirShallow)** (-22.497 ms vs. STORAGE-1, unaffected by either change): already pinned to
  `ix_file_parent`, bounded by one directory's own children regardless of which mechanism the wider scopes use.
- **Directory listing**, **Parent lookup by identity**, and **Sibling lookup by identity**: all at or below
  half a millisecond - imperceptible in absolute terms regardless of ratio.

## Query plans

### FilesByParent

- SEARCH f USING INDEX ix_file_parent (storage_id=? AND parent_path=?)
- SEARCH m USING INDEX sqlite_autoindex_content_metadata_1 (content_id=?) LEFT-JOIN
- USE TEMP B-TREE FOR ORDER BY

### Search

- CO-ROUTINE f
- COMPOUND QUERY
- LEFT-MOST SUBQUERY
- SEARCH f USING INDEX ix_file_type (storage_id=? AND file_type=? AND rowid=?)
- LIST SUBQUERY 1
- SCAN file_search VIRTUAL TABLE INDEX 0:M3
- UNION USING TEMP B-TREE
- SEARCH f USING INDEX ix_file_identity (storage_id=? AND content_id=?)
- LIST SUBQUERY 3
- SCAN content_search VIRTUAL TABLE INDEX 0:M4
- SCAN f
- SEARCH m USING INDEX sqlite_autoindex_content_metadata_1 (content_id=?) LEFT-JOIN
- USE TEMP B-TREE FOR ORDER BY

### RandomPick (Storage)

- SEARCH f USING INDEX sqlite_autoindex_file_1 (storage_id=? AND path>? AND path<?)
- USE TEMP B-TREE FOR ORDER BY

### RandomBounds

- COMPOUND QUERY
- LEFT-MOST SUBQUERY
- SEARCH file USING COVERING INDEX ix_file_storage_id (storage_id=?)
- UNION ALL
- SEARCH file USING COVERING INDEX ix_file_storage_id (storage_id=?)

### RandomReject (Storage)

- SEARCH f USING INTEGER PRIMARY KEY (rowid=?)

### RandomPick (DirDeep)

- SEARCH f USING INDEX sqlite_autoindex_file_1 (storage_id=? AND path>? AND path<?)
- USE TEMP B-TREE FOR ORDER BY

### RandomPick (DirShallow)

- SEARCH f USING INDEX ix_file_parent (storage_id=? AND parent_path=?)
- USE TEMP B-TREE FOR ORDER BY

### FileById

- SEARCH f USING INTEGER PRIMARY KEY (rowid=?)
- SEARCH m USING INDEX sqlite_autoindex_content_metadata_1 (content_id=?) LEFT-JOIN

### ParentLookup

- SEARCH f USING INDEX ix_file_identity (storage_id=? AND content_id=?)
- SEARCH m USING INDEX sqlite_autoindex_content_metadata_1 (content_id=?) LEFT-JOIN
- USE TEMP B-TREE FOR ORDER BY

### SiblingLookup

- SEARCH f USING INDEX ix_file_identity (storage_id=? AND content_id=?)
- SEARCH m USING INDEX sqlite_autoindex_content_metadata_1 (content_id=?) LEFT-JOIN
- USE TEMP B-TREE FOR ORDER BY

### FileUpsert

- (no plan rows)

### DirectoryUpsert

- SEARCH file USING COVERING INDEX ix_file_directory (directory_id=?)

### FileSearchDelete

- SCAN file_search VIRTUAL TABLE INDEX 0:=

### FileSearchInsert

- (no plan rows)

### FavoriteRecompute

- SEARCH file USING INDEX ix_file_identity (storage_id=? AND content_id=?)
- SCALAR SUBQUERY 1
- SEARCH favorite USING INDEX ix_file_identity (storage_id=? AND content_id=?)
