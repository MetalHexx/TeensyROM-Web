import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { logInfo, LogType } from '@teensyrom-nx/utils';
import { DeckRegistry } from '../../deck/deck-registry';
import type { DeckHandle } from '../../deck/deck-registry';
import { NOMINAL_INTERVAL_OPTIONS_US } from '../../engine/dj-player-engine';
import type { EngineStats } from '../../engine/dj-player-engine';
import type { TimingMode } from '../../engine/play-rate';
import { MixerService } from '../../mixer/mixer.service';
import type { KeyDisplayFormat } from '../../mixer/key-display';
import type { SidFile } from '../../sid/sid-file.model';
import {
  tuneIndexKeyConfidenceLabel,
  tuneIndexKeyLabel,
  tuneIndexLengthLabel,
  tuneIndexLoopIsImplausible,
  tuneIndexLoopPeriodLabel,
  tuneIndexLoopStartLabel,
} from '../../analysis/tune-index-readouts';
import type { TuneIndexRate } from '../../analysis/tune-index-readouts';
import { crossDeckDriftMs, formatCrossDeckDrift } from '../cross-deck-drift';

const MICROSECONDS_PER_SECOND = 1_000_000;

/**
 * Off, two sub-frame probes, then a ceiling that reaches well past a single PAL frame (~19.95 ms).
 * Carried over verbatim from the retired per-deck sidebar — see `DjPlayerEngine.setScheduleAhead`.
 */
const SCHEDULE_AHEAD_OPTIONS_MS: readonly number[] = [0, 5, 20, 40, 80, 160];

/** The stall control's starting span — long enough to be heard, short enough not to trip
 *  `MAX_CATCH_UP_US`'s catch-up ceiling in the frame clock on a single press. */
const DEFAULT_STALL_DURATION_MS = 150;

/**
 * The longest stall the control will actually run. The busy-wait is synchronous and uncancellable,
 * so a mistyped `150000` would freeze the tab for two and a half minutes with no way back. This
 * still reaches well past the widest schedule-ahead option (160 ms), which is the span the stall
 * has to out-last to prove anything.
 */
const MAX_STALL_DURATION_MS = 2000;

const EM_DASH = '—';

/**
 * The setup drawer: every field the old per-deck sidebar carried, re-laid as one row per figure with
 * one column per deck — Timing, Tune, Tune Index and Diagnostics, in that order, each a `<table>`
 * reading `DeckRegistry.decks()` in `DECKS` order so two decks can be compared at a glance.
 *
 * A settable figure still renders as its control, never demoted to a readout: the nominal frame
 * interval and Schedule ahead are per-deck `<select>`s — the engine derives the interval from each
 * tune's own PAL/NTSC clock, so it cannot be page-level — and the Tune Index Timing toggle is a
 * `<select>` too. The one page-level exception is the main-thread stall control, moved in here from
 * `DjPocViewComponent`: it is singular because it stalls the one main thread both decks share, and
 * duplicating it per deck would claim an isolation neither deck actually has.
 *
 * The cross-deck drift figure sits at the top of the Diagnostics table, over the first two registered
 * decks — see `crossDeckDriftMs`'s own doc for why no correction is attempted.
 */
@Component({
  selector: 'lib-setup-drawer',
  templateUrl: './setup-drawer.component.html',
  styleUrl: './setup-drawer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetupDrawerComponent {
  private readonly registry = inject(DeckRegistry);
  private readonly mixer = inject(MixerService);

  protected readonly decks = this.registry.decks;
  protected readonly scheduleAheadOptionsMs = SCHEDULE_AHEAD_OPTIONS_MS;
  protected readonly keyDisplayFormat = this.mixer.keyDisplayFormat;

  protected readonly stallDurationMs = signal<number>(DEFAULT_STALL_DURATION_MS);
  protected readonly maxStallDurationMs = MAX_STALL_DURATION_MS;

  /** 'A−B: +12.4 ms' over the first two registered decks, or '—' before a second one exists. */
  protected readonly crossDeckDriftLabel = computed<string>(() => {
    const decks = this.decks();
    if (decks.length < 2) return formatCrossDeckDrift(null, null);
    const [a, b] = decks;
    return formatCrossDeckDrift(
      [a.descriptor.label, b.descriptor.label],
      crossDeckDriftMs(a.engine.stats(), b.engine.stats())
    );
  });

  protected onStallDurationInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(value) && value >= 0) {
      this.stallDurationMs.set(value);
    }
  }

  /**
   * Blocks the main thread synchronously for `stallDurationMs()`, capped at
   * `MAX_STALL_DURATION_MS` — the deliberate stall the resilience claim needs on demand rather than
   * waiting for a real one to land during a session. Every deck's frame clock rides this same
   * thread, so nothing any of them paces can run until the loop below returns — this is the
   * isolation test's negative control: it disturbs every deck together, where a fault confined to
   * one deck must not touch the others.
   *
   * The log line carries the duration actually run, so a clamped value reads as the override it is
   * rather than as the control silently ignoring what was typed.
   */
  protected onStallMainThread(): void {
    const ms = Math.min(this.stallDurationMs(), MAX_STALL_DURATION_MS);
    logInfo(LogType.Debug, `DJ POC: stalling the main thread for ${ms} ms.`);
    const until = performance.now() + ms;
    while (performance.now() < until) {
      // Deliberately empty — a busy-wait is the point, not a bug.
    }
  }

  // --- Timing ---------------------------------------------------------------------------------

  /** An NTSC tune loads an interval of its own, so the selector has to be able to show it even when
   *  it is not one of the fixed PAL options. */
  protected intervalOptionsFor(deck: DeckHandle): readonly number[] {
    const current = deck.engine.nominalIntervalUs();
    return NOMINAL_INTERVAL_OPTIONS_US.includes(current)
      ? NOMINAL_INTERVAL_OPTIONS_US
      : [current, ...NOMINAL_INTERVAL_OPTIONS_US];
  }

  protected onNominalIntervalChange(deck: DeckHandle, event: Event): void {
    deck.engine.setNominalIntervalUs(Number((event.target as HTMLSelectElement).value));
  }

  protected onScheduleAheadChange(deck: DeckHandle, event: Event): void {
    deck.engine.setScheduleAhead(Number((event.target as HTMLSelectElement).value));
  }

  protected frameRateHz(intervalUs: number): string {
    return (MICROSECONDS_PER_SECOND / intervalUs).toFixed(3);
  }

  // --- Tune -------------------------------------------------------------------------------------

  protected tuneFor(deck: DeckHandle): SidFile | null {
    return deck.tuneLoader.currentTune();
  }

  protected anyTuneHasSecondSid(): boolean {
    return this.decks().some((deck) => (this.tuneFor(deck)?.secondSidAddress ?? null) !== null);
  }

  protected anyTuneHasThirdSid(): boolean {
    return this.decks().some((deck) => (this.tuneFor(deck)?.thirdSidAddress ?? null) !== null);
  }

  protected formatLabelFor(deck: DeckHandle): string {
    const tune = this.tuneFor(deck);
    return tune === null ? EM_DASH : `${tune.format} v${tune.version}`;
  }

  protected subtunesLabelFor(deck: DeckHandle): string {
    const tune = this.tuneFor(deck);
    return tune === null ? EM_DASH : `${tune.songs} (starts at ${tune.startSong})`;
  }

  protected clockModelLabelFor(deck: DeckHandle): string {
    const tune = this.tuneFor(deck);
    return tune === null ? EM_DASH : `${tune.clock} / ${tune.model}`;
  }

  protected loadInitPlayLabelFor(deck: DeckHandle): string {
    const tune = this.tuneFor(deck);
    return tune === null
      ? EM_DASH
      : `$${tune.loadAddress.toString(16)} / $${tune.initAddress.toString(16)} / $${tune.playAddress.toString(16)}`;
  }

  protected secondSidLabelFor(deck: DeckHandle): string {
    const address = this.tuneFor(deck)?.secondSidAddress ?? null;
    return address === null ? EM_DASH : `$${address.toString(16)}`;
  }

  protected thirdSidLabelFor(deck: DeckHandle): string {
    const address = this.tuneFor(deck)?.thirdSidAddress ?? null;
    return address === null ? EM_DASH : `$${address.toString(16)}`;
  }

  protected dataSizeLabelFor(deck: DeckHandle): string {
    const tune = this.tuneFor(deck);
    return tune === null ? EM_DASH : `${tune.data.length} bytes`;
  }

  // --- Tune Index ---------------------------------------------------------------------------------

  private rateFor(deck: DeckHandle): TuneIndexRate {
    return { nominalIntervalUs: deck.engine.nominalIntervalUs(), playRate: deck.engine.playRate() };
  }

  protected tuneIndexLengthLabelFor(deck: DeckHandle): string {
    return tuneIndexLengthLabel(deck.tuneIndex.record(), deck.tuneIndex.pending(), this.rateFor(deck));
  }

  protected tuneIndexLoopStartLabelFor(deck: DeckHandle): string {
    return tuneIndexLoopStartLabel(deck.tuneIndex.record(), deck.tuneIndex.pending());
  }

  protected tuneIndexLoopPeriodLabelFor(deck: DeckHandle): string {
    return tuneIndexLoopPeriodLabel(
      deck.tuneIndex.record(),
      deck.tuneIndex.pending(),
      this.rateFor(deck)
    );
  }

  protected tuneIndexLoopIsImplausibleFor(deck: DeckHandle): boolean {
    return tuneIndexLoopIsImplausible(
      deck.tuneIndex.record(),
      deck.tuneIndex.pending(),
      this.rateFor(deck)
    );
  }

  protected tuneIndexKeyLabelFor(deck: DeckHandle): string {
    return tuneIndexKeyLabel(deck.tuneIndex.record(), deck.tuneIndex.pending());
  }

  protected tuneIndexKeyConfidenceLabelFor(deck: DeckHandle): string {
    return tuneIndexKeyConfidenceLabel(deck.tuneIndex.record(), deck.tuneIndex.pending());
  }

  protected tuneIndexTimingModeFor(deck: DeckHandle): TimingMode | null {
    return deck.tuneIndex.record()?.timingMode ?? null;
  }

  protected onTuneIndexTimingModeChange(deck: DeckHandle, event: Event): void {
    const mode = (event.target as HTMLSelectElement).value as TimingMode;
    deck.tuneIndex.setTimingMode(mode);
  }

  /** Page-level, not per-deck — see `MixerService.keyDisplayFormat`'s own doc. */
  protected onKeyDisplayFormatChange(event: Event): void {
    const format = (event.target as HTMLSelectElement).value as KeyDisplayFormat;
    this.mixer.setKeyDisplayFormat(format);
  }

  // --- Diagnostics --------------------------------------------------------------------------------

  protected scheduleAheadLabelFor(deck: DeckHandle): string {
    const ms = deck.engine.scheduleAheadMs();
    return ms === 0 ? 'off' : `${ms} ms`;
  }

  // One SID-data packet goes out per clock tick, so the clock's own measured tick rate is the
  // frame-packet rate; the occasional Start/Stop/Identify control packet is noise against it.
  protected packetsPerSecond(stats: EngineStats): number {
    return stats.measuredMeanIntervalUs > 0 ? MICROSECONDS_PER_SECOND / stats.measuredMeanIntervalUs : 0;
  }

  protected bytesPerSecond(stats: EngineStats): number {
    return stats.packetsSent > 0
      ? this.packetsPerSecond(stats) * (stats.bytesSent / stats.packetsSent)
      : 0;
  }

  protected intervalMeasuredLabelFor(deck: DeckHandle): string {
    const stats = deck.engine.stats();
    return `${stats.measuredMeanIntervalUs.toFixed(1)} µs (${deck.engine.nominalIntervalUs()} µs)`;
  }

  protected jitterLabelFor(deck: DeckHandle): string {
    const stats = deck.engine.stats();
    return `${stats.jitterMs.toFixed(2)} ms / ${stats.worstGapMs.toFixed(1)} ms`;
  }

  protected lagLabelFor(deck: DeckHandle): string {
    const stats = deck.engine.stats();
    return `${stats.meanLagMs.toFixed(1)} ms / ${stats.worstLagMs.toFixed(1)} ms`;
  }

  protected cancelLatencyLabelFor(deck: DeckHandle): string {
    const ms = deck.engine.stats().lastCancelLatencyMs;
    return ms < 0 ? EM_DASH : `${ms.toFixed(1)} ms`;
  }
}
