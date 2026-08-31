import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DECKS } from '../../deck/deck.config';
import { MixerService } from '../mixer.service';

/**
 * The fader and its end labels only — no per-deck gain fader, no curve selector, no curve preview,
 * and no numeric readout of the resulting register value. `MixerService` is provided page-level, one
 * level up, so every deck's own gain reads the same crossfader position this writes.
 *
 * Rendered inside `MixerColumnComponent`, beneath the reserved region.
 */
@Component({
  selector: 'lib-crossfader',
  templateUrl: './crossfader.component.html',
  styleUrl: './crossfader.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CrossfaderComponent {
  private readonly mixer = inject(MixerService);

  protected readonly position = this.mixer.crossfaderPosition;
  protected readonly labelA = DECKS[0]?.label ?? '';
  protected readonly labelB = DECKS[1]?.label ?? '';

  /** `step="0.01"` is the input's own granularity; the model stores whatever value arrives and never
   *  re-rounds it. */
  protected onPositionInput(event: Event): void {
    this.mixer.setCrossfaderPosition(Number((event.target as HTMLInputElement).value));
  }
}
