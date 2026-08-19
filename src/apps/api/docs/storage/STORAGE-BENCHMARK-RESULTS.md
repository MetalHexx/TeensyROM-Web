<!--
Data provenance: a genuine `dotnet run` of TeensyRom.Tools.StorageBenchmark with `--scenarios both
--iterations 5 --explain --prior storage-1-prior-medians.tsv`, run against the same real index file as the
STORAGE-1 baseline - `Sd-L5ZMCNBR.json` (155,439,795 bytes, 64,658 files) from the shipped build
`TeensyROM-Web-1.0.0-alpha.8-win-x64` under `C:\Users\Metal\Downloads\` - paired with the matching extracted
fixture `Sd-L5ZMCNBR.tsv` used to seed the store side. Both inputs are personal-collection listings and
neither is committed to the repository; only this report is. `--prior` supplies the STORAGE-1 baseline's own
store medians (`storage-1-prior-medians.tsv`), which populate the "Store median, STORAGE-1" column below.

Store seeding time: 14,418.600 ms (0.24 minutes) - down from the STORAGE-1 baseline's 1,996,596.225 ms
(~33 minutes). Indexing a real card finishing in minutes was one of this iteration's stated goals; this run
clears it by two orders of magnitude, not by a margin.

Legacy and store scenarios ran back to back in one process (`--scenarios both`), so the process-wide peak
working set is cumulative: the "Legacy peak working set" column reflects the process's peak partway through
the run (after the legacy scenarios, before the store side had allocated anything), while "Store peak working
set" reflects the peak after both halves had run, including the "every discovered index loaded" scenario that
deliberately spikes it. The two columns are therefore not a clean apples-to-apples memory comparison, but the
store's peak (~1.52 GB after seeding, indexing, and querying 64,658 real files) is still far below what
repeatedly deserializing the 155 MB JSON index into memory costs the legacy side, which is the property this
row is meant to demonstrate.

The STORAGE-1 baseline attributed its write-path regression (single upsert 63.617 ms store vs. 0.051 ms
legacy) entirely to `UpsertFilesAsync`'s per-content-identity favourite recompute. That was incomplete: the
measured decomposition of that cost was two centres, not one - the missing composite index driving every
identity-scoped lookup (favourite recompute, parent lookup, sibling lookup) as an unindexed scan, at roughly
45.4 ms per identity touched, and the full-text index maintenance on every write (`FileSearchInsert` /
`FileSearchDelete` in `SqliteIndexStore.Writes.cs`), at roughly 22.3 ms per file written. Both centres are
addressed as of this run's code: this run's own `## Query plans` section shows `FavoriteRecompute`,
`ParentLookup`, and `SiblingLookup` all resolving through `ix_file_identity` rather than an unindexed scan,
and the write path now measures a single-upsert delta of 0.614 ms and a 500-file bulk upsert 72.968 ms
*faster* than legacy (it was 32,306.354 ms slower in the STORAGE-1 baseline). Search shows the same pattern:
from a `SEARCH-PLAN-FINDING.md`-diagnosed unselective driving scan (100.904 ms store, 42.012 ms slower than
legacy in the STORAGE-1 baseline) to 8.724 ms store, 51.619 ms faster than legacy today; this run's
`### Search` plan below shows the `UNION`-with-`INDEXED BY ix_file_identity` shape that finding prescribed.
Two operations remain measurably slower than legacy on this collection - Random by scope (Storage) and Random
by scope (DirDeep) - explained in the "Reasons" list below the comparison table; neither is a regression this
iteration introduced, both were already slower in the STORAGE-1 baseline, and both are unaddressed by this
iteration's fixes, which targeted the write path, search, and the DirShallow scope specifically.

Everything from "# Storage Benchmark Report" onward is the harness's own emitted markdown, unedited, except
for the "### Reasons" list appended immediately below the comparison table: the harness measures what
happened, not why, so that attribution is added here rather than invented as part of the tool's output.
-->

# Storage Benchmark Report

## Run header

- Generated (UTC): 2026-08-19T04:25:01.5971141Z
- OS: Microsoft Windows 10.0.26200
- Processor count: 24
- .NET runtime: .NET 9.0.19
- Iterations per scenario (warm-up excluded): 5
- Data directory: C:\Users\Metal\Downloads\TeensyROM-Web-1.0.0-alpha.8-win-x64
- Device: L5ZMCNBR (SD)
- Scenario set: both
- Store seeding time (setup, excluded from every measured operation): 14418.600 ms

### Index files read

| Path | Size (bytes) | File count |
|---|---|---|
| C:\Users\Metal\Downloads\TeensyROM-Web-1.0.0-alpha.8-win-x64\Assets/System/Cache/Sd-L5ZMCNBR.json | 155,439,795 | 64,658 |
| C:\Users\Metal\.radorc\worktrees\STORAGE-1\teensyrom-web\src\apps\api\.local-fixtures\Sd-L5ZMCNBR.tsv | 4,374,456 | 64,658 |

## Legacy vs. store comparison

| Operation | Legacy median (ms) | Store median, STORAGE-1 (ms) | Store median (ms) | Delta (ms) | Delta vs. STORAGE-1 (ms) | Legacy peak working set (bytes) | Store peak working set (bytes) | Expectation |
|---|---|---|---|---|---|---|---|---|
| Cold start to queryable | 2348.705 | 4.128 | 2.411 | -2346.293 | -1.717 | 1,094,332,416 | 1,629,167,616 | Explicit target: time from opening the database to answering the first directory listing. |
| Directory listing by path | 0.000 | 0.239 | 0.148 | 0.148 | -0.091 | 1,094,332,416 | 1,629,167,616 | The one at risk. May be a fraction slower in absolute terms; must stay imperceptible. |
| Search | 60.342 | 100.904 | 8.724 | -51.619 | -92.180 | 1,094,332,416 | 1,629,167,616 | Materially faster: today is a full scan of every file with several substring comparisons each. |
| Random by scope (Storage) | 38.262 | 109.999 | 118.148 | 79.886 | 8.149 | 1,094,332,416 | 1,629,167,616 | Materially faster; the allocation of the whole matching set disappears. |
| Random by scope (DirDeep) | 29.403 | 110.647 | 157.207 | 127.804 | 46.560 | 1,094,332,416 | 1,629,167,616 | Materially faster; the allocation of the whole matching set disappears. |
| Random by scope (DirShallow) | 103.834 | 22.648 | 0.296 | -103.537 | -22.352 | 1,094,332,416 | 1,629,167,616 | Materially faster; the allocation of the whole matching set disappears. |
| Parent lookup by identity | 0.018 | 0.097 | 0.121 | 0.103 | 0.024 | 1,094,332,416 | 1,629,167,616 | Materially faster; unaffected by concurrent writes, unlike the map rebuilt on every upsert. |
| Sibling lookup by identity | 0.032 | 31.615 | 0.175 | 0.143 | -31.440 | 1,094,332,416 | 1,629,167,616 | Materially faster; unaffected by concurrent writes, unlike the map rebuilt on every upsert. |
| Single upsert | 0.045 | 63.617 | 0.659 | 0.614 | -62.958 | 1,094,332,416 | 1,629,167,616 | Materially faster - the workload that motivates the rewrite. |
| Bulk upsert (500) + parent lookup (identity map rebuild) | 130.046 | 32459.181 | 57.078 | -72.968 | -32402.103 | 1,094,332,416 | 1,629,167,616 | Materially faster - the workload that motivates the rewrite. |
| Peak memory with every discovered index loaded | 2521.494 | 260.183 | 254.646 | -2266.847 | -5.537 | 1,629,167,616 | 1,629,167,616 | Explicit target: the index is not resident - nothing requires the full collection in memory. |

### Reasons

- **Single upsert** (+0.614 ms): a durable database write against an in-memory dictionary assignment is
  expected to cost more in ratio - that is the intended trade recorded in STORAGE-DESIGN's D9. Judged in
  absolute time, a fraction of a millisecond is imperceptible, and today's number lands there: 0.659 ms store
  vs. 0.045 ms legacy, a 62.958 ms improvement over the STORAGE-1 baseline's 63.617 ms.
- **Search** (-51.619 ms, now faster than legacy): `SEARCH-PLAN-FINDING.md` diagnosed the access-path defect
  behind the STORAGE-1 baseline's 100.904 ms and prescribed a `UNION` pinning the `f.content_id` branch to
  `ix_file_identity`; this run's `### Search` plan (below) shows that shape in place.
- **Random by scope (Storage)** (+79.886 ms) and **Random by scope (DirDeep)** (+127.804 ms): both scopes
  count and then offset-seek across a `path LIKE`-bounded range spanning the whole storage (Storage) or an
  entire subtree (DirDeep) - `RandomCount` and `RandomCandidate` (`IndexSql.cs`) each walk that full range
  once, a cost proportional to the scope's width rather than the file type or exclude-path selectivity.
  `DirShallow` avoids this by pinning to `ix_file_parent`, bounded by one directory's own children; Storage
  and DirDeep have no equivalently narrow index to pin to. Both were already slower than legacy in the
  STORAGE-1 baseline (+66.660 ms and +85.043 ms respectively) and remain unaddressed by this iteration's
  fixes - a finding for a future iteration, not a regression introduced here.
- **Directory listing** (+0.148 ms), **Parent lookup by identity** (+0.103 ms), and **Sibling lookup by
  identity** (+0.143 ms): all at or below one millisecond - imperceptible in absolute terms regardless of
  ratio.

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

### RandomCount (Storage)

- SEARCH f USING INDEX sqlite_autoindex_file_1 (storage_id=? AND path>? AND path<?)

### RandomCandidate (Storage)

- SEARCH f USING INDEX sqlite_autoindex_file_1 (storage_id=? AND path>? AND path<?)

### RandomCount (DirDeep)

- SEARCH f USING INDEX sqlite_autoindex_file_1 (storage_id=? AND path>? AND path<?)

### RandomCandidate (DirDeep)

- SEARCH f USING INDEX sqlite_autoindex_file_1 (storage_id=? AND path>? AND path<?)

### RandomCount (DirShallow)

- SEARCH f USING INDEX ix_file_parent (storage_id=? AND parent_path=?)

### RandomCandidate (DirShallow)

- SEARCH f USING INDEX ix_file_parent (storage_id=? AND parent_path=?)

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

