import {
  effect,
  inject,
  Injectable,
  signal,
  untracked,
  type OnDestroy,
  type Signal,
} from '@angular/core';
import { logInfo, logWarn, LogType } from '@teensyrom-nx/utils';
import { ANALYSIS_SCANNER } from './scan-runner';
import type { ScanRequest, ScanResult } from './scan-runner';
import { buildFeatureMatrix } from './frame-features';
import { computeNovelty, DEFAULT_FEATURE_WEIGHTS } from './novelty';
import { computeStructure } from './structure';
import { detectLoop, IDLE_PERIOD_SECONDS, MIN_TAIL_SECONDS } from './loop-detect';
import type { LoopDetectOptions, LoopDetection } from './loop-detect';
import { computePulse, impliedTempo } from './pulse';
import { segmentNotes } from './notes';
import { detectKey } from './key';
import { SharedTuneIndex } from './shared-tune-index';
import { TUNE_INDEX_FORMAT_VERSION } from './tune-index.model';
import type { TuneIndexRecord } from './tune-index.model';
import type { ScanOutput } from './scan-tune';
import { DjPlayerEngine } from '../engine/dj-player-engine';
import { asRounded, playCallsPerSecond } from '../engine/play-rate';
import type { TimingMode } from '../engine/play-rate';
import type { SidFile } from '../sid/sid-file.model';

/** What a load establishes: which file, under which name. `setTune` always writes a fresh object, so
 *  the effect below re-triggers even when the same tune is loaded twice in a session. */
interface TuneIdentity {
  readonly file: SidFile | null;
  readonly filename: string | null;
}

const EMPTY_IDENTITY: TuneIdentity = { file: null, filename: null };

/** Seconds of music per rung. A loop needs roughly two laps to confirm, so the deepest rung sits
 *  well past JUMP_CEILING_SECONDS — the ceiling is the scrub basis, not the detection depth. These
 *  are the depths the Requirements' measured baseline was produced at. */
const SCAN_DEPTH_SECONDS = [90, 210, 450, 750];

/** What one pass down the ladder concludes with: an output to hand the detectors, or a scan failure
 *  the caller should log and let the next load retry. Guard-free — the ladder always runs to
 *  completion, so there is no "abandoned" outcome here; a caller whose own tune moved on mid-run
 *  discards the resolved record itself, after `produceRecord` returns it. */
type LadderOutcome =
  | { readonly kind: 'answered'; readonly output: ScanOutput; readonly loop: LoopDetection }
  | { readonly kind: 'failed'; readonly error: string };

/**
 * Owns the tune index's whole lifecycle for the tune currently loaded in `DjPlayerEngine`: look up
 * the stored record on every genuinely new tune or subtune load, scan in the background on a miss,
 * persist what the scan finds, and publish the answer onto `record()` and into the engine. Deck-
 * host-provided, so its scanner and generation counter are scoped to one deck's own player instance
 * — the same reasoning `TrackAnalysisPanelComponent` uses for its own `ANALYSIS_SCANNER`.
 *
 * Storage reads/writes and the scan ladder itself run through `SharedTuneIndex`, the page-level
 * collaborator every deck shares — that is what lets one deck's scan answer for another deck loading
 * the same tune. The generation guard stays here, on this side of that collaborator: `produceRecord`
 * is guard-free and always runs to completion, and `refreshIndex` applies this instance's own
 * generation check to the record it resolves with, discarding it if this deck's own tune moved on
 * while the shared run was in flight. A second deck awaiting the same run is unaffected — it applies
 * its own generation, not this one's.
 *
 * Depends on the engine, never the other way around: the engine only stores what this service hands
 * it through `setTuneIndex`, so the dependency runs one way and a back-edge can never form a cycle.
 */
@Injectable()
export class TuneIndexService implements OnDestroy {
  private readonly shared = inject(SharedTuneIndex);
  private readonly scanner = inject(ANALYSIS_SCANNER);
  private readonly engine = inject(DjPlayerEngine);

  private readonly _record = signal<TuneIndexRecord | null>(null);
  readonly record: Signal<TuneIndexRecord | null> = this._record.asReadonly();

  private readonly _pending = signal<boolean>(false);
  /** True while a first-time background scan is in flight — distinct from "detector found nothing". */
  readonly pending: Signal<boolean> = this._pending.asReadonly();

  private readonly identity = signal<TuneIdentity>(EMPTY_IDENTITY);

  private generation = 0;
  private nextRequestId = 0;
  private nextSessionId = 0;

  /** Every `setTune` caller still waiting for an effect run to pick their load up, drained the moment
   *  one does. A list rather than a slot because signal writes coalesce: two loads issued in the same
   *  turn share a single effect run, and a slot would let the second silently displace the first
   *  caller's resolver — hanging it forever. A subtune-only trigger (no `setTune` in between) finds
   *  this empty, so it never resolves a promise it wasn't asked to settle. */
  private pendingSettles: (() => void)[] = [];

  constructor() {
    // A subtune step is different music from the tune it steps away from, and a fresh load replaces
    // the file outright; play, pause and stop touch neither signal below, so this effect stays inert
    // across them.
    effect(() => {
      const tune = this.identity();
      const subtune = this.engine.currentSubtune();
      // The refresh reads `engine.nominalIntervalUs()` and `engine.playRate()` to size each rung —
      // both signals the Timing selector writes on every speed change. Read outside `untracked`,
      // that becomes a third, unwanted trigger for this effect.
      untracked(() => {
        const settles = this.pendingSettles;
        this.pendingSettles = [];
        void this.refresh(tune.file, tune.filename, subtune, settles);
      });
    });
  }

  /** Called by the view on every tune load. Resolves once the record for this tune has been published —
   *  on a cache hit, on a completed scan, and equally on a failed or abandoned one. Loads issued so close
   *  together that they coalesce into one effect run resolve together, on the outcome of the last one.
   *  Never rejects: a load path that hangs on a failed scan is worse than one that starts playback with
   *  no index. */
  setTune(file: SidFile | null, filename: string | null): Promise<void> {
    return new Promise<void>((resolve) => {
      this.pendingSettles.push(resolve);
      this.identity.set({ file, filename });
    });
  }

  /**
   * R6's timing escape hatch: rewrites the current record with `mode` and republishes it — no
   * re-scan, since the record already carries both rates. A no-op when nothing is indexed yet.
   *
   * Goes through `engine.setTuneIndex`, never `engine.timingMode.set` or `engine.setTimingMode`
   * directly — `setTuneIndex` is what re-resolves the clock, so it is what makes the change audible.
   */
  setTimingMode(mode: TimingMode): void {
    const current = this.record();
    if (current === null) {
      return;
    }
    const updated: TuneIndexRecord = { ...current, timingMode: mode };
    this.shared.save(updated);
    this._record.set(updated);
    this.engine.setTuneIndex(updated);
  }

  ngOnDestroy(): void {
    this.scanner.dispose();
  }

  /**
   * Refreshes the index for the incoming tune and releases every caller that was waiting on this run,
   * whatever it concluded — a hit, a completed scan, a failed one, an abandoned one, or a throw out of
   * a detector or storage. The release sits in a `finally` rather than on each of the outcome paths so
   * that a new one cannot be added that forgets it: a hung load path is silent, has no error and no
   * timeout, and is worse than playback that starts with no index.
   */
  private async refresh(
    file: SidFile | null,
    filename: string | null,
    subtune: number,
    settles: readonly (() => void)[]
  ): Promise<void> {
    try {
      await this.refreshIndex(file, filename, subtune);
    } finally {
      for (const settle of settles) {
        settle();
      }
    }
  }

  /** The refresh itself: retire the outgoing tune's answer, then hydrate from cache or produce the
   *  record for the incoming one — shared with every other deck loading the same tune. Every exit is
   *  an outcome its caller releases the load path on. */
  private async refreshIndex(
    file: SidFile | null,
    filename: string | null,
    subtune: number
  ): Promise<void> {
    this.generation++;
    const generation = this.generation;
    // A stale answer describing the outgoing tune must never survive one frame into the incoming one.
    this._record.set(null);
    this._pending.set(false);
    this.engine.setTuneIndex(null);

    if (file === null || filename === null) {
      return;
    }

    const hit = this.shared.load(filename, subtune);
    if (hit !== null) {
      // A cache hit hydrates instantly — no scan at all, so the waiting load is released this turn.
      this._record.set(hit);
      this.engine.setTuneIndex(hit);
      return;
    }

    this._pending.set(true);
    const record = await this.shared.produceOnce(filename, subtune, () =>
      this.produceRecord(file, filename, subtune)
    );

    if (generation !== this.generation) {
      // This deck's own tune or subtune changed while the shared run was in flight; the record it
      // resolved with describes music that is no longer loaded here. A newer refresh has already
      // reset `pending` for its own tune, so this one must not touch it. The caller that awaited this
      // load is still released, though — it is superseded, not stuck. Any other deck still awaiting
      // this exact run applies its own generation check and is unaffected by this one moving on.
      return;
    }
    this._pending.set(false);

    if (record === null) {
      // A failed scan is not a cached "no answer" — the next load of this tune should try again.
      return;
    }

    this._record.set(record);
    this.engine.setTuneIndex(record);
  }

  /**
   * Runs the scan ladder to conclusion and builds the `TuneIndexRecord` it answers with, persisting
   * it through the shared collaborator — or returns `null` when the ladder failed. This is the
   * function `refreshIndex` hands to `SharedTuneIndex.produceOnce`, so it runs at most once per
   * `(filename, subtune)` no matter how many decks are waiting on it.
   *
   * Deliberately guard-free: unlike `refreshIndex`, nothing here checks whether *this* deck's own
   * tune has since moved on, because another deck may be genuinely still waiting on this exact
   * answer for a tune it never abandoned. The generation check that discards a superseded answer
   * lives in `refreshIndex`, on the resolved record, once each caller's own wait is over.
   */
  private async produceRecord(
    file: SidFile,
    filename: string,
    subtune: number
  ): Promise<TuneIndexRecord | null> {
    const ladder = await this.runLadder(file, subtune);

    if (ladder.kind === 'failed') {
      logWarn(`TuneIndexService: scan failed for ${filename}:${subtune}: ${ladder.error}`);
      return null;
    }

    // The detectors run in the same order TrackAnalysisPanelComponent.runAnalysis uses.
    const output = ladder.output;
    const matrix = buildFeatureMatrix(output);
    const novelty = computeNovelty(matrix, DEFAULT_FEATURE_WEIGHTS);
    const structure = computeStructure(matrix, DEFAULT_FEATURE_WEIGHTS);
    const loop = ladder.loop;
    const pulse = computePulse(novelty.candidates);
    const key = detectKey(segmentNotes(output, file.clock));
    const playRate = this.engine.playRate();
    const { native } = impliedTempo(
      pulse.dominantInterval,
      this.engine.nominalIntervalUs(),
      output.callsPerFrame,
      1
    );

    const record: TuneIndexRecord = {
      filename,
      subtune,
      loopStartFrame: loop.kind === 'loop' ? loop.startFrame : null,
      loopPeriodFrames: loop.kind === 'loop' ? loop.periodFrames : null,
      endedAtFrame: loop.kind === 'ended' ? loop.endFrame : null,
      sectionBoundaries: structure.sectionBoundaries,
      tonic: key.tonic,
      mode: key.mode,
      camelot: key.camelot,
      tuningReferenceHz: key.tuning?.referenceHz ?? null,
      tuningCents: key.tuning?.cents ?? null,
      keyConfidence: key.confidence,
      scalePitchClasses: key.scalePitchClasses,
      // Off the ScanOutput, not the engine's machine: a multispeed tune calls the play routine more
      // than once per video frame, and every length and tempo derived later is wrong by that integer
      // factor if the record carries the wrong one.
      dominantIntervalFrames: pulse.dominantInterval,
      pulseConfidence: pulse.confidence,
      nativeTempo: native,
      callsPerFrame: output.callsPerFrame,
      // The ScanOutput carries only the rounded rate, so the un-rounded one has to come off the
      // engine — without it the Timing toggle could not flip a cached tune without a re-scan. Read
      // off this producing deck's engine, but valid for either deck: see the class doc's note on
      // rate-derived fields.
      exactCallsPerFrame: playRate.exactCallsPerFrame,
      timingMode: this.engine.timingMode(),
      formatVersion: TUNE_INDEX_FORMAT_VERSION,
      computedAt: new Date().toISOString(),
    };

    this.shared.save(record);
    logInfo(LogType.Success, `TuneIndexService: indexed ${filename}:${subtune}.`);
    return record;
  }

  /**
   * Scans `SCAN_DEPTH_SECONDS` deepest-first-stopping-shallowest: each rung hands its output to
   * `detectLoop`, and the ladder stops at the first rung that answers. Exhausting every rung without
   * an answer still counts as answered, with `loop.kind` `'none'`, so the caller writes a null record
   * rather than looping forever.
   *
   * Every rung carries one session id, which is what lets the scanner continue the previous rung's
   * emulation rather than replaying from init — the id, not the file, because the file crosses the
   * thread boundary as a fresh copy each time. A new ladder means a new session, so a rung can never
   * deepen a scan of different music.
   *
   * Guard-free: a run here always continues to the deepest rung it needs, whatever any deck's own
   * generation does meanwhile — see the class doc. Only a genuine scan failure ends it early.
   */
  private async runLadder(file: SidFile, subtune: number): Promise<LadderOutcome> {
    let lastOutput: ScanOutput | undefined;
    let lastLoop: LoopDetection = { kind: 'none' };
    const session = ++this.nextSessionId;

    for (const depthSeconds of SCAN_DEPTH_SECONDS) {
      const request: ScanRequest = {
        id: ++this.nextRequestId,
        session,
        file,
        subtune,
        maxFrames: this.scanDepthFrames(depthSeconds),
      };
      const result: ScanResult = await this.scanner.scan(request);

      if (result.kind === 'failed') {
        return { kind: 'failed', error: result.error };
      }

      lastOutput = result.output;
      lastLoop = detectLoop(lastOutput, this.loopDetectOptions());
      if (lastLoop.kind !== 'none') {
        break;
      }
    }

    if (lastOutput === undefined) {
      // SCAN_DEPTH_SECONDS is never empty, so this never actually happens — the guard exists only to
      // satisfy narrowing.
      return { kind: 'failed', error: 'the scan ladder produced no output' };
    }
    return { kind: 'answered', output: lastOutput, loop: lastLoop };
  }

  /** One rung's depth, in play calls. Converted against the **rounded** rate, for the same reason
   *  `loopDetectOptions` is — the ladder's depths are emulation budgets, not real-time durations. */
  private scanDepthFrames(seconds: number): number {
    const perSecond = playCallsPerSecond(
      this.engine.nominalIntervalUs(),
      asRounded(this.engine.playRate())
    );
    return Math.round(seconds * perSecond);
  }

  /**
   * The detector's seconds-valued constants in frames.
   *
   * Converted against the **rounded** rate, never the mode-selected one. Both guards are emulation
   * budgets rather than real-time durations, and the measured detection baseline was produced against
   * the rounded rate — converting through the exact rate would shift the effective thresholds by up to
   * ~20% on a CIA-timer tune and quietly invalidate the numbers the detector is graded against.
   */
  private loopDetectOptions(): LoopDetectOptions {
    const perSecond = playCallsPerSecond(
      this.engine.nominalIntervalUs(),
      asRounded(this.engine.playRate())
    );
    return {
      minTailFrames: Math.round(MIN_TAIL_SECONDS * perSecond),
      idlePeriodFrames: Math.round(IDLE_PERIOD_SECONDS * perSecond),
    };
  }
}
