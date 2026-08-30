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
import type { LoopDetectOptions } from './loop-detect';
import { computePulse, impliedTempo } from './pulse';
import { segmentNotes } from './notes';
import { detectKey } from './key';
import { TUNE_INDEX_STORAGE } from './tune-index-storage';
import { TUNE_INDEX_FORMAT_VERSION } from './tune-index.model';
import type { TuneIndexRecord } from './tune-index.model';
import { DjPlayerEngine } from '../engine/dj-player-engine';
import { asRounded, playCallsPerSecond } from '../engine/play-rate';
import type { SidFile } from '../sid/sid-file.model';

/** What a load establishes: which file, under which name. `setTune` always writes a fresh object, so
 *  the effect below re-triggers even when the same tune is loaded twice in a session. */
interface TuneIdentity {
  readonly file: SidFile | null;
  readonly filename: string | null;
}

const EMPTY_IDENTITY: TuneIdentity = { file: null, filename: null };

/**
 * Owns the tune index's whole lifecycle for the tune currently loaded in `DjPlayerEngine`: look up
 * the stored record on every genuinely new tune or subtune load, scan in the background on a miss,
 * persist what the scan finds, and publish the answer onto `record()` and into the engine. View-
 * provided, so its scanner and generation counter are scoped to one player instance — the same
 * reasoning `TrackAnalysisPanelComponent` uses for its own `ANALYSIS_SCANNER`.
 *
 * Depends on the engine, never the other way around: the engine only stores what this service hands
 * it through `setTuneIndex`, so the dependency runs one way and a back-edge can never form a cycle.
 */
@Injectable()
export class TuneIndexService implements OnDestroy {
  private readonly storage = inject(TUNE_INDEX_STORAGE);
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

  constructor() {
    // A subtune step is different music from the tune it steps away from, and a fresh load replaces
    // the file outright; play, pause and stop touch neither signal below, so this effect stays inert
    // across them.
    effect(() => {
      const tune = this.identity();
      const subtune = this.engine.currentSubtune();
      // The refresh reads `engine.ceilingFrames()`, a computed over `nominalIntervalUs` — a signal
      // the Timing selector writes on every speed change. Read outside `untracked`, that becomes a
      // third, unwanted trigger for this effect.
      untracked(() => {
        void this.refresh(tune.file, tune.filename, subtune);
      });
    });
  }

  /** Called by the view on every tune load; `filename` is the bundled label or the picker's file.name. */
  setTune(file: SidFile | null, filename: string | null): void {
    this.identity.set({ file, filename });
  }

  ngOnDestroy(): void {
    this.scanner.dispose();
  }

  private async refresh(
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

    const hit = this.storage.load(filename, subtune);
    if (hit !== null) {
      this._record.set(hit);
      this.engine.setTuneIndex(hit);
      return; // a cache hit hydrates instantly — no scan at all
    }

    this._pending.set(true);
    const request: ScanRequest = {
      id: ++this.nextRequestId,
      file,
      subtune,
      maxFrames: this.engine.ceilingFrames(),
    };
    const result: ScanResult = await this.scanner.scan(request);

    if (generation !== this.generation) {
      // The tune or subtune changed while the scan was in flight; this answer describes music that
      // is no longer loaded.
      return;
    }
    this._pending.set(false);

    if (result.kind === 'failed') {
      // A failed scan is not a cached "no answer" — the next load of this tune should try again.
      logWarn(`TuneIndexService: scan failed for ${filename}:${subtune}: ${result.error}`);
      return;
    }

    // The detectors run in the same order TrackAnalysisPanelComponent.runAnalysis uses.
    const output = result.output;
    const matrix = buildFeatureMatrix(output);
    const novelty = computeNovelty(matrix, DEFAULT_FEATURE_WEIGHTS);
    const structure = computeStructure(matrix, DEFAULT_FEATURE_WEIGHTS);
    const loop = detectLoop(output, this.loopDetectOptions());
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
      // engine — without it the Timing toggle could not flip a cached tune without a re-scan.
      exactCallsPerFrame: playRate.exactCallsPerFrame,
      timingMode: this.engine.timingMode(),
      formatVersion: TUNE_INDEX_FORMAT_VERSION,
      computedAt: new Date().toISOString(),
    };

    this.storage.save(record);
    this._record.set(record);
    this.engine.setTuneIndex(record);
    logInfo(LogType.Success, `TuneIndexService: indexed ${filename}:${subtune}.`);
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
