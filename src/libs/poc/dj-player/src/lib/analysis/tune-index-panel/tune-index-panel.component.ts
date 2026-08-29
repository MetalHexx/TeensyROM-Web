import { ChangeDetectionStrategy, Component, computed, inject, Signal } from '@angular/core';
import { DjPlayerEngine } from '../../engine/dj-player-engine';
import { TuneIndexService } from '../tune-index.service';
import { PITCH_CLASS_NAMES } from '../key';
import type { TuneIndexRecord } from '../tune-index.model';
import { formatDuration } from '../format';

const ANALYSING_LABEL = 'analysing…';
const UNKNOWN_LABEL = '—';

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
 * The rail's compact, always-visible tune index readout: native length, key and Camelot number, a
 * confidence for each, and the explicit re-arm the scrub-beats-loop rule requires. Reads the same
 * `TuneIndexService` record the engine's own tune index draws from, so this panel and the Track
 * Analysis panel it sits beside can never disagree about the answer.
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

  protected readonly canLoop = computed<boolean>(() => this.engine.tuneLoopFrame() !== null);

  protected readonly lengthLabel = computed<string>(() => {
    if (this.analysing()) return ANALYSING_LABEL;
    const record = this.tuneIndexService.record();
    if (record === null) return UNKNOWN_LABEL;
    return record.nativeLengthSeconds === null
      ? 'not found'
      : formatDuration(record.nativeLengthSeconds);
  });

  protected readonly keyLabel = computed<string>(() => {
    if (this.analysing()) return ANALYSING_LABEL;
    const record = this.tuneIndexService.record();
    return record === null ? UNKNOWN_LABEL : keyLabelFor(record);
  });

  protected readonly loopConfidenceLabel = computed<string>(() =>
    this.confidenceLabel((record) => record.structureConfidence)
  );

  protected readonly keyConfidenceLabel = computed<string>(() =>
    this.confidenceLabel((record) => record.keyConfidence)
  );

  protected onLoopToggle(event: Event): void {
    this.engine.armTuneLoop((event.target as HTMLInputElement).checked);
  }

  private confidenceLabel(pick: (record: TuneIndexRecord) => string): string {
    if (this.analysing()) return ANALYSING_LABEL;
    const record = this.tuneIndexService.record();
    return record === null ? UNKNOWN_LABEL : pick(record);
  }
}
