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

2. Run the harness against the synthetic data directory (the tool will create a temp directory with a synthetic index):
   ```bash
   dotnet run -- --output ../../docs/storage/STORAGE-BASELINE.md
   ```

3. The harness emits the full markdown report. Review it to confirm the scenario names and measurements match the structure of prior baselines.

**Note**: The synthetic fixture is ephemeral — it is generated each run inside the harness and not retained on disk. The `STORAGE-BASELINE.md` report is the committed artifact.

## Comparison Measurement (Real Data)

The comparison measurement runs the harness against a real device index paired with an extracted fixture. This shows legacy vs. store performance on genuine data.

### Step 1: Obtain the Index and Fixture

The baseline committed to this repository used:
- **Index file**: `Sd-L5ZMCNBR.json` (155.4 MB, 64,658 files)
- **Extracted fixture**: `.local-fixtures/Sd-L5ZMCNBR.tsv` (stored in the repo)

**To obtain these files:**
- If you have the shipped build `TeensyROM-Web-1.0.0-alpha.8-win-x64`, the index is present in its `Assets/System/Cache/` directory
- The extracted fixture is already committed at `src/apps/api/.local-fixtures/Sd-L5ZMCNBR.tsv`
- If neither is available, you cannot regenerate the real-data comparison; use a more recent device index when it is available

### Step 2: Run the Comparison Benchmark

1. Navigate to the storage benchmark project:
   ```bash
   cd src/apps/api/src/TeensyRom.Tools.StorageBenchmark
   ```

2. Point the data directory at the location of the real index and fixture. Assuming `Sd-L5ZMCNBR.json` is in `C:\Users\Metal\Downloads\TeensyROM-Web-1.0.0-alpha.8-win-x64\Assets\System\Cache\`:
   ```bash
   dotnet run -- --data-directory "C:\Users\Metal\Downloads\TeensyROM-Web-1.0.0-alpha.8-win-x64" --scenarios both --output ../../docs/storage/STORAGE-BENCHMARK-RESULTS.md
   ```

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

The fixture is retained in the repository (`.local-fixtures/Sd-L5ZMCNBR.tsv`) so the benchmark can run against real data without requiring the extraction tool. When a new real index becomes available for comparison, extract its fixture manually (or restore the extraction tool from git history if needed), then commit both the results and the new fixture.

## Harness Implementation

The benchmark harness is at `src/TeensyRom.Tools.StorageBenchmark/Program.cs`. It:
- Accepts command-line arguments for `--data-directory`, `--scenarios` (baseline, comparison, or both), and `--output`
- Emits structured scenario results and a markdown report
- Measures wall-clock time (median, min, max), managed memory delta, and peak working set for each operation
- Is self-documenting — review `Program.cs` and the fixture reader in `TeensyRom.Core.Storage` for the exact measurements taken

## When to Re-run

- **After major store changes**: If you modify the core read or write paths, re-run both baseline and comparison to establish new baseline measurements
- **When a new device index is available**: Run the comparison against it to update the real-data baseline
- **For local iteration**: Run the baseline locally as a quick feedback loop during development; the comparison is heavier and less frequent

## Troubleshooting

- **"Data directory not found"**: Confirm the path to the index files is correct and the files exist
- **"Cannot open fixture"**: Ensure `.local-fixtures/Sd-L5ZMCNBR.tsv` is present and readable; it should be committed to the repository
- **Memory exhaustion on large indices**: The harness loads the entire index and store into memory. On collections over 200 MB, ensure sufficient RAM; consider running on a machine with > 16 GB

## CI Integration

This harness does not run in continuous integration. The measurements are made locally by developers when architectural decisions need data. The repository's unit tests cover the store's correctness; the benchmark harness covers performance and memory behavior.
