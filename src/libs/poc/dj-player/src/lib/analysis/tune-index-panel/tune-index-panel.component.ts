import { ChangeDetectionStrategy, Component, computed, inject, Signal } from '@angular/core';
import { DjPlayerEngine } from '../../engine/dj-player-engine';
import { positionBasisFor } from '../../engine/engine-utils';
import { playCallsToSeconds } from '../../engine/play-rate';
import type { TimingMode } from '../../engine/play-rate';
import { TuneIndexService } from '../tune-index.service';
import { PITCH_CLASS_NAMES } from '../key';
import type { TuneIndexRecord } from '../tune-index.model';
import { formatDuration } from '../format';

const ANALYSING_LABEL = 'analysing…';
const UNKNOWN_LABEL = '—';
const NOT_FOUND_LABEL = 'not found';
/** A tune detection proved stops rather than repeats. A completed answer, and a different one from
 *  "no answer" — the two must not both collapse to the same text. */
const ENDED_LABEL = 'ends, no loop';

/** Below this, a byte-verified repeat is almost certainly an ostinato or an idle cycle rather than
 *  the tune's musical loop. Informational only — the loop still arms; see R3's rule in
 *  DjPlayerEngine.setTuneIndex. The bar sits at the top of the range investigation pointed at,
 *  because showing the label on a genuine loop costs nothing and missing one costs the diagnosis
 *  the label exists to give. */
const IMPLAUSIBLE_PERIOD_SECONDS = 15;

/** Either a verified loop worth rendering field by field, or the one placeholder both loop rows show
 *  for every other outcome. */
type LoopReadout =
  | { readonly kind: 'placeholder'; readonly label: string }
  | { readonly kind: 'loop'; readonly startFrame: number; readonly periodFrames: number };

/** '{tonic} {mode} · {camelot}', or the honest answer. Never a key name without the Camelot number
 *  beside it — the wheel is what a DJ mixes on. Reports the native key only; the sounding key stays
 *  the Track Analysis panel's job. */
function keyLabelFor(record: TuneIndexRecord): string {
  const { tonic, mode, camelot } = record;
  return tonic === null || mode === null || camelot === null
    ? 'no clear key'
    : `${PITCH_CLASS_NAMES[tonic]} ${mode} · ${camelot}`;
}

/**
 * The rail's compact, always-visible tune index readout: native length, the detected loop's start and
 * period, key and Camelot number, and the explicit re-arm the scrub-beats-loop rule requires. Reads
 * the same `TuneIndexService` record the engine's own tune index draws from, so this panel and the
 * Track Analysis panel it sits beside can never disagree about the answer.
 *
 * Every duration is derived at display time from the record's frames and the rate currently in force,
 * never from a stored number of seconds — which is what makes the readout follow the Timing selector
 * rather than freeze whatever was in force when the tune was scanned.
 */
@Component({
  selector: 'lib-tune-index-panel',
  templateUrl: './tune-index-panel.component.html',
  styleUrl: './tune-index-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TuneIndexPanelComponent {
  private readonly tuneIndexService = inject(TuneIndexService);
  private readonly engine = inject(DjPlayerEngine);

  protected readonly analysing: Signal<boolean> = this.tuneIndexService.pending;
  protected readonly tuneLoopArmed = this.engine.tuneLoopArmed;

  protected readonly canLoop = computed<boolean>(() => this.engine.tuneLoopOutFrame() !== null);

  private readonly loopReadout = computed<LoopReadout>(() => {
    if (this.analysing()) return { kind: 'placeholder', label: ANALYSING_LABEL };
    const record = this.tuneIndexService.record();
    if (record === null) return { kind: 'placeholder', label: UNKNOWN_LABEL };

    const { loopStartFrame, loopPeriodFrames } = record;
    if (loopStartFrame === null || loopPeriodFrames === null) {
      const label = record.endedAtFrame === null ? NOT_FOUND_LABEL : ENDED_LABEL;
      return { kind: 'placeholder', label };
    }
    return { kind: 'loop', startFrame: loopStartFrame, periodFrames: loopPeriodFrames };
  });

  protected readonly lengthLabel = computed<string>(() => {
    if (this.analysing()) return ANALYSING_LABEL;
    const record = this.tuneIndexService.record();
    if (record === null) return UNKNOWN_LABEL;
    const basis = positionBasisFor(record);
    return basis === null ? NOT_FOUND_LABEL : formatDuration(this.toSeconds(basis));
  });

  protected readonly loopStartLabel = computed<string>(() => {
    const readout = this.loopReadout();
    return readout.kind === 'placeholder' ? readout.label : readout.startFrame.toLocaleString();
  });

  protected readonly loopPeriodLabel = computed<string>(() => {
    const readout = this.loopReadout();
    return readout.kind === 'placeholder'
      ? readout.label
      : formatDuration(this.toSeconds(readout.periodFrames));
  });

  /** R4: a verified loop whose period is short enough to read as an ostinato or an idle cycle rather
   *  than the tune's arrangement. Purely informational — see IMPLAUSIBLE_PERIOD_SECONDS above. */
  protected readonly loopImplausible = computed<boolean>(() => {
    const readout = this.loopReadout();
    return (
      readout.kind === 'loop' && this.toSeconds(readout.periodFrames) < IMPLAUSIBLE_PERIOD_SECONDS
    );
  });

  protected readonly keyLabel = computed<string>(() => {
    if (this.analysing()) return ANALYSING_LABEL;
    const record = this.tuneIndexService.record();
    return record === null ? UNKNOWN_LABEL : keyLabelFor(record);
  });

  protected readonly keyConfidenceLabel = computed<string>(() => {
    if (this.analysing()) return ANALYSING_LABEL;
    const record = this.tuneIndexService.record();
    return record === null ? UNKNOWN_LABEL : record.keyConfidence;
  });

  /** R6's toggle reflects the persisted record — a property of the tune, not the live transport —
   *  and has nothing to show while none is loaded. */
  protected readonly timingMode = computed<TimingMode | null>(
    () => this.tuneIndexService.record()?.timingMode ?? null
  );

  protected onLoopToggle(event: Event): void {
    this.engine.armTuneLoop((event.target as HTMLInputElement).checked);
  }

  protected onTimingModeChange(event: Event): void {
    const mode = (event.target as HTMLSelectElement).value as TimingMode;
    this.tuneIndexService.setTimingMode(mode);
  }

  private toSeconds(frames: number): number {
    return playCallsToSeconds(frames, this.engine.nominalIntervalUs(), this.engine.playRate());
  }
}
