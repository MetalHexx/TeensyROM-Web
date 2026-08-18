<!--
Data provenance: no hardware-synced Sd-*.json / Usb-*.json index files were present in this
environment (the path named by the P01-T01 handoff, src/apps/api/src/TeensyRom.Api/bin/Debug/net9.0/
win-x64/Assets/System/Cache/, does not exist in this worktree - the API has never been run against a
real device here). The run below is a genuine `dotnet run` of TeensyRom.Tools.StorageBenchmark, executed
against a synthetic index built by driving SimpleStorageCache's own EnsureParents/UpsertFile/WriteToDisk
path (so the on-disk JSON is schema-identical to a real index), containing 25,920 files across a
composer/album/song tree - real numbers, real code paths, synthetic content. Re-run this harness against
a real multi-hundred-megabyte index the first time one is available and replace this file; the scenario
list and sampling methodology are what future runs are compared against, not this file size.

Everything from "# Storage Benchmark Report" onward is the harness's own emitted markdown, unedited.
-->

# Storage Benchmark Report

## Run header

- Generated (UTC): 2026-08-18T05:20:26.9315219Z
- OS: Microsoft Windows 10.0.26200
- Processor count: 24
- .NET runtime: .NET 9.0.19
- Iterations per scenario (warm-up excluded): 5
- Data directory: C:\Users\Metal\AppData\Local\Temp\claude\C--Users-Metal--radorc-worktrees-STORAGE-1\b91069d5-fc2f-49b1-8e85-458621d9ba75\scratchpad\bench-data
- Device: BENCH01 (SD)

### Index files read

| Path | Size (bytes) | File count |
|---|---|---|
| C:\Users\Metal\AppData\Local\Temp\claude\C--Users-Metal--radorc-worktrees-STORAGE-1\b91069d5-fc2f-49b1-8e85-458621d9ba75\scratchpad\bench-data\Assets/System/Cache/Sd-BENCH01.json | 24,060,951 | 25,920 |

## Scenario results

| Operation | Iterations | Median (ms) | Min (ms) | Max (ms) | Managed delta (bytes) | Peak working set (bytes) |
|---|---|---|---|---|---|---|
| Cold start to queryable | 5 | 386.123 | 346.947 | 755.302 | 134,551,088 | 194,179,072 |
| Directory listing by path | 5 | 0.000 | 0.000 | 0.010 | 144 | 194,179,072 |
| Search | 5 | 5.334 | 4.966 | 6.079 | 352 | 194,179,072 |
| Random by scope (Storage) | 5 | 12.801 | 12.764 | 13.586 | 296 | 194,179,072 |
| Random by scope (DirDeep) | 5 | 15.007 | 13.672 | 16.106 | 144 | 194,179,072 |
| Random by scope (DirShallow) | 5 | 41.621 | 39.136 | 44.392 | 240 | 194,179,072 |
| Parent lookup by identity | 5 | 0.017 | 0.012 | 0.034 | 4,674,528 | 194,179,072 |
| Sibling lookup by identity | 5 | 0.014 | 0.012 | 0.030 | 144 | 194,179,072 |
| Single upsert | 5 | 0.020 | 0.013 | 0.067 | -4,668,400 | 194,179,072 |
| Bulk upsert (500) + parent lookup (identity map rebuild) | 5 | 70.941 | 64.414 | 84.151 | 4,771,016 | 194,179,072 |
| Peak memory with every discovered index loaded | 5 | 419.895 | 384.628 | 429.406 | 352 | 307,601,408 |
