import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { DeckDescriptor } from '../../deck/deck.config';
import { DeckRegistry } from '../../deck/deck-registry';
import { ChannelFaderComponent } from '../channel-fader/channel-fader.component';
import { FilterModeSelectorComponent } from '../filter-mode-selector/filter-mode-selector.component';
import { keyDisplayFor } from '../key-display';
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
  private readonly deckRegistry = inject(DeckRegistry);

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

  /** This strip's own deck's collaborators, reached through the page-level registry — a
   *  `DeckStripComponent` sits outside the deck host's own injector, so it cannot inject
   *  `TuneIndexService` directly. `null` before that deck's host has registered. */
  private readonly deckHandle = computed(
    () => this.deckRegistry.decks().find((handle) => handle.descriptor.id === this.deck().id) ?? null
  );

  /** The tune's detected key transposed by the Key knob's own offset, formatted per the operator's
   *  `MixerService.keyDisplayFormat` preference — so turning the knob shows the key it's actually
   *  tuning *to*, letting two decks be dialed to the same key for harmonic mixing. `null` with no
   *  confident detection, in which case `keyReadout` falls back to the plain semitone-offset text. */
  private readonly detectedKeyDisplay = computed(() =>
    keyDisplayFor(
      this.deckHandle()?.tuneIndex.record() ?? null,
      this.mixer.keyDisplayFormat(),
      this.keySemitones()
    )
  );

  /** The tune's detected (and knob-transposed) key when one is known with confidence, else the
   *  signed semitone offset Key otherwise renders under its dial. */
  protected readonly keyReadout = computed(() => {
    const display = this.detectedKeyDisplay();
    if (display) return display;
    const semitones = this.keySemitones();
    return semitones === 0 ? '0' : semitones > 0 ? `+${semitones}` : `${semitones}`;
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
