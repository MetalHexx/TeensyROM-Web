import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { DeckDescriptor } from '../../deck/deck.config';
import { ChannelFaderComponent } from '../channel-fader/channel-fader.component';
import { FilterModeSelectorComponent } from '../filter-mode-selector/filter-mode-selector.component';
import { MixerService } from '../mixer.service';
import type { ScaleControl } from '../mixer.service';
import { KEY_SEMITONE_RANGE } from '../scale-taper';
import { ScaleKnobComponent } from '../scale-knob/scale-knob.component';

/**
 * One deck's whole control strip, top to bottom: filter mode, the four scale knobs (Cutoff,
 * Resonance, Pulse Width, Key), then the deck's own channel fader. Every control binds straight to
 * `MixerService` for the deck it serves — this component holds no state of its own; it only
 * composes and names the controls. Composed once per `DECKS` entry by `MixerColumnComponent`, so
 * nothing here assumes exactly two decks.
 */
@Component({
  selector: 'lib-deck-strip',
  templateUrl: './deck-strip.component.html',
  styleUrl: './deck-strip.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FilterModeSelectorComponent, ScaleKnobComponent, ChannelFaderComponent],
})
export class DeckStripComponent {
  private readonly mixer = inject(MixerService);

  readonly deck = input.required<DeckDescriptor>();

  protected readonly keyMin = -KEY_SEMITONE_RANGE;
  protected readonly keyMax = KEY_SEMITONE_RANGE;

  protected readonly cutoff = computed(() => this.mixer.scalePosition(this.deck().id, 'cutoff')());
  protected readonly resonance = computed(() =>
    this.mixer.scalePosition(this.deck().id, 'resonance')()
  );
  protected readonly pulseWidth = computed(() =>
    this.mixer.scalePosition(this.deck().id, 'pulseWidth')()
  );
  protected readonly keySemitones = computed(() => this.mixer.keySemitones(this.deck().id)());

  /** The signed semitone offset Key alone renders under its dial — arithmetic the operator has to
   *  be able to read to match against the tune's own key. */
  protected readonly keyReadout = computed(() => {
    const semitones = this.keySemitones();
    return semitones > 0 ? `+${semitones}` : `${semitones}`;
  });

  protected accessibleName(label: string): string {
    return `${label} deck ${this.deck().label}`;
  }

  protected onScaleChange(control: ScaleControl, value: number): void {
    this.mixer.setScalePosition(this.deck().id, control, value);
  }

  protected onKeyChange(value: number): void {
    this.mixer.setKeySemitones(this.deck().id, value);
  }
}
