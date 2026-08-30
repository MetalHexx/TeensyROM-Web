# Validation Harnesses

Three scratch harnesses that informed the loop-detection regression and its replacement, kept as
standing, re-runnable measurements rather than notes nobody can check. They live here — a sibling
of `src/`, outside every glob `src/**` and `tests/**` cover — so deleting `libs/poc/` removes them
along with the rest of the POC, and so `pnpm nx test dj-player` never collects them: they take from
minutes to tens of minutes and one of them needs a developer-machine SID collection that does not
exist in CI. **Running one is always an explicit act, never part of a gating test run.**

Run all three from the Nx workspace root (this repo's `src/` directory):

```
pnpm vitest run --config libs/poc/dj-player/validation/vite.config.mts
```

That runs every harness in one pass. To run a single one, add its filename:

```
pnpm vitest run --config libs/poc/dj-player/validation/vite.config.mts loop-detection-diagnosis.spec.ts
```

## `loop-detection-diagnosis.spec.ts`

**Question:** How loose is a perceptual, similarity-threshold-and-sustained-run search for a loop
point, and what would it have concluded on the bundled tunes?

`structure.ts` no longer contains that search — loop detection is `detectLoop`'s byte-exact
register-stream comparison instead (see below). This harness keeps its own copy of the abandoned
search so the reasoning behind dropping it stays checkable rather than asserted.

**Inputs:** none — it runs entirely against the two committed bundled tunes
(`src/lib/sid/bundled/InSID3_Out.sid`, `Still_Time.sid`).

**Time:** a few seconds per tune.

**Reading the output:** for each tune it prints the block-pair similarity distribution (min through
max, and what fraction of all pairs clear a 0.85 bar), the longest sustained run of matches at each
of the first twelve block offsets, which offset (if any) a threshold-and-run search would accept,
and what a refinement pass would then narrow that offset to. A high fraction of pairs above the bar,
or a run accepted at an offset that is not the true loop period, is what "the perceptual route
cannot answer this question reliably" looks like in numbers.

## `exact-matching-proof.spec.ts`

**Question:** Does `detectLoop` — the function the shipped tune index actually calls — find a
verified loop in the bundled tunes, and what does it report?

**Inputs:** none — the same two bundled tunes, scanned once at the normal ceiling and once at double
that window, to show the answer does not depend on where the scan happened to stop.

**Time:** well under a minute total.

**Reading the output:** each tune's scan length in seconds, then either "no verified repeat", a
settled idle cycle with its frame, or an exact loop with its start, period, and how many consecutive
calls of tail were verified byte-identical against it.

## `stratified-accuracy.spec.ts`

**Question:** Across a broad, stratified sample of real HVSC tunes, how often does the shipped
detection ladder (the same `SCAN_DEPTH_SECONDS` rungs and `detectLoop` call `TuneIndexService` uses)
land within a few seconds of the tune's curated, human-verified length — and does that hold evenly
across video standard, play-rate driver, collection area, era, and length bucket, or does it break
down somewhere specific?

**Inputs**, all via environment variables:

| Variable | Required | Default | Meaning |
|---|---|---|---|
| `HVSC_ROOT` | yes | none | Root of a local HVSC collection, e.g. `C:/Users/you/HVSC/C64Music`. This is a developer machine's music collection, not a repo asset — there is no sane default. **The suite skips with a console message rather than failing when this is unset or does not resolve to a real directory.** |
| `SID_CSV` | no | the committed `SIDlist_82_UTF8.csv` grading key | Override only for a differently-laid-out checkout. |
| `STRAT_OUT` | no | unset | Path to write the full per-tune JSON results. When unset, the run still prints its full summary to the console; it just writes nothing to disk. |

Example:

```
HVSC_ROOT="C:/Users/you/HVSC/C64Music" STRAT_OUT="./strat-results.json" pnpm vitest run --config libs/poc/dj-player/validation/vite.config.mts stratified-accuracy.spec.ts
```

**Time:** tens of minutes — it scans up to 300 tunes, each up to four times as the detection ladder
climbs.

**Reading the output:** an overall breakdown by outcome class (`exact<=1s`, `close<=3s`, `near<=5s`,
`multiple`/`submultiple` of the true length, `mismatch`, `ended`, `none`, `silent`, `error`), a
"within 5s" and "defensible" summary line, and the same breakdown repeated per clock, format, chip
model, play-rate driver, collection area, era, and length bucket — this is where a detector that
looks fine overall but fails a specific slice shows up. The sample itself is drawn once with a seeded
RNG (reproducible across runs) and drawn without replacement, so no tune appears twice.

**A measured baseline, with its caveats, is recorded in the library's own `README.md`** — read that
figure alongside its caveats, not on its own.
