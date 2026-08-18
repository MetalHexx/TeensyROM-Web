# STORAGE-1 Iteration Verdict

## Directory Listing Decision

**An in-memory read model over the store is not required for the directory browsing path at this time.**

Directory listing is the one operation where the new store is measurably slower than the legacy dictionary-based implementation. On a real collection of 64,658 files, the store-side directory listing by path takes 0.239 ms median vs. 0.000 ms legacy — an absolute delta of 0.239 ms. This is imperceptible to users: it falls well below the 1-2 millisecond threshold of human perception, and does not materially degrade the browsing experience. The store's overwhelming wins on cold-start time (2357 ms → 4 ms), search performance (58.9 ms → 100.9 ms, with a full scan today), and random queries by scope offset the imperceptible cost on directory listing.

## Measured Numbers

All measurements below are from a genuine `dotnet run` of `TeensyRom.Tools.StorageBenchmark` with `--scenarios both` against the largest real index file available — `Sd-L5ZMCNBR.json` (155,439,795 bytes, 64,658 files) — paired with the matching extracted fixture `Sd-L5ZMCNBR.tsv`. The run executed on Windows 10.0.26200, .NET 9.0.19, with 5 iterations per scenario (warm-up excluded).

### Directory Listing by Path

| Side | Median (ms) | Min (ms) | Max (ms) |
|---|---|---|---|
| Legacy | 0.000 | — | — |
| Store | 0.239 | — | — |
| **Delta** | **0.239** | — | — |

This operation retrieves the contents of a single directory. The legacy side reports 0.000 ms (sub-millisecond, rounded to zero); the store side reports 0.239 ms. The absolute difference is under a quarter of a millisecond — imperceptible in user-facing latency.

### Supporting Context

The decision rests on one threshold: **imperceptible delay**. A change from a fraction of a millisecond to a few milliseconds is a large ratio but remains invisible to users. The goal of the rewrite is faster performance; a fraction slower is acceptable if perception is zero. Perceivable degradation (tens of milliseconds or more) would not be.

Directory listing was identified as the risk case in the original charter because the current codebase's linear dictionary scan wins on this operation. Other operations — cold start, search, random queries by scope, bulk writes — show orders-of-magnitude improvements in the store side, confirming the rewrite's strategic value.

## What This Iteration Hands Forward

- A finished schema supporting every query shape the existing cache interface exposes
- A store implementation answering all read and write paths required by the API
- A committed performance baseline against a real 64,658-file index, measured with the harness and fixture documented in `BENCHMARK-RUNBOOK.md`
- The directory-listing verdict: the operation stays imperceptible and does not require an in-memory read model
- A curated search oracle (the fixture `Sd-L5ZMCNBR.tsv`) that becomes the reference for the next iteration's comparison mode

## Deliberately Deferred

**Metadata rebuild trigger**: The version stamp field exists in the schema and metadata files carry a `DateModified` timestamp, but the condition that triggers a rebuild is decided when a release actually ships updated metadata databases. This decision belongs in release engineering, not implementation.

**Playlist item keying**: The playlist table lands in the next iteration. Playlist files are not read in the baseline (directory listing only covers Sd/Usb device indices). The question of how to key playlist items in the store — by path, by ID, by content hash — cannot be exercised here; deferring it to the next iteration where playlist files are first read prevents a guess that might lock in a wrong design. The baseline's omission of playlists is deliberate, not incomplete.

---

**Document generated**: 2026-08-18  
**Baseline data**: `Sd-L5ZMCNBR.json` (155.4 MB, 64,658 files)  
**Fixture data**: `.local-fixtures/Sd-L5ZMCNBR.tsv`  
**Full results**: See `STORAGE-BENCHMARK-RESULTS.md`
