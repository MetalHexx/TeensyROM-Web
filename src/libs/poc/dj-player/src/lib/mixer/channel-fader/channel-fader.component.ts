import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { DeckDescriptor } from '../../deck/deck.config';
import { MixerService } from '../mixer.service';

/**
 * One deck's own gain fader, rendered vertically. Reads and writes `MixerService.deckFader` for the
 * deck it serves, with no local copy of the value, so the control and the model cannot drift apart.
 * `MixerService` is provided page-level, one level up, so a write here lands on the same instance a
 * deck host's gain effect reads from.
 */
@Component({
  selector: 'lib-channel-fader',
  templateUrl: './channel-fader.component.html',
  styleUrl: './channel-fader.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChannelFaderComponent {
  private readonly mixer = inject(MixerService);

  readonly deck = input.required<DeckDescriptor>();

  protected readonly gain = computed(() => this.mixer.deckFader(this.deck().id)());
  protected readonly accessibleName = computed(() => `Channel fader deck ${this.deck().label}`);

  /** `step="0.01"` is the input's own granularity; the model stores whatever value arrives and never
   *  re-rounds it. */
  protected onGainInput(event: Event): void {
    this.mixer.setDeckFader(this.deck().id, Number((event.target as HTMLInputElement).value));
  }
}
