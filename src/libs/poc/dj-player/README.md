# ASID-DJ-0 DJ Player POC

## What This Is

This is a throwaway spike proving that a browser tab can hold musical timing over Web MIDI well enough to stream SID tunes to a real Commodore 64. The entire codebase is disposable and expected to be replaced by `ASID-DJ-1`; its only permanent value is the written findings in the listening protocol below.

The spike makes a C64 play a SID tune whose player code runs in this browser tab, with an audio-rate frame clock, ASID SysEx encoding over Web MIDI, and host-side timestamped delivery to measure whether the ASID protocol closes the jitter gap that Web MIDI is known to have — eliminating the cartridge's timed queue and running it in pass-through mode.

## How to Run It

1. Start the development server: `pnpm start`
2. Navigate to `http://localhost:4200/dev/dj-poc` (the route is unlinked from navigation — type the URL)
3. Grant Web MIDI SysEx permission when prompted
4. Connect a TeensyROM cartridge in ASID player mode via USB
5. Any recent cartridge firmware version is compatible. Current release is 0.7.2.
6. Use Chrome or Edge. Web MIDI with SysEx is unavailable in Safari and prompt-gated in Firefox.

## The Linked `@sidablist/core` Package

The POC consumes `@sidablist/core` from the sibling `SIDablist` repository through a relative `file:`
dependency in `src/package.json`.

**Both repositories must be cloned side by side under the same parent.** The specifier resolves
`../../SIDablist/libs/core` from `TeensyROM-Web/src`, so a clone of only this repository fails at
`pnpm install` with a resolution error and no further explanation. Clone both:

```
<parent>/
  SIDablist/
  TeensyROM-Web/
```

### The Inner Loop

```
# in SIDablist
pnpm --filter @sidablist/core build

# in TeensyROM-Web/src — nothing to reinstall
pnpm nx serve teensyrom-ui
```

The dev server picks the rebuilt package up on its next reload.

No reinstall is needed, but not for the reason you would expect. pnpm 10 does **not** symlink a
`file:` directory dependency — it hard-links each file into `node_modules/.pnpm`. The loop stays
fast because `tsc` rewrites its outputs in place, so the hard links survive a rebuild and both
repositories keep pointing at the same bytes. **If core's build ever starts by deleting `dist`, that
breaks**: the new files are different inodes, the old hard links are orphaned, and this workspace
silently keeps serving the previous build until you `pnpm install` again. Run the core smoke job in
the setup drawer before you conclude a core change did nothing — `pnpm install` and retry if it still
disagrees with what you just built.

### Why the Package Declares `main` and `types`

`@sidablist/core` is ESM-only and its `exports` map is the real entry-point contract. It also
declares `main` and `types` pointing at the same files, purely so this workspace can resolve it:
`tsconfig.base.json` sets `"moduleResolution": "node"`, which predates `exports` and would otherwise
fail with `TS2307: Cannot find module '@sidablist/core'` even though the bundler resolves it fine.
Removing either field breaks the type-check here; switching this workspace to `bundler` resolution
would be the alternative, and is a far larger change than the POC justifies.

### Why the Worker Goes Through a First-Party Shim

`diagnostics/core-replay.worker.ts` is one line — `import '@sidablist/core/replay.worker';` — and the
setup drawer starts the worker from it rather than letting the package start its own.

The package can start its own worker under a plain ESM loader, but not under this build. Angular
rewrites `new Worker(new URL(..., import.meta.url))` specifiers with a **TypeScript transformer**
(`@angular/build`'s `web-worker-transformer`), which only walks sources in its own program — so the
copy already compiled into the package's `dist` is never rewritten. Worse, it fails silently: the
build stays green, the untouched specifier lands in the bundle, and at run time it resolves against
the emitted chunk's own URL and 404s. Nothing in `dist/apps/teensyrom-ui/browser/` corresponds to it.

Two constraints force the shape. The Worker must be constructed in first-party TypeScript, because
that is all the transformer sees; and the specifier must be a **relative path**, because the builder
resolves it with a plain `path.join` rather than module resolution — a bare package specifier cannot
work there. The shim is the smallest thing satisfying both.

The package's `createWorkerReplayRunner(workerFactory?)` takes the worker as its argument, so no
part of this leaks back into the library — `@sidablist/core` exposes `./replay.worker` as a public
subpath export and knows nothing about who consumes it. That is the same mechanism a real published
npm package would use, so nothing here needs rework when these libraries stop being `file:` links.

**Passing the factory is not optional here.** Calling `createWorkerReplayRunner()` bare falls back to
the package's own worker and reproduces the silent 404 above. Every linked worker this app grows
needs its own one-line shim; there is no build setting that makes the fallback work.

### Why `prebundle.exclude` Exists

The **serve** target in `apps/teensyrom-ui/project.json` excludes the `@sidablist/*` packages from
the dev server's dependency pre-bundling. Pre-bundling rewrites a module into the dev server's own
cache directory, and the package starts its worker from a `new URL('./replay.worker.js',
import.meta.url)` specifier that would then resolve against that cache, where no worker file exists.
The failure is silent — the build stays green and the worker simply never starts — so the exclusion
is load-bearing rather than an optimisation.

It is a `dev-server` option, not a build option and not a Vite setting. The
`@angular/build:application` schema rejects `prebundle` outright (`additionalProperties: false`), and
`vite.config.mts` is read only by the `@nx/vite:test` executor — so writing the exclusion in either
place fails loudly or does nothing at all.

### Verifying the Link

The setup drawer's Diagnostics panel carries a **Run core smoke job** button: it drives the linked
`@sidablist/core`'s replay worker over a tiny fixture tune and renders the frame the round trip
landed on. A worker that fails to resolve renders the failure instead, which is what proves the
worker inside the currently linked build actually started. Check it against a production build
served statically as well as against the dev server — pre-bundling and linking faults only show up
in one of the two.

## The Yank — Deleting the Iteration

The spike is quarantined in one folder and four registration lines. To delete it completely:

1. **Delete the library folder:**
   ```
   rm -rf libs/poc/
   ```

2. **Remove the dev route** from `apps/teensyrom-ui/src/app/app.routes.ts`:
   - Delete the route entry for `path: 'dev/dj-poc'` (lines 6–12 in the current file)

3. **Remove the scope:poc constraint** from the workspace-root `eslint.config.mjs`:
   - Delete the `scope:poc` constraint block (lines 71–74)
   - Remove `'scope:poc'` from the `scope:app` allowlist (line 87)

4. **Drop the path alias** from `tsconfig.base.json`:
   - Delete the line `"@teensyrom-nx/poc/dj-player": ["libs/poc/dj-player/src/index.ts"]`

5. **Remove the dependencies:**
   ```
   pnpm remove mos6502 @sidablist/core
   ```

6. **Drop the pre-bundling exclusion** from `apps/teensyrom-ui/project.json`:
   - Delete the `prebundle` entry under `targets.serve.options` — it exists only for the linked
     `@sidablist/*` packages

After these six edits, run `pnpm nx lint` and `pnpm nx test` to verify the workspace is clean. The
five-edit form of this yank was rehearsed on a scratch branch and reverted successfully.

## The Tune List

Nine tunes from HVSC #83, chosen to break specific things:

| Tune | HVSC Path | What It Tests |
|------|-----------|---------------|
| Divertigo — *InSID3 Out* | `MUSICIANS/D/DivertigoO/Divertigo_-_InSID3_Out.sid` | CIA-timed tune; cleared for redistribution ✓ **committed** |
| Avrilcadabra — *Still Time* | `MUSICIANS/A/Avrilcadabra/Still_Time.sid` | 8580 model reporting; cleared for redistribution ✓ **committed** |
| Rob Hubbard — *Commando* | `MUSICIANS/R/Rob_Hubbard/Commando.sid` | 19 subtunes; control case and subtune stepping under load |
| Geir Tjelta — *Artillery* | `MUSICIANS/G/Geir_Tjelta/Artillery.sid` | Second plain case, different player |
| Martin Galway — *Wizball* | `MUSICIANS/M/Martin_Galway/Wizball.sid` | Speed flags 511 (every subtune CIA-timed) — canonical CIA-timing breaker |
| Martin Galway — *Arkanoid* | `MUSICIANS/M/Martin_Galway/Arkanoid.sid` | RSID v2; assumes real machine, no PSID player shortcuts |
| Ashley Hogg — *CJ in the USA* | `MUSICIANS/C/Cj_In_The_Usa.sid` | The tune DeepSID carries a `$D420` workaround for |
| Cadaver — *Stereotest 2SID* | `MUSICIANS/S/Stereotest_2sid.sid` | PSID v3, second SID at `$D500`; header v3 parsing without multi-chip emission |
| Booker — *Stereo Pendejo 2SID* | `MUSICIANS/S/Stereo_Pendejo_2SID.sid` | Hard mode: three difficulties at once (PSID v3, `$D420`, CIA-timed, 8580). **Diagnostic-only** — failures here are never read as evidence about timing. |

Only the first two are committed (with artist permission). The other seven load via the file picker from your local HVSC #83 collection at `C:\test\HVSC_83-all-of-them\C64Music\`.

## The Listening Protocol

As of version `-0.6`, the host sends no recipe packet and the cartridge runs in pass-through mode. The configuration matrix and comparison results below are historical, preserved as the record of how the `-0` through `-0.5` sessions were run.

### Procedure

Run several minutes per configuration, not seconds. The firmware's published starting points come from `docs/ASID_Player.md` in the TeensyROM hardware repository. Fixed 50 Hz with tiny-to-small buffers is what low-jitter sources use; Web MIDI has historically needed small-to-large on auto, and medium-to-XXL once multispeed is involved.

For each configuration below, play through the tunes in order, pausing at each to listen for audible jitter, clicks, or timing drift:

### Configuration Matrix

**C64-side timer modes** (set in the ASID player menu on the cartridge):
- *off* — plays each packet the moment it arrives, exposing the host's jitter directly
- *auto-seed* — measures the first packets to seed its own timer, then trims
- *fixed 50 Hz* — seeds from an exact constant

**C64-side buffer sizes** (also set on the cartridge):
- Tiny (256 B), Small (512 B), Medium (1024 B), Large (2048 B), XL (4096 B), XXL (8192 B)

**Recipe packet** (toggle in the browser):
- *off* — no recipe; timer mode and buffer are C64-only
- *on* — sends `APT_ContFramerate` (0x31) declaring our frame interval and speed multiplier

**Baseline:** fixed 50 Hz with tiny-to-small buffers and recipe off. This is what the firmware author measured as good. Try to beat it with the recipe, then explore the boundaries.

### What to Watch on the C64 Screen

The cartridge's diagnostics are your oracle. Watch all of these as you play:

- **Buffer-fill bar graph** — shows queue depth in real time. Stable height and smooth motion indicate timing lock. Bottoming out means underrun; topping out means we're falling behind.
- **Per-SID write spinners** — advance with each write packet. Flat means the stream stopped; spin rate shows throughput.
- **25 register-access lights** — one for each of the twenty-five SID register slots. Flash with each `0x4E` packet carrying that slot. A pattern that disappears mid-tune means the encoder or the emulated player crashed.
- **Packet-error indicator** — lights if the cartridge sees malformed SysEx (framing, register count, or message type). **If this stays dark through an entire tune, the encoder is correct.** It is the free oracle of your instrumentation.
- **Read-error indicator** — lights on queue underruns (played out of data while waiting for the next packet). Means the host is too slow or the interval is wrong.

**Note:** The host cannot read the queue-fill register. It is exposed on the C64's data port and the ASID handler never sends MIDI back, so this screen is the only view of it. Trust the lights.

## The Findings Capture Sheet

### Instructions

Record observations as they happen during the session. Findings cannot be reconstructed from memory afterwards. For each question below, note what you heard, which tunes showed the phenomenon, and which configuration was under test.

### The Questions

#### 1. Does the browser hold musical timing over a long playback?

*This is the binding risk in the whole initiative. Everything downstream assumes yes.*

**Observations:** Yes.

---

#### 2. Does the recipe packet close the Web MIDI jitter gap the firmware author measured?

*Whether the transport choice survives contact with hardware.*

**Observations:** Moot: the recipe is no longer in the path, because host-side timestamps closed the gap without it.

---

#### 3. Which timer mode, at which buffer size, sounds best?

*Replaces guesswork with measured defaults.*

**Observations:**

---

#### 4. What is the real control latency, and how does it trade against buffer size?

*Whether this can feel like an instrument at all.*

**Observations:**

---

#### 5. Can a continuous pitch fader coexist with the frame timer, or must it run timer-off?

*Shapes whether smooth speed and locked timing are mutually exclusive.*

**Observations:**

---

#### 6. Does 50.125 Hz versus 50.0 Hz make an audible difference?

*Confirms or overturns D8.*

**Observations:**

---

#### 7. Do two cartridges present distinguishable MIDI ports, and does the display-chars gesture work?

*Confirms D24 and whether deck binding needs custom firmware.*

**Observations:**

---

#### 8. What breaks the emulation, and how fast?

*Sizes the workaround tail. HVSC #83: roughly 10% of tunes set a CIA timer, 5% are RSID.*

**Observations:**

---

#### 9. Does pause/resume leave the chip coherent?

*The first evidence for or against the state-snapshot design in ASID-DJ-3.*

**Observations:**

---

#### 10. How alarming is the SysEx permission prompt in practice?

*Shapes how and when it is requested in the product.*

**Observations:**

---

#### 11. Is Web MIDI's timestamped `send()` honored on this platform?

*Potentially removes a whole class of jitter, and is not currently in the architecture.*

**Observations:** Yes, and well enough that no schedule-ahead margin was required.

---

#### 12. Does `R2`'s software control-register interception sound indistinguishable from what real hardware mute would produce?

*Confirms whether the corrected voice-mute design is sound, or whether the firmware ask needs to happen sooner than planned.*

**Observations:** Yes, indistinguishable from hardware mute.

---

#### 13. How does jump latency (silent-replay time) scale as the target frame approaches the top of the fixed ceiling, and around what frame count?

*Sizes the practical range where frame-indexed cue points and loop handles remain a usable DJ-cueing primitive.*

**Observations:**

---

#### 14. Does the mid-stream full-register snapshot every hop/loop-reentry/scrub jump sends cause the same audible interruption the recipe packet did, or is it clean since it never touches `APT_ContFramerate`?

*A second data point for the pause/resume state-snapshot question (D9), now covering hop, loop-reentry, and scrub jumps together against the recipe packet's known interruption cost.*

**Observations:**

---

#### 15. Does a momentary invert control feel like a performance gesture, or does the punch-in direction turn out to be the one that actually gets used?

*Decides whether the eventual voice channel strip needs both directions as distinct mapped actions.*

**Observations:**

---

#### 16. Is ±25 frames of nudge travel enough to land a missed cue on its transient, and is a one-frame step fine enough to feel exact?

*Sizes the fine-adjustment contract for the real cue and loop features, in the only unit that exists.*

**Observations:**

---

#### 17. Does snapshot-based loop re-entry produce an audible seam?

*Confirms whether a loop can engage without a seam, which is the precondition for hopping between multiple loops later.*

**Observations:**

---

#### 18. Does change detection land on musically real moments across a range of tunes?

*Tests whether the register-stream-derived change signal (F71) tracks what a listener would call a real transition, rather than firing on incidental register noise.*

**Observations:**

---

#### 19. Does the candidate strength ladder sort the way a listener would?

*Confirms that the scoring heuristic for change candidates ranks high-confidence structural moments above noise, matching human judgment across genres.*

**Observations:**

---

#### 20. Do the tunes in the library have findable regular pulses, and how often?

*Determines what proportion of the HVSC repertoire yields a stable tempo signal (F76), sizing the applicability of pulse-based navigation and quantization features.*

**Observations:**

---

#### 21. Does key detection hold up, and on what proportion of tunes does it decline to answer?

*Sizes the reliability of harmonic-content analysis (F73) as a foundation for pitch-shifted mashup matching, and what proportion of tunes need manual override.*

**Observations:**

---

#### 22. Does the similarity square reveal real structure, and does the loop point match the ear?

*Validates that frame-by-frame feature self-similarity (F72) surfaces loop points and structural boundaries where a listener would place them, enabling seamless looping.*

**Observations:**

---

**Note on ASID-DJ-0.8:** This iteration makes the transport act on the loop point and the key without the listening session having been run, so questions 18–22 remain open. The first real sessions under `-0.8` are informal evidence toward them — a consistently early or late loop point will now be *more* audible, not less.

---

#### 23. Does the intro play exactly once before the loop takes over?

*Confirms the loop lifecycle split by ear — an unrepeating intro followed by a repeating lap — rather than only in the frame arithmetic that drives it.*

**Observations:**

---

#### 24. Does the deck stop exactly where the position bar says it will, with repeat off?

*Confirms the ended state and the track end frame it renders agree with what a listener actually hears the deck do.*

**Observations:**

---

#### 25. Is the pre-playback wait tolerable, weighed against the stutter it replaces?

*Weighs the resumable indexing ladder's fixed wait before a tune starts against the mid-tune stutter the previous scan-on-demand design produced.*

**Observations:**

---

### Validation Harnesses And The Measured Baseline

Three scratch harnesses that informed the loop-detection regression and its replacement are committed under `validation/` (a sibling of `src/`, so `pnpm nx test dj-player` never collects them — see that directory's own README for exact commands, inputs, and how to read each one's output). They are diagnostic and grading tools, not part of the suite that gates a commit; running one is always an explicit act.

The stratified-accuracy harness (`validation/stratified-accuracy.spec.ts`) is the closest thing to quantitative evidence toward question 22: across a seeded, stratified sample of 300 HVSC tunes, the shipped detection ladder landed within 5 seconds of the curated song length on **46%** of tunes, or **50%** counting an exact multiple/submultiple of the true length as defensible.

That figure carries two caveats that must travel with it — quoting it alone misrepresents what was measured:

- **The residual disagreement is systematically long, not random.** The detector is understating a real, direction-biased shortfall against the curated lengths, not scattering evenly around them.
- **The recorded run predates a sampler fix.** `buildSample` drew each stratum with replacement at the time this number was measured, so a small stratum could yield the same tune more than once — 24 of the 300 sampled tunes were repeat picks (one tune six times), accounting for 42 of the 300 rows and collapsing the run to 258 distinct tunes, which skews whichever per-cluster breakdown those tunes fell into. The sampler now draws without replacement; this baseline has not been re-measured against the corrected sample and should be read as directional, not as a rerun-and-match target.

---

### Transcription

When the session is complete, transcribe the findings into `ASID-DJ-ITERATIONS.md`'s decision log, superseding any entries in place where these findings overturn something.
