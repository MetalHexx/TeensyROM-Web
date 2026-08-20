<!--
Data provenance: This file documents a baseline run against a synthetic index (25,920 files, generated via
SimpleStorageCache's EnsureParents/UpsertFile/WriteToDisk path). It serves as a smoke test to confirm the
benchmark harness and scenario framework function correctly.

A real-data baseline was generated in Phase 5 and is documented in STORAGE-BENCHMARK-RESULTS.md, which
measures the same operation set against a genuine 64,658-file index (Sd-L5ZMCNBR.json, 155.4 MB). That
report is authoritative for actual performance requirements and system decisions. This file is retained as
the synthetic smoke-test record for regression detection in the benchmark harness itself, and is no longer
intended to be updated from real data.

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
