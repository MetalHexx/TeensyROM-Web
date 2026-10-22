import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  computed,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import {
  DjStore,
  MixerService,
  PANEL_RANGES,
  type KeyDisplayFormat,
  type Slot,
} from '@teensyrom-nx/application';
import {
  IconButtonComponent,
  RotaryKnobComponent,
  ScalingCompactCardComponent,
} from '@teensyrom-nx/ui/components';
import type { DeckRef } from '../deck-ref';

/** The key-notation switch's two buttons, in render order. */
const KEY_FORMAT_OPTIONS: readonly { readonly format: KeyDisplayFormat; readonly label: string }[] =
  [
    { format: 'camelot', label: 'Camelot' },
    { format: 'note', label: 'Note' },
  ];

/**
 * The mixer card: the Bindings button, the Camelot / Note switch and one Key knob per deck. The
 * SID panel's own controls replace this card's body.
 */
@Component({
  selector: 'lib-dj-mixer-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'grid-area: mx' },
  imports: [ScalingCompactCardComponent, RotaryKnobComponent, IconButtonComponent],
  templateUrl: './dj-mixer-card.component.html',
  styleUrl: './dj-mixer-card.component.scss',
})
export class DjMixerCardComponent {
  private readonly djStore = inject(DjStore);
  private readonly mixerService = inject(MixerService);

  readonly decks = input.required<readonly DeckRef[]>();

  /** Whether the bindings panel is open: the button's pressed look and its accessible name. */
  readonly bindingsOpen = input<boolean>(false);

  /** Emits when the Bindings button is pressed, to open or close the panel. */
  readonly bindingsToggle = output<void>();

  private readonly bindingsRow = viewChild<ElementRef<HTMLElement>>('bindingsRow');

  readonly keyRange = PANEL_RANGES.key;

  /** Each deck paired with what its Key knob shows, built from its store values. */
  readonly keys = computed(() =>
    this.decks().map((deck) => ({
      deck,
      value: this.djStore.deckPanel(deck.slot)().keySemitones,
      readout: this.djStore.keyReadout(deck.slot)(),
      disabled: !this.djStore.canShape(deck.slot)(),
    }))
  );

  readonly keyDisplayFormat = this.djStore.keyDisplayFormat;
  readonly keyFormatOptions = KEY_FORMAT_OPTIONS;

  /** Moves keyboard focus to the Bindings button. */
  focusBindingsButton(): void {
    this.bindingsRow()?.nativeElement.querySelector('button')?.focus();
  }

  onKeyChange(slot: Slot, semitones: number): void {
    this.mixerService.setKeySemitones(slot, semitones);
  }

  onKeyFormatSelect(format: KeyDisplayFormat): void {
    this.mixerService.setKeyDisplayFormat(format);
  }
}
