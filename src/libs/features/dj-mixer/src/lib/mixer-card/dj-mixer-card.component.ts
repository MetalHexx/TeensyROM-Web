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
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { map } from 'rxjs/operators';
import {
  DjStore,
  MixerService,
  type KeyDisplayFormat,
  type Slot,
} from '@teensyrom-nx/application';
import {
  CrossfaderComponent,
  DeckStripComponent,
  IconButtonComponent,
  ScalingCompactCardComponent,
  type DeckStripModel,
} from '@teensyrom-nx/ui/components';
import type { DeckRef } from '../deck-ref';

/**
 * The travel shared by every channel fader and by the crossfader: the card's own content width,
 * which is the view grid's definite `--mixer-col` track less this card's own padding. 148px at
 * desktop — the wireframe's fader length and crossfader track length, which are the same number.
 * Derived rather than measured because a container query would need inline-size containment, and
 * that would zero the card's intrinsic width.
 */
const FADER_LENGTH =
  'calc(var(--mixer-col) - 2 * var(--compact-card-padding, var(--spacing-card-padding-compact)))';

/**
 * `$bp-tablet` is 1280px in `_mixins.scss`; below it this card's own stylesheet switches to the
 * band form. A template can't read its own media query, so the one place that needs the answer in
 * TypeScript observes the same breakpoint.
 */
const BELOW_TABLET = '(max-width: 1279px)';

type MixerKnob = 'cutoff' | 'resonance' | 'pulseWidth';

/** The strip's `knobChange` id is an opaque string; this is the one place it is narrowed. */
function isMixerKnob(id: string): id is MixerKnob {
  return id === 'cutoff' || id === 'resonance' || id === 'pulseWidth';
}

/** The key-notation switch's two buttons, in render order. */
const KEY_FORMAT_OPTIONS: readonly { readonly format: KeyDisplayFormat; readonly label: string }[] = [
  { format: 'camelot', label: 'Camelot' },
  { format: 'note', label: 'Note' },
];

@Component({
  selector: 'lib-dj-mixer-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'grid-area: mx' },
  imports: [
    ScalingCompactCardComponent,
    DeckStripComponent,
    CrossfaderComponent,
    IconButtonComponent,
  ],
  templateUrl: './dj-mixer-card.component.html',
  styleUrl: './dj-mixer-card.component.scss',
})
export class DjMixerCardComponent {
  private readonly djStore = inject(DjStore);
  private readonly mixerService = inject(MixerService);

  readonly decks = input.required<readonly DeckRef[]>();
  readonly showCrossfader = input.required<boolean>();

  /** Whether the bindings panel is open: the button's pressed look and its accessible name. */
  readonly bindingsOpen = input<boolean>(false);

  /** Emits when the Bindings button is pressed, to open or close the panel. */
  readonly bindingsToggle = output<void>();

  private readonly bindingsRow = viewChild<ElementRef<HTMLElement>>('bindingsRow');

  /** Each deck paired with the strip model built from its store values. */
  readonly strips = computed(() =>
    this.decks().map((deck) => ({ deck, model: this.stripModel(deck) }))
  );

  readonly crossfader = this.djStore.crossfader;
  readonly keyDisplayFormat = this.djStore.keyDisplayFormat;
  readonly keyFormatOptions = KEY_FORMAT_OPTIONS;

  readonly firstLetter = computed(() => this.decks()[0]?.letter ?? '');
  readonly lastLetter = computed(() => this.decks()[this.decks().length - 1]?.letter ?? '');
  readonly crossfaderName = computed(
    () => `Crossfader, deck ${this.firstLetter()} to deck ${this.lastLetter()}`
  );

  private readonly belowTablet = toSignal(
    inject(BreakpointObserver)
      .observe(BELOW_TABLET)
      .pipe(map((state) => state.matches)),
    { initialValue: false }
  );

  /** True in the vertical form the definite `--mixer-col` track exists for. */
  readonly columnForm = computed(() => !this.belowTablet());

  /**
   * The pinned travel in the column form, `null` everywhere else — the band and stacked forms keep
   * a fluid crossfader and a floor-based channel fader instead.
   */
  readonly faderLength = computed<string | null>(() => (this.columnForm() ? FADER_LENGTH : null));

  /** Moves keyboard focus to the Bindings button. */
  focusBindingsButton(): void {
    this.bindingsRow()?.nativeElement.querySelector('button')?.focus();
  }

  onKnobChange(slot: Slot, change: { id: string; value: number }): void {
    if (change.id === 'key') {
      this.mixerService.setKeySemitones(slot, change.value);
    } else if (isMixerKnob(change.id)) {
      this.mixerService.setKnob(slot, change.id, change.value);
    }
  }

  onFaderChange(slot: Slot, level: number): void {
    this.mixerService.setLevel(slot, level);
  }

  onCrossfaderChange(position: number): void {
    this.mixerService.setCrossfader(position);
  }

  onKeyFormatSelect(format: KeyDisplayFormat): void {
    this.mixerService.setKeyDisplayFormat(format);
  }

  private stripModel({ slot, letter }: DeckRef): DeckStripModel {
    const mix = this.djStore.deckMix(slot)();
    const disabled = !this.djStore.canShape(slot)();
    const keyReadout = this.djStore.keyReadout(slot)();

    return {
      knobs: [
        {
          id: 'cutoff',
          label: 'Cutoff',
          accessibleName: `Cutoff deck ${letter}`,
          value: mix.cutoff,
          disabled,
        },
        {
          id: 'resonance',
          label: 'Resonance',
          accessibleName: `Resonance deck ${letter}`,
          value: mix.resonance,
          min: 0,
          max: 1,
          home: 0,
          disabled,
        },
        {
          id: 'pulseWidth',
          label: 'Pulse width',
          accessibleName: `Pulse width deck ${letter}`,
          value: mix.pulseWidth,
          disabled,
        },
        {
          id: 'key',
          label: 'Key',
          accessibleName: `Key deck ${letter}`,
          value: mix.keySemitones,
          min: -12,
          max: 12,
          step: 1,
          readout: keyReadout,
          disabled,
        },
      ],
      fader: { value: mix.level, label: letter, accessibleName: `Gain deck ${letter}` },
    };
  }
}
