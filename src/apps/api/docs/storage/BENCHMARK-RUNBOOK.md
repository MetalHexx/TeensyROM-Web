# Benchmark Runbook

This document describes the exact steps to regenerate every committed measurement in the STORAGE-1 iteration.

## Overview

The benchmark harness runs locally against real data files in two scenarios:
1. **Baseline (synthetic data)**: A synthetic index built by driving the store's own write path, stored as a local fixture
2. **Comparison (real data)**: A real device index paired with its extracted fixture, producing the legacy vs. store comparison

The harness is **not part of continuous integration** and must not gate a build. The measurements are development artifacts used to make architectural decisions. They are reproducible locally by following this runbook, but the harness environment (real index files, extracted fixtures, benchmark tooling) is not maintained in CI.

## Prerequisites

- A working `dotnet` environment with .NET 9.0 or later
- The local fixtures directory and data files (see below for paths and provenance)
- For the real-data scenario: the original index file and its extracted fixture (both local; not in the repo)

## Baseline Measurement (Synthetic Data)

The baseline measurement exercises the store against a synthetic index containing 25,920 files. This fixture was generated once by driving the store's `EnsureParents`, `UpsertFile`, and `WriteToDisk` paths with synthetic content, ensuring the on-disk JSON matches the schema of a real device index.

**To regenerate the baseline:**

1. Navigate to the storage benchmark project:
   ```bash
   cd src/apps/api/src/TeensyRom.Tools.StorageBenchmark
   ```

2. Run the harness with `--scenarios store` against a working data directory containing a device index (required for the `--device` parameter). The tool creates a temp database and seeds it from whichever fixture file resolves for the given `--device`/`--storage` — either the path passed via `--fixture`, or `{fixture-dir}/{Sd-|Usb-}<deviceId>.tsv` under `IndexFixturePaths.ResolveDirectory()` (`.local-fixtures` by default). There is no code path that fabricates index content: the store is seeded from a real, already-extracted `.tsv` fixture, the same mechanism the real-data comparison run below uses:
   ```bash
   dotnet run -- --data-dir <path-to-index-directory> --device <deviceId> --scenarios store --out ../../docs/storage/STORAGE-BASELINE.md
   ```

   To reproduce the originally-committed 25,920-file synthetic baseline specifically, that fixture must exist locally — place it at `.local-fixtures/Sd-<deviceId>.tsv` (or pass `--fixture <path-to-that-file>`) before running the command above.

3. The harness emits the full markdown report. Review it to confirm the scenario names and measurements match the structure of prior baselines.

**Note**: The fixture is a local, gitignored artifact — it is not committed to the repository. The `STORAGE-BASELINE.md` report is the committed artifact.

## Comparison Measurement (Real Data)

The comparison measurement runs the harness against a real device index paired with an extracted fixture. This shows legacy vs. store performance on genuine data.

### Step 1: Obtain the Index and Fixture

The baseline committed to this repository used:
- **Index file**: `Sd-L5ZMCNBR.json` (155.4 MB, 64,658 files)
- **Extracted fixture**: `.local-fixtures/Sd-L5ZMCNBR.tsv` (local, gitignored artifact — not committed)

**To obtain these files:**
- If you have the shipped build `TeensyROM-Web-1.0.0-alpha.8-win-x64`, the index is present in its `Assets/System/Cache/` directory
- The extracted fixture must be obtained locally by placing the index file and running extraction or obtaining it from the build's source; it is a gitignored local artifact and not committed to the repository
- If the index file is not available, you cannot regenerate the real-data comparison; use a more recent device index when it is available

### Step 2: Run the Comparison Benchmark

1. Navigate to the storage benchmark project:
   ```bash
   cd src/apps/api/src/TeensyRom.Tools.StorageBenchmark
   ```

2. Point the data directory at the location of the real index file. Assuming `Sd-L5ZMCNBR.json` is in `C:\Users\Metal\Downloads\TeensyROM-Web-1.0.0-alpha.8-win-x64\Assets\System\Cache\`:
   ```bash
   dotnet run -- --data-dir "C:\Users\Metal\Downloads\TeensyROM-Web-1.0.0-alpha.8-win-x64" --device L5ZMCNBR --iterations 5 --scenarios both --explain --prior <path-to-prior-medians.tsv> --out ../../docs/storage/STORAGE-BENCHMARK-RESULTS.md
   ```
   
   The `--prior <path>` argument points to a two-column TSV file (operation name, then median milliseconds) capturing the prior iteration's store-side medians. This baseline is used to populate the "Store median, STORAGE-1" column in the results, allowing side-by-side comparison of improvements. The prior-medians file is committed data (copied forward from a previous run) rather than regenerated.

3. The harness runs both the legacy and store scenarios back-to-back in one process. The output is written to `STORAGE-BENCHMARK-RESULTS.md`.

### Step 3: Validate the Output

- Review the report to confirm the device name (`L5ZMCNBR`), file count (64,658), and scenario set (`both`) match prior runs
- Check that the legacy and store measurements are present and the expected operations are listed
- Commit the updated `STORAGE-BENCHMARK-RESULTS.md` alongside your change

## Extracting a New Fixture (Historical Context)

**Important**: The extraction tool (`TeensyRom.Tools.IndexExtractor`) has been removed from the repository by design. This section documents what was done once; it is not a step you perform.

The fixture `Sd-L5ZMCNBR.tsv` was extracted from `Sd-L5ZMCNBR.json` using the now-deleted `IndexExtractor` project with the command:
```bash
dotnet run -- --input Sd-L5ZMCNBR.json --output Sd-L5ZMCNBR.tsv
```

The fixture is a gitignored local artifact (`.local-fixtures/Sd-L5ZMCNBR.tsv`) used for benchmarking against real data without requiring the extraction tool at benchmark time. When a new real index becomes available for comparison, extract its fixture manually (or restore the extraction tool from git history if needed), place both files locally per Step 1 instructions, then commit only the results (not the fixture itself).

## Harness Implementation

The benchmark harness is at `src/TeensyRom.Tools.StorageBenchmark/Program.cs`. It accepts the following command-line arguments:

- `--data-dir <dir>` (required): Path to the directory containing real index files
- `--device <deviceId>` (required): The device identifier (e.g., `L5ZMCNBR`) for the index file
- `--storage sd|usb` (optional, defaults to `sd`): Storage type
- `--iterations <n>` (optional, defaults to `5`): Number of iterations per scenario (warm-up excluded)
- `--out <path.md>` (optional): Output markdown report path; if omitted, output goes to stdout
- `--scenarios legacy|store|both` (optional, defaults to `legacy`): Which scenarios to run
- `--fixture <path>` (optional): Custom fixture path; if omitted, resolved from `IndexFixturePaths`
- `--db <path>` (optional): Custom database path; if omitted, a temp database is created
- `--keep-db` (optional, no value): Retain the database file after the run completes
- `--prior <path.tsv>` (optional): Path to a two-column TSV of prior iteration's medians (operation, median ms)
- `--explain` (optional, no value): Capture `EXPLAIN QUERY PLAN` output for all measured operations

The harness:
- Emits structured scenario results and a markdown report
- Measures wall-clock time (median, min, max), managed memory delta, and peak working set for each operation
- When `--explain` is passed, appends a `## Query Plans` section documenting the database's access plans for each operation
- Is self-documenting — review `Program.cs` and the fixture reader in `TeensyRom.Core.Storage` for the exact measurements taken

## Full-Text Search Index Compatibility

**Important**: This iteration (P04) changed how full-text row IDs are assigned to files. Index databases written before this iteration are now stale: the file IDs stored in their full-text index tables do not match the file IDs the new write path assigns.

**If you have a cached device index (`.db` file) from an earlier iteration**: Delete it and re-scan the card. The store will rebuild the database from scratch with the correct row-ID mappings. Search results from a stale index will point to the wrong files or fail to resolve.

This applies to local development iteration files, not just production indices; any stored index predating this iteration must be discarded.

## When to Re-run

- **After major store changes**: If you modify the core read or write paths, re-run both baseline and comparison to establish new baseline measurements
- **When a new device index is available**: Run the comparison against it to update the real-data baseline
- **For local iteration**: Run the baseline locally as a quick feedback loop during development; the comparison is heavier and less frequent

## Troubleshooting

- **"Data directory not found"**: Confirm the path to the index files is correct and the files exist
- **"Cannot open fixture"**: Ensure `.local-fixtures/Sd-L5ZMCNBR.tsv` is present and readable locally; see Step 1 "Obtain the Index and Fixture" to regenerate or obtain it from the shipped build
- **Memory exhaustion on large indices**: The harness loads the entire index and store into memory. On collections over 200 MB, ensure sufficient RAM; consider running on a machine with > 16 GB

## CI Integration

This harness does not run in continuous integration. The measurements are made locally by developers when architectural decisions need data. The repository's unit tests cover the store's correctness; the benchmark harness covers performance and memory behavior.
