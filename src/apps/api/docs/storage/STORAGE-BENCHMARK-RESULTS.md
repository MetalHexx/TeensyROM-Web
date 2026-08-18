<!--
Data provenance: a genuine `dotnet run` of TeensyRom.Tools.StorageBenchmark with `--scenarios both`, run
against the largest real index file available on this machine - `Sd-L5ZMCNBR.json` (155,439,795 bytes,
64,658 files) from the shipped build `TeensyROM-Web-1.0.0-alpha.8-win-x64` under
`C:\Users\Metal\Downloads\` - paired with the matching extracted fixture `Sd-L5ZMCNBR.tsv` used to seed the
store side. Both inputs are personal-collection listings and neither is committed to the repository; only
this report is.

Legacy and store scenarios ran back to back in one process (`--scenarios both`), so the process-wide peak
working set is cumulative: the "Legacy peak working set" column reflects the process's peak partway through
the run (after the legacy scenarios, before the store side had allocated anything), while "Store peak working
set" reflects the peak after both halves had run. The two columns are therefore not a clean apples-to-apples
memory comparison - the store's own incremental contribution is smaller than the absolute figure suggests -
but the store's peak (1.6 GB after seeding, indexing, and querying 64,658 real files) is still far below what
repeatedly deserializing the 155 MB JSON index into memory costs the legacy side, which is the property this
row is meant to demonstrate.

The store's write-path rows (single upsert, bulk upsert, sibling lookup) and the seeding time itself land
dramatically slower than legacy, not faster as the expectation column anticipated. That is a real, measured
result against the largest available real collection, not a defect in this harness - the benchmark's job is
to report what actually happened, including the operations where the store does not yet win. On a collection
this size, `UpsertFilesAsync`'s per-content-identity favourite recompute (`SqliteIndexStore.Writes.cs`) is the
evident cost centre: it runs one `EXISTS` scan per content identity written, so its cost grows with the
collection rather than the batch size.

Everything from "# Storage Benchmark Report" onward is the harness's own emitted markdown, unedited.
-->

# Storage Benchmark Report

## Run header

- Generated (UTC): 2026-08-18T12:11:14.7834932Z
- OS: Microsoft Windows 10.0.26200
- Processor count: 24
- .NET runtime: .NET 9.0.19
- Iterations per scenario (warm-up excluded): 5
- Data directory: C:\Users\Metal\Downloads\TeensyROM-Web-1.0.0-alpha.8-win-x64
- Device: L5ZMCNBR (SD)
- Scenario set: both
- Store seeding time (setup, excluded from every measured operation): 1996596.225 ms

### Index files read

| Path | Size (bytes) | File count |
|---|---|---|
| C:\Users\Metal\Downloads\TeensyROM-Web-1.0.0-alpha.8-win-x64\Assets/System/Cache/Sd-L5ZMCNBR.json | 155,439,795 | 64,658 |
| C:\Users\Metal\.radorc\worktrees\STORAGE-1\teensyrom-web\src\apps\api\.local-fixtures\Sd-L5ZMCNBR.tsv | 4,374,456 | 64,658 |

## Legacy vs. store comparison

| Operation | Legacy median (ms) | Store median (ms) | Delta (ms) | Legacy peak working set (bytes) | Store peak working set (bytes) | Expectation |
|---|---|---|---|---|---|---|
| Cold start to queryable | 2357.445 | 4.128 | -2353.317 | 942,759,936 | 1,625,903,104 | Explicit target: time from opening the database to answering the first directory listing. |
| Directory listing by path | 0.000 | 0.239 | 0.239 | 942,759,936 | 1,625,903,104 | The one at risk. May be a fraction slower in absolute terms; must stay imperceptible. |
| Search | 58.892 | 100.904 | 42.012 | 942,759,936 | 1,625,903,104 | Materially faster: today is a full scan of every file with several substring comparisons each. |
| Random by scope (Storage) | 43.338 | 109.999 | 66.660 | 942,759,936 | 1,625,903,104 | Materially faster; the allocation of the whole matching set disappears. |
| Random by scope (DirDeep) | 25.604 | 110.647 | 85.043 | 942,759,936 | 1,625,903,104 | Materially faster; the allocation of the whole matching set disappears. |
| Random by scope (DirShallow) | 69.507 | 22.648 | -46.859 | 942,759,936 | 1,625,903,104 | Materially faster; the allocation of the whole matching set disappears. |
| Parent lookup by identity | 0.021 | 0.097 | 0.075 | 942,759,936 | 1,625,903,104 | Materially faster; unaffected by concurrent writes, unlike the map rebuilt on every upsert. |
| Sibling lookup by identity | 0.024 | 31.615 | 31.591 | 942,759,936 | 1,625,903,104 | Materially faster; unaffected by concurrent writes, unlike the map rebuilt on every upsert. |
| Single upsert | 0.051 | 63.617 | 63.566 | 942,759,936 | 1,625,903,104 | Materially faster - the workload that motivates the rewrite. |
| Bulk upsert (500) + parent lookup (identity map rebuild) | 152.828 | 32459.181 | 32306.354 | 942,759,936 | 1,625,903,104 | Materially faster - the workload that motivates the rewrite. |
| Peak memory with every discovered index loaded | 2338.293 | 260.183 | -2078.110 | 1,625,903,104 | 1,625,903,104 | Explicit target: the index is not resident - nothing requires the full collection in memory. |
