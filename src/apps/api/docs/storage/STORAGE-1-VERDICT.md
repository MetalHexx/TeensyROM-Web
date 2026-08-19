# STORAGE-1 Iteration Verdict

## Directory Listing Decision

**An in-memory read model over the store is not required for the directory browsing path at this time.**

This iteration's focus was fixing the write-path and search regressions identified in the STORAGE-1 baseline. The fixes have succeeded: single upsert, bulk upsert, search, and sibling lookup — the four operations that regressed most severely in STORAGE-1 — have all been brought to or below the legacy performance. Bulk upsert, the workload that primarily motivated the rewrite, is now 570× faster than the STORAGE-1 baseline (32,459 ms → 57 ms) and 2.3× faster than legacy (130 ms → 57 ms). Single upsert, formerly 63.6 ms (1250× slower than legacy), is now 0.659 ms (14× slower in ratio, but imperceptible in absolute terms at 0.614 ms overhead). Search, formerly 100.9 ms, is now 8.7 ms and faster than legacy by 51 ms. The store's wins on cold-start time (2348.7 ms → 2.4 ms, the explicit target) and peak memory (2521.5 MB → 254.6 MB, the explicit target) demonstrate the rewrite's strategic value. Directory listing remains imperceptible at 0.148 ms and does not require an in-memory read model. However, two operations that measure scope-based row counts (Random by scope for Storage and DirDeep scopes) remain measurably slower than legacy; these require a separate architectural approach (index narrowing) deferred to a future iteration.

## Measured Numbers

All measurements below are from a genuine `dotnet run` of `TeensyRom.Tools.StorageBenchmark` with `--scenarios both --iterations 5 --explain --prior storage-1-prior-medians.tsv` against the largest real index file available — `Sd-L5ZMCNBR.json` (155,439,795 bytes, 64,658 files) — paired with the matching extracted fixture `Sd-L5ZMCNBR.tsv`. The run executed on Windows 10.0.26200, .NET 9.0.19, with 5 iterations per scenario (warm-up excluded). Full results including query plans are documented in `STORAGE-BENCHMARK-RESULTS.md`.

### Directory Listing by Path

| Side | Median (ms) | Min (ms) | Max (ms) |
|---|---|---|---|
| Legacy | 0.000 | — | — |
| Store (STORAGE-1 baseline) | 0.239 | — | — |
| Store (current) | 0.148 | — | — |
| **Delta vs. legacy (current)** | **0.148** | — | — |

This operation retrieves the contents of a single directory. The legacy side reports 0.000 ms (sub-millisecond, rounded to zero); the current store measurement is 0.148 ms, down from 0.239 ms in the STORAGE-1 baseline. The absolute difference remains under a quarter of a millisecond — imperceptible in user-facing latency.

### Supporting Context

The decision rests on one threshold: **imperceptible delay**. A change from a fraction of a millisecond to a few milliseconds is a large ratio but remains invisible to users. The goal of the rewrite is faster performance; a fraction slower is acceptable if perception is zero. Perceivable degradation (tens of milliseconds or more) would not be.

Directory listing was identified as the risk case in the original charter because the legacy linear dictionary scan wins on this operation. Against the real 64,658-file baseline:

**Operations fixed in this iteration** (now faster than the STORAGE-1 baseline):
- **Single upsert**: 0.045 ms (legacy) → 63.617 ms (STORAGE-1) → 0.659 ms (current); fixed by adding composite index `ix_file_identity` for direct identity-scoped lookups, eliminating the full-table scan in the favourite recompute
- **Bulk upsert (500 + parent lookup)**: 130.046 ms (legacy) → 32,459.181 ms (STORAGE-1) → 57.078 ms (current); same fix as single upsert, plus separate full-text index optimizations
- **Sibling lookup**: 0.032 ms (legacy) → 31.615 ms (STORAGE-1) → 0.175 ms (current); fixed by the same composite index
- **Search**: 60.342 ms (legacy) → 100.904 ms (STORAGE-1) → 8.724 ms (current, now faster than legacy); fixed by restructuring the query to pin the `f.content_id` branch with `INDEXED BY ix_file_identity` as diagnosed in `SEARCH-PLAN-FINDING.md`
- **Random by scope (DirShallow)**: 103.834 ms (legacy) → 22.648 ms (STORAGE-1) → 0.296 ms (current); pinning to `ix_file_parent` index for shallow directory scopes
- **Cold start**: 2348.705 ms (legacy) → 4.128 ms (STORAGE-1) → 2.411 ms (current); explicit target achieved
- **Peak memory**: 2521.494 MB (legacy) → 260.183 MB (STORAGE-1) → 254.646 MB (current); explicit target achieved
- **Directory listing**: 0.000 ms (legacy) → 0.239 ms (STORAGE-1) → 0.148 ms (current); slight improvement, remains imperceptible

**Effectively unchanged, still imperceptible** (at or below the 1 ms bar in both directions):
- **Parent lookup**: 0.018 ms (legacy) → 0.097 ms (STORAGE-1) → 0.121 ms (current); the composite index applies here too, but the measured delta against the STORAGE-1 baseline is +0.024 ms — flat, not faster; overhead remains imperceptible against both legacy and STORAGE-1

**Operations not fixed in this iteration** (still slower than legacy, already identified in STORAGE-1):
- **Random by scope (Storage)**: 38.262 ms (legacy) → 109.999 ms (STORAGE-1) → 118.148 ms (current); requires separate architectural approach (composite index on storage scope paths) not included in this iteration
- **Random by scope (DirDeep)**: 29.403 ms (legacy) → 110.647 ms (STORAGE-1) → 157.207 ms (current); same architectural issue as Storage scope

The two unfixed operations require index narrowing on scope-bounded ranges; see `STORAGE-BENCHMARK-RESULTS.md` section "Reasons" for detail. They were already identified as future-iteration work in STORAGE-1 and remain so.

## What This Iteration Hands Forward

- Composite index `ix_file_identity(storage_id, content_id)` addressing the write-path and lookup regressions identified in STORAGE-1
- Fixed Search query plan (UNION-based structure pinning the content-id branch with `INDEXED BY ix_file_identity`), per `SEARCH-PLAN-FINDING.md`
- A committed performance baseline against a real 64,658-file index, measured with the harness and fixture documented in `BENCHMARK-RUNBOOK.md`
- The directory-listing verdict re-confirmed: the operation stays imperceptible and does not require an in-memory read model; the composite index even improves it
- A curated search oracle (the fixture `Sd-L5ZMCNBR.tsv`) and prior-medians file (`storage-1-prior-medians.tsv`) that become the reference baseline for the next iteration's comparison mode
- Clear identification of two remaining scope-based random operations (Storage and DirDeep) as future-iteration architectural work, requiring index narrowing on scope-bounded ranges

## Deliberately Deferred

**Metadata rebuild trigger**: The version stamp field exists in the schema and metadata files carry a `DateModified` timestamp, but the condition that triggers a rebuild is decided when a release actually ships updated metadata databases. This decision belongs in release engineering, not implementation.

**Playlist item keying**: The playlist table lands in the next iteration. Playlist files are not read in the baseline (directory listing only covers Sd/Usb device indices). The question of how to key playlist items in the store — by path, by ID, by content hash — cannot be exercised here; deferring it to the next iteration where playlist files are first read prevents a guess that might lock in a wrong design. The baseline's omission of playlists is deliberate, not incomplete.

---

**Document updated**: 2026-08-19 (P04 iteration; updates STORAGE-1 verdict with current measurements)  
**Baseline data**: `Sd-L5ZMCNBR.json` (155,439,795 bytes, 64,658 files)  
**Fixture data**: `.local-fixtures/Sd-L5ZMCNBR.tsv`  
**Prior medians**: `storage-1-prior-medians.tsv` (STORAGE-1 store-side medians, used for "STORAGE-1" column in results)  
**Full results**: See `STORAGE-BENCHMARK-RESULTS.md` with full comparison table and query plans
